/**
 * 50 soruluk PDF'i yapisal JSON'a cevirir.
 * Konum bilgisi kullanilir: soru/sik satirlari sola dayali (x < 65),
 * devam satirlari girintilidir (x >= 65).
 */
const fs = require('fs');
const { extractLines } = require('./layout');

const SRC = 'C:/Users/LENOVO/Desktop/kardiyo/OKU/11-Kardiyo_Farmakoloji_50 soru.pdf';
const OUT = 'questions.json';

const NOISE = [
  /^Kardiyovasküler Klinik Farmakoloji$/,
  /^TUS \/ USMLE Tarzı/,
  /^SORULAR$/,
  /^DETAYLI ÇÖZÜMLER/,
  /^Kaynakça:/,
  /^\d+\s*\/\s*\d+$/,
  /^•\s*$/,
];

const isNoise = (t) => NOISE.some((re) => re.test(t));

(async () => {
  const lines = (await extractLines(SRC)).filter((l) => !isNoise(l.text));

  // --- Cozumler bolumunun basladigi yer
  const solIdx = lines.findIndex((l) => /^Soru\s+1\s+Doğru Cevap/.test(l.text));
  const qLines = lines.slice(0, solIdx);
  const sLines = lines.slice(solIdx);

  // --- Sorular
  const questions = [];
  let cur = null;
  let target = null; // 'stem' | option index

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
    // devam satiri
    if (target === 'stem') cur.stem += ' ' + l.text;
    else if (typeof target === 'number' && cur.options[target])
      cur.options[target].text += ' ' + l.text;
  }

  // --- Cozumler
  const solutions = new Map();
  let sc = null;
  for (const l of sLines) {
    const m = l.text.match(/^Soru\s+(\d{1,2})\s+Doğru Cevap:\s*([A-E])/);
    if (m) {
      sc = { number: Number(m[1]), answer: m[2], explanation: '', reference: '' };
      solutions.set(sc.number, sc);
      continue;
    }
    if (!sc) continue;
    if (/^Kaynakça/.test(l.text)) break;

    // Referans satiri: madde imi glifiyle basliyor ve girintili (x >= 62)
    const ref = l.text.match(/Bölüm\s+([\d.]+\s*.*)$/);
    if (ref && l.x >= 62) {
      sc.reference = 'Bölüm ' + ref[1].trim();
      continue;
    }
    const exp = l.text.replace(/^Açıklama:\s*/, '');
    sc.explanation += (sc.explanation ? ' ' : '') + exp;
  }

  // --- Birlestir + dogrula
  const problems = [];
  const merged = questions.map((q) => {
    const s = solutions.get(q.number);
    if (!s) problems.push(`Soru ${q.number}: cozum yok`);
    if (q.options.length !== 5) problems.push(`Soru ${q.number}: ${q.options.length} sik`);
    if (s && !q.options.some((o) => o.label === s.answer))
      problems.push(`Soru ${q.number}: dogru sik (${s.answer}) siklarda yok`);
    return {
      number: q.number,
      stem: q.stem.replace(/\s+/g, ' ').trim(),
      options: q.options.map((o) => ({
        label: o.label,
        text: o.text.replace(/\s+/g, ' ').trim(),
        isCorrect: s ? o.label === s.answer : false,
      })),
      answer: s?.answer || null,
      explanation: (s?.explanation || '').replace(/\s+/g, ' ').trim(),
      reference: s?.reference || '',
    };
  });

  fs.writeFileSync(OUT, JSON.stringify(merged, null, 2));

  console.log(`Soru: ${merged.length} | Cozum: ${solutions.size}`);
  console.log(`Sik sayilari: ${[...new Set(merged.map((m) => m.options.length))].join(',')}`);
  console.log(
    'Cozumu bos olan:',
    merged.filter((m) => !m.explanation).map((m) => m.number).join(',') || 'yok'
  );
  console.log('SORUN:', problems.length ? problems.join(' | ') : 'yok');
})();
