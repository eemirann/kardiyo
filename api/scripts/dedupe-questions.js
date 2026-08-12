/**
 * Ayni sorunun tekrarlarini temizler.
 *
 * Kaynak setlerde ayni soru yalnizca yas/cinsiyet degistirilerek defalarca geciyor.
 * Govdeler farkli oldugu icin ice aktarma bunlari ayri kayit sayiyor; burada
 * "sik kumesi + dogru sik" ayni olan sorular tek kayda indirilir.
 *
 * Ayni konudaki sorular karsilastirilir (konular arasi birlestirme yapilmaz).
 * Kalacak kayit: en cok denemede kullanilan, esitlikte en kucuk id.
 * Silinenlere bagli deneme ve cevap kayitlari kalan soruya tasinir.
 *
 *   npm run dedupe-questions            -> yalnizca rapor (hicbir sey silinmez)
 *   npm run dedupe-questions -- --apply -> uygular
 */
require('dotenv').config();
const { pool } = require('../config/db');

const GROUPS = `
  WITH o AS (
    SELECT question_id,
           md5(string_agg(lower(text) || ':' || is_correct, '|' ORDER BY lower(text))) AS h
      FROM question_options GROUP BY question_id
  )
  SELECT o.h, q.topic_id, array_agg(q.id ORDER BY q.id) AS ids
    FROM o JOIN questions q ON q.id = o.question_id
   GROUP BY o.h, q.topic_id
  HAVING COUNT(*) > 1
`;

async function run() {
  const apply = process.argv.includes('--apply');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: groups } = await client.query(GROUPS);
    const { rows: usage } = await client.query(
      'SELECT question_id, COUNT(*)::int n FROM exam_questions GROUP BY question_id'
    );
    const examCount = new Map(usage.map((u) => [u.question_id, u.n]));

    let removed = 0;
    const removedIds = [];
    for (const g of groups) {
      // En cok denemede kullanilan kalsin; esitlikte en eski (kucuk id)
      const keep = [...g.ids].sort(
        (a, b) => (examCount.get(b) || 0) - (examCount.get(a) || 0) || a - b
      )[0];
      const drop = g.ids.filter((id) => id !== keep);
      removedIds.push(...drop);
      removed += drop.length;

      if (!apply) continue;
      for (const id of drop) {
        // Denemelerdeki yeri kalan soruya tasinir; sinav zaten kalan soruyu
        // iceriyorsa (ayni sinavda iki kopya vardi) o slot dusulur
        await client.query(
          `UPDATE exam_questions SET question_id = $2
            WHERE question_id = $1
              AND NOT EXISTS (SELECT 1 FROM exam_questions e2
                               WHERE e2.exam_id = exam_questions.exam_id AND e2.question_id = $2)`,
          [id, keep]
        );
        await client.query(
          `UPDATE attempts SET question_id = $2 WHERE question_id = $1`,
          [id, keep]
        );
      }
      await client.query('DELETE FROM questions WHERE id = ANY($1::int[])', [drop]);
    }

    const { rows: after } = await client.query('SELECT COUNT(*)::int n FROM questions');
    const { rows: small } = await client.query(
      `SELECT e.title, COUNT(eq.question_id)::int n
         FROM exams e LEFT JOIN exam_questions eq ON eq.exam_id = e.id
        GROUP BY e.title HAVING COUNT(eq.question_id) < 20 ORDER BY 2`
    );

    if (apply) await client.query('COMMIT');
    else await client.query('ROLLBACK');

    console.log(`${apply ? 'Silinen' : '[rapor] Silinecek'} tekrar: ${removed} (${groups.length} grup)`);
    console.log(`Soru sayisi: ${after[0].n}`);
    if (small.length) {
      console.log('\n20 soruya ulasmayan denemeler:');
      for (const s of small) console.log(`  ${s.n} soru — ${s.title}`);
    }
    if (!apply) console.log('\nDegisiklik YAPILMADI. Uygulamak icin: npm run dedupe-questions -- --apply');
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
