/**
 * OKU/10 Adımda Kardiyo/sorular klasorundeki konu bazli soru setlerini JSON'a cevirir.
 *
 *   8 x .docx  -> "Soru N" / A)-E) / "Dogru Cevap: X" / "Detayli Cozum..." / "Notlarda..."
 *   1 x .pdf   -> farmakoloji seti (parse-questions.js ile ayni kaynak)
 *
 * Cikti: api/data/question-sets.json
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { extractLines } = require('./layout');

const SRC = 'C:/Users/LENOVO/Desktop/kardiyo/OKU/10 Adımda Kardiyo/sorular';
const OUT = path.join(__dirname, '..', '..', 'api', 'data', 'question-sets.json');
const TMP = path.join(require('os').tmpdir(), 'kardiyo-docx');

/** Dosya adi -> konu slug'i (veritabanindaki topics.slug). */
const SETS = [
  { file: '1- Kalp_Yetmezligi_50_Soru_Seti.docx', topicSlug: 'kalp-yetmezligi', name: 'Kalp Yetmezliği' },
  { file: '2- Hipertansiyon_50_Soru_Seti.docx', topicSlug: 'hipertansiyon', name: 'Hipertansiyon' },
  { file: '3- Iskemik_Kalp_Hastaliklari_50_Soru_Seti.docx', topicSlug: 'koroner-arter-hastaligi', name: 'İskemik Kalp Hastalıkları' },
  { file: '4- Kapak_Hastaliklari_50_Soru_Seti.docx', topicSlug: 'kapak-hastaliklari', name: 'Kapak Hastalıkları' },
  { file: '5- Enfektif_Endokardit_50_Soru_Seti.docx', topicSlug: 'enfektif-endokardit', name: 'Enfektif Endokardit' },
  { file: '6- Miyokard_Hastaliklari_50_Soru_Seti.docx', topicSlug: 'miyokard-hastaliklari', name: 'Miyokard Hastalıkları' },
  { file: '7- Perikard_Hastaliklari_50_Soru_Seti.docx', topicSlug: 'perikard-hastaliklari', name: 'Perikard Hastalıkları' },
  { file: '8- Aritmiler_ve_Tedavileri_50_Soru_Seti.docx', topicSlug: 'aritmiler', name: 'Aritmiler ve Tedavileri' },
  { file: '9-Kardiyo_Farmakoloji_50 soru.pdf', topicSlug: 'kardiyovaskuler-farmakoloji', name: 'Kardiyovasküler Farmakoloji' },
];

const tidy = (s) => String(s).replace(/\s+/g, ' ').trim();

/** .docx bir zip; word/document.xml icindeki paragraflari duz metne cevirir. */
function docxParagraphs(file) {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const zip = path.join(TMP, 'a.zip');
  fs.copyFileSync(file, zip);
  execFileSync('unzip', ['-o', '-q', zip, '-d', TMP]);

  const xml = fs.readFileSync(path.join(TMP, 'word', 'document.xml'), 'utf8');
  return xml
    .split(/<\/w:p>/)
    .map((p) =>
      (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((s) => s.replace(/<[^>]*>/g, '')).join('')
    )
    .map(tidy)
    .filter(Boolean);
}

/** Paragraf dizisini sorulara ayirir (docx ve pdf icin ortak). */
function parseParagraphs(lines, problems, setName) {
  const questions = [];
  let cur = null;
  let field = null; // 'stem' | 'explanation' | option index

  for (const t of lines) {
    if (/^Soru\s+\d{1,3}$/.test(t)) {
      cur = { number: Number(t.match(/\d+/)[0]), stem: '', options: [], answer: null, explanation: '', reference: '' };
      questions.push(cur);
      field = 'stem';
      continue;
    }
    if (!cur) continue;

    const om = t.match(/^([A-E])\)\s*(.*)$/);
    if (om && om[1] === 'ABCDE'[cur.options.length]) {
      cur.options.push({ label: om[1], text: om[2] });
      field = cur.options.length - 1;
      continue;
    }
    const am = t.match(/^Doğru Cevap:\s*([A-E])/);
    if (am) {
      cur.answer = am[1];
      field = null;
      continue;
    }
    if (/^Detaylı Çözüm/.test(t)) {
      cur.explanation = t.replace(/^Detaylı Çözüm[^:]*:\s*/, '');
      field = 'explanation';
      continue;
    }
    if (/^Notlarda Nereden Çalışılmalı/.test(t)) {
      cur.reference = t.replace(/^Notlarda Nereden Çalışılmalı:\s*/, '');
      field = null;
      continue;
    }

    if (field === 'stem') cur.stem += (cur.stem ? ' ' : '') + t;
    else if (field === 'explanation') cur.explanation += ' ' + t;
    else if (typeof field === 'number' && cur.options[field]) cur.options[field].text += ' ' + t;
  }

  return questions.map((q) => {
    if (q.options.length !== 5) problems.push(`${setName} S${q.number}: ${q.options.length} şık`);
    if (!q.answer) problems.push(`${setName} S${q.number}: doğru cevap yok`);
    if (!q.explanation) problems.push(`${setName} S${q.number}: çözüm yok`);
    return {
      number: q.number,
      stem: tidy(q.stem),
      options: q.options.map((o) => ({
        label: o.label,
        text: tidy(o.text),
        isCorrect: o.label === q.answer,
      })),
      answer: q.answer,
      explanation: tidy(q.explanation),
      reference: tidy(q.reference),
    };
  });
}

/** PDF'teki farmakoloji seti: satirlari paragraf bicimine yaklastirip ayni ayristiriciyi kullanir. */
async function pdfQuestions(file, problems, setName) {
  const NOISE = [
    /^Kardiyovasküler Klinik Farmakoloji$/,
    /^TUS \/ USMLE Tarzı/,
    /^SORULAR$/,
    /^DETAYLI ÇÖZÜMLER/,
    /^Kaynakça:/,
    /^\d+\s*\/\s*\d+$/,
    /^•\s*$/,
  ];
  const lines = (await extractLines(file)).filter((l) => !NOISE.some((re) => re.test(l.text)));

  // Sorular ve cozumler ayri bolumlerde: once soru govdeleri, sonra cozumler
  const solIdx = lines.findIndex((l) => /^Soru\s+1\s+Doğru Cevap/.test(l.text));
  const qLines = lines.slice(0, solIdx);
  const sLines = lines.slice(solIdx);

  const questions = [];
  let cur = null;
  let target = null;
  for (const l of qLines) {
    const qm = l.text.match(/^(\d{1,2})\.\s+(.*)$/);
    const om = l.text.match(/^([A-E])\.\s*(.*)$/);
    if (qm && Number(qm[1]) === questions.length + 1 && l.x < 65) {
      cur = { number: Number(qm[1]), stem: qm[2], options: [] };
      questions.push(cur);
      target = 'stem';
      continue;
    }
    if (!cur) continue;
    if (om && l.x < 65) {
      cur.options.push({ label: om[1], text: om[2] });
      target = cur.options.length - 1;
      continue;
    }
    if (target === 'stem') cur.stem += ' ' + l.text;
    else if (typeof target === 'number' && cur.options[target]) cur.options[target].text += ' ' + l.text;
  }

  const solutions = new Map();
  let sc = null;
  for (const l of sLines) {
    const m = l.text.match(/^Soru\s+(\d{1,2})\s+Doğru Cevap:\s*([A-E])/);
    if (m) {
      sc = { answer: m[2], explanation: '', reference: '' };
      solutions.set(Number(m[1]), sc);
      continue;
    }
    if (!sc) continue;
    if (/^Kaynakça/.test(l.text)) break;
    const ref = l.text.match(/Bölüm\s+([\d.]+\s*.*)$/);
    if (ref && l.x >= 62) {
      sc.reference = 'Bölüm ' + tidy(ref[1]);
      continue;
    }
    sc.explanation += (sc.explanation ? ' ' : '') + l.text.replace(/^Açıklama:\s*/, '');
  }

  return questions.map((q) => {
    const s = solutions.get(q.number);
    if (q.options.length !== 5) problems.push(`${setName} S${q.number}: ${q.options.length} şık`);
    if (!s) problems.push(`${setName} S${q.number}: çözüm yok`);
    return {
      number: q.number,
      stem: tidy(q.stem),
      options: q.options.map((o) => ({
        label: o.label,
        text: tidy(o.text),
        isCorrect: s ? o.label === s.answer : false,
      })),
      answer: s?.answer || null,
      explanation: tidy(s?.explanation || ''),
      reference: s?.reference || '',
    };
  });
}

(async () => {
  const out = [];
  let total = 0;

  for (const set of SETS) {
    const file = path.join(SRC, set.file);
    const problems = [];
    const questions = file.endsWith('.pdf')
      ? await pdfQuestions(file, problems, set.name)
      : parseParagraphs(docxParagraphs(file), problems, set.name);

    total += questions.length;
    out.push({ ...set, questions, problems });
    console.log(
      `${set.name.padEnd(28)} ${String(questions.length).padStart(3)} soru | ` +
        `şık: ${[...new Set(questions.map((q) => q.options.length))].join(',')} | ` +
        `kaynaklı: ${questions.filter((q) => q.reference).length} | ` +
        `SORUN: ${problems.length ? problems.slice(0, 3).join(' · ') : 'yok'}`
    );
  }

  fs.writeFileSync(OUT, JSON.stringify({ sets: out }, null, 2));
  console.log(`\nToplam ${total} soru -> ${OUT}`);
})();
