const express = require('express');
const { query } = require('../config/db');
const { asyncHandler } = require('../utils/http');
const { optionalAuth, hasPremiumAccess } = require('../middleware/auth');

const router = express.Router();

/**
 * Konu listesi + her konudaki soru/video sayisi ve (giris varsa) kullanicinin ilerlemesi.
 * Sayimlar kullanicinin ERISEBILDIGI icerikle sinirlidir; aksi halde ucretsiz uyenin
 * ilerleme cubugu hicbir zaman dolmaz.
 */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id || null;
    const premium = hasPremiumAccess(req.user);
    const { rows } = await query(
      `SELECT t.id, t.name, t.slug, t.description, t.icon, t.sort_order,
              (SELECT COUNT(*)::int FROM questions q
                WHERE q.topic_id = t.id AND q.is_active
                  AND ($2::boolean OR q.is_premium = FALSE)) AS question_count,
              (SELECT COUNT(*)::int FROM videos v
                WHERE v.topic_id = t.id AND v.is_active) AS video_count,
              COALESCE((
                SELECT COUNT(DISTINCT a.question_id)::int
                  FROM attempts a
                  JOIN questions q2 ON q2.id = a.question_id
                 WHERE q2.topic_id = t.id AND a.user_id = $1 AND a.is_correct
              ), 0) AS solved_count
         FROM topics t
        WHERE t.is_active
        ORDER BY t.sort_order, t.name`,
      [userId, premium]
    );
    // Icerigi olmayan konu basliklari listede gorunmez (bos sayfaya goturuyordu).
    // Yonetici paneli /admin/topics ucunu kullandigi icin oradan hepsi yonetilebilir.
    res.json({ topics: rows.filter((t) => t.question_count > 0 || t.video_count > 0) });
  })
);

module.exports = router;
