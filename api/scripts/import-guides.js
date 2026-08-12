/**
 * "10 Adimda Kardiyo" kilavuzlarini konu anlatimi olarak yukler.
 *
 * PDF'ler web/public/kilavuzlar/ altinda duruyor ve Vercel tarafindan sunuluyor;
 * burada yalnizca kitap kayitlari (baslik, konu, pdf adresi) olusturuluyor.
 *
 * DIKKAT: --replace verilirse mevcut TUM kitaplar (bolumleri, alt bolumleri ve
 * okuma ilerlemeleriyle birlikte) silinir.
 *
 *   npm run import-guides            -> ekler/gunceller
 *   npm run import-guides -- --replace  -> once mevcut kitaplari siler
 */
require('dotenv').config();
const { pool } = require('../config/db');

const GUIDES = [
  { n: 1, slug: 'kalp-yetmezligi', title: 'Kalp Yetmezliği', topicSlug: 'kalp-yetmezligi', pdf: '/kilavuzlar/1-kalp-yetmezligi.pdf' },
  { n: 2, slug: 'hipertansiyon', title: 'Hipertansiyon', topicSlug: 'hipertansiyon', pdf: '/kilavuzlar/2-hipertansiyon.pdf' },
  { n: 3, slug: 'iskemik-kalp-hastaliklari', title: 'İskemik Kalp Hastalıkları', topicSlug: 'koroner-arter-hastaligi', pdf: '/kilavuzlar/3-iskemik-kalp-hastaliklari.pdf' },
  { n: 4, slug: 'kalp-kapak-hastaliklari', title: 'Kalp Kapak Hastalıkları', topicSlug: 'kapak-hastaliklari', pdf: '/kilavuzlar/4-kapak-hastaliklari.pdf' },
  { n: 5, slug: 'enfektif-endokardit', title: 'Enfektif Endokardit', topicSlug: 'enfektif-endokardit', pdf: '/kilavuzlar/5-enfektif-endokardit.pdf' },
  { n: 6, slug: 'miyokard-hastaliklari', title: 'Miyokard Hastalıkları', topicSlug: 'miyokard-hastaliklari', pdf: '/kilavuzlar/6-miyokard-hastaliklari.pdf' },
  { n: 7, slug: 'perikard-hastaliklari', title: 'Perikard Hastalıkları', topicSlug: 'perikard-hastaliklari', pdf: '/kilavuzlar/7-perikard-hastaliklari.pdf' },
  { n: 8, slug: 'aritmiler-ve-tedavileri', title: 'Aritmiler ve Tedavileri', topicSlug: 'aritmiler', pdf: '/kilavuzlar/8-aritmiler.pdf' },
  { n: 9, slug: 'kardiyovaskuler-farmakoloji-kilavuz', title: 'Kardiyovasküler Farmakoloji', topicSlug: 'kardiyovaskuler-farmakoloji', pdf: '/kilavuzlar/9-kardiyovaskuler-farmakoloji.pdf' },
];

const SUBTITLE = '10 Adımda Kardiyoloji — bölüm kılavuzu';

async function run() {
  const replace = process.argv.includes('--replace');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (replace) {
      const { rows: old } = await client.query('SELECT id, title FROM books');
      // book_chapters / book_sections / book_progress ON DELETE CASCADE ile gider
      await client.query('DELETE FROM books');
      console.log(`Silinen kitap: ${old.length ? old.map((b) => b.title).join(', ') : 'yok'}`);
    }

    const { rows: topicRows } = await client.query('SELECT id, slug FROM topics');
    const topicId = new Map(topicRows.map((t) => [t.slug, t.id]));

    for (const g of GUIDES) {
      const tid = topicId.get(g.topicSlug) || null;
      if (!tid) console.log(`  UYARI: konu bulunamadi -> ${g.topicSlug}`);

      await client.query(
        `INSERT INTO books (title, slug, subtitle, description, pdf_url, sort_order, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,TRUE)
         ON CONFLICT (slug) DO UPDATE
           SET title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
               description = EXCLUDED.description, pdf_url = EXCLUDED.pdf_url,
               sort_order = EXCLUDED.sort_order, is_active = TRUE`,
        [
          g.title,
          g.slug,
          SUBTITLE,
          `${g.n}. bölüm kılavuzu. Güncel ESC/AHA önerileriyle ${g.title.toLowerCase()} konusunun tanı, tedavi ve takip başlıkları.`,
          g.pdf,
          g.n,
        ]
      );
      console.log(`  ${g.n}. ${g.title} -> ${g.pdf}`);
    }

    await client.query('COMMIT');
    console.log(`\n${GUIDES.length} kılavuz yüklendi.`);
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
