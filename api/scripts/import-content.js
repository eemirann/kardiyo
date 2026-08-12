/**
 * OKU klasorundeki PDF'lerden uretilen icerigi (api/data/*.json) veritabanina aktarir.
 *
 * Aktarilanlar:
 *   - "Kardiyovaskuler Farmakoloji" konusu
 *   - 50 TUS/USMLE sorusu + cozumleri  (soru bankasi)
 *   - 50 soruluk deneme sinavi
 *   - Farmakoloji kilavuzu (e-kitap: 8 bolum / 32 alt bolum)
 *   - 75 flashcard destesi
 *   - Flashcard ve okuma rozetleri
 *
 * Tekrar calistirilabilir: ayni icerik varsa guncellenir, cogaltilmaz.
 */
require('dotenv').config();
const path = require('path');
const { pool } = require('../config/db');

const questions = require(path.join(__dirname, '..', 'data', 'questions.json'));
const guide = require(path.join(__dirname, '..', 'data', 'guide.json'));
const cards = require(path.join(__dirname, '..', 'data', 'cards.json'));

const TOPIC = {
  name: 'Kardiyovasküler Farmakoloji',
  slug: 'kardiyovaskuler-farmakoloji',
  icon: 'pill',
  description: 'Kalp yetmezliği, hipertansiyon, AKS, aritmi ve endokardit ilaç tedavileri.',
  order: 6,
};

const BOOK = {
  title: 'Kardiyovasküler Klinik Farmakoloji',
  slug: 'kardiyovaskuler-farmakoloji',
  subtitle: 'Moleküler farmakolojiden yatak başı uygulamaya',
  description:
    'Katzung moleküler derinliği, Braunwald klinik pratiği ve güncel ESC/ACC-AHA kılavuzlarının sentezi. ' +
    'Sekiz bölümde etken maddeler, mekanizma, endikasyon, doz ve kritik hatalar.',
};

const DECK = {
  title: 'Kardiyovasküler Farmakoloji Kartları',
  slug: 'kardiyovaskuler-farmakoloji',
  icon: 'pill',
  description: 'Ticari adlar, etki mekanizmaları, dozlar ve malpraktis önlemleri.',
};

const NEW_BADGES = [
  { code: 'kart-100', name: 'Kart Kurdu', description: '100 flashcard tekrarı tamamladın.',
    icon: 'style', rule_type: 'cards_reviewed', rule_params: { count: 100 }, sort_order: 11 },
  { code: 'kart-500', name: 'Hafıza Ustası', description: '500 flashcard tekrarı tamamladın.',
    icon: 'psychology', rule_type: 'cards_reviewed', rule_params: { count: 500 }, sort_order: 12 },
  { code: 'okur-10', name: 'Meraklı Okur', description: '10 kitap bölümünü okudun.',
    icon: 'menu_book', rule_type: 'sections_read', rule_params: { count: 10 }, sort_order: 13 },
  { code: 'okur-32', name: 'Kılavuzu Bitirdi', description: 'Farmakoloji kılavuzunun tamamını okudun.',
    icon: 'auto_stories', rule_type: 'sections_read', rule_params: { count: 32 }, sort_order: 14 },
];

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Uzun vaka koku olan sorulari "zor", digerlerini "orta" say. */
const difficultyOf = (q) => (q.stem.length > 380 ? 'hard' : 'medium');
const typeOf = (q) => (/yaşında|hasta|başvur/i.test(q.stem) ? 'case' : 'classic');

/** Kilavuz bloklarini okunabilir HTML'e cevirir. */
function blocksToHtml(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.type === 'heading') {
      out.push(`<h3>${esc(b.text)}</h3>`);
    } else if (b.type === 'paragraph') {
      // "Terim: aciklama" bicimini kalinlastir
      const m = b.text.match(/^([^:]{3,70}):\s+(.*)$/);
      out.push(
        m && !/[.!?]/.test(m[1])
          ? `<p><strong>${esc(m[1])}:</strong> ${esc(m[2])}</p>`
          : `<p>${esc(b.text)}</p>`
      );
    } else if (b.type === 'callout') {
      out.push(
        `<blockquote><h4>${esc(b.title)}</h4><p>${esc(b.text)}</p></blockquote>`
      );
    } else if (b.type === 'table') {
      const [head, ...rows] = b.rows;
      const thead = head
        ? `<thead><tr>${head.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>`
        : '';
      const tbody = rows
        .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
        .join('');
      out.push(
        `<p><em>${esc(b.caption)}</em></p><table>${thead}<tbody>${tbody}</tbody></table>`
      );
    }
  }
  return out.join('\n');
}

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- Konu
    const { rows: topicRows } = await client.query(
      `INSERT INTO topics (name, slug, description, icon, sort_order)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (slug) DO UPDATE
         SET name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon
       RETURNING id`,
      [TOPIC.name, TOPIC.slug, TOPIC.description, TOPIC.icon, TOPIC.order]
    );
    const topicId = topicRows[0].id;

    const { rows: adminRows } = await client.query(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1"
    );
    const adminId = adminRows[0]?.id || null;

    // --- Sorular
    const questionIds = [];
    for (const q of questions) {
      const body = `<p>${esc(q.stem)}</p>`;
      const explanation =
        `<p><strong>Doğru Cevap: ${q.answer}) ${esc(
          q.options.find((o) => o.isCorrect)?.text || ''
        )}</strong></p>` +
        `<p>${esc(q.explanation)}</p>` +
        (q.reference ? `<p><em>Kaynak: ${esc(q.reference)}</em></p>` : '');

      const { rows: existing } = await client.query(
        'SELECT id FROM questions WHERE topic_id = $1 AND LEFT(body, 80) = LEFT($2, 80)',
        [topicId, body]
      );

      let qid;
      if (existing[0]) {
        qid = existing[0].id;
        await client.query('DELETE FROM question_options WHERE question_id = $1', [qid]);
        await client.query(
          `UPDATE questions SET type=$2, difficulty=$3, body=$4, explanation=$5, updated_at=now()
            WHERE id=$1`,
          [qid, typeOf(q), difficultyOf(q), body, explanation]
        );
      } else {
        const { rows } = await client.query(
          `INSERT INTO questions (topic_id, type, difficulty, body, explanation, created_by)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [topicId, typeOf(q), difficultyOf(q), body, explanation, adminId]
        );
        qid = rows[0].id;
      }
      questionIds.push(qid);

      for (const [i, o] of q.options.entries()) {
        await client.query(
          `INSERT INTO question_options (question_id, label, text, is_correct, sort_order)
           VALUES ($1,$2,$3,$4,$5)`,
          [qid, o.label, o.text, o.isCorrect, i]
        );
      }
    }

    // --- Deneme sinavi
    const examTitle = 'Kardiyovasküler Farmakoloji Denemesi (50 Soru)';
    const { rows: examRows } = await client.query(
      `INSERT INTO exams (title, description, topic_id, duration_minutes)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        examTitle,
        'TUS / USMLE tarzı, çözümlü 50 soruluk kardiyovasküler farmakoloji denemesi.',
        topicId,
        75,
      ]
    );
    let examId = examRows[0]?.id;
    if (!examId) {
      const { rows } = await client.query('SELECT id FROM exams WHERE title = $1', [examTitle]);
      examId = rows[0]?.id;
      if (!examId) {
        const { rows: created } = await client.query(
          `INSERT INTO exams (title, description, topic_id, duration_minutes)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [examTitle, 'TUS / USMLE tarzı çözümlü deneme.', topicId, 75]
        );
        examId = created[0].id;
      }
    }
    await client.query('DELETE FROM exam_questions WHERE exam_id = $1', [examId]);
    for (const [i, qid] of questionIds.entries()) {
      await client.query(
        'INSERT INTO exam_questions (exam_id, question_id, sort_order) VALUES ($1,$2,$3)',
        [examId, qid, i]
      );
    }

    // --- E-kitap
    const { rows: bookRows } = await client.query(
      `INSERT INTO books (title, slug, subtitle, description, sort_order)
       VALUES ($1,$2,$3,$4,1)
       ON CONFLICT (slug) DO UPDATE
         SET title = EXCLUDED.title, subtitle = EXCLUDED.subtitle, description = EXCLUDED.description
       RETURNING id`,
      [BOOK.title, BOOK.slug, BOOK.subtitle, BOOK.description]
    );
    const bookId = bookRows[0].id;

    // Bolumleri bastan kur (icerik PDF'ten uretildigi icin kaynak tek dogruluk noktasi)
    await client.query('DELETE FROM book_chapters WHERE book_id = $1', [bookId]);

    let sectionCount = 0;
    for (const [ci, ch] of guide.entries()) {
      const { rows: chRows } = await client.query(
        `INSERT INTO book_chapters (book_id, number, title, subtitle, sort_order)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [bookId, String(ch.number), ch.title, ch.subtitle || null, ci]
      );
      const chapterId = chRows[0].id;

      for (const [si, sec] of ch.sections.entries()) {
        await client.query(
          `INSERT INTO book_sections (chapter_id, topic_id, number, slug, title, content, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            chapterId,
            topicId,
            sec.number,
            slugify(`${sec.number}-${sec.title}`),
            sec.title,
            blocksToHtml(sec.blocks),
            si,
          ]
        );
        sectionCount++;
      }
    }

    // --- Flashcard destesi
    const { rows: deckRows } = await client.query(
      `INSERT INTO flashcard_decks (topic_id, title, slug, description, icon, sort_order)
       VALUES ($1,$2,$3,$4,$5,1)
       ON CONFLICT (slug) DO UPDATE
         SET title = EXCLUDED.title, description = EXCLUDED.description, topic_id = EXCLUDED.topic_id
       RETURNING id`,
      [topicId, DECK.title, DECK.slug, DECK.description, DECK.icon]
    );
    const deckId = deckRows[0].id;

    // Kartlari tazele (kullanici tekrar gecmisi card_id'ye bagli oldugundan
    // ayni on yuze sahip kart guncellenir, silinmez)
    for (const [i, c] of cards.entries()) {
      const { rows: existing } = await client.query(
        'SELECT id FROM flashcards WHERE deck_id = $1 AND front = $2',
        [deckId, c.front]
      );
      if (existing[0]) {
        await client.query(
          'UPDATE flashcards SET back=$2, kind=$3, reference=$4, sort_order=$5 WHERE id=$1',
          [existing[0].id, c.back, c.kind, c.reference, i]
        );
      } else {
        await client.query(
          `INSERT INTO flashcards (deck_id, front, back, kind, reference, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [deckId, c.front, c.back, c.kind, c.reference, i]
        );
      }
    }

    // --- Yeni rozetler
    for (const b of NEW_BADGES) {
      await client.query(
        `INSERT INTO badges (code, name, description, icon, rule_type, rule_params, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (code) DO UPDATE
           SET name=EXCLUDED.name, description=EXCLUDED.description, icon=EXCLUDED.icon,
               rule_type=EXCLUDED.rule_type, rule_params=EXCLUDED.rule_params`,
        [b.code, b.name, b.description, b.icon, b.rule_type, JSON.stringify(b.rule_params), b.sort_order]
      );
    }

    await client.query('COMMIT');

    console.log('İçerik aktarımı tamam:');
    console.log(`  Konu        : ${TOPIC.name}`);
    console.log(`  Soru        : ${questionIds.length}`);
    console.log(`  Deneme      : ${examTitle} (${questionIds.length} soru, 75 dk)`);
    console.log(`  E-kitap     : ${guide.length} bölüm / ${sectionCount} alt bölüm`);
    console.log(`  Flashcard   : ${cards.length} kart`);
    console.log(`  Yeni rozet  : ${NEW_BADGES.length}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('İçerik aktarımı başarısız:', err.message);
  process.exit(1);
});
