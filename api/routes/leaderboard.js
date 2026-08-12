const express = require('express');
const { z } = require('zod');
const { query } = require('../config/db');
const { asyncHandler, validate } = require('../utils/http');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

const schema = z.object({
  period: z.enum(['all', 'week']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * Siralama tablosu.
 * all  -> users.total_points uzerinden (tum zamanlar)
 * week -> son 7 gunde kazanilan puan toplami
 */
router.get(
  '/',
  optionalAuth,
  validate(schema, 'query'),
  asyncHandler(async (req, res) => {
    const { period, limit } = req.query;
    const userId = req.user?.id || null;

    const rankedSql =
      period === 'week'
        ? `SELECT u.id, u.full_name, u.avatar_url, u.is_premium,
                  COALESCE(SUM(a.points_awarded), 0)::int AS points,
                  COUNT(*) FILTER (WHERE a.is_correct)::int AS correct_count
             FROM users u
             JOIN attempts a ON a.user_id = u.id AND a.created_at > now() - interval '7 days'
            WHERE u.is_blocked = FALSE
            GROUP BY u.id
           HAVING COALESCE(SUM(a.points_awarded), 0) > 0`
        : `SELECT u.id, u.full_name, u.avatar_url, u.is_premium,
                  u.total_points AS points,
                  (SELECT COUNT(*)::int FROM attempts a
                    WHERE a.user_id = u.id AND a.is_correct) AS correct_count
             FROM users u
            WHERE u.is_blocked = FALSE AND u.total_points > 0`;

    const sql = `
      WITH ranked AS (
        SELECT *, RANK() OVER (ORDER BY points DESC, id) AS rank
          FROM (${rankedSql}) base
      )
      SELECT * FROM ranked ORDER BY rank LIMIT $1`;

    const { rows } = await query(sql, [limit]);

    let me = null;
    if (userId) {
      const { rows: meRows } = await query(
        `WITH ranked AS (
           SELECT *, RANK() OVER (ORDER BY points DESC, id) AS rank
             FROM (${rankedSql}) base
         )
         SELECT * FROM ranked WHERE id = $1`,
        [userId]
      );
      me = meRows[0] || null;
    }

    const shape = (r) => ({
      rank: Number(r.rank),
      userId: r.id,
      fullName: r.full_name,
      avatarUrl: r.avatar_url,
      isPremium: r.is_premium,
      points: r.points,
      correctCount: r.correct_count,
    });

    res.json({
      period,
      entries: rows.map(shape),
      me: me ? shape(me) : null,
    });
  })
);

module.exports = router;
