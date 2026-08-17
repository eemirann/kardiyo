/**
 * OKU/EKG altindaki vaka verisini okur.
 *
 * Klasor duzeni (kaynak oldugu gibi birakildi, adlar Turkce):
 *   OKU/EKG/2-MI/
 *     2- mi.docx                     30 vakanin metni
 *     ecg_only_mi/ECG_<id>.png       12 derivasyonlu kayit
 *
 * Klasor adlari macOS'ta uretildigi icin Turkce harfler birlesik aksan
 * (NFD) olarak kodlanmis; "Mİxx" gibi adlari birebir eslestirmek kirilgan
 * oldugundan klasorler bastaki sira numarasiyla, gorsel klasoru de
 * "ecg_only" onekiyle bulunuyor.
 *
 * Her vakadan yalnizca Soru 1 ("hangi tani?") soru olarak aliniyor. Soru 2'nin
 * govdesi dogru taniyi acikca yaziyor ("Dogru bulgu 'X' olarak belirlenmistir..."),
 * bu yuzden ayri bir soru olarak listede yan yana durunca cevabi ele verirdi.
 * Bunun yerine Soru 2'nin DOGRU SIKKI (klinik yaklasim) cozum metnine ekleniyor:
 * kaynakta vaka basina aciklama olmadigi icin cozum aksi halde yalnizca dogru
 * sikkin tekrarindan ibaret kalirdi.
 */
const fs = require('fs');
const path = require('path');
const { docxParagraphs } = require('./docx-text');
const { fixDiacritics } = require('./tr-diacritics');

/**
 * Kategoriler. `code` hem gorsel klasorunde, hem konu slug'inda (ekg-<code>),
 * hem source_key'de gecer; degistirmek mevcut kayitlari kopyalar.
 * `dir` kaynak klasorun bastaki sira numarasidir.
 * `name` ve `short` sitede gorunur — web/src/data/ekg-categories.js ile ayni olmali.
 */
const CATEGORIES = [
  { code: 'norm', dir: 1, name: 'Normal Sinüs Ritmi', short: 'Normal Sinüs' },
  { code: 'mi', dir: 2, name: 'Miyokard Enfarktüsü', short: 'MI' },
  { code: 'cd', dir: 3, name: 'İleti Bozuklukları', short: 'İleti Boz.' },
  { code: 'hyp', dir: 4, name: 'Hipertrofi Paterni', short: 'Hipertrofi' },
  { code: 'sttc', dir: 5, name: 'MI Dışı ST-T Değişiklikleri', short: 'ST-T' },
  { code: 'svt', dir: 6, name: 'Supraventriküler Taşikardiler', short: 'SVT' },
  { code: 'vt', dir: 7, name: 'Ventriküler Aritmiler', short: 'Ventriküler' },
  { code: 'axis', dir: 8, name: 'Aks Sapmaları', short: 'Aks Sapması' },
  { code: 'pace', dir: 9, name: 'Pacemaker Ritimleri', short: 'Pacemaker' },
];

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Depo kokundeki OKU/EKG klasoru (bu dosya api/scripts/lib/ altinda). */
const sourceRoot = () => path.join(__dirname, '..', '..', '..', 'OKU', 'EKG');

/** Konu slug'i: kategori basina ayri konu acilir, hepsi /konular'da gizlidir. */
const topicSlug = (code) => `ekg-${code}`;

/** Kategorinin kaynak klasorunu bastaki sira numarasindan bulur. */
function categoryDir(category) {
  const root = sourceRoot();
  if (!fs.existsSync(root)) {
    throw new Error(`Kaynak klasor yok: ${root}\nEKG klasorunu depo kokundeki OKU/ altina koyun.`);
  }
  const match = fs
    .readdirSync(root)
    .filter((d) => fs.statSync(path.join(root, d)).isDirectory())
    .find((d) => new RegExp(`^${category.dir}\\s*-`).test(d));

  if (!match) throw new Error(`${category.code}: "${category.dir}- ..." klasoru bulunamadi`);
  return path.join(root, match);
}

/** Kategorinin EKG gorsellerinin durdugu klasor (ecg_only... ile baslar). */
function imageDir(category) {
  const dir = categoryDir(category);
  const match = fs
    .readdirSync(dir)
    .find((d) => d.startsWith('ecg_only') && fs.statSync(path.join(dir, d)).isDirectory());

  if (!match) throw new Error(`${category.code}: ecg_only... gorsel klasoru bulunamadi (${dir})`);
  return path.join(dir, match);
}

/** Kategorinin vaka metinlerini tutan .docx dosyasi. */
function docxFile(category) {
  const dir = categoryDir(category);
  // "~$" ile baslayanlar Word'un acik belge kilit dosyalari, belge degil.
  const match = fs.readdirSync(dir).find((f) => f.endsWith('.docx') && !f.startsWith('~$'));
  if (!match) throw new Error(`${category.code}: .docx dosyasi bulunamadi (${dir})`);
  return path.join(dir, match);
}

/**
 * "Hasta Bilgisi" satirindaki anonimlestirilmis yasi okunur hale getirir.
 *
 * Kaynak PTB-XL veri setinde 90 yas ustu hastalarin yasi 300 olarak
 * anonimlestirilmis, alan oldugu gibi "300 yaş, Kadın" diyor (4 vaka).
 * Ayni vakalarin oykusu zaten "90 yaş üzeri kadın hasta, ..." dedigi icin
 * ikisi birbirini tutsun diye "90+ yaş" yaziyoruz.
 *
 * Not: "yaş" sonrasi \b kullanilmiyor — JS'te ş ASCII kelime karakteri
 * sayilmadigi icin sinir olusmaz ve kalip hic eslesmez.
 */
const fixAnonymizedAge = (s) => s.replace(/^300(?=\s*yaş)/, '90+');

/**
 * Bir vaka blogunu ayristirir. Blok duzeni:
 *   EKG #1  —  Kayıt ID: 582
 *   Tanı: Normal Sinüs Ritmi
 *   Hasta Bilgisi: 38 yaş, Kadın
 *   Öykü: 38 yasinda kadin hasta, ...
 *   Soru 1
 *   <soru koku>
 *   A) ...   (dogru sikkin sonunda "✓ Doğru Cevap")
 *   Soru 2
 *   <soru koku>
 *   A) ...
 */
function parseCase(category, lines, where) {
  const field = (name) => {
    const line = lines.find((l) => l.startsWith(`${name}: `));
    if (!line) throw new Error(`${where}: "${name}" satiri yok`);
    return line.slice(name.length + 2).trim();
  };

  const header = lines[0].match(/^EKG #\d+\s*—\s*Kayıt ID:\s*(\d+)$/);
  if (!header) throw new Error(`${where}: baslik satiri beklenen bicimde degil: "${lines[0]}"`);
  const ecgId = header[1];

  const q1 = lines.indexOf('Soru 1');
  const q2 = lines.indexOf('Soru 2');
  if (q1 < 0 || q2 < 0 || q2 < q1) throw new Error(`${where}: Soru 1 / Soru 2 basliklari eksik`);

  /** Sik satirlarini {text, isCorrect} listesine cevirir. */
  const parseOptions = (from, to) =>
    lines
      .slice(from, to)
      .filter((l) => /^[A-F]\)\s/.test(l))
      .map((l) => {
        const text = l.replace(/^[A-F]\)\s*/, '');
        const isCorrect = text.includes('✓');
        return { text: text.replace(/\s*✓\s*Doğru Cevap\s*$/, '').trim(), isCorrect };
      });

  const raw1 = parseOptions(q1 + 1, q2);
  const raw2 = parseOptions(q2 + 1, lines.length);

  const check = (opts, no) => {
    if (opts.length < 2) throw new Error(`${where}: Soru ${no} icin ${opts.length} sik bulundu`);
    const correct = opts.filter((o) => o.isCorrect).length;
    if (correct !== 1) throw new Error(`${where}: Soru ${no} icin ${correct} dogru sik isaretli`);
  };
  check(raw1, 1);
  check(raw2, 2);

  const correctIndex = raw1.findIndex((o) => o.isCorrect);
  const diagnosis = field('Tanı');

  // Kaynak hatasi olarak dogru sik ile tani ayrisirsa cozum metni yanlis olurdu
  if (raw1[correctIndex].text !== diagnosis) {
    throw new Error(
      `${where}: dogru sik "${raw1[correctIndex].text}" ile tani "${diagnosis}" ayni degil`
    );
  }

  return {
    category: category.code,
    ecgId,
    diagnosis,
    patient: fixAnonymizedAge(field('Hasta Bilgisi')),
    narrative: fixDiacritics(field('Öykü')),
    // Soru koku "Soru 1" basligindan hemen sonraki satirdir
    question: fixDiacritics(lines[q1 + 1]),
    options: raw1.map((o, i) => ({ label: LABELS[i], text: o.text, isCorrect: o.isCorrect })),
    correctLabel: LABELS[correctIndex],
    correctText: raw1[correctIndex].text,
    // Soru 2'nin dogru sikki: "bu tani konduysa ne yapilmali" — cozumun govdesi
    clinicalApproach: fixDiacritics(raw2.find((o) => o.isCorrect).text),
    // Site ici mutlak yol; dosya web/public/ekg/ altinda durur (Vercel sunar)
    imageUrl: `/ekg/${category.code}/ECG_${ecgId}.png`,
    sourceKey: `ekg#${category.code}#${ecgId}`,
  };
}

/** Bir kategorinin vakalarini normalize edilmis halde doner. */
function casesFor(category) {
  const paragraphs = docxParagraphs(docxFile(category)).filter(Boolean);

  // Belge basligi/altligi vakalardan once gelir; ilk "EKG #" satirindan basla
  const starts = [];
  paragraphs.forEach((line, i) => {
    if (/^EKG #\d+\s*—\s*Kayıt ID:/.test(line)) starts.push(i);
  });
  if (!starts.length) throw new Error(`${category.code}: belgede vaka bulunamadi`);

  return starts.map((start, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] : paragraphs.length;
    return parseCase(category, paragraphs.slice(start, end), `${category.code} #${i + 1}`);
  });
}

/** --category / --all bayraklarini kategori listesine cevirir. */
function selectCategories({ category, all }) {
  if (all) return CATEGORIES;
  return CATEGORIES.filter((c) => c.code === category);
}

module.exports = {
  CATEGORIES,
  LABELS,
  casesFor,
  selectCategories,
  sourceRoot,
  imageDir,
  topicSlug,
};
