/**
 * api/data/exams.json icindeki 20 denemeyi (400 soru) veritabanina aktarir.
 *
 * Kaynak: OKU/Kardiyovaskuler Klinik Farmakoloji 10 Deneme 200 Soru.pdf
 *         OKU/Kardiyoloji_10_Karma_Deneme_Sinavi_V2.pdf
 * (tools/pdf-import/parse-exams.js ile JSON'a cevriliyor)
 *
 * Tekrar calistirilabilir: ayni soru/sinav varsa guncellenir, cogaltilmaz.
 * Eslestirme, sorunun govdesinin ilk 80 karakteri ve sinavin basligi uzerinden yapilir.
 */
require('dotenv').config();
const path = require('path');
const { pool } = require('../config/db');

const { sets } = require(path.join(__dirname, '..', 'data', 'exams.json'));

/** Karma denemedeki konu blogu basliklari -> konu tablosu. */
const TOPIC_MAP = {
  'KALP YETMEZLIĞI': 'kalp-yetmezligi',
  'KAPAK HASTALIKLARI': 'kapak-hastaliklari',
  'KAPAK HASTALIKLARI VE ARA': 'kapak-hastaliklari',
  ARITMILER: 'aritmiler',
  ANTIARITMIKLER: 'aritmiler',
  'İSKEMIK KALP': 'koroner-arter-hastaligi',
  FARMAKOLOJI: 'kardiyovaskuler-farmakoloji',
  'MIYOKARD HASTALIKLARI': 'miyokard-hastaliklari',
  'PERIKARD HASTALIKLARI': 'perikard-hastaliklari',
  'KARDIYOMIYOPATI VE PERIKARDIT': 'miyokard-hastaliklari',
  'ENFEKTIF ENDOKARDIT': 'enfektif-endokardit',
  HIPERTANSIYON: 'hipertansiyon',
};

/** Yukaridaki eslemede gecen ama seed'de olmayan konular. */
const NEW_TOPICS = [
  {
    slug: 'miyokard-hastaliklari',
    name: 'Miyokard Hastalıkları',
    icon: 'cardiology',
    order: 7,
    description: 'Kardiyomiyopatiler, miyokardit ve infiltratif kalp hastalıkları.',
  },
  {
    slug: 'perikard-hastaliklari',
    name: 'Perikard Hastalıkları',
    icon: 'blood_pressure',
    order: 8,
    description: 'Akut perikardit, perikardiyal efüzyon, tamponad ve konstriktif perikardit.',
  },
  {
    slug: 'enfektif-endokardit',
    name: 'Enfektif Endokardit',
    // 'infection' Material Symbols'ta yok, adi duz yazi olarak basiliyordu
    icon: 'coronavirus',
    order: 9,
    description: 'Tanı ölçütleri, etkene göre antibiyoterapi, profilaksi ve cerrahi endikasyonlar.',
  },
  {
    slug: 'hipertansiyon',
    name: 'Hipertansiyon',
    icon: 'monitor_heart',
    order: 10,
    description: 'Antihipertansif tedavi seçimi, dirençli HT ve hipertansif aciller.',
  },
];

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const difficultyOf = (q) => (q.stem.length > 380 ? 'hard' : 'medium');
const typeOf = (q) => (/yaşında|hasta|başvur/i.test(q.stem) ? 'case' : 'classic');

async function upsertTopic(client, t) {
  const { rows } = await client.query(
    `INSERT INTO topics (name, slug, description, icon, sort_order)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon
     RETURNING id`,
    [t.name, t.slug, t.description, t.icon, t.order]
  );
  return rows[0].id;
}

/** Soruyu ekler ya da gunceller, id dondurur. */
async function upsertQuestion(client, q, topicId, adminId) {
  const body = `<p>${esc(q.stem)}</p>`;
  const correct = q.options.find((o) => o.isCorrect);
  const explanation =
    `<p><strong>Doğru Cevap: ${q.answer}) ${esc(correct?.text || '')}</strong></p>` +
    `<p>${esc(q.explanation)}</p>` +
    (q.reference ? `<p><em>Kaynak: ${esc(q.reference)}</em></p>` : '');

  // Tam govde uzerinden eslestir: bu setlerde ayni senaryonun yas/cinsiyet varyantlari
  // var; ilk 80 karaktere bakmak farkli sorulari tek satirda birlestiriyordu.
  const { rows: existing } = await client.query(
    'SELECT id FROM questions WHERE topic_id = $1 AND md5(body) = md5($2)',
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

  for (const [i, o] of q.options.entries()) {
    await client.query(
      `INSERT INTO question_options (question_id, label, text, is_correct, sort_order)
       VALUES ($1,$2,$3,$4,$5)`,
      [qid, o.label, o.text, o.isCorrect, i]
    );
  }
  return qid;
}

/** Sinavi basligina gore ekler ya da gunceller, id dondurur. */
async function upsertExam(client, { title, description, topicId, durationMinutes, category, sortOrder }) {
  const { rows: found } = await client.query('SELECT id FROM exams WHERE title = $1', [title]);
  if (found[0]) {
    await client.query(
      `UPDATE exams SET description=$2, topic_id=$3, duration_minutes=$4,
              category=$5, sort_order=$6 WHERE id=$1`,
      [found[0].id, description, topicId, durationMinutes, category, sortOrder]
    );
    return found[0].id;
  }
  const { rows } = await client.query(
    `INSERT INTO exams (title, description, topic_id, duration_minutes, category, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [title, description, topicId, durationMinutes, category, sortOrder]
  );
  return rows[0].id;
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const t of NEW_TOPICS) await upsertTopic(client, t);

    const { rows: topicRows } = await client.query('SELECT id, slug FROM topics');
    const topicIdBySlug = new Map(topicRows.map((r) => [r.slug, r.id]));

    const { rows: adminRows } = await client.query(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1"
    );
    const adminId = adminRows[0]?.id || null;

    const missingLabels = new Set();
    let examCount = 0;
    let questionCount = 0;
    const flagged = [];
    const duplicates = [];

    for (const set of sets) {
      const setTopicId = set.topicSlug ? topicIdBySlug.get(set.topicSlug) : null;
      if (set.topicSlug && !setTopicId)
        throw new Error(`Konu bulunamadi: ${set.topicSlug} (önce npm run seed / import-content)`);

      for (const exam of set.exams) {
        const questionIds = [];
        // Karma sette ayni soru bazen tekrar ediyor; bir sinava iki kez eklenemez
        const seen = new Set();

        for (const q of exam.questions) {
          // Setin sabit konusu yoksa soru, blok basligindan konuya eslenir
          let topicId = setTopicId;
          if (!topicId) {
            const slug = TOPIC_MAP[q.topicLabel];
            topicId = slug ? topicIdBySlug.get(slug) : null;
            if (!topicId) {
              missingLabels.add(q.topicLabel);
              topicId = topicIdBySlug.get('kardiyovaskuler-farmakoloji');
            }
          }
          const qid = await upsertQuestion(client, q, topicId, adminId);
          if (seen.has(qid)) {
            duplicates.push(`${set.key} D${exam.number}S${q.number} (aynı sınavda tekrar eden soru)`);
          } else {
            seen.add(qid);
            questionIds.push(qid);
          }
          questionCount += 1;
          if (q.warnings?.length)
            flagged.push(`${set.key} D${exam.number}S${q.number}: ${q.warnings.join(', ')}`);
        }

        const title = set.title.replace('{n}', exam.number);
        // Seriler listede kendi basligi altinda ve deneme numarasi sirasiyla ciksin:
        // ilk serinin sinavlari 101-110, ikincinin 201-210 ...
        const setIndex = sets.indexOf(set);
        const examId = await upsertExam(client, {
          title,
          description: set.description,
          topicId: setTopicId,
          durationMinutes: set.durationMinutes,
          category: set.category,
          sortOrder: (setIndex + 1) * 100 + exam.number,
        });
        await client.query('DELETE FROM exam_questions WHERE exam_id = $1', [examId]);
        for (const [i, qid] of questionIds.entries()) {
          await client.query(
            'INSERT INTO exam_questions (exam_id, question_id, sort_order) VALUES ($1,$2,$3)',
            [examId, qid, i]
          );
        }
        examCount += 1;
        console.log(`  ${title}: ${questionIds.length} soru`);
      }
    }

    // Soru kokunu degistiren bir duzeltme yapildiysa eski satir eslesmez ve
    // hicbir sinava bagli olmayan bir kopya olarak kalir; goze batsin diye rapor et.
    const { rows: orphans } = await client.query(
      `SELECT q.id, LEFT(regexp_replace(q.body, '<[^>]+>', '', 'g'), 70) AS ozet
         FROM questions q
        WHERE NOT EXISTS (SELECT 1 FROM exam_questions eq WHERE eq.question_id = q.id)
        ORDER BY q.id`
    );

    await client.query('COMMIT');

    console.log(`\nDeneme: ${examCount} | İşlenen soru: ${questionCount}`);
    if (duplicates.length) {
      console.log(`\nAynı sınavda tekrar ettiği için atlanan ${duplicates.length} soru:`);
      for (const d of duplicates) console.log(`  ${d}`);
    }
    if (orphans.length) {
      console.log(
        `\nHiçbir sınava bağlı olmayan ${orphans.length} soru var. Soru kökü düzeltildiyse` +
          ' eski kopya burada görünür; gerekiyorsa yönetici panelinden silin:'
      );
      for (const o of orphans) console.log(`  #${o.id} ${o.ozet}…`);
    }
    if (missingLabels.size)
      console.log(`Eslenmeyen konu basliklari: ${[...missingLabels].join(', ')}`);
    if (flagged.length) {
      console.log(
        `\nKaynak PDF'te bozuk ${flagged.length} soru aktarildi; yonetici panelinden duzeltin:`
      );
      for (const f of flagged) console.log(`  ${f}`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
