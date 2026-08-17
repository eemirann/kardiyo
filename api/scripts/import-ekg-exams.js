/**
 * EKG deneme sinavlarini (10 deneme x 10 soru) veritabanina aktarir.
 *
 * Kaynak: OKU/deneme_10_adet_output/ (bkz. scripts/lib/ekg-exam-source.js)
 * Gorseller once hazirlanmis olmali: npm run prepare-ekg-exam-images -- --all
 *
 * Sorular "ekg-deneme" konusuna yazilir. Bu konu hem /konular listesinde
 * (is_listed = FALSE) hem de /ekg quiz sayfasinda gorunmez; sorular yalnizca
 * kendi sinavlarindan cikar. EKG Quiz konularina (ekg-mi, ekg-cd ...) yazsaydik
 * ayni kayitlar quiz sayfasinda ikinci kez listelenirdi — kaynaklar arasinda
 * ortak EKG kodlari var (ornegin 13079 hem quiz'de hem denemede geciyor).
 *
 * Denemeler sayfasinda "EKG Vaka Denemeleri" basligi altinda gruplanirlar.
 *
 * source_key sayesinde tekrar calistirmak kopya uretmez, mevcut kaydi gunceller.
 *
 *   npm run import-ekg-exams -- --all --dry-run
 *   npm run import-ekg-exams -- --all
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const {
  EXAM_CATEGORY,
  EXAM_COUNT,
  DURATION_MINUTES,
  questionsFor,
  selectExams,
} = require('./lib/ekg-exam-source');
const { suspiciousWords } = require('./lib/tr-diacritics');

const TOPIC_SLUG = 'ekg-deneme';
const WEB_PUBLIC = path.join(__dirname, '..', '..', 'web', 'public');
// Alt metin taniyi ELE VERMEMELI: gorsel yuklenmediginde cevabi okurdu
const IMAGE_ALT = '12 derivasyonlu EKG kaydı';
const ATTRIBUTION =
  'Kaynak: PTB-XL veri seti (Wagner ve ark., 2020, PhysioNet) — ODC-BY lisansı.';

// Denemeler listesinde mevcut iki serinin (100'ler ve 200'ler) ardina gelsin
const SORT_BASE = 300;

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

const bodyHtml = (q) => `<p>${esc(q.narrative)}</p><p><strong>${esc(q.question)}</strong></p>`;

const explanationHtml = (q) =>
  `<p><strong>Doğru cevap: ${q.correctLabel}) ${esc(q.correctText)}</strong></p>` +
  `<p><strong>Klinik yaklaşım:</strong> ${esc(q.clinicalApproach)}</p>` +
  `<p><em>${esc(ATTRIBUTION)}</em></p>`;

const examTitle = (n) => `EKG Vaka Denemesi ${n}`;
const sourceKeyFor = (n, q) => `ekg-deneme#${n}#${q.number}`;

/** Sorularin yazildigi gizli konu; yoksa olusturulur. */
async function ensureTopic(client) {
  const { rows } = await client.query('SELECT id FROM topics WHERE slug = $1', [TOPIC_SLUG]);
  if (rows[0]) return rows[0].id;

  const { rows: created } = await client.query(
    `INSERT INTO topics (name, slug, description, icon, sort_order, is_listed)
     VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id`,
    [
      'EKG Deneme Soruları',
      TOPIC_SLUG,
      'EKG vaka denemelerinde kullanılan sorular.',
      'monitor_heart',
      120,
    ]
  );
  console.log(`Konu olusturuldu: ${TOPIC_SLUG} (listelenmiyor)`);
  return created[0].id;
}

async function upsertQuestion(client, { topicId, adminId, number, q }) {
  const sourceKey = sourceKeyFor(number, q);
  const { rows: existing } = await client.query('SELECT id FROM questions WHERE source_key = $1', [
    sourceKey,
  ]);

  let questionId;
  if (existing[0]) {
    questionId = existing[0].id;
    await client.query('DELETE FROM question_options WHERE question_id = $1', [questionId]);
    await client.query(
      `UPDATE questions SET topic_id=$2, type='case', difficulty='medium', body=$3,
              explanation=$4, image_url=$5, image_alt=$6, is_active=TRUE, updated_at=now()
        WHERE id=$1`,
      [questionId, topicId, bodyHtml(q), explanationHtml(q), q.imageUrl, IMAGE_ALT]
    );
  } else {
    const { rows } = await client.query(
      `INSERT INTO questions (topic_id, type, difficulty, body, explanation,
                              image_url, image_alt, created_by, source_key)
       VALUES ($1,'case','medium',$2,$3,$4,$5,$6,$7) RETURNING id`,
      [topicId, bodyHtml(q), explanationHtml(q), q.imageUrl, IMAGE_ALT, adminId, sourceKey]
    );
    questionId = rows[0].id;
  }

  for (const [i, o] of q.options.entries()) {
    await client.query(
      `INSERT INTO question_options (question_id, label, text, is_correct, sort_order)
       VALUES ($1,$2,$3,$4,$5)`,
      [questionId, o.label, o.text, o.isCorrect, i]
    );
  }
  return Boolean(existing[0]);
}

/** Sinavi basligina gore ekler ya da gunceller. */
async function upsertExam(client, number) {
  const title = examTitle(number);
  const description =
    'Gerçek EKG kayıtları üzerinden 10 soruluk vaka denemesi. ' +
    'Her soruda hastanın geliş hikâyesi, EKG kaydı ve ayrıntılı çözüm.';

  const { rows: found } = await client.query('SELECT id FROM exams WHERE title = $1', [title]);
  if (found[0]) {
    await client.query(
      `UPDATE exams SET description=$2, duration_minutes=$3, category=$4, sort_order=$5,
              is_active=TRUE WHERE id=$1`,
      [found[0].id, description, DURATION_MINUTES, EXAM_CATEGORY, SORT_BASE + number]
    );
    return { id: found[0].id, created: false };
  }
  const { rows } = await client.query(
    `INSERT INTO exams (title, description, duration_minutes, category, sort_order)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [title, description, DURATION_MINUTES, EXAM_CATEGORY, SORT_BASE + number]
  );
  return { id: rows[0].id, created: true };
}

/** Yazmadan once ozet: sayilar, ornek soru ve eksik gorseller. */
function report(selected) {
  let total = 0;
  const suspicious = new Set();
  const missingImages = [];

  for (const number of selected) {
    const questions = questionsFor(number);
    total += questions.length;
    for (const q of questions) {
      for (const text of [q.narrative, q.question, q.clinicalApproach]) {
        for (const w of suspiciousWords(text)) suspicious.add(w);
      }
      // Gorsel hazirlanmadan ice aktarilirsa sinav kirik resimle acilirdi
      if (!fs.existsSync(path.join(WEB_PUBLIC, q.imageUrl))) missingImages.push(q.imageUrl);
    }
    console.log(`  ${examTitle(number).padEnd(24)} ${questions.length} soru`);
  }

  const first = questionsFor(selected[0])[0];
  console.log(`\nToplam: ${total} soru\n`);
  console.log('Ornek soru:');
  console.log(`  ${first.narrative}`);
  console.log(`  ${first.question}`);
  for (const o of first.options) console.log(`    ${o.label}) ${o.text}${o.isCorrect ? '  <-' : ''}`);
  console.log(`  Klinik yaklasim: ${first.clinicalApproach}`);
  console.log(`  Gorsel: ${first.imageUrl}`);
  console.log(
    `\nSozlukte olmayan kelimeler (${suspicious.size}): ${[...suspicious].sort().join(', ')}`
  );

  if (missingImages.length) {
    console.error(
      `\nEKSIK GORSEL: ${missingImages.length} dosya web/public altinda yok. Ornek:\n` +
        missingImages.slice(0, 3).map((p) => `  ${p}`).join('\n') +
        '\n\nOnce gorselleri hazirlayin:  npm run prepare-ekg-exam-images -- --all'
    );
  }
  return { total, missingImages };
}

async function run() {
  const dryRun = has('dry-run');
  const selected = selectExams({ exam: arg('exam'), all: has('all') });

  if (!selected.length) {
    console.error(`Deneme verin: --exam 1  (veya tumu icin --all; 1-${EXAM_COUNT})`);
    process.exit(1);
  }

  if (dryRun) {
    report(selected);
    console.log('\n[deneme] Veritabanina hicbir sey yazilmadi.');
    await pool.end();
    return;
  }

  const { missingImages } = report(selected);
  if (missingImages.length) {
    await pool.end();
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const topicId = await ensureTopic(client);
    const { rows: adminRows } = await client.query(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1"
    );
    const adminId = adminRows[0]?.id || null;

    let added = 0;
    let updated = 0;
    let newExams = 0;

    for (const number of selected) {
      const { id: examId, created } = await upsertExam(client, number);
      if (created) newExams += 1;

      const questionIds = [];
      for (const q of questionsFor(number)) {
        const wasUpdate = await upsertQuestion(client, { topicId, adminId, number, q });
        if (wasUpdate) updated += 1;
        else added += 1;

        const { rows } = await client.query('SELECT id FROM questions WHERE source_key = $1', [
          sourceKeyFor(number, q),
        ]);
        questionIds.push(rows[0].id);
      }

      // Sinav-soru baglantisi bastan kuruluyor: kaynakta soru sirasi degisirse
      // eski satirlar kalirsa sinav yanlis sirayla ya da fazla soruyla acilirdi.
      await client.query('DELETE FROM exam_questions WHERE exam_id = $1', [examId]);
      for (const [i, qid] of questionIds.entries()) {
        await client.query(
          'INSERT INTO exam_questions (exam_id, question_id, sort_order) VALUES ($1,$2,$3)',
          [examId, qid, i]
        );
      }
      console.log(`  ${examTitle(number)}: ${questionIds.length} soru bagli`);
    }

    await client.query('COMMIT');
    console.log(`\nYeni sinav: ${newExams} | Eklenen soru: ${added} | Guncellenen soru: ${updated}`);

    const { rows: stat } = await client.query(
      `SELECT e.category, COUNT(*)::int deneme
         FROM exams e WHERE e.is_active GROUP BY e.category ORDER BY 2 DESC`
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
