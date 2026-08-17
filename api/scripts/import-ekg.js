/**
 * EKG Quiz vakalarini soru bankasina yukler.
 *
 * Kaynak: OKU/EKG/<kategori>/<kategori>.docx (bkz. scripts/lib/ekg-source.js)
 * Gorseller once hazirlanmis olmali: npm run prepare-ekg-images -- --all
 *
 * Her kaynak klasoru kendi konusuna yazilir (ekg-norm, ekg-mi, ...); bu konular
 * /konular listesinde gorunmez (topics.is_listed = false), /ekg sayfasindaki
 * kategori seciciden sunulur.
 *
 * source_key sayesinde tekrar calistirmak kopya uretmez, mevcut kaydi gunceller.
 *
 *   npm run import-ekg -- --category norm --dry-run
 *   npm run import-ekg -- --category norm
 *   npm run import-ekg -- --all
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const { CATEGORIES, casesFor, selectCategories, topicSlug } = require('./lib/ekg-source');
const { suspiciousWords } = require('./lib/tr-diacritics');

const WEB_PUBLIC = path.join(__dirname, '..', '..', 'web', 'public');
// Gorselin alt metni taniyi ELE VERMEMELI: ekran okuyucuda ve gorsel
// yuklenmediginde soru cevabiyla birlikte okunurdu.
const IMAGE_ALT = '12 derivasyonlu EKG kaydı';
const ATTRIBUTION =
  'Kaynak: PTB-XL veri seti (Wagner ve ark., 2020, PhysioNet) — ODC-BY lisansı.';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
};
const has = (name) => process.argv.includes(`--${name}`);

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const bodyHtml = (c) => `<p>${esc(c.narrative)}</p><p><strong>${esc(c.question)}</strong></p>`;

const explanationHtml = (c) =>
  `<p><strong>Doğru cevap: ${c.correctLabel}) ${esc(c.correctText)}</strong></p>` +
  `<p><strong>Klinik yaklaşım:</strong> ${esc(c.clinicalApproach)}</p>` +
  `<p><em>${esc(ATTRIBUTION)}</em></p>`;

/**
 * Kategorinin konusunu dondurur, yoksa olusturur.
 *
 * Konular /konular listesinde gorunmez (is_listed = FALSE); /ekg sayfasindaki
 * kategori seciciden acilirlar. sort_order kaynak klasorun sira numarasini
 * izler, boylece yonetici panelinde de ayni sirada dururlar.
 */
async function ensureTopic(client, category) {
  const slug = topicSlug(category.code);
  const { rows } = await client.query('SELECT id FROM topics WHERE slug = $1', [slug]);
  if (rows[0]) return rows[0].id;

  const { rows: created } = await client.query(
    `INSERT INTO topics (name, slug, description, icon, sort_order, is_listed)
     VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id`,
    [
      `EKG · ${category.name}`,
      slug,
      `Gerçek EKG kayıtları üzerinden ${category.name.toLocaleLowerCase('tr')} vakaları.`,
      'monitor_heart',
      100 + category.dir,
    ]
  );
  console.log(`Konu olusturuldu: ${slug} (listelenmiyor)`);
  return created[0].id;
}

async function upsertCase(client, { topicId, adminId, c }) {
  const imageUrl = c.imageUrl;
  const { rows: existing } = await client.query('SELECT id FROM questions WHERE source_key = $1', [
    c.sourceKey,
  ]);

  let questionId;
  if (existing[0]) {
    questionId = existing[0].id;
    await client.query('DELETE FROM question_options WHERE question_id = $1', [questionId]);
    await client.query(
      `UPDATE questions SET topic_id=$2, type='case', difficulty='medium', body=$3,
              explanation=$4, image_url=$5, image_alt=$6, is_active=TRUE, updated_at=now()
        WHERE id=$1`,
      [questionId, topicId, bodyHtml(c), explanationHtml(c), imageUrl, IMAGE_ALT]
    );
  } else {
    const { rows } = await client.query(
      `INSERT INTO questions (topic_id, type, difficulty, body, explanation,
                              image_url, image_alt, created_by, source_key)
       VALUES ($1,'case','medium',$2,$3,$4,$5,$6,$7) RETURNING id`,
      [topicId, bodyHtml(c), explanationHtml(c), imageUrl, IMAGE_ALT, adminId, c.sourceKey]
    );
    questionId = rows[0].id;
  }

  for (const [i, o] of c.options.entries()) {
    await client.query(
      `INSERT INTO question_options (question_id, label, text, is_correct, sort_order)
       VALUES ($1,$2,$3,$4,$5)`,
      [questionId, o.label, o.text, o.isCorrect, i]
    );
  }
  return Boolean(existing[0]);
}

/** Yazmadan once ozet: sayilar, ornek metin ve sozlukte olmayan kelimeler. */
function report(selected) {
  let total = 0;
  const suspicious = new Set();
  const missingImages = [];

  for (const cat of selected) {
    const cases = casesFor(cat);
    total += cases.length;
    for (const c of cases) {
      for (const text of [c.narrative, c.question, c.clinicalApproach]) {
        for (const w of suspiciousWords(text)) suspicious.add(w);
      }
      const correct = c.options.filter((o) => o.isCorrect).length;
      if (correct !== 1) throw new Error(`${c.sourceKey}: ${correct} dogru sik var, 1 olmali.`);
      // Gorsel hazirlanmadan ice aktarilirsa sayfa kirik resimle acilirdi
      if (!fs.existsSync(path.join(WEB_PUBLIC, c.imageUrl))) missingImages.push(c.imageUrl);
    }
    console.log(`  ${cat.code.padEnd(6)} ${cat.name.padEnd(28)} ${cases.length} vaka`);
  }

  const first = casesFor(selected[0])[0];
  console.log(`\nToplam: ${total} soru\n`);
  console.log('Ornek vaka:');
  console.log(`  ${first.narrative}`);
  console.log(`  ${first.question}`);
  for (const o of first.options) console.log(`    ${o.label}) ${o.text}${o.isCorrect ? '  <-' : ''}`);
  console.log(`  Klinik yaklasim: ${first.clinicalApproach}`);
  console.log(`  Gorsel: ${first.imageUrl}`);
  console.log(`\nSozlukte olmayan kelimeler (${suspicious.size}): ${[...suspicious].sort().join(', ')}`);

  if (missingImages.length) {
    console.error(
      `\nEKSIK GORSEL: ${missingImages.length} dosya web/public altinda yok. Ornek:\n` +
        missingImages.slice(0, 3).map((p) => `  ${p}`).join('\n') +
        `\n\nOnce gorselleri hazirlayin:  npm run prepare-ekg-images -- --all`
    );
  }
  return { total, missingImages };
}

async function run() {
  const dryRun = has('dry-run');
  const category = arg('category');
  const all = has('all');

  if (!category && !all) {
    console.error('Kategori verin: --category norm  (veya tumu icin --all)');
    console.error(`Kategoriler: ${CATEGORIES.map((c) => c.code).join(', ')}`);
    process.exit(1);
  }
  const selected = selectCategories({ category, all });
  if (!selected.length) {
    console.error(`Bilinmeyen kategori: ${category}`);
    console.error(`Kategoriler: ${CATEGORIES.map((c) => c.code).join(', ')}`);
    process.exit(1);
  }

  if (dryRun) {
    report(selected);
    console.log('\n[deneme] Veritabanina hicbir sey yazilmadi.');
    await pool.end();
    return;
  }

  // Gorseller hazir degilse yazma: kirik resimli sorular olusurdu
  const { missingImages } = report(selected);
  if (missingImages.length) {
    await pool.end();
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: adminRows } = await client.query(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1"
    );
    const adminId = adminRows[0]?.id || null;

    let added = 0;
    let updated = 0;

    for (const cat of selected) {
      const topicId = await ensureTopic(client, cat);
      for (const c of casesFor(cat)) {
        const wasUpdate = await upsertCase(client, { topicId, adminId, c });
        if (wasUpdate) updated += 1;
        else added += 1;
      }
    }

    await client.query('COMMIT');
    console.log(`\nEklenen: ${added} | Guncellenen: ${updated}`);

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
