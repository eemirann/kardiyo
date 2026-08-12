const express = require('express');
const { z } = require('zod');
const { query, withTransaction } = require('../config/db');
const {
  asyncHandler,
  validate,
  notFound,
  badRequest,
  premiumRequired,
} = require('../utils/http');
const { requireAuth, optionalAuth, hasPremiumAccess } = require('../middleware/auth');
const { schedule, previewIntervals } = require('../services/spacedRepetition');
const { checkAndAwardBadges } = require('../services/badgeEngine');

const router = express.Router();

/** Deste listesi + kullanicinin ilerlemesi (ogrenilen / bugun tekrar edilecek). */
router.get(
  '/decks',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id || null;
    const premium = hasPremiumAccess(req.user);

    const { rows } = await query(
      `SELECT d.id, d.title, d.slug, d.description, d.icon, d.is_premium,
              t.name AS topic_name, t.slug AS topic_slug,
              (SELECT COUNT(*)::int FROM flashcards c
                WHERE c.deck_id = d.id AND c.is_active) AS card_count,
              COALESCE((
                SELECT COUNT(*)::int FROM flashcard_reviews r
                  JOIN flashcards c ON c.id = r.card_id
                 WHERE c.deck_id = d.id AND r.user_id = $1 AND r.repetitions > 0
              ), 0) AS learned_count,
              COALESCE((
                SELECT COUNT(*)::int FROM flashcards c
                  LEFT JOIN flashcard_reviews r ON r.card_id = c.id AND r.user_id = $1
                 WHERE c.deck_id = d.id AND c.is_active
                   AND (r.user_id IS NULL OR r.due_at <= now())
              ), 0) AS due_count
         FROM flashcard_decks d
         LEFT JOIN topics t ON t.id = d.topic_id
        WHERE d.is_active
        ORDER BY d.sort_order, d.title`,
      [userId]
    );

    res.json({
      decks: rows.map((d) => ({
        id: d.id,
        title: d.title,
        slug: d.slug,
        description: d.description,
        icon: d.icon,
        isPremium: d.is_premium,
        locked: d.is_premium && !premium,
        topicName: d.topic_name,
        topicSlug: d.topic_slug,
        cardCount: d.card_count,
        learnedCount: d.learned_count,
        dueCount: userId ? d.due_count : 0,
      })),
    });
  })
);

async function loadDeck(slug, user) {
  const { rows } = await query(
    'SELECT * FROM flashcard_decks WHERE slug = $1 AND is_active',
    [slug]
  );
  const deck = rows[0];
  if (!deck) throw notFound('Deste bulunamadi.');
  if (deck.is_premium && !hasPremiumAccess(user)) throw premiumRequired();
  return deck;
}

const cardShape = (c) => ({
  id: c.id,
  front: c.front,
  back: c.back,
  hint: c.hint,
  kind: c.kind,
  reference: c.reference,
  state: c.repetitions === null || c.repetitions === undefined
    ? null
    : {
        repetitions: c.repetitions,
        intervalDays: c.interval_days,
        easeFactor: Number(c.ease_factor),
        dueAt: c.due_at,
      },
});

/**
 * Deste kartlari.
 * mode=study  -> serbest calisma: tum kartlar sirayla
 * mode=review -> aralikli tekrar: yalnizca zamani gelmis + hic gorulmemis kartlar
 */
const cardsSchema = z.object({
  mode: z.enum(['study', 'review']).default('study'),
  limit: z.coerce.number().int().min(1).max(200).default(60),
  shuffle: z.enum(['0', '1']).default('0'),
});

router.get(
  '/decks/:slug/cards',
  optionalAuth,
  validate(cardsSchema, 'query'),
  asyncHandler(async (req, res) => {
    const deck = await loadDeck(req.params.slug, req.user);
    const { mode, limit, shuffle } = req.query;
    const userId = req.user?.id || null;

    if (mode === 'review' && !userId) throw badRequest('Tekrar modu icin giris gerekli.');

    const dueFilter =
      mode === 'review' ? 'AND (r.user_id IS NULL OR r.due_at <= now())' : '';
    const order = shuffle === '1' ? 'random()' : 'c.sort_order, c.id';

    const { rows } = await query(
      `SELECT c.*, r.repetitions, r.interval_days, r.ease_factor, r.due_at
         FROM flashcards c
         LEFT JOIN flashcard_reviews r ON r.card_id = c.id AND r.user_id = $1
        WHERE c.deck_id = $2 AND c.is_active ${dueFilter}
        ORDER BY ${mode === 'review' ? 'r.due_at NULLS FIRST, c.id' : order}
        LIMIT $3`,
      [userId, deck.id, limit]
    );

    res.json({
      deck: {
        id: deck.id,
        title: deck.title,
        slug: deck.slug,
        description: deck.description,
        isPremium: deck.is_premium,
      },
      mode,
      cards: rows.map(cardShape),
    });
  })
);

const gradeSchema = z.object({
  grade: z.coerce.number().int().min(0).max(3),
});

/**
 * Kart degerlendirmesi (yalnizca tekrar modunda kalici).
 * grade: 0 Tekrar · 1 Zor · 2 İyi · 3 Kolay
 */
router.post(
  '/cards/:id/review',
  requireAuth,
  validate(gradeSchema),
  asyncHandler(async (req, res) => {
    const cardId = Number(req.params.id);
    if (!Number.isInteger(cardId)) throw badRequest('Gecersiz kart id.');

    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT c.id, d.is_premium
           FROM flashcards c JOIN flashcard_decks d ON d.id = c.deck_id
          WHERE c.id = $1 AND c.is_active`,
        [cardId]
      );
      const card = rows[0];
      if (!card) throw notFound('Kart bulunamadi.');
      if (card.is_premium && !hasPremiumAccess(req.user)) throw premiumRequired();

      const { rows: stateRows } = await client.query(
        'SELECT * FROM flashcard_reviews WHERE user_id = $1 AND card_id = $2',
        [req.user.id, cardId]
      );
      const prev = stateRows[0] || {
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        lapses: 0,
      };

      const next = schedule(
        {
          easeFactor: prev.ease_factor,
          intervalDays: prev.interval_days,
          repetitions: prev.repetitions,
          lapses: prev.lapses,
        },
        req.body.grade
      );

      await client.query(
        `INSERT INTO flashcard_reviews
           (user_id, card_id, ease_factor, interval_days, repetitions, lapses,
            total_reviews, last_grade, last_reviewed_at, due_at)
         VALUES ($1,$2,$3,$4,$5,$6,1,$7,now(),$8)
         ON CONFLICT (user_id, card_id) DO UPDATE SET
            ease_factor = EXCLUDED.ease_factor,
            interval_days = EXCLUDED.interval_days,
            repetitions = EXCLUDED.repetitions,
            lapses = EXCLUDED.lapses,
            total_reviews = flashcard_reviews.total_reviews + 1,
            last_grade = EXCLUDED.last_grade,
            last_reviewed_at = now(),
            due_at = EXCLUDED.due_at`,
        [
          req.user.id,
          cardId,
          next.easeFactor,
          next.intervalDays,
          next.repetitions,
          next.lapses,
          req.body.grade,
          next.dueAt,
        ]
      );

      const newBadges = await checkAndAwardBadges(client, req.user.id);
      return { next, newBadges };
    });

    res.json({
      intervalDays: result.next.intervalDays,
      dueAt: result.next.dueAt,
      easeFactor: result.next.easeFactor,
      newBadges: result.newBadges,
    });
  })
);

/** Bugunku tekrar ozeti (tum desteler). */
router.get(
  '/due',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT d.id, d.title, d.slug,
              COUNT(*) FILTER (WHERE r.user_id IS NULL)::int AS new_count,
              COUNT(*) FILTER (WHERE r.user_id IS NOT NULL AND r.due_at <= now())::int AS due_count
         FROM flashcards c
         JOIN flashcard_decks d ON d.id = c.deck_id AND d.is_active
         LEFT JOIN flashcard_reviews r ON r.card_id = c.id AND r.user_id = $1
        WHERE c.is_active AND (r.user_id IS NULL OR r.due_at <= now())
        GROUP BY d.id
        ORDER BY d.sort_order, d.title`,
      [req.user.id]
    );

    const { rows: totals } = await query(
      `SELECT COUNT(*)::int AS learned,
              COUNT(*) FILTER (WHERE repetitions >= 3)::int AS mature,
              COALESCE(SUM(total_reviews), 0)::int AS reviews
         FROM flashcard_reviews WHERE user_id = $1`,
      [req.user.id]
    );

    res.json({
      decks: rows.map((d) => ({
        id: d.id,
        title: d.title,
        slug: d.slug,
        newCount: d.new_count,
        dueCount: d.due_count,
        total: d.new_count + d.due_count,
      })),
      stats: totals[0],
    });
  })
);

/** Arayuzde dugme altinda gosterilen "+3 gün" onizlemesi icin. */
router.get(
  '/preview',
  requireAuth,
  asyncHandler(async (req, res) => {
    const state = {
      easeFactor: Number(req.query.ease) || 2.5,
      intervalDays: Number(req.query.interval) || 0,
      repetitions: Number(req.query.repetitions) || 0,
      lapses: 0,
    };
    res.json({ intervals: previewIntervals(state) });
  })
);

module.exports = router;
