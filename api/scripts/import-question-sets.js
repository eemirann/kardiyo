/**
 * "10 Adimda Kardiyo" konu bazli soru setlerini (9 x 50 soru) yukler.
 *
 * Kaynak: api/data/question-sets.json (tools/pdf-import/parse-question-sets.js uretir)
 *
 * --clean verilirse: hicbir deneme sinavinda kullanilmayan mevcut sorular silinir.
 * Sinavlara bagli sorulara dokunulmaz, boylece denemeler bozulmaz.
 *
 *   npm run import-question-sets
 *   npm run import-question-sets -- --clean
 */
require('dotenv').config();
const path = require('path');
const { pool } = require('../config/db');

const { sets } = require(path.join(__dirname, '..', 'data', 'question-sets.json'));

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const difficultyOf = (q) => (q.stem.length > 380 ? 'hard' : 'medium');
const typeOf = (q) => (/yaşında|hasta|başvur/i.test(q.stem) ? 'case' : 'classic');

async function run() {
  const clean = process.argv.includes('--clean');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (clean) {
      // Sinavlarda kullanilmayan sorular: eski seed ve onceki ice aktarmalardan kalanlar
      const { rows } = await client.query(
        `DELETE FROM questions q
          WHERE NOT EXISTS (SELECT 1 FROM exam_questions eq WHERE eq.question_id = q.id)
          RETURNING id`
      );
      console.log(`Temizlik: sınava bağlı olmayan ${rows.length} soru silindi.`);
    }

    const { rows: topicRows } = await client.query('SELECT id, slug FROM topics');
    const topicId = new Map(topicRows.map((t) => [t.slug, t.id]));

    const { rows: adminRows } = await client.query(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1"
    );
    const adminId = adminRows[0]?.id || null;

    let added = 0;
    let updated = 0;

    for (const set of sets) {
      const tid = topicId.get(set.topicSlug);
      if (!tid) throw new Error(`Konu bulunamadi: ${set.topicSlug}`);

      for (const q of set.questions) {
        const body = `<p>${esc(q.stem)}</p>`;
        const correct = q.options.find((o) => o.isCorrect);
        const explanation =
          `<p><strong>Doğru Cevap: ${q.answer}) ${esc(correct?.text || '')}</strong></p>` +
          `<p>${esc(q.explanation)}</p>` +
          (q.reference ? `<p><em>Notlarda nereden çalışılmalı: ${esc(q.reference)}</em></p>` : '');

        const { rows: existing } = await client.query(
          'SELECT id FROM questions WHERE topic_id = $1 AND md5(body) = md5($2)',
          [tid, body]
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
          updated += 1;
        } else {
          const { rows } = await client.query(
            `INSERT INTO questions (topic_id, type, difficulty, body, explanation, created_by)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
            [tid, typeOf(q), difficultyOf(q), body, explanation, adminId]
          );
          qid = rows[0].id;
          added += 1;
        }

        for (const [i, o] of q.options.entries()) {
          await client.query(
            `INSERT INTO question_options (question_id, label, text, is_correct, sort_order)
             VALUES ($1,$2,$3,$4,$5)`,
            [qid, o.label, o.text, o.isCorrect, i]
          );
        }
      }
      console.log(`  ${set.name.padEnd(28)} ${set.questions.length} soru`);
    }

    await client.query('COMMIT');
    console.log(`\nEklenen: ${added} | Güncellenen: ${updated}`);

    const { rows: stat } = await client.query(
      `SELECT t.name, COUNT(q.id)::int soru
         FROM topics t LEFT JOIN questions q ON q.topic_id = t.id
        GROUP BY t.name ORDER BY 2 DESC`
    );
    console.table(stat);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Islem basarisiz:', err.message);
  process.exit(1);
});
