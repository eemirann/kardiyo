const express = require('express');
const { z } = require('zod');
const { query, withTransaction } = require('../config/db');
const {
  asyncHandler,
  validate,
  notFound,
  badRequest,
  forbidden,
  premiumRequired,
} = require('../utils/http');
const { requireAuth, optionalAuth, hasPremiumAccess } = require('../middleware/auth');
const { pointsFor } = require('../services/scoring');
const { checkAndAwardBadges } = require('../services/badgeEngine');

const router = express.Router();

/** Sinav listesi. */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT e.id, e.title, e.description, e.duration_minutes, e.is_premium,
              t.name AS topic_name, t.slug AS topic_slug,
              (SELECT COUNT(*)::int FROM exam_questions eq WHERE eq.exam_id = e.id) AS question_count,
              (SELECT MAX(es.score) FROM exam_sessions es
                WHERE es.exam_id = e.id AND es.user_id = $1 AND es.finished_at IS NOT NULL) AS best_score
         FROM exams e
         LEFT JOIN topics t ON t.id = e.topic_id
        WHERE e.is_active
        ORDER BY e.created_at DESC`,
      [req.user?.id || null]
    );
    res.json({
      exams: rows.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        durationMinutes: e.duration_minutes,
        isPremium: e.is_premium,
        topicName: e.topic_name,
        topicSlug: e.topic_slug,
        questionCount: e.question_count,
        bestScore: e.best_score,
      })),
    });
  })
);

/** Sinav oturumu baslat. Bitis zamani SUNUCUDA hesaplanip saklanir. */
router.post(
  '/:id/start',
  requireAuth,
  asyncHandler(async (req, res) => {
    const examId = Number(req.params.id);
    if (!Number.isInteger(examId)) throw badRequest('Gecersiz sinav id.');

    const { rows } = await query('SELECT * FROM exams WHERE id = $1 AND is_active', [examId]);
    const exam = rows[0];
    if (!exam) throw notFound('Sinav bulunamadi.');
    if (exam.is_premium && !hasPremiumAccess(req.user)) throw premiumRequired();

    const { rows: qCount } = await query(
      'SELECT COUNT(*)::int AS n FROM exam_questions WHERE exam_id = $1',
      [examId]
    );
    if (qCount[0].n === 0) throw badRequest('Bu sinavda henuz soru yok.');

    // Devam eden oturum varsa yenisini acmak yerine onu dondur
    const { rows: openRows } = await query(
      `SELECT * FROM exam_sessions
        WHERE exam_id = $1 AND user_id = $2 AND finished_at IS NULL AND expires_at > now()
        ORDER BY started_at DESC LIMIT 1`,
      [examId, req.user.id]
    );

    let session = openRows[0];
    if (!session) {
      const { rows: created } = await query(
        `INSERT INTO exam_sessions (exam_id, user_id, expires_at)
         VALUES ($1, $2, now() + ($3 || ' minutes')::interval)
         RETURNING *`,
        [examId, req.user.id, String(exam.duration_minutes)]
      );
      session = created[0];
    }

    res.status(201).json({ session: await buildSessionPayload(session, exam, req.user.id) });
  })
);

/** Devam eden/bitmis oturumu getir (sayfa yenilenince kaldigi yerden devam icin). */
router.get(
  '/sessions/:sessionId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { session, exam } = await loadSession(req.params.sessionId, req.user.id);
    res.json({ session: await buildSessionPayload(session, exam, req.user.id) });
  })
);

async function loadSession(sessionIdRaw, userId) {
  const sessionId = Number(sessionIdRaw);
  if (!Number.isInteger(sessionId)) throw badRequest('Gecersiz oturum id.');

  const { rows } = await query('SELECT * FROM exam_sessions WHERE id = $1', [sessionId]);
  const session = rows[0];
  if (!session) throw notFound('Sinav oturumu bulunamadi.');
  if (session.user_id !== userId) throw forbidden('Bu oturum size ait degil.');

  const { rows: examRows } = await query('SELECT * FROM exams WHERE id = $1', [session.exam_id]);
  return { session, exam: examRows[0] };
}

/** Oturumun sorularini (dogru sik gizli) + verilen cevaplari doner. */
async function buildSessionPayload(session, exam, userId) {
  const { rows: questions } = await query(
    `SELECT q.id, q.type, q.difficulty, q.body, eq.sort_order,
            t.name AS topic_name
       FROM exam_questions eq
       JOIN questions q ON q.id = eq.question_id
       LEFT JOIN topics t ON t.id = q.topic_id
      WHERE eq.exam_id = $1
      ORDER BY eq.sort_order, q.id`,
    [exam.id]
  );

  const ids = questions.map((q) => q.id);
  const { rows: options } = ids.length
    ? await query(
        `SELECT id, question_id, label, text FROM question_options
          WHERE question_id = ANY($1::int[]) ORDER BY sort_order, label`,
        [ids]
      )
    : { rows: [] };

  const { rows: answers } = await query(
    'SELECT question_id, selected_option_id FROM attempts WHERE exam_session_id = $1',
    [session.id]
  );
  const answerMap = new Map(answers.map((a) => [a.question_id, a.selected_option_id]));

  const finished = Boolean(session.finished_at);

  return {
    id: session.id,
    examId: exam.id,
    examTitle: exam.title,
    durationMinutes: exam.duration_minutes,
    startedAt: session.started_at,
    expiresAt: session.expires_at,
    finishedAt: session.finished_at,
    finished,
    score: finished ? session.score : null,
    correctCount: finished ? session.correct_count : null,
    wrongCount: finished ? session.wrong_count : null,
    blankCount: finished ? session.blank_count : null,
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type,
      difficulty: q.difficulty,
      body: q.body,
      topicName: q.topic_name,
      selectedOptionId: answerMap.get(q.id) ?? null,
      options: options
        .filter((o) => o.question_id === q.id)
        .map((o) => ({ id: o.id, label: o.label, text: o.text })),
    })),
  };
}

const answerSchema = z.object({
  questionId: z.coerce.number().int().positive(),
  optionId: z.coerce.number().int().positive().nullable(),
});

/**
 * Sinav sirasinda cevap kaydeder/gunceller.
 * Sinav bitene kadar dogru/yanlis bilgisi DONMEZ.
 */
router.post(
  '/sessions/:sessionId/answer',
  requireAuth,
  validate(answerSchema),
  asyncHandler(async (req, res) => {
    const { session, exam } = await loadSession(req.params.sessionId, req.user.id);
    if (session.finished_at) throw badRequest('Bu sinav zaten tamamlanmis.');
    if (new Date(session.expires_at) < new Date()) throw badRequest('Sinav suresi doldu.', 'EXPIRED');

    const { questionId, optionId } = req.body;
    const { rowCount } = await query(
      'SELECT 1 FROM exam_questions WHERE exam_id = $1 AND question_id = $2',
      [exam.id, questionId]
    );
    if (!rowCount) throw badRequest('Bu soru bu sinava ait degil.');

    if (optionId === null) {
      // Cevabi geri al (bos birak)
      await query('DELETE FROM attempts WHERE exam_session_id = $1 AND question_id = $2', [
        session.id,
        questionId,
      ]);
      return res.json({ saved: true, selectedOptionId: null });
    }

    const { rows: opts } = await query(
      'SELECT id, is_correct FROM question_options WHERE question_id = $1',
      [questionId]
    );
    const selected = opts.find((o) => o.id === optionId);
    if (!selected) throw badRequest('Bu soruya ait olmayan bir sik gonderildi.');

    // Sinav icindeki cevaplar puan vermez; puan sinav bitiminde toplu hesaplanir
    await query(
      `INSERT INTO attempts (user_id, question_id, selected_option_id, is_correct, points_awarded, exam_session_id)
       VALUES ($1, $2, $3, $4, 0, $5)
       -- Kismi unique index oldugu icin WHERE kosulu da belirtilmeli;
       -- aksi halde Postgres arbiter index'i secemez.
       ON CONFLICT (exam_session_id, question_id) WHERE exam_session_id IS NOT NULL
       DO UPDATE SET selected_option_id = EXCLUDED.selected_option_id,
                     is_correct = EXCLUDED.is_correct,
                     created_at = now()`,
      [req.user.id, questionId, selected.id, selected.is_correct, session.id]
    );

    res.json({ saved: true, selectedOptionId: selected.id });
  })
);

/** Sinavi bitir: skor hesapla, puanlari yaz, rozetleri kontrol et, sonuc kartini dondur. */
router.post(
  '/sessions/:sessionId/finish',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { session, exam } = await loadSession(req.params.sessionId, req.user.id);
    if (session.finished_at) {
      return res.json({ result: await buildResult(session.id, req.user.id) });
    }

    const result = await withTransaction(async (client) => {
      const { rows: questions } = await client.query(
        `SELECT q.id, q.difficulty FROM exam_questions eq
           JOIN questions q ON q.id = eq.question_id
          WHERE eq.exam_id = $1`,
        [exam.id]
      );
      const { rows: answers } = await client.query(
        'SELECT question_id, selected_option_id, is_correct FROM attempts WHERE exam_session_id = $1',
        [session.id]
      );
      const answerMap = new Map(answers.map((a) => [a.question_id, a]));

      let correct = 0;
      let wrong = 0;
      let blank = 0;

      for (const q of questions) {
        const a = answerMap.get(q.id);
        if (!a) {
          blank++;
          continue;
        }
        if (a.is_correct) correct++;
        else wrong++;

        // Sinav cevaplari icin puani burada veriyoruz: ayni soru daha once dogru
        // cozulduyse recordAttempt zaten 0 puan verir. Sinav icindeki kaydi
        // guncelledigimiz icin puani ayrica hesaplayip yaziyoruz.
        if (a.is_correct) {
          const { rows: prior } = await client.query(
            `SELECT 1 FROM attempts
              WHERE user_id = $1 AND question_id = $2 AND is_correct AND points_awarded > 0
              LIMIT 1`,
            [req.user.id, q.id]
          );
          if (prior.length === 0) {
            const points = pointsFor(q.difficulty);
            await client.query(
              'UPDATE attempts SET points_awarded = $1 WHERE exam_session_id = $2 AND question_id = $3',
              [points, session.id, q.id]
            );
            await client.query('UPDATE users SET total_points = total_points + $1 WHERE id = $2', [
              points,
              req.user.id,
            ]);
          }
        }
      }

      const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
      await client.query(
        `UPDATE exam_sessions
            SET finished_at = now(), score = $2, correct_count = $3,
                wrong_count = $4, blank_count = $5
          WHERE id = $1`,
        [session.id, score, correct, wrong, blank]
      );

      const newBadges = await checkAndAwardBadges(client, req.user.id);
      return { newBadges };
    });

    res.json({
      result: await buildResult(session.id, req.user.id),
      newBadges: result.newBadges,
    });
  })
);

/** Sonuc karti: skor + soru soru dogru sik ve cozum. */
async function buildResult(sessionId, userId) {
  const { rows: sRows } = await query('SELECT * FROM exam_sessions WHERE id = $1', [sessionId]);
  const session = sRows[0];

  const { rows } = await query(
    `SELECT q.id, q.body, q.explanation, q.difficulty,
            t.name AS topic_name,
            a.selected_option_id, a.is_correct, a.points_awarded,
            (SELECT json_agg(json_build_object(
                'id', o.id, 'label', o.label, 'text', o.text, 'isCorrect', o.is_correct)
                ORDER BY o.sort_order, o.label)
               FROM question_options o WHERE o.question_id = q.id) AS options
       FROM exam_questions eq
       JOIN questions q ON q.id = eq.question_id
       LEFT JOIN topics t ON t.id = q.topic_id
       LEFT JOIN attempts a ON a.question_id = q.id AND a.exam_session_id = $1
      WHERE eq.exam_id = $2
      ORDER BY eq.sort_order, q.id`,
    [sessionId, session.exam_id]
  );

  const earnedPoints = rows.reduce((sum, r) => sum + (r.points_awarded || 0), 0);

  return {
    sessionId: session.id,
    examId: session.exam_id,
    score: session.score,
    correctCount: session.correct_count,
    wrongCount: session.wrong_count,
    blankCount: session.blank_count,
    finishedAt: session.finished_at,
    earnedPoints,
    questions: rows.map((r) => ({
      id: r.id,
      body: r.body,
      explanation: r.explanation,
      difficulty: r.difficulty,
      topicName: r.topic_name,
      selectedOptionId: r.selected_option_id,
      isCorrect: r.is_correct,
      options: r.options || [],
    })),
  };
}

/** Sonuc kartini ayri endpoint olarak da sunuyoruz (sonuc sayfasi yenilenirse). */
router.get(
  '/sessions/:sessionId/result',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { session } = await loadSession(req.params.sessionId, req.user.id);
    if (!session.finished_at) throw badRequest('Sinav henuz tamamlanmadi.');
    res.json({ result: await buildResult(session.id, req.user.id) });
  })
);

module.exports = router;
