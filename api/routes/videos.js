const express = require('express');
const { z } = require('zod');
const { query, withTransaction } = require('../config/db');
const { asyncHandler, validate, notFound, premiumRequired, badRequest } = require('../utils/http');
const { requireAuth, optionalAuth, hasPremiumAccess } = require('../middleware/auth');
const { publicUrlFor } = require('../services/storage');
const { checkAndAwardBadges } = require('../services/badgeEngine');

const router = express.Router();

/**
 * Kapak gorseli girilmemisse YouTube linkinden uretir; YouTube her video icin
 * bu adresi hazir sunuyor, ayrica istek atmaya gerek yok.
 * (Vimeo'da kapak adresi ancak Vimeo API'sine sorularak bulunabildigi icin
 * orada kapak bos kalir ve arayuz simgeyi gosterir.)
 */
function thumbnailFor(row) {
  if (row.thumbnail_url) return row.thumbnail_url;
  if (row.source !== 'youtube' || !row.url) return null;
  const m = row.url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|\/v\/)([\w-]{11})/);
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : null;
}

/** Video kaydini kullaniciya gonderilebilir hale getirir. Kilitliyse oynatma adresi gizlenir. */
function toPublicVideo(row, unlocked) {
  return {
    id: row.id,
    topicId: row.topic_id,
    topicName: row.topic_name,
    topicSlug: row.topic_slug,
    title: row.title,
    description: row.description,
    source: row.source,
    // Kilitli videonun adresi hic gonderilmez
    url: unlocked ? (row.source === 'upload' ? publicUrlFor(row.storage_key) : row.url) : null,
    durationSeconds: row.duration_seconds,
    thumbnailUrl: thumbnailFor(row),
    isPremium: row.is_premium,
    locked: !unlocked,
    watchedSeconds: row.watched_seconds ?? 0,
    completed: row.completed ?? false,
  };
}

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id || null;
    const params = [userId];
    let topicFilter = '';
    if (req.query.topic) {
      params.push(String(req.query.topic));
      topicFilter = `AND t.slug = $${params.length}`;
    }

    const { rows } = await query(
      `SELECT v.*, t.name AS topic_name, t.slug AS topic_slug,
              vp.watched_seconds, vp.completed
         FROM videos v
         LEFT JOIN topics t ON t.id = v.topic_id
         LEFT JOIN video_progress vp ON vp.video_id = v.id AND vp.user_id = $1
        WHERE v.is_active ${topicFilter}
        ORDER BY v.sort_order, v.created_at DESC`,
      params
    );

    const premium = hasPremiumAccess(req.user);
    res.json({ videos: rows.map((r) => toPublicVideo(r, !r.is_premium || premium)) });
  })
);

router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw badRequest('Gecersiz video id.');

    const { rows } = await query(
      `SELECT v.*, t.name AS topic_name, t.slug AS topic_slug,
              vp.watched_seconds, vp.completed
         FROM videos v
         LEFT JOIN topics t ON t.id = v.topic_id
         LEFT JOIN video_progress vp ON vp.video_id = v.id AND vp.user_id = $2
        WHERE v.id = $1 AND v.is_active`,
      [id, req.user?.id || null]
    );
    const video = rows[0];
    if (!video) throw notFound('Video bulunamadi.');
    if (video.is_premium && !hasPremiumAccess(req.user)) throw premiumRequired();

    res.json({ video: toPublicVideo(video, true) });
  })
);

const progressSchema = z.object({
  watchedSeconds: z.coerce.number().int().min(0),
  completed: z.boolean().optional(),
});

/** Izleme ilerlemesi. %90'i izlendiyse otomatik tamamlandi sayilir. */
router.post(
  '/:id/progress',
  requireAuth,
  validate(progressSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { rows } = await query('SELECT * FROM videos WHERE id = $1 AND is_active', [id]);
    const video = rows[0];
    if (!video) throw notFound('Video bulunamadi.');
    if (video.is_premium && !hasPremiumAccess(req.user)) throw premiumRequired();

    const { watchedSeconds } = req.body;
    const autoCompleted =
      req.body.completed === true ||
      (video.duration_seconds ? watchedSeconds >= video.duration_seconds * 0.9 : false);

    const newBadges = await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO video_progress (user_id, video_id, watched_seconds, completed, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (user_id, video_id) DO UPDATE
           SET watched_seconds = GREATEST(video_progress.watched_seconds, EXCLUDED.watched_seconds),
               completed = video_progress.completed OR EXCLUDED.completed,
               updated_at = now()`,
        [req.user.id, id, watchedSeconds, autoCompleted]
      );
      return autoCompleted ? checkAndAwardBadges(client, req.user.id) : [];
    });

    res.json({ ok: true, completed: autoCompleted, newBadges });
  })
);

module.exports = router;
