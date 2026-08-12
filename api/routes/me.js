const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query } = require('../config/db');
const { asyncHandler, validate, badRequest } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');
const { revokeAllForUser } = require('../services/tokens');

const router = express.Router();
router.use(requireAuth);

/** Genel istatistikler + konu bazli dogruluk. */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const [overall, weekly, byTopic, exams, videos] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total_attempts,
                COUNT(*) FILTER (WHERE is_correct)::int AS correct_attempts,
                COUNT(DISTINCT question_id) FILTER (WHERE is_correct)::int AS solved_questions
           FROM attempts WHERE user_id = $1`,
        [userId]
      ),
      query(
        `SELECT COALESCE(SUM(points_awarded), 0)::int AS week_points
           FROM attempts WHERE user_id = $1 AND created_at > now() - interval '7 days'`,
        [userId]
      ),
      query(
        `SELECT t.id, t.name, t.slug,
                COUNT(a.*)::int AS attempts,
                COUNT(a.*) FILTER (WHERE a.is_correct)::int AS correct,
                (SELECT COUNT(*)::int FROM questions q2
                  WHERE q2.topic_id = t.id AND q2.is_active) AS total_questions,
                COUNT(DISTINCT a.question_id) FILTER (WHERE a.is_correct)::int AS solved
           FROM topics t
           LEFT JOIN questions q ON q.topic_id = t.id
           LEFT JOIN attempts a ON a.question_id = q.id AND a.user_id = $1
          WHERE t.is_active
          GROUP BY t.id
          ORDER BY t.sort_order, t.name`,
        [userId]
      ),
      query(
        `SELECT COUNT(*)::int AS finished, COALESCE(AVG(score), 0)::numeric(5,1) AS avg_score
           FROM exam_sessions WHERE user_id = $1 AND finished_at IS NOT NULL`,
        [userId]
      ),
      query(
        `SELECT COUNT(*)::int AS completed FROM video_progress
          WHERE user_id = $1 AND completed`,
        [userId]
      ),
    ]);

    const o = overall.rows[0];
    res.json({
      totalPoints: req.user.total_points,
      weekPoints: weekly.rows[0].week_points,
      totalAttempts: o.total_attempts,
      correctAttempts: o.correct_attempts,
      solvedQuestions: o.solved_questions,
      accuracy: o.total_attempts ? Math.round((o.correct_attempts / o.total_attempts) * 100) : 0,
      finishedExams: exams.rows[0].finished,
      averageExamScore: Number(exams.rows[0].avg_score),
      completedVideos: videos.rows[0].completed,
      topics: byTopic.rows.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        attempts: t.attempts,
        correct: t.correct,
        solved: t.solved,
        totalQuestions: t.total_questions,
        accuracy: t.attempts ? Math.round((t.correct / t.attempts) * 100) : 0,
      })),
    });
  })
);

/** Kazanilan ve henuz kazanilmayan rozetler. */
router.get(
  '/badges',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT b.code, b.name, b.description, b.icon, b.sort_order, ub.earned_at
         FROM badges b
         LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = $1
        WHERE b.is_active
        ORDER BY (ub.earned_at IS NULL), b.sort_order, b.name`,
      [req.user.id]
    );
    res.json({
      badges: rows.map((b) => ({
        code: b.code,
        name: b.name,
        description: b.description,
        icon: b.icon,
        earned: Boolean(b.earned_at),
        earnedAt: b.earned_at,
      })),
    });
  })
);

/** Son cevap gecmisi. */
router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const { rows } = await query(
      `SELECT a.id, a.is_correct, a.points_awarded, a.created_at, a.exam_session_id,
              q.id AS question_id, q.difficulty, LEFT(q.body, 160) AS excerpt,
              t.name AS topic_name, t.slug AS topic_slug
         FROM attempts a
         JOIN questions q ON q.id = a.question_id
         JOIN topics t ON t.id = q.topic_id
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC
        LIMIT $2`,
      [req.user.id, limit]
    );
    res.json({
      history: rows.map((r) => ({
        id: r.id,
        questionId: r.question_id,
        isCorrect: r.is_correct,
        pointsAwarded: r.points_awarded,
        createdAt: r.created_at,
        inExam: Boolean(r.exam_session_id),
        difficulty: r.difficulty,
        excerpt: r.excerpt,
        topicName: r.topic_name,
        topicSlug: r.topic_slug,
      })),
    });
  })
);

const profileSchema = z.object({
  fullName: z.string().min(2).max(120).trim().optional(),
  avatarUrl: z.string().url().max(500).nullish(),
});

router.patch(
  '/profile',
  validate(profileSchema),
  asyncHandler(async (req, res) => {
    const { fullName, avatarUrl } = req.body;
    const { rows } = await query(
      `UPDATE users
          SET full_name = COALESCE($2, full_name),
              avatar_url = COALESCE($3, avatar_url)
        WHERE id = $1
        RETURNING id, email, full_name, role, is_premium, avatar_url, total_points`,
      [req.user.id, fullName ?? null, avatarUrl ?? null]
    );
    res.json({ user: rows[0] });
  })
);

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Yeni sifre en az 8 karakter olmali.').max(72),
});

router.post(
  '/password',
  validate(passwordSchema),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const ok = await bcrypt.compare(req.body.currentPassword, rows[0].password_hash);
    if (!ok) throw badRequest('Mevcut sifreniz hatali.');

    const hash = await bcrypt.hash(req.body.newPassword, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    // Sifre degisince diger oturumlar dusurulur
    await revokeAllForUser(req.user.id);
    res.json({ ok: true });
  })
);

module.exports = router;
