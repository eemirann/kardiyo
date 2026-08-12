const express = require('express');
const { z } = require('zod');
const sanitizeHtml = require('sanitize-html');
const { query, withTransaction } = require('../config/db');
const { asyncHandler, validate, notFound, badRequest } = require('../utils/http');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { createUploadUrl, isEnabled: storageEnabled } = require('../services/storage');

const router = express.Router();
router.use(requireAuth, requireAdmin);

/** Admin girdisi olsa bile HTML temizlenir (XSS'e karsi). */
const SANITIZE_OPTS = {
  allowedTags: [
    'p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'blockquote',
    'h3', 'h4', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'code', 'pre', 'sub', 'sup', 'img', 'a',
  ],
  allowedAttributes: { img: ['src', 'alt', 'width', 'height'], a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'data'],
};
const clean = (html) => sanitizeHtml(String(html ?? ''), SANITIZE_OPTS);

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// ---------------------------------------------------------------- Dashboard

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM users WHERE is_premium) AS premium_users,
        (SELECT COUNT(*)::int FROM users WHERE created_at > now() - interval '7 days') AS new_users_week,
        (SELECT COUNT(*)::int FROM questions WHERE is_active) AS questions,
        (SELECT COUNT(*)::int FROM videos WHERE is_active) AS videos,
        (SELECT COUNT(*)::int FROM exams WHERE is_active) AS exams,
        (SELECT COUNT(*)::int FROM flashcards WHERE is_active) AS cards,
        (SELECT COUNT(*)::int FROM flashcard_reviews
           WHERE last_reviewed_at > now() - interval '7 days') AS card_reviews_week,
        (SELECT COUNT(*)::int FROM book_sections) AS book_sections,
        (SELECT COUNT(*)::int FROM attempts WHERE created_at > now() - interval '7 days') AS attempts_week,
        (SELECT COUNT(*)::int FROM ad_events WHERE type = 'impression'
           AND created_at > now() - interval '7 days') AS ad_impressions_week,
        (SELECT COUNT(*)::int FROM ad_events WHERE type = 'click'
           AND created_at > now() - interval '7 days') AS ad_clicks_week
    `);
    res.json({ stats: rows[0] });
  })
);

// ---------------------------------------------------------------- Konular

const topicSchema = z.object({
  name: z.string().min(2).max(120).trim(),
  slug: z.string().max(140).optional(),
  description: z.string().max(500).nullish(),
  icon: z.string().max(60).nullish(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

router.get(
  '/topics',
  asyncHandler(async (_req, res) => {
    const { rows } = await query('SELECT * FROM topics ORDER BY sort_order, name');
    res.json({ topics: rows });
  })
);

router.post(
  '/topics',
  validate(topicSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO topics (name, slug, description, icon, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [b.name, b.slug || slugify(b.name), b.description ?? null, b.icon ?? null, b.sortOrder, b.isActive]
    );
    res.status(201).json({ topic: rows[0] });
  })
);

router.put(
  '/topics/:id',
  validate(topicSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `UPDATE topics SET name = $2, slug = $3, description = $4, icon = $5,
              sort_order = $6, is_active = $7
        WHERE id = $1 RETURNING *`,
      [
        Number(req.params.id), b.name, b.slug || slugify(b.name),
        b.description ?? null, b.icon ?? null, b.sortOrder, b.isActive,
      ]
    );
    if (!rows[0]) throw notFound('Konu bulunamadi.');
    res.json({ topic: rows[0] });
  })
);

router.delete(
  '/topics/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      'SELECT COUNT(*)::int AS n FROM questions WHERE topic_id = $1',
      [Number(req.params.id)]
    );
    if (rows[0].n > 0)
      throw badRequest(`Bu konuda ${rows[0].n} soru var. Once sorulari tasiyin veya silin.`);
    await query('DELETE FROM topics WHERE id = $1', [Number(req.params.id)]);
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------- Sorular

const optionSchema = z.object({
  label: z.string().min(1).max(4),
  text: z.string().min(1).max(2000),
  isCorrect: z.boolean().default(false),
});

const questionSchema = z.object({
  topicId: z.coerce.number().int().positive(),
  type: z.enum(['case', 'classic']).default('classic'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  body: z.string().min(10),
  explanation: z.string().default(''),
  isPremium: z.boolean().default(false),
  isActive: z.boolean().default(true),
  options: z
    .array(optionSchema)
    .min(2, 'En az 2 sik gerekli.')
    .max(6)
    .refine((opts) => opts.filter((o) => o.isCorrect).length === 1, {
      message: 'Tam olarak bir sik dogru isaretlenmeli.',
    }),
});

/** Admin listesi: dogru sik ve cozum dahil (bu uc requireAdmin ile korunuyor). */
router.get(
  '/questions',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const params = [];
    const where = ['1=1'];
    if (req.query.topicId) {
      params.push(Number(req.query.topicId));
      where.push(`q.topic_id = $${params.length}`);
    }
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      where.push(`q.body ILIKE $${params.length}`);
    }
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS total FROM questions q WHERE ${where.join(' AND ')}`,
      params
    );
    params.push(limit, offset);
    const { rows } = await query(
      `SELECT q.*, t.name AS topic_name,
              (SELECT json_agg(json_build_object('id', o.id, 'label', o.label,
                      'text', o.text, 'isCorrect', o.is_correct) ORDER BY o.sort_order, o.label)
                 FROM question_options o WHERE o.question_id = q.id) AS options,
              (SELECT COUNT(*)::int FROM attempts a WHERE a.question_id = q.id) AS attempt_count
         FROM questions q JOIN topics t ON t.id = q.topic_id
        WHERE ${where.join(' AND ')}
        ORDER BY q.id DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ total: countRows[0].total, questions: rows });
  })
);

async function upsertQuestion(client, data, userId, id = null) {
  const body = clean(data.body);
  const explanation = clean(data.explanation);

  let questionId = id;
  if (id) {
    const { rows } = await client.query(
      `UPDATE questions SET topic_id=$2, type=$3, difficulty=$4, body=$5, explanation=$6,
              is_premium=$7, is_active=$8, updated_at=now()
        WHERE id=$1 RETURNING id`,
      [id, data.topicId, data.type, data.difficulty, body, explanation, data.isPremium, data.isActive]
    );
    if (!rows[0]) throw notFound('Soru bulunamadi.');
    await client.query('DELETE FROM question_options WHERE question_id = $1', [id]);
  } else {
    const { rows } = await client.query(
      `INSERT INTO questions (topic_id, type, difficulty, body, explanation, is_premium, is_active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [data.topicId, data.type, data.difficulty, body, explanation, data.isPremium, data.isActive, userId]
    );
    questionId = rows[0].id;
  }

  for (const [i, opt] of data.options.entries()) {
    await client.query(
      `INSERT INTO question_options (question_id, label, text, is_correct, sort_order)
       VALUES ($1, $2, $3, $4, $5)`,
      [questionId, opt.label, clean(opt.text), opt.isCorrect, i]
    );
  }
  return questionId;
}

router.post(
  '/questions',
  validate(questionSchema),
  asyncHandler(async (req, res) => {
    const id = await withTransaction((c) => upsertQuestion(c, req.body, req.user.id));
    res.status(201).json({ id });
  })
);

router.put(
  '/questions/:id',
  validate(questionSchema),
  asyncHandler(async (req, res) => {
    const id = await withTransaction((c) =>
      upsertQuestion(c, req.body, req.user.id, Number(req.params.id))
    );
    res.json({ id });
  })
);

router.delete(
  '/questions/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM questions WHERE id = $1', [
      Number(req.params.id),
    ]);
    if (!rowCount) throw notFound('Soru bulunamadi.');
    res.json({ ok: true });
  })
);

/** Toplu soru ice aktarma (JSON dizisi). Hatali satirlar rapor edilir, digerleri eklenir. */
router.post(
  '/questions/bulk',
  validate(z.object({ questions: z.array(z.unknown()).min(1).max(500) })),
  asyncHandler(async (req, res) => {
    const created = [];
    const errors = [];
    for (const [i, raw] of req.body.questions.entries()) {
      const parsed = questionSchema.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        errors.push({ index: i, error: `${issue.path.join('.') || 'kayit'}: ${issue.message}` });
        continue;
      }
      try {
        const id = await withTransaction((c) => upsertQuestion(c, parsed.data, req.user.id));
        created.push(id);
      } catch (err) {
        errors.push({ index: i, error: err.message });
      }
    }
    res.json({ createdCount: created.length, createdIds: created, errors });
  })
);

// ---------------------------------------------------------------- Sinavlar

const examSchema = z.object({
  title: z.string().min(3).max(200).trim(),
  description: z.string().max(1000).nullish(),
  topicId: z.coerce.number().int().positive().nullish(),
  durationMinutes: z.coerce.number().int().min(1).max(600).default(30),
  isPremium: z.boolean().default(false),
  isActive: z.boolean().default(true),
  questionIds: z.array(z.coerce.number().int().positive()).min(1, 'En az 1 soru secin.'),
});

router.get(
  '/exams',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT e.*, t.name AS topic_name,
              (SELECT COUNT(*)::int FROM exam_questions eq WHERE eq.exam_id = e.id) AS question_count,
              (SELECT COUNT(*)::int FROM exam_sessions es WHERE es.exam_id = e.id) AS session_count
         FROM exams e LEFT JOIN topics t ON t.id = e.topic_id
        ORDER BY e.created_at DESC`
    );
    res.json({ exams: rows });
  })
);

router.get(
  '/exams/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM exams WHERE id = $1', [Number(req.params.id)]);
    if (!rows[0]) throw notFound('Sinav bulunamadi.');
    const { rows: qs } = await query(
      'SELECT question_id, sort_order FROM exam_questions WHERE exam_id = $1 ORDER BY sort_order',
      [Number(req.params.id)]
    );
    res.json({ exam: rows[0], questionIds: qs.map((q) => q.question_id) });
  })
);

async function upsertExam(client, data, id = null) {
  let examId = id;
  if (id) {
    const { rows } = await client.query(
      `UPDATE exams SET title=$2, description=$3, topic_id=$4, duration_minutes=$5,
              is_premium=$6, is_active=$7 WHERE id=$1 RETURNING id`,
      [id, data.title, data.description ?? null, data.topicId ?? null,
       data.durationMinutes, data.isPremium, data.isActive]
    );
    if (!rows[0]) throw notFound('Sinav bulunamadi.');
    await client.query('DELETE FROM exam_questions WHERE exam_id = $1', [id]);
  } else {
    const { rows } = await client.query(
      `INSERT INTO exams (title, description, topic_id, duration_minutes, is_premium, is_active)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [data.title, data.description ?? null, data.topicId ?? null,
       data.durationMinutes, data.isPremium, data.isActive]
    );
    examId = rows[0].id;
  }
  for (const [i, qid] of data.questionIds.entries()) {
    await client.query(
      `INSERT INTO exam_questions (exam_id, question_id, sort_order) VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [examId, qid, i]
    );
  }
  return examId;
}

router.post(
  '/exams',
  validate(examSchema),
  asyncHandler(async (req, res) => {
    const id = await withTransaction((c) => upsertExam(c, req.body));
    res.status(201).json({ id });
  })
);

router.put(
  '/exams/:id',
  validate(examSchema),
  asyncHandler(async (req, res) => {
    const id = await withTransaction((c) => upsertExam(c, req.body, Number(req.params.id)));
    res.json({ id });
  })
);

router.delete(
  '/exams/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM exams WHERE id = $1', [Number(req.params.id)]);
    if (!rowCount) throw notFound('Sinav bulunamadi.');
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------- Videolar

const videoSchema = z
  .object({
    topicId: z.coerce.number().int().positive().nullish(),
    title: z.string().min(3).max(200).trim(),
    description: z.string().max(2000).nullish(),
    source: z.enum(['youtube', 'vimeo', 'upload']),
    url: z.string().url().max(500).nullish(),
    storageKey: z.string().max(500).nullish(),
    durationSeconds: z.coerce.number().int().min(0).nullish(),
    thumbnailUrl: z.string().url().max(500).nullish(),
    isPremium: z.boolean().default(false),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().default(0),
  })
  .refine((v) => (v.source === 'upload' ? Boolean(v.storageKey) : Boolean(v.url)), {
    message: 'Yuklenen video icin storageKey, link icin url zorunlu.',
  });

router.get(
  '/videos',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT v.*, t.name AS topic_name,
              (SELECT COUNT(*)::int FROM video_progress vp WHERE vp.video_id = v.id) AS viewer_count
         FROM videos v LEFT JOIN topics t ON t.id = v.topic_id
        ORDER BY v.sort_order, v.created_at DESC`
    );
    res.json({ videos: rows });
  })
);

router.post(
  '/videos',
  validate(videoSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO videos (topic_id, title, description, source, url, storage_key,
              duration_seconds, thumbnail_url, is_premium, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [b.topicId ?? null, b.title, b.description ?? null, b.source, b.url ?? null,
       b.storageKey ?? null, b.durationSeconds ?? null, b.thumbnailUrl ?? null,
       b.isPremium, b.isActive, b.sortOrder]
    );
    res.status(201).json({ video: rows[0] });
  })
);

router.put(
  '/videos/:id',
  validate(videoSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `UPDATE videos SET topic_id=$2, title=$3, description=$4, source=$5, url=$6,
              storage_key=$7, duration_seconds=$8, thumbnail_url=$9, is_premium=$10,
              is_active=$11, sort_order=$12
        WHERE id=$1 RETURNING *`,
      [Number(req.params.id), b.topicId ?? null, b.title, b.description ?? null, b.source,
       b.url ?? null, b.storageKey ?? null, b.durationSeconds ?? null, b.thumbnailUrl ?? null,
       b.isPremium, b.isActive, b.sortOrder]
    );
    if (!rows[0]) throw notFound('Video bulunamadi.');
    res.json({ video: rows[0] });
  })
);

router.delete(
  '/videos/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM videos WHERE id = $1', [Number(req.params.id)]);
    if (!rowCount) throw notFound('Video bulunamadi.');
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------- Dosya yukleme

router.get('/uploads/status', (_req, res) => res.json({ enabled: storageEnabled() }));

router.post(
  '/uploads/presign',
  validate(
    z.object({
      kind: z.enum(['video', 'image']),
      filename: z.string().min(1).max(200),
      contentType: z.string().min(3).max(120),
      sizeBytes: z.coerce.number().int().min(1).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    res.json(await createUploadUrl(req.body));
  })
);

// ---------------------------------------------------------------- Kullanicilar

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const params = [];
    let where = '1=1';
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      where = `(email ILIKE $1 OR full_name ILIKE $1)`;
    }
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS total FROM users WHERE ${where}`,
      params
    );
    params.push(limit, offset);
    const { rows } = await query(
      `SELECT id, email, full_name, role, is_premium, premium_until, is_blocked,
              total_points, created_at, last_login_at
         FROM users WHERE ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ total: countRows[0].total, users: rows });
  })
);

const userUpdateSchema = z.object({
  isPremium: z.boolean().optional(),
  premiumUntil: z.string().datetime().nullish(),
  role: z.enum(['user', 'admin']).optional(),
  isBlocked: z.boolean().optional(),
});

router.patch(
  '/users/:id',
  validate(userUpdateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body;

    // Admin kendi yetkisini/erisimini kazara kaybetmesin
    if (id === req.user.id && (b.role === 'user' || b.isBlocked === true))
      throw badRequest('Kendi yonetici yetkinizi veya erisiminizi kaldiramazsiniz.');

    const { rows } = await query(
      `UPDATE users SET
          is_premium    = COALESCE($2, is_premium),
          premium_until = CASE WHEN $3::text IS NULL THEN premium_until ELSE $3::timestamptz END,
          role          = COALESCE($4, role),
          is_blocked    = COALESCE($5, is_blocked)
        WHERE id = $1
        RETURNING id, email, full_name, role, is_premium, premium_until, is_blocked, total_points`,
      [id, b.isPremium ?? null, b.premiumUntil ?? null, b.role ?? null, b.isBlocked ?? null]
    );
    if (!rows[0]) throw notFound('Kullanici bulunamadi.');
    res.json({ user: rows[0] });
  })
);

// ---------------------------------------------------------------- Reklamlar

const slotSchema = z.object({
  code: z.string().min(2).max(60).trim(),
  name: z.string().min(2).max(120).trim(),
  provider: z.enum(['adsense', 'custom']).default('custom'),
  adsenseSnippet: z.string().max(4000).nullish(),
  isActive: z.boolean().default(true),
});

router.get(
  '/ad-slots',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT s.*,
              (SELECT COUNT(*)::int FROM ads a WHERE a.slot_id = s.id AND a.is_active) AS active_ads
         FROM ad_slots s ORDER BY s.id`
    );
    res.json({ slots: rows });
  })
);

router.post(
  '/ad-slots',
  validate(slotSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO ad_slots (code, name, provider, adsense_snippet, is_active)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [b.code, b.name, b.provider, b.adsenseSnippet ?? null, b.isActive]
    );
    res.status(201).json({ slot: rows[0] });
  })
);

router.put(
  '/ad-slots/:id',
  validate(slotSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `UPDATE ad_slots SET code=$2, name=$3, provider=$4, adsense_snippet=$5, is_active=$6
        WHERE id=$1 RETURNING *`,
      [Number(req.params.id), b.code, b.name, b.provider, b.adsenseSnippet ?? null, b.isActive]
    );
    if (!rows[0]) throw notFound('Reklam alani bulunamadi.');
    res.json({ slot: rows[0] });
  })
);

const adSchema = z.object({
  slotId: z.coerce.number().int().positive(),
  title: z.string().min(2).max(200).trim(),
  imageUrl: z.string().url().max(500),
  targetUrl: z.string().url().max(500),
  startsAt: z.string().datetime().nullish(),
  endsAt: z.string().datetime().nullish(),
  weight: z.coerce.number().int().min(1).max(100).default(1),
  isActive: z.boolean().default(true),
});

/** Reklam listesi + gosterim/tiklama sayaclari. */
router.get(
  '/ads',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT a.*, s.code AS slot_code, s.name AS slot_name,
              (SELECT COUNT(*)::int FROM ad_events e WHERE e.ad_id = a.id AND e.type='impression') AS impressions,
              (SELECT COUNT(*)::int FROM ad_events e WHERE e.ad_id = a.id AND e.type='click') AS clicks
         FROM ads a JOIN ad_slots s ON s.id = a.slot_id
        ORDER BY a.created_at DESC`
    );
    res.json({
      ads: rows.map((a) => ({
        ...a,
        ctr: a.impressions ? Number(((a.clicks / a.impressions) * 100).toFixed(2)) : 0,
      })),
    });
  })
);

router.post(
  '/ads',
  validate(adSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO ads (slot_id, title, image_url, target_url, starts_at, ends_at, weight, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.slotId, b.title, b.imageUrl, b.targetUrl, b.startsAt ?? null, b.endsAt ?? null, b.weight, b.isActive]
    );
    res.status(201).json({ ad: rows[0] });
  })
);

router.put(
  '/ads/:id',
  validate(adSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `UPDATE ads SET slot_id=$2, title=$3, image_url=$4, target_url=$5,
              starts_at=$6, ends_at=$7, weight=$8, is_active=$9
        WHERE id=$1 RETURNING *`,
      [Number(req.params.id), b.slotId, b.title, b.imageUrl, b.targetUrl,
       b.startsAt ?? null, b.endsAt ?? null, b.weight, b.isActive]
    );
    if (!rows[0]) throw notFound('Reklam bulunamadi.');
    res.json({ ad: rows[0] });
  })
);

router.delete(
  '/ads/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM ads WHERE id = $1', [Number(req.params.id)]);
    if (!rowCount) throw notFound('Reklam bulunamadi.');
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------- Flashcard

const deckSchema = z.object({
  topicId: z.coerce.number().int().positive().nullish(),
  title: z.string().min(2).max(160).trim(),
  slug: z.string().max(180).optional(),
  description: z.string().max(1000).nullish(),
  icon: z.string().max(60).default('style'),
  isPremium: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

router.get(
  '/decks',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT d.*, t.name AS topic_name,
              (SELECT COUNT(*)::int FROM flashcards c WHERE c.deck_id = d.id) AS card_count,
              (SELECT COUNT(DISTINCT r.user_id)::int FROM flashcard_reviews r
                 JOIN flashcards c2 ON c2.id = r.card_id
                WHERE c2.deck_id = d.id) AS learner_count
         FROM flashcard_decks d LEFT JOIN topics t ON t.id = d.topic_id
        ORDER BY d.sort_order, d.title`
    );
    res.json({ decks: rows });
  })
);

router.post(
  '/decks',
  validate(deckSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO flashcard_decks (topic_id, title, slug, description, icon, is_premium, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.topicId ?? null, b.title, b.slug || slugify(b.title), b.description ?? null,
       b.icon, b.isPremium, b.isActive, b.sortOrder]
    );
    res.status(201).json({ deck: rows[0] });
  })
);

router.put(
  '/decks/:id',
  validate(deckSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `UPDATE flashcard_decks SET topic_id=$2, title=$3, slug=$4, description=$5,
              icon=$6, is_premium=$7, is_active=$8, sort_order=$9
        WHERE id=$1 RETURNING *`,
      [Number(req.params.id), b.topicId ?? null, b.title, b.slug || slugify(b.title),
       b.description ?? null, b.icon, b.isPremium, b.isActive, b.sortOrder]
    );
    if (!rows[0]) throw notFound('Deste bulunamadi.');
    res.json({ deck: rows[0] });
  })
);

router.delete(
  '/decks/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM flashcard_decks WHERE id = $1', [
      Number(req.params.id),
    ]);
    if (!rowCount) throw notFound('Deste bulunamadi.');
    res.json({ ok: true });
  })
);

const cardSchema = z.object({
  deckId: z.coerce.number().int().positive(),
  front: z.string().min(3).max(2000),
  back: z.string().min(3).max(6000),
  hint: z.string().max(500).nullish(),
  kind: z.string().max(60).nullish(),
  reference: z.string().max(300).nullish(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

router.get(
  '/cards',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 300);
    const offset = Number(req.query.offset) || 0;
    const params = [];
    const where = ['1=1'];
    if (req.query.deckId) {
      params.push(Number(req.query.deckId));
      where.push(`c.deck_id = $${params.length}`);
    }
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      where.push(`(c.front ILIKE $${params.length} OR c.back ILIKE $${params.length})`);
    }
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS total FROM flashcards c WHERE ${where.join(' AND ')}`,
      params
    );
    params.push(limit, offset);
    const { rows } = await query(
      `SELECT c.*, d.title AS deck_title
         FROM flashcards c JOIN flashcard_decks d ON d.id = c.deck_id
        WHERE ${where.join(' AND ')}
        ORDER BY c.deck_id, c.sort_order, c.id
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ total: countRows[0].total, cards: rows });
  })
);

router.post(
  '/cards',
  validate(cardSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO flashcards (deck_id, front, back, hint, kind, reference, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.deckId, clean(b.front), clean(b.back), b.hint ?? null, b.kind ?? null,
       b.reference ?? null, b.sortOrder, b.isActive]
    );
    res.status(201).json({ card: rows[0] });
  })
);

router.put(
  '/cards/:id',
  validate(cardSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `UPDATE flashcards SET deck_id=$2, front=$3, back=$4, hint=$5, kind=$6,
              reference=$7, sort_order=$8, is_active=$9
        WHERE id=$1 RETURNING *`,
      [Number(req.params.id), b.deckId, clean(b.front), clean(b.back), b.hint ?? null,
       b.kind ?? null, b.reference ?? null, b.sortOrder, b.isActive]
    );
    if (!rows[0]) throw notFound('Kart bulunamadi.');
    res.json({ card: rows[0] });
  })
);

router.delete(
  '/cards/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM flashcards WHERE id = $1', [
      Number(req.params.id),
    ]);
    if (!rowCount) throw notFound('Kart bulunamadi.');
    res.json({ ok: true });
  })
);

/** Toplu kart ekleme (JSON dizisi). */
router.post(
  '/cards/bulk',
  validate(
    z.object({
      deckId: z.coerce.number().int().positive(),
      cards: z.array(z.object({
        front: z.string().min(3),
        back: z.string().min(3),
        kind: z.string().max(60).nullish(),
        reference: z.string().max(300).nullish(),
      })).min(1).max(500),
    })
  ),
  asyncHandler(async (req, res) => {
    const { deckId, cards } = req.body;
    const created = await withTransaction(async (client) => {
      const ids = [];
      for (const [i, c] of cards.entries()) {
        const { rows } = await client.query(
          `INSERT INTO flashcards (deck_id, front, back, kind, reference, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [deckId, clean(c.front), clean(c.back), c.kind ?? null, c.reference ?? null, i]
        );
        ids.push(rows[0].id);
      }
      return ids;
    });
    res.json({ createdCount: created.length, createdIds: created });
  })
);

// ---------------------------------------------------------------- E-kitap

const bookSchema = z.object({
  title: z.string().min(2).max(200).trim(),
  slug: z.string().max(220).optional(),
  subtitle: z.string().max(300).nullish(),
  description: z.string().max(2000).nullish(),
  coverUrl: z.string().url().max(500).nullish(),
  isPremium: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

router.get(
  '/books',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT b.*,
              (SELECT COUNT(*)::int FROM book_chapters ch WHERE ch.book_id = b.id) AS chapter_count,
              (SELECT COUNT(*)::int FROM book_sections s
                 JOIN book_chapters ch2 ON ch2.id = s.chapter_id
                WHERE ch2.book_id = b.id) AS section_count
         FROM books b ORDER BY b.sort_order, b.title`
    );
    res.json({ books: rows });
  })
);

router.post(
  '/books',
  validate(bookSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO books (title, slug, subtitle, description, cover_url, is_premium, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.title, b.slug || slugify(b.title), b.subtitle ?? null, b.description ?? null,
       b.coverUrl ?? null, b.isPremium, b.isActive, b.sortOrder]
    );
    res.status(201).json({ book: rows[0] });
  })
);

router.put(
  '/books/:id',
  validate(bookSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `UPDATE books SET title=$2, slug=$3, subtitle=$4, description=$5, cover_url=$6,
              is_premium=$7, is_active=$8, sort_order=$9
        WHERE id=$1 RETURNING *`,
      [Number(req.params.id), b.title, b.slug || slugify(b.title), b.subtitle ?? null,
       b.description ?? null, b.coverUrl ?? null, b.isPremium, b.isActive, b.sortOrder]
    );
    if (!rows[0]) throw notFound('Kitap bulunamadi.');
    res.json({ book: rows[0] });
  })
);

router.delete(
  '/books/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM books WHERE id = $1', [Number(req.params.id)]);
    if (!rowCount) throw notFound('Kitap bulunamadi.');
    res.json({ ok: true });
  })
);

/** Kitabin tum bolum/alt bolum agaci (duzenleme ekrani icin). */
router.get(
  '/books/:id/tree',
  asyncHandler(async (req, res) => {
    const bookId = Number(req.params.id);
    const { rows: chapters } = await query(
      'SELECT * FROM book_chapters WHERE book_id = $1 ORDER BY sort_order, id',
      [bookId]
    );
    const { rows: sections } = await query(
      `SELECT s.id, s.chapter_id, s.number, s.slug, s.title, s.is_premium, s.sort_order,
              LENGTH(s.content) AS content_length
         FROM book_sections s JOIN book_chapters ch ON ch.id = s.chapter_id
        WHERE ch.book_id = $1 ORDER BY ch.sort_order, s.sort_order, s.id`,
      [bookId]
    );
    res.json({
      chapters: chapters.map((ch) => ({
        ...ch,
        sections: sections.filter((s) => s.chapter_id === ch.id),
      })),
    });
  })
);

const chapterSchema = z.object({
  bookId: z.coerce.number().int().positive(),
  number: z.string().max(20),
  title: z.string().min(2).max(200),
  subtitle: z.string().max(500).nullish(),
  sortOrder: z.coerce.number().int().default(0),
});

router.post(
  '/book-chapters',
  validate(chapterSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO book_chapters (book_id, number, title, subtitle, sort_order)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [b.bookId, b.number, b.title, b.subtitle ?? null, b.sortOrder]
    );
    res.status(201).json({ chapter: rows[0] });
  })
);

router.put(
  '/book-chapters/:id',
  validate(chapterSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `UPDATE book_chapters SET book_id=$2, number=$3, title=$4, subtitle=$5, sort_order=$6
        WHERE id=$1 RETURNING *`,
      [Number(req.params.id), b.bookId, b.number, b.title, b.subtitle ?? null, b.sortOrder]
    );
    if (!rows[0]) throw notFound('Bolum bulunamadi.');
    res.json({ chapter: rows[0] });
  })
);

router.delete(
  '/book-chapters/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM book_chapters WHERE id = $1', [
      Number(req.params.id),
    ]);
    if (!rowCount) throw notFound('Bolum bulunamadi.');
    res.json({ ok: true });
  })
);

const sectionSchema = z.object({
  chapterId: z.coerce.number().int().positive(),
  topicId: z.coerce.number().int().positive().nullish(),
  number: z.string().max(20),
  slug: z.string().max(220).optional(),
  title: z.string().min(2).max(300),
  content: z.string().default(''),
  isPremium: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

router.get(
  '/book-sections/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM book_sections WHERE id = $1', [
      Number(req.params.id),
    ]);
    if (!rows[0]) throw notFound('Alt bolum bulunamadi.');
    res.json({ section: rows[0] });
  })
);

router.post(
  '/book-sections',
  validate(sectionSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO book_sections (chapter_id, topic_id, number, slug, title, content, is_premium, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.chapterId, b.topicId ?? null, b.number, b.slug || slugify(`${b.number} ${b.title}`),
       b.title, clean(b.content), b.isPremium, b.sortOrder]
    );
    res.status(201).json({ section: rows[0] });
  })
);

router.put(
  '/book-sections/:id',
  validate(sectionSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `UPDATE book_sections SET chapter_id=$2, topic_id=$3, number=$4, slug=$5, title=$6,
              content=$7, is_premium=$8, sort_order=$9
        WHERE id=$1 RETURNING *`,
      [Number(req.params.id), b.chapterId, b.topicId ?? null, b.number,
       b.slug || slugify(`${b.number} ${b.title}`), b.title, clean(b.content),
       b.isPremium, b.sortOrder]
    );
    if (!rows[0]) throw notFound('Alt bolum bulunamadi.');
    res.json({ section: rows[0] });
  })
);

router.delete(
  '/book-sections/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM book_sections WHERE id = $1', [
      Number(req.params.id),
    ]);
    if (!rowCount) throw notFound('Alt bolum bulunamadi.');
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------- Rozetler

const badgeSchema = z.object({
  code: z.string().min(2).max(60).trim(),
  name: z.string().min(2).max(120).trim(),
  description: z.string().min(2).max(300),
  icon: z.string().max(60).default('military_tech'),
  ruleType: z.enum([
    'questions_solved', 'topic_mastery', 'accuracy',
    'points_total', 'exams_completed', 'videos_completed',
    'cards_reviewed', 'sections_read',
  ]),
  ruleParams: z.record(z.unknown()).default({}),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

router.get(
  '/badges',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT b.*, (SELECT COUNT(*)::int FROM user_badges ub WHERE ub.badge_id = b.id) AS earned_count
         FROM badges b ORDER BY b.sort_order, b.name`
    );
    res.json({ badges: rows });
  })
);

router.post(
  '/badges',
  validate(badgeSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO badges (code, name, description, icon, rule_type, rule_params, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.code, b.name, b.description, b.icon, b.ruleType, JSON.stringify(b.ruleParams), b.sortOrder, b.isActive]
    );
    res.status(201).json({ badge: rows[0] });
  })
);

router.put(
  '/badges/:id',
  validate(badgeSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `UPDATE badges SET code=$2, name=$3, description=$4, icon=$5, rule_type=$6,
              rule_params=$7, sort_order=$8, is_active=$9
        WHERE id=$1 RETURNING *`,
      [Number(req.params.id), b.code, b.name, b.description, b.icon, b.ruleType,
       JSON.stringify(b.ruleParams), b.sortOrder, b.isActive]
    );
    if (!rows[0]) throw notFound('Rozet bulunamadi.');
    res.json({ badge: rows[0] });
  })
);

router.delete(
  '/badges/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM badges WHERE id = $1', [Number(req.params.id)]);
    if (!rowCount) throw notFound('Rozet bulunamadi.');
    res.json({ ok: true });
  })
);

module.exports = router;
