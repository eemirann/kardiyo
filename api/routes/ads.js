const express = require('express');
const { z } = require('zod');
const { query } = require('../config/db');
const { asyncHandler, validate, notFound } = require('../utils/http');
const { optionalAuth, hasPremiumAccess } = require('../middleware/auth');

const router = express.Router();

/** Agirliga gore rastgele bir reklam secer. */
function pickWeighted(ads) {
  const total = ads.reduce((sum, a) => sum + a.weight, 0);
  let r = Math.random() * total;
  for (const ad of ads) {
    r -= ad.weight;
    if (r <= 0) return ad;
  }
  return ads[ads.length - 1];
}

/**
 * Bir reklam alaninin icerigi.
 * Premium uyeye (ve admine) reklam gosterilmez: bos doner.
 */
router.get(
  '/slot/:code',
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (hasPremiumAccess(req.user)) return res.json({ ad: null, adsense: null, hidden: true });

    const { rows } = await query('SELECT * FROM ad_slots WHERE code = $1 AND is_active', [
      req.params.code,
    ]);
    const slot = rows[0];
    if (!slot) return res.json({ ad: null, adsense: null, hidden: false });

    if (slot.provider === 'adsense') {
      return res.json({ ad: null, adsense: slot.adsense_snippet || null, hidden: false });
    }

    const { rows: ads } = await query(
      `SELECT id, title, image_url, target_url, weight FROM ads
        WHERE slot_id = $1 AND is_active
          AND (starts_at IS NULL OR starts_at <= now())
          AND (ends_at IS NULL OR ends_at >= now())`,
      [slot.id]
    );
    if (!ads.length) return res.json({ ad: null, adsense: null, hidden: false });

    const ad = pickWeighted(ads);
    res.json({
      ad: { id: ad.id, title: ad.title, imageUrl: ad.image_url, targetUrl: ad.target_url },
      adsense: null,
      hidden: false,
    });
  })
);

const eventSchema = z.object({ type: z.enum(['impression', 'click']) });

/** Gosterim/tiklama sayaci. */
router.post(
  '/:id/event',
  optionalAuth,
  validate(eventSchema),
  asyncHandler(async (req, res) => {
    const adId = Number(req.params.id);
    if (!Number.isInteger(adId)) throw notFound('Reklam bulunamadi.');

    await query('INSERT INTO ad_events (ad_id, type, user_id) VALUES ($1, $2, $3)', [
      adId,
      req.body.type,
      req.user?.id || null,
    ]).catch(() => {}); // silinmis reklam icin sessizce gec

    res.status(204).end();
  })
);

module.exports = router;
