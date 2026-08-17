/**
 * OKU/deneme_10_adet_output altindaki EKG deneme sinavlarini okur.
 *
 * Klasor duzeni:
 *   OKU/deneme_10_adet_output/deneme_1/
 *     Deneme_1.docx                      10 sorunun metni + cevap anahtari
 *     Sinav1_Soru01_EKG21045.png         soruya ait 12 derivasyonlu kayit
 *
 * Gorsel eslesmesi dosya adinda yazili: Sinav<sinav>_Soru<sira>_EKG<id>.png
 *
 * Belge de her sorunun basinda bir dosya adi veriyor ama bastaki sinav numarasi
 * 6-10. denemelerde yanlis (o belgeler ikinci bir partide uretilmis ve sayac
 * 1'den yeniden baslamis: deneme 6 "Sinav1..." diyor). Bu yuzden gorsel diskten,
 * (deneme klasoru + soru sirasi + EKG kodu) uclusuyle bulunuyor; belgedeki addan
 * yalnizca EKG kodu dogrulamasi icin yararlaniliyor.
 *
 * Belge duzeni (soru basina):
 *   SORU 1 / 10   —   EKG Kodu: 21045
 *   (Konu: mi  ·  Görsel dosyası: Sinav1_Soru01_EKG21045.png)
 *   <hastanin gelis hikayesi>
 *   <Soru 1 koku>            A) ... E)
 *   <Soru 2 koku>            A) ... E)
 * ve belgenin sonunda:
 *   CEVAP ANAHTARI
 *   Soru 1 (EKG 21045) — S1: E) İnferior MI   |   S2: B) Acil reperfuzyon ...
 *
 * EKG Quiz kaynagindan farkli olarak dogru sik satir icinde isaretlenmiyor;
 * dogru siklar yalnizca cevap anahtarindan geliyor. Anahtardaki harf ile metin
 * ayrica karsilastiriliyor: biri kaysa bile sessizce yanlis cevap uretmesin.
 *
 * EKG Quiz'de oldugu gibi yalnizca Soru 1 ("hangi tani?") soru olarak aliniyor;
 * Soru 2'nin govdesi dogru taniyi acikca yazdigi icin ayri soru olarak
 * sorulamaz, dogru sikki cozum metnine "klinik yaklasim" olarak ekleniyor.
 */
const fs = require('fs');
const path = require('path');
const { docxParagraphs } = require('./docx-text');
const { fixDiacritics } = require('./tr-diacritics');

/** Denemeler sayfasinda bu baslik altinda gruplanirlar. */
const EXAM_CATEGORY = 'EKG Vaka Denemeleri';
/** Sinav basina sure; 10 soru, soru basina ~2 dk. */
const DURATION_MINUTES = 20;
const EXAM_COUNT = 10;

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Depo kokundeki kaynak klasor (bu dosya api/scripts/lib/ altinda). */
const sourceRoot = () =>
  path.join(__dirname, '..', '..', '..', 'OKU', 'deneme_10_adet_output');

/** Sinav gorsellerinin site ici klasoru. */
const IMAGE_BASE = '/ekg/deneme';

/** Kaynak dosya adini site ici yola cevirir (buyuk/kucuk harf farki cikmasin). */
const imageUrlFor = (fileName) => `${IMAGE_BASE}/${fileName.toLowerCase()}`;

/**
 * Sorunun gorselini deneme klasorunde bulur.
 *
 * Belgedeki dosya adina guvenilmiyor (bkz. dosya basi): eslesme soru sirasi ve
 * EKG kodu uzerinden kuruluyor, sinav numarasi onekine bakilmiyor.
 */
function resolveImageFile(number, question) {
  const dir = examDir(number);
  const wanted = new RegExp(`^Sinav\\d+_Soru0*${question.number}_EKG${question.ecgId}\\.png$`, 'i');
  const match = fs.readdirSync(dir).find((f) => wanted.test(f));

  if (!match) {
    throw new Error(
      `deneme ${number} soru ${question.number}: EKG ${question.ecgId} icin gorsel bulunamadi (${dir})`
    );
  }
  return match;
}

/** deneme_<n> klasoru; ad kaliplarindaki buyuk/kucuk harf farki tolere edilir. */
function examDir(number) {
  const root = sourceRoot();
  if (!fs.existsSync(root)) {
    throw new Error(
      `Kaynak klasor yok: ${root}\ndeneme_10_adet_output klasorunu depo kokundeki OKU/ altina koyun.`
    );
  }
  const match = fs
    .readdirSync(root)
    .filter((d) => fs.statSync(path.join(root, d)).isDirectory())
    .find((d) => new RegExp(`^deneme[_ -]*${number}$`, 'i').test(d));

  if (!match) throw new Error(`Deneme ${number}: klasor bulunamadi (${root})`);
  return path.join(root, match);
}

/** Denemenin .docx dosyasi (Deneme_1.docx / deneme_6.docx — ikisi de geciyor). */
function docxFile(number) {
  const dir = examDir(number);
  // "~$" ile baslayanlar Word'un acik belge kilit dosyalari, belge degil.
  const match = fs.readdirSync(dir).find((f) => /\.docx$/i.test(f) && !f.startsWith('~$'));
  if (!match) throw new Error(`Deneme ${number}: .docx dosyasi bulunamadi (${dir})`);
  return path.join(dir, match);
}

/**
 * Cevap anahtarini soru sirasina gore {q1: {label, text}, q2: {...}} olarak doner.
 * Satir: "Soru 1 (EKG 21045) — S1: E) İnferior MI   |   S2: B) Acil reperfuzyon ..."
 */
function parseAnswerKey(paragraphs, where) {
  const start = paragraphs.findIndex((l) => /^CEVAP ANAHTARI$/i.test(l));
  if (start < 0) throw new Error(`${where}: CEVAP ANAHTARI bolumu yok`);

  const key = new Map();
  for (const line of paragraphs.slice(start + 1)) {
    const m = line.match(
      /^Soru\s+(\d+)\s*\(EKG\s*(\d+)\)\s*—\s*S1:\s*([A-F])\)\s*(.+?)\s*\|\s*S2:\s*([A-F])\)\s*(.+)$/
    );
    if (!m) continue;
    // Metinler siklarla karsilastirilacagi icin ayni normalizasyondan geciyorlar
    key.set(Number(m[1]), {
      ecgId: m[2],
      q1: { label: m[3], text: fixDiacritics(m[4].trim()) },
      q2: { label: m[5], text: fixDiacritics(m[6].trim()) },
    });
  }
  if (!key.size) throw new Error(`${where}: cevap anahtarindan hicbir satir okunamadi`);
  return key;
}

/**
 * Bir sorunun A)-E) sik satirlarini {label, text} listesine cevirir.
 *
 * Sik metinleri de sozlukten geciriyoruz: EKG Quiz kaynagindan farkli olarak
 * burada yazim tutarsiz, ayni terim bir soruda "Ventriküler Taşikardi",
 * digerinde "Ventrikuler Tasikardi" olarak geciyor.
 */
const parseOptions = (lines) =>
  lines
    .filter((l) => /^[A-F]\)\s/.test(l))
    .map((l) => ({ label: l[0], text: fixDiacritics(l.replace(/^[A-F]\)\s*/, '').trim()) }));

/**
 * Tek bir soru blogunu ayristirir.
 * Blok, "SORU n / 10" satirindan bir sonraki soruya (ya da cevap anahtarina) kadardir.
 */
function parseQuestion(lines, answer, where) {
  const header = lines[0].match(/^SORU\s+(\d+)\s*\/\s*\d+\s*—\s*EKG Kodu:\s*(\d+)$/);
  if (!header) throw new Error(`${where}: soru basligi beklenen bicimde degil: "${lines[0]}"`);
  const number = Number(header[1]);
  const ecgId = header[2];

  const meta = lines[1].match(/^\(Konu:\s*([a-z]+)\s*·\s*Görsel dosyası:\s*(.+?)\s*\)$/);
  if (!meta) throw new Error(`${where}: konu/gorsel satiri okunamadi: "${lines[1]}"`);
  const [, categoryCode, imageFile] = meta;

  // Dosya adindaki EKG kodu ile baslikdaki kod ayrisirsa yanlis gorsel eslenirdi
  const inFileName = imageFile.match(/EKG(\d+)\.png$/i);
  if (!inFileName || inFileName[1] !== ecgId) {
    throw new Error(`${where}: gorsel adi "${imageFile}" ile EKG kodu ${ecgId} uyusmuyor`);
  }

  // Siklar iki grup halinde: once Soru 1'inkiler, sonra Soru 2'ninkiler.
  // Aralarindaki duz metin satirlari sirasiyla hikaye, Soru 1 koku, Soru 2 kokudur.
  const firstOption = lines.findIndex((l) => /^[A-F]\)\s/.test(l));
  if (firstOption < 0) throw new Error(`${where}: hic sik satiri yok`);

  const q1Options = parseOptions(lines.slice(firstOption, firstOption + 6));
  const afterQ1 = firstOption + q1Options.length;
  // Soru 2'nin koku: "Dogru tani/bulgu 'X' olarak belirlenmistir. ..."
  const q2StemIndex = lines.findIndex((l, i) => i >= afterQ1 && /olarak belirlenmistir/i.test(l));
  if (q2StemIndex < 0) throw new Error(`${where}: ikinci sorunun koku bulunamadi`);

  const q2Options = parseOptions(lines.slice(q2StemIndex + 1));

  const check = (opts, no) => {
    if (opts.length !== 5) throw new Error(`${where}: Soru ${no} icin ${opts.length} sik bulundu`);
    const labels = opts.map((o) => o.label).join('');
    if (labels !== 'ABCDE') throw new Error(`${where}: Soru ${no} sik harfleri bozuk: ${labels}`);
  };
  check(q1Options, 1);
  check(q2Options, 2);

  // Hikaye ile Soru 1 koku, baslik satirlari ile ilk sik arasindaki duz metinler
  const intro = lines.slice(2, firstOption);
  if (intro.length < 2) throw new Error(`${where}: hikaye/soru koku satirlari eksik`);
  const narrative = intro.slice(0, -1).join(' ');
  const question = intro[intro.length - 1];

  if (!answer) throw new Error(`${where}: cevap anahtarinda karsiligi yok`);
  if (answer.ecgId !== ecgId) {
    throw new Error(`${where}: cevap anahtari EKG ${answer.ecgId} diyor, soru ${ecgId}`);
  }

  /** Anahtardaki harf ile metnin ayni sikki gosterdigini dogrular. */
  const resolve = (opts, ans, no) => {
    const byLabel = opts.find((o) => o.label === ans.label);
    if (!byLabel) throw new Error(`${where}: Soru ${no} icin ${ans.label} sikki yok`);
    if (byLabel.text !== ans.text) {
      throw new Error(
        `${where}: Soru ${no} cevap anahtari "${ans.label}) ${ans.text}" ` +
          `ama ${ans.label} sikki "${byLabel.text}"`
      );
    }
    return byLabel;
  };

  const correct1 = resolve(q1Options, answer.q1, 1);
  const correct2 = resolve(q2Options, answer.q2, 2);

  // Soru 2'nin koku dogru taniyi tirnak icinde tekrar eder; Soru 1'in dogru
  // sikkiyla tutmuyorsa kaynakta karisma var demektir.
  const quoted = lines[q2StemIndex].match(/'([^']+)'/);
  if (quoted && fixDiacritics(quoted[1]) !== correct1.text) {
    throw new Error(
      `${where}: metindeki tani "${quoted[1]}" cevap anahtariyla ("${correct1.text}") ayrisiyor`
    );
  }

  return {
    number,
    ecgId,
    categoryCode,
    // Belgenin bildirdigi ad; gercek dosya questionsFor icinde diskten bulunuyor
    declaredImageFile: imageFile,
    narrative: fixDiacritics(narrative),
    question: fixDiacritics(question),
    options: q1Options.map((o) => ({ ...o, isCorrect: o.label === correct1.label })),
    correctLabel: correct1.label,
    correctText: correct1.text,
    // Soru 2'nin dogru sikki: cozumun "klinik yaklasim" govdesi (zaten normalize)
    clinicalApproach: correct2.text,
  };
}

/** Bir denemenin 10 sorusunu normalize edilmis halde doner. */
function questionsFor(number) {
  const where = `deneme ${number}`;
  const paragraphs = docxParagraphs(docxFile(number)).filter(Boolean);
  const answers = parseAnswerKey(paragraphs, where);

  const starts = [];
  paragraphs.forEach((line, i) => {
    if (/^SORU\s+\d+\s*\/\s*\d+\s*—\s*EKG Kodu:/.test(line)) starts.push(i);
  });
  if (!starts.length) throw new Error(`${where}: belgede soru bulunamadi`);

  const keyStart = paragraphs.findIndex((l) => /^CEVAP ANAHTARI$/i.test(l));

  return starts.map((start, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] : keyStart;
    const lines = paragraphs.slice(start, end);
    const question = parseQuestion(lines, answers.get(i + 1), `${where} soru ${i + 1}`);
    const imageFile = resolveImageFile(number, question);
    return { ...question, imageFile, imageUrl: imageUrlFor(imageFile) };
  });
}

/** Kaynak gorselin tam yolu. */
function imagePath(number, question) {
  return path.join(examDir(number), question.imageFile);
}

/** --exam / --all bayraklarini deneme numarasi listesine cevirir. */
function selectExams({ exam, all }) {
  const numbers = Array.from({ length: EXAM_COUNT }, (_, i) => i + 1);
  if (all) return numbers;
  const n = Number(exam);
  return numbers.filter((x) => x === n);
}

module.exports = {
  EXAM_CATEGORY,
  EXAM_COUNT,
  DURATION_MINUTES,
  LABELS,
  IMAGE_BASE,
  questionsFor,
  selectExams,
  sourceRoot,
  examDir,
  imagePath,
};
