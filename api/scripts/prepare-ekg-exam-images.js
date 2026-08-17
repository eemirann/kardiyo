/**
 * EKG deneme sinavlarinin kayit gorsellerini sikistirip web/public altina kopyalar.
 *
 * Kaynak: OKU/deneme_10_adet_output/deneme_<n>/Sinav<n>_Soru<mm>_EKG<id>.png
 * Hedef:  web/public/ekg/deneme/sinav<n>_soru<mm>_ekg<id>.png
 *         -> site icinde /ekg/deneme/sinav<n>_soru<mm>_ekg<id>.png
 *
 * Dosya adlari kucuk harfe cevriliyor: kaynakta buyuk harfli, Windows'ta bu fark
 * gorunmez ama Vercel'in dosya sistemi buyuk/kucuk harfe duyarli — adres birebir
 * tutmazsa gorsel yayinda 404 doner.
 *
 * Sikistirma gerekcesi EKG Quiz gorselleriyle ayni (bkz. prepare-ekg-images.js):
 * cizgi grafigi 64 renklik palete kayipsiza yakin siginca dosyalar ~%75 kuculuyor.
 *
 *   npm run prepare-ekg-exam-images -- --exam 1
 *   npm run prepare-ekg-exam-images -- --all
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { EXAM_COUNT, questionsFor, selectExams, imagePath } = require('./lib/ekg-exam-source');

const OUT_DIR = path.join(__dirname, '..', '..', 'web', 'public', 'ekg', 'deneme');
const COLORS = 64;

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
};
const has = (name) => process.argv.includes(`--${name}`);

async function run() {
  const selected = selectExams({ exam: arg('exam'), all: has('all') });
  if (!selected.length) {
    console.error(`Deneme verin: --exam 1  (veya tumu icin --all; 1-${EXAM_COUNT})`);
    process.exit(1);
  }

  // Tumu yeniden uretiliyorsa klasoru sifirla: kaynaktan cikan bir sorunun
  // gorseli hedefte kalirsa depoda sahipsiz dosya olarak birikirdi.
  if (has('all')) fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let done = 0;
  let srcBytes = 0;
  let outBytes = 0;

  for (const number of selected) {
    const questions = questionsFor(number);
    process.stdout.write(`deneme ${String(number).padStart(2)}  ${questions.length} gorsel `);

    for (const q of questions) {
      const src = imagePath(number, q);
      if (!fs.existsSync(src)) throw new Error(`Gorsel bulunamadi: ${src}`);
      // imageUrl "/ekg/deneme/<ad>" — hedef dosya adi oradan gelsin ki
      // veritabanina yazilan adres ile diskteki ad kesin ayni olsun.
      const out = path.join(OUT_DIR, path.basename(q.imageUrl));

      srcBytes += fs.statSync(src).size;
      await sharp(src)
        .flatten({ background: '#ffffff' })
        .png({ palette: true, colors: COLORS, effort: 8 })
        .toFile(out);
      outBytes += fs.statSync(out).size;
      done += 1;
    }
    process.stdout.write('tamam\n');
  }

  const mb = (b) => (b / (1024 * 1024)).toFixed(1);
  console.log(
    `\n${done} gorsel: ${mb(srcBytes)} MB -> ${mb(outBytes)} MB ` +
      `(%${(100 - (outBytes / srcBytes) * 100).toFixed(0)} kucultuldu)`
  );
  console.log('Hedef: web/public/ekg/deneme/');
}

run().catch((err) => {
  console.error('Islem basarisiz:', err.message);
  process.exit(1);
});
