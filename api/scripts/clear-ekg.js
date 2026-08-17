/**
 * EKG Quiz icerigini veritabanindan tamamen siler.
 *
 * Siteyi yeni OKU/EKG klasorundeki icerikle sifirdan kurmak icin kullanilir:
 * once bu, sonra prepare-ekg-images ve import-ekg.
 *
 * Silinen konular: eski tek konu (ekg-quiz) ve kategori konulari (ekg-<kod>).
 * Soru bankasindaki ayri "EKG Analizi" (ekg-analizi) konusu bu isin disindadir,
 * dokunulmaz.
 * questions.topic_id ON DELETE CASCADE oldugu icin konuyu silmek sorulari,
 * onlar da siklari (question_options) ve DENEMELERI (attempts) silmeyi tetikler
 * — yani kullanicilarin EKG cozum gecmisi de gider. Kazanilmis puanlar
 * users tablosunda durdugu icin geri alinmaz.
 *
 *   npm run clear-ekg              -> yalnizca ne silinecegini raporlar
 *   npm run clear-ekg -- --yes     -> siler
 */
require('dotenv').config();
const { pool } = require('../config/db');
const { CATEGORIES, topicSlug } = require('./lib/ekg-source');

/**
 * Silinecek konular ACIKCA listelenir; "ekg-%" gibi bir kalip kullanilmiyor,
 * cunku soru bankasinda EKG Quiz'le ilgisi olmayan "ekg-analizi" konusu da var
 * ve kalip onu da silerdi.
 */
const TOPIC_SLUGS = ['ekg-quiz', ...CATEGORIES.map((c) => topicSlug(c.code))];

async function run() {
  const confirmed = process.argv.includes('--yes');
  const client = await pool.connect();

  try {
    const { rows: topics } = await client.query(
      `SELECT t.id, t.slug, t.name,
              (SELECT COUNT(*)::int FROM questions q WHERE q.topic_id = t.id) AS soru,
              (SELECT COUNT(*)::int FROM attempts a
                 JOIN questions q ON q.id = a.question_id
                WHERE q.topic_id = t.id) AS deneme,
              (SELECT COUNT(*)::int FROM exam_questions eq
                 JOIN questions q ON q.id = eq.question_id
                WHERE q.topic_id = t.id) AS sinavda
         FROM topics t
        WHERE t.slug = ANY($1)
        ORDER BY t.slug`,
      [TOPIC_SLUGS]
    );

    if (!topics.length) {
      console.log('Silinecek EKG konusu yok; veritabani zaten temiz.');
      return;
    }

    console.log('Silinecek konular:');
    console.table(topics);

    const totals = topics.reduce(
      (acc, t) => ({
        soru: acc.soru + t.soru,
        deneme: acc.deneme + t.deneme,
        sinavda: acc.sinavda + t.sinavda,
      }),
      { soru: 0, deneme: 0, sinavda: 0 }
    );
    console.log(
      `\nToplam: ${topics.length} konu, ${totals.soru} soru, ` +
        `${totals.deneme} kullanici denemesi silinecek.`
    );
    // Sinav sorusu olarak kullanilmis bir soruyu silmek sinavi kisaltir
    if (totals.sinavda) {
      console.log(
        `DIKKAT: bu sorularin ${totals.sinavda} tanesi bir sinavda kullaniliyor; ` +
          'silinince o sinavlardan da cikacak.'
      );
    }

    if (!confirmed) {
      console.log('\n[deneme] Hicbir sey silinmedi. Silmek icin: npm run clear-ekg -- --yes');
      return;
    }

    await client.query('BEGIN');
    const { rowCount } = await client.query('DELETE FROM topics WHERE slug = ANY($1)', [
      TOPIC_SLUGS,
    ]);
    await client.query('COMMIT');
    console.log(`\n${rowCount} konu ve bagli tum icerik silindi.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
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
