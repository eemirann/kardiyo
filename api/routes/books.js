const express = require('express');
const { query, withTransaction } = require('../config/db');
const { asyncHandler, notFound, premiumRequired } = require('../utils/http');
const { requireAuth, optionalAuth, hasPremiumAccess } = require('../middleware/auth');
const { checkAndAwardBadges } = require('../services/badgeEngine');

const router = express.Router();

/** Kitap listesi. */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const premium = hasPremiumAccess(req.user);
    const { rows } = await query(
      `SELECT b.*,
              (SELECT COUNT(*)::int FROM book_chapters ch WHERE ch.book_id = b.id) AS chapter_count,
              (SELECT COUNT(*)::int FROM book_sections s
                 JOIN book_chapters ch2 ON ch2.id = s.chapter_id
                WHERE ch2.book_id = b.id) AS section_count,
              COALESCE((
                SELECT COUNT(*)::int FROM book_progress bp
                  JOIN book_sections s2 ON s2.id = bp.section_id
                  JOIN book_chapters ch3 ON ch3.id = s2.chapter_id
                 WHERE ch3.book_id = b.id AND bp.user_id = $1 AND bp.completed
              ), 0) AS read_count
         FROM books b
        WHERE b.is_active
        ORDER BY b.sort_order, b.title`,
      [req.user?.id || null]
    );

    res.json({
      books: rows.map((b) => ({
        id: b.id,
        title: b.title,
        slug: b.slug,
        subtitle: b.subtitle,
        description: b.description,
        coverUrl: b.cover_url,
        pdfUrl: b.pdf_url,
        isPremium: b.is_premium,
        locked: b.is_premium && !premium,
        chapterCount: b.chapter_count,
        sectionCount: b.section_count,
        readCount: b.read_count,
      })),
    });
  })
);

/** Kitap icindekiler tablosu. */
router.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM books WHERE slug = $1 AND is_active', [
      req.params.slug,
    ]);
    const book = rows[0];
    if (!book) throw notFound('Kitap bulunamadi.');
    if (book.is_premium && !hasPremiumAccess(req.user)) throw premiumRequired();

    const { rows: chapters } = await query(
      'SELECT * FROM book_chapters WHERE book_id = $1 ORDER BY sort_order, id',
      [book.id]
    );
    const { rows: sections } = await query(
      `SELECT s.id, s.chapter_id, s.number, s.slug, s.title, s.is_premium,
              LENGTH(s.content) AS content_length,
              (bp.user_id IS NOT NULL) AS is_read
         FROM book_sections s
         JOIN book_chapters ch ON ch.id = s.chapter_id
         LEFT JOIN book_progress bp ON bp.section_id = s.id AND bp.user_id = $2
        WHERE ch.book_id = $1
        ORDER BY ch.sort_order, s.sort_order, s.id`,
      [book.id, req.user?.id || null]
    );

    const premium = hasPremiumAccess(req.user);
    res.json({
      book: {
        id: book.id,
        title: book.title,
        slug: book.slug,
        subtitle: book.subtitle,
        description: book.description,
        coverUrl: book.cover_url,
        pdfUrl: book.pdf_url,
      },
      chapters: chapters.map((ch) => ({
        id: ch.id,
        number: ch.number,
        title: ch.title,
        subtitle: ch.subtitle,
        sections: sections
          .filter((s) => s.chapter_id === ch.id)
          .map((s) => ({
            id: s.id,
            number: s.number,
            slug: s.slug,
            title: s.title,
            isPremium: s.is_premium,
            locked: s.is_premium && !premium,
            isRead: s.is_read,
            // Kabaca okuma suresi (dakika): 1000 karakter ~ 1 dakika
            readingMinutes: Math.max(1, Math.round(s.content_length / 1000)),
          })),
      })),
    });
  })
);

/** Tek bolum icerigi + onceki/sonraki gezinme. */
router.get(
  '/:slug/:sectionSlug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { rows: bookRows } = await query(
      'SELECT * FROM books WHERE slug = $1 AND is_active',
      [req.params.slug]
    );
    const book = bookRows[0];
    if (!book) throw notFound('Kitap bulunamadi.');

    const { rows: all } = await query(
      `SELECT s.*, ch.number AS chapter_number, ch.title AS chapter_title,
              ch.sort_order AS chapter_order
         FROM book_sections s
         JOIN book_chapters ch ON ch.id = s.chapter_id
        WHERE ch.book_id = $1
        ORDER BY ch.sort_order, s.sort_order, s.id`,
      [book.id]
    );

    const index = all.findIndex((s) => s.slug === req.params.sectionSlug);
    if (index === -1) throw notFound('Bolum bulunamadi.');
    const section = all[index];

    if ((section.is_premium || book.is_premium) && !hasPremiumAccess(req.user))
      throw premiumRequired();

    const nav = (s) => (s ? { slug: s.slug, number: s.number, title: s.title } : null);

    res.json({
      book: { title: book.title, slug: book.slug },
      section: {
        id: section.id,
        number: section.number,
        slug: section.slug,
        title: section.title,
        content: section.content,
        chapterNumber: section.chapter_number,
        chapterTitle: section.chapter_title,
        topicId: section.topic_id,
      },
      prev: nav(all[index - 1]),
      next: nav(all[index + 1]),
      position: { index: index + 1, total: all.length },
    });
  })
);

/** Bolumu okundu isaretle. */
router.post(
  '/sections/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { rowCount } = await query('SELECT 1 FROM book_sections WHERE id = $1', [id]);
    if (!rowCount) throw notFound('Bolum bulunamadi.');

    const newBadges = await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO book_progress (user_id, section_id) VALUES ($1, $2)
         ON CONFLICT (user_id, section_id) DO UPDATE SET completed = TRUE, updated_at = now()`,
        [req.user.id, id]
      );
      return checkAndAwardBadges(client, req.user.id);
    });

    res.json({ ok: true, newBadges });
  })
);

module.exports = router;
