/**
 * 10'ar denemelik iki PDF'i yapisal JSON'a cevirir -> exams.json
 *
 *   1) Kardiyovaskuler Klinik Farmakoloji 10 Deneme 200 Soru.pdf
 *      Sik bicimi "A)metin", cozum basligi "Soru N · Dogru Cevap X",
 *      cozumun sonunda "Bolum x.y ..." kaynak satiri.
 *
 *   2) Kardiyoloji_10_Karma_Deneme_Sinavi_V2.pdf
 *      Sik bicimi "A. metin", cozum basligi "Soru N Dogru Cevap: X",
 *      aciklama "Aciklama: ..." ile basliyor.
 *
 * Iki dosyada da her deneme 20 soru; soru numaralari her denemede 1'den basliyor.
 * Buyuk harfli tek satirlar konu blogu basligi olarak okunuyor (KALP YETMEZLIGI gibi).
 */
const fs = require('fs');
const path = require('path');
const { extractLines } = require('./layout');

const OKU = 'C:/Users/LENOVO/Desktop/kardiyo/OKU';
const OUT = path.join(__dirname, '..', '..', 'api', 'data', 'exams.json');

const SETS = [
  {
    key: 'kardiyovaskuler-farmakoloji-denemeleri',
    file: `${OKU}/Kardiyovaskuler Klinik Farmakoloji 10 Deneme 200 Soru.pdf`,
    title: 'Kardiyovasküler Klinik Farmakoloji — Deneme {n}',
    description:
      'TUS / USMLE tarzı, 20 soruluk kardiyovasküler klinik farmakoloji denemesi. ' +
      'Sekiz konu bloğundan dengeli dağılım, her soruda ayrıntılı çözüm.',
    topicSlug: 'kardiyovaskuler-farmakoloji',
    durationMinutes: 30,
    optionRe: /^([A-E])\)\s*(.*)$/,
    answerRe: /^Soru\s+(\d{1,2})\s*·\s*Doğru Cevap\s*([A-E])\s*$/,
    solutionStartRe: /^Deneme\s+\d+\s+—\s+Ayrıntılı Çözümler/,
    examStartRe: /^DENEME SINAVI\s+(\d{1,2})$/,
    noise: [
      /^KARDİYOVASKÜLER KLİNİK FARMAKOLOJİ — 10 DENEME SINAVI$/,
      /^Stj\. Dr\. Berat İmdat Kalkan/,
      /^\d+\s*\/\s*\d+$/,
      /^20 Soru · Önerilen süre/,
      /^KARDİYOVASKÜLER KLİNİK FARMAKOLOJİ$/,
      /^Deneme\s+\d+\s+—\s+Cevap Anahtarı$/,
      /^SoruCevap/,
      /^(\d{1,2}[A-E]){2,}$/, // cevap anahtari tablosu satirlari
    ],
  },
  {
    key: 'kardiyoloji-karma-denemeler',
    file: `${OKU}/Kardiyoloji_10_Karma_Deneme_Sınavı_V2.pdf`,
    title: 'Kardiyoloji Karma Deneme {n}',
    description:
      'Patofizyoloji, klinik yönetim ve kılavuz odaklı çözümleriyle 20 soruluk karma ' +
      'kardiyoloji denemesi.',
    topicSlug: null, // karma: soru basina konu blogundan eslenir
    durationMinutes: 30,
    optionRe: /^([A-E])\.\s+(.*)$/,
    answerRe: /^Soru\s+(\d{1,2})\s+Doğru Cevap:\s*([A-E])\s*$/,
    solutionStartRe: /^DENEME SINAVI\s+\d+\s*-\s*ÇÖZÜMLER VE ANALİZLER$/,
    examStartRe: /^DENEME SINAVI\s+(\d{1,2})$/,
    noise: [
      /^KARDİYOLOJİ SORU BANKASI$/,
      /^Karma Deneme Sınavları$/,
      /^10 Adet Deneme Sınavı/,
      /^Patofizyoloji, Klinik Yönetim/,
      /^\d+\s*\/\s*\d+$/,
    ],
  },
];

/**
 * Buyuk harfli konu blogu basligi mi? ("KALP YETMEZLIĞI")
 * Tamami buyuk harfle yazilmis siklar ("E)TWILIGHT", "(SENIORS)") baslik sanilmasin
 * diye rakam ve parantez iceren satirlar elenir.
 */
const isTopicHeading = (t) =>
  t.length > 3 &&
  t.length < 60 &&
  !/[a-zçğıöşü]/.test(t) &&
  /[A-ZÇĞİÖŞÜ]/.test(t) &&
  !/[\d()]/.test(t);

const tidy = (s) => s.replace(/\s+/g, ' ').trim();

/**
 * Kaynak PDF'te bozulmus siklari isaretler (ayristirma hatasi degil, dosyanin kendisi bozuk):
 * baska sikkin metni sizmis ya da cumle yarida kesilmis olanlar.
 */
function qualityWarnings(q) {
  const w = [];
  for (const o of q.options) {
    if (/\s[A-E]\)\s/.test(o.text)) w.push(`${o.label} şıkkına başka şıkkın metni sızmış`);
    const open = (o.text.match(/\(/g) || []).length;
    const close = (o.text.match(/\)/g) || []).length;
    if (open !== close) w.push(`${o.label} şıkkı yarıda kesilmiş`);
    if (o.text.length < 3) w.push(`${o.label} şıkkı boş`);
  }
  if (q.stem.length < 60) w.push('soru kökü çok kısa');
  if (q.explanation.length < 80) w.push('çözüm çok kısa');
  return w;
}

/** Bir denemenin soru bolumunu ayristirir. */
function parseQuestions(lines, cfg, problems, examNo) {
  const questions = [];
  let cur = null;
  let target = null; // 'stem' | sik indeksi
  let topic = '';

  for (const l of lines) {
    const t = l.text;
    const qm = t.match(/^(\d{1,2})[.)]\s+(.*)$/);
    const om = t.match(cfg.optionRe);

    // Once sik: buyuk harfle yazilmis bir sik baslik sanilmasin
    // (sik etiketleri sirayla gelmeli: A, B, C, D, E)
    if (cur && om && om[1] === 'ABCDE'[cur.options.length]) {
      cur.options.push({ label: om[1], text: om[2] });
      target = cur.options.length - 1;
      continue;
    }
    if (isTopicHeading(t)) {
      topic = t;
      cur = null;
      target = null;
      continue;
    }
    // Yeni soru: numara sirayla artmali (metin icindeki "1." gibi ifadeleri elemek icin)
    if (qm && Number(qm[1]) === questions.length + 1) {
      cur = { number: Number(qm[1]), topicLabel: topic, stem: qm[2], options: [] };
      questions.push(cur);
      target = 'stem';
      continue;
    }
    if (!cur) continue;
    if (target === 'stem') cur.stem += ' ' + t;
    else if (typeof target === 'number' && cur.options[target])
      cur.options[target].text += ' ' + t;
  }

  if (questions.length !== 20)
    problems.push(`Deneme ${examNo}: ${questions.length} soru (20 bekleniyordu)`);
  return questions;
}

/** Bir denemenin cozum bolumunu ayristirir: numara -> {answer, explanation, reference} */
function parseSolutions(lines, cfg, problems, examNo) {
  const map = new Map();
  let cur = null;

  for (const l of lines) {
    const t = l.text;
    const am = t.match(cfg.answerRe);
    if (am) {
      cur = { answer: am[2], explanation: '', reference: '' };
      map.set(Number(am[1]), cur);
      continue;
    }
    if (!cur) continue;
    if (/^Kaynakça/.test(t) || /^Uyarı:/.test(t)) break;

    // Farmakoloji setinde cozumun son satiri girintili "Bölüm x.y ..." kaynagidir
    const ref = t.match(/^Bölüm\s+([\d.]+.*)$/);
    if (ref && l.x >= 62) {
      cur.reference = 'Bölüm ' + ref[1];
      continue;
    }
    cur.explanation += (cur.explanation ? ' ' : '') + t.replace(/^Açıklama:\s*/, '');
  }

  if (map.size !== 20) problems.push(`Deneme ${examNo}: ${map.size} çözüm (20 bekleniyordu)`);
  return map;
}

/** Cozum metni cogu zaman dogru sikkin metniyle basliyor; tekrari kirp. */
function stripLeadingAnswerText(explanation, optionText) {
  const opt = tidy(optionText);
  if (!opt) return explanation;
  const head = opt.slice(0, Math.min(40, opt.length));
  if (explanation.startsWith(head)) return tidy(explanation.slice(opt.length));
  return explanation;
}

async function parseSet(cfg) {
  const problems = [];
  const isNoise = (t) => cfg.noise.some((re) => re.test(t));
  const lines = (await extractLines(cfg.file)).filter((l) => !isNoise(l.text));

  // Deneme sinirlarini bul
  const starts = [];
  lines.forEach((l, i) => {
    const m = l.text.match(cfg.examStartRe);
    if (m) starts.push({ i, number: Number(m[1]) });
  });
  if (starts.length !== 10) problems.push(`${starts.length} deneme başlığı bulundu (10 bekleniyordu)`);

  const exams = [];
  for (const [k, s] of starts.entries()) {
    const end = starts[k + 1]?.i ?? lines.length;
    const block = lines.slice(s.i + 1, end);

    const solIdx = block.findIndex((l) => cfg.solutionStartRe.test(l.text));
    if (solIdx === -1) {
      problems.push(`Deneme ${s.number}: çözüm bölümü bulunamadı`);
      continue;
    }

    const questions = parseQuestions(block.slice(0, solIdx), cfg, problems, s.number);
    const solutions = parseSolutions(block.slice(solIdx + 1), cfg, problems, s.number);

    const merged = questions.map((q) => {
      const sol = solutions.get(q.number);
      if (!sol) problems.push(`Deneme ${s.number} soru ${q.number}: çözüm yok`);
      if (q.options.length !== 5)
        problems.push(`Deneme ${s.number} soru ${q.number}: ${q.options.length} şık`);
      if (sol && !q.options.some((o) => o.label === sol.answer))
        problems.push(
          `Deneme ${s.number} soru ${q.number}: doğru şık (${sol.answer}) şıklarda yok`
        );

      const options = q.options.map((o) => ({
        label: o.label,
        text: tidy(o.text),
        isCorrect: sol ? o.label === sol.answer : false,
      }));
      const correct = options.find((o) => o.isCorrect);

      const out = {
        number: q.number,
        topicLabel: tidy(q.topicLabel),
        stem: tidy(q.stem),
        options,
        answer: sol?.answer || null,
        explanation: stripLeadingAnswerText(tidy(sol?.explanation || ''), correct?.text || ''),
        reference: sol?.reference || '',
      };
      out.warnings = qualityWarnings(out);
      return out;
    });

    exams.push({ number: s.number, questions: merged });
  }

  return {
    key: cfg.key,
    title: cfg.title,
    description: cfg.description,
    topicSlug: cfg.topicSlug,
    durationMinutes: cfg.durationMinutes,
    source: path.basename(cfg.file),
    exams,
    problems,
  };
}

(async () => {
  const sets = [];
  for (const cfg of SETS) {
    const set = await parseSet(cfg);
    sets.push(set);

    const qs = set.exams.flatMap((e) => e.questions);
    console.log(`\n=== ${set.key}`);
    console.log(`Deneme: ${set.exams.length} | Soru: ${qs.length}`);
    console.log(`Şık sayıları: ${[...new Set(qs.map((q) => q.options.length))].join(',')}`);
    console.log(`Çözümü boş: ${qs.filter((q) => !q.explanation).length}`);
    console.log(`Konu etiketi boş: ${qs.filter((q) => !q.topicLabel).length}`);
    console.log(`Konu blokları: ${[...new Set(qs.map((q) => q.topicLabel))].join(' | ')}`);
    console.log(`SORUN (${set.problems.length}): ${set.problems.slice(0, 10).join(' · ') || 'yok'}`);

    const flagged = set.exams.flatMap((e) =>
      e.questions.filter((q) => q.warnings.length).map((q) => ({ e: e.number, q }))
    );
    console.log(`Kaynakta bozuk soru: ${flagged.length}`);
    for (const f of flagged) console.log(`  D${f.e}S${f.q.number}: ${f.q.warnings.join(', ')}`);
  }

  fs.writeFileSync(OUT, JSON.stringify({ sets }, null, 2));
  console.log(`\n-> ${OUT}`);
})();
