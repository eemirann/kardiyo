const express = require('express');
const { z } = require('zod');
const { query, withTransaction } = require('../config/db');
const {
  asyncHandler,
  validate,
  notFound,
  premiumRequired,
  badRequest,
} = require('../utils/http');
const { requireAuth, optionalAuth, hasPremiumAccess } = require('../middleware/auth');
const { recordAttempt } = require('../services/scoring');
const { checkAndAwardBadges } = require('../services/badgeEngine');

const router = express.Router();

/**
 * Soruyu kullaniciya gonderilebilir hale getirir.
 * DIKKAT: is_correct ve explanation buradan ASLA donmez; sadece cevap verildikten
 * sonra /answer yanitinda paylasilir.
 */
function toPublicQuestion(row, options) {
  return {
    id: row.id,
    topicId: row.topic_id,
    topicName: row.topic_name,
    topicSlug: row.topic_slug,
    type: row.type,
    difficulty: row.difficulty,
    body: row.body,
    isPremium: row.is_premium,
    alreadySolved: row.already_solved ?? false,
    options: options.map((o) => ({ id: o.id, label: o.label, text: o.text })),
  };
}

const listSchema = z.object({
  topic: z.string().trim().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  unsolved: z.enum(['1', 'true']).optional(),
});

/** Soru listesi (siklar dahil, dogru sik gizli). */
router.get(
  '/',
  optionalAuth,
  validate(listSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { topic, difficulty, limit, offset, unsolved } = req.query;
    const userId = req.user?.id || null;
    const premium = hasPremiumAccess(req.user);

    // Filtre parametreleri hem liste hem sayim sorgusunda ayni sirayla kullanilir
    const where = ['q.is_active', 't.is_active'];
    const filterParams = [];
    if (topic) {
      filterParams.push(topic);
      where.push(`t.slug = $${filterParams.length}`);
    }
    if (difficulty) {
      filterParams.push(difficulty);
      where.push(`q.difficulty = $${filterParams.length}`);
    }
    // Premium olmayan kullanici premium sorulari hic gormez
    if (!premium) where.push('q.is_premium = FALSE');
    if (unsolved && userId) {
      filterParams.push(userId);
      where.push(
        `NOT EXISTS (SELECT 1 FROM attempts a2
                      WHERE a2.user_id = $${filterParams.length}
                        AND a2.question_id = q.id AND a2.is_correct)`
      );
    }
    const whereSql = where.join(' AND ');

    const listParams = [...filterParams, userId, limit, offset];
    const userIdx = filterParams.length + 1;
    const { rows } = await query(
      `SELECT q.id, q.topic_id, q.type, q.difficulty, q.body, q.is_premium,
              t.name AS topic_name, t.slug AS topic_slug,
              EXISTS (SELECT 1 FROM attempts a
                       WHERE a.user_id = $${userIdx} AND a.question_id = q.id AND a.is_correct)
                AS already_solved
         FROM questions q
         JOIN topics t ON t.id = q.topic_id
        WHERE ${whereSql}
        ORDER BY q.id
        LIMIT $${userIdx + 1} OFFSET $${userIdx + 2}`,
      listParams
    );

    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS total
         FROM questions q JOIN topics t ON t.id = q.topic_id
        WHERE ${whereSql}`,
      filterParams
    );

    let optionsByQuestion = new Map();
    if (rows.length) {
      const { rows: opts } = await query(
        `SELECT id, question_id, label, text FROM question_options
          WHERE question_id = ANY($1::int[]) ORDER BY sort_order, label`,
        [rows.map((r) => r.id)]
      );
      optionsByQuestion = opts.reduce((map, o) => {
        if (!map.has(o.question_id)) map.set(o.question_id, []);
        map.get(o.question_id).push(o);
        return map;
      }, new Map());
    }

    res.json({
      total: countRows[0].total,
      questions: rows.map((r) => toPublicQuestion(r, optionsByQuestion.get(r.id) || [])),
    });
  })
);

/** Tek soru. */
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw badRequest('Gecersiz soru id.');

    const { rows } = await query(
      `SELECT q.id, q.topic_id, q.type, q.difficulty, q.body, q.is_premium,
              t.name AS topic_name, t.slug AS topic_slug,
              EXISTS (SELECT 1 FROM attempts a
                       WHERE a.user_id = $2 AND a.question_id = q.id AND a.is_correct)
                AS already_solved
         FROM questions q JOIN topics t ON t.id = q.topic_id
        WHERE q.id = $1 AND q.is_active`,
      [id, req.user?.id || null]
    );
    const question = rows[0];
    if (!question) throw notFound('Soru bulunamadi.');
    if (question.is_premium && !hasPremiumAccess(req.user)) throw premiumRequired();

    const { rows: opts } = await query(
      `SELECT id, label, text FROM question_options
        WHERE question_id = $1 ORDER BY sort_order, label`,
      [id]
    );
    res.json({ question: toPublicQuestion(question, opts) });
  })
);

const answerSchema = z.object({
  optionId: z.coerce.number().int().positive(),
  durationMs: z.coerce.number().int().min(0).max(3600000).optional(),
});

/** Cevap gonder: dogru sik, cozum, kazanilan puan ve yeni rozetler burada doner. */
router.post(
  '/:id/answer',
  requireAuth,
  validate(answerSchema),
  asyncHandler(async (req, res) => {
    const questionId = Number(req.params.id);
    if (!Number.isInteger(questionId)) throw badRequest('Gecersiz soru id.');
    const { optionId, durationMs } = req.body;

    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        'SELECT * FROM questions WHERE id = $1 AND is_active',
        [questionId]
      );
      const question = rows[0];
      if (!question) throw notFound('Soru bulunamadi.');
      if (question.is_premium && !hasPremiumAccess(req.user)) throw premiumRequired();

      const { rows: opts } = await client.query(
        'SELECT id, label, text, is_correct FROM question_options WHERE question_id = $1',
        [questionId]
      );
      const selected = opts.find((o) => o.id === optionId);
      if (!selected) throw badRequest('Bu soruya ait olmayan bir sik gonderildi.');
      const correct = opts.find((o) => o.is_correct);

      const { pointsAwarded } = await recordAttempt(client, {
        userId: req.user.id,
        question,
        selectedOptionId: selected.id,
        isCorrect: selected.is_correct,
        durationMs: durationMs ?? null,
      });

      const newBadges = await checkAndAwardBadges(client, req.user.id);
      const { rows: pointRows } = await client.query(
        'SELECT total_points FROM users WHERE id = $1',
        [req.user.id]
      );

      return {
        isCorrect: selected.is_correct,
        correctOptionId: correct ? correct.id : null,
        correctOptionLabel: correct ? correct.label : null,
        explanation: question.explanation,
        pointsAwarded,
        totalPoints: pointRows[0].total_points,
        newBadges,
      };
    });

    res.json(result);
  })
);

module.exports = router;
