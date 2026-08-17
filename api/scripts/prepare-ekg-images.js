/**
 * EKG kayit gorsellerini sikistirip web/public/ekg/ altina kopyalar.
 *
 * Kaynak: OKU/EKG/<sira>- <ad>/ecg_only_<ad>/ECG_<id>.png
 * Hedef:  web/public/ekg/<kod>/ECG_<id>.png  ->  site icinde /ekg/<kod>/ECG_<id>.png
 *
 * Neden sikistiriyoruz: kaynak dosyalar 1988x1817 RGBA, ortalama 367 KB; 270 vaka
 * ~97 MB tutuyor ve bu boyut kalici olarak git gecmisine girerdi. EKG bir cizgi
 * grafigi (beyaz zemin, birkac ton kirmizi izgara, siyah trase, lacivert etiket),
 * yani 64 renklik palete kayipsiza yakin sigiyor: ortalama 91 KB, toplam ~24 MB.
 * Alfa kanali gereksiz oldugu icin beyaz zemine duzlestiriliyor.
 *
 *   npm run prepare-ekg-images -- --category norm
 *   npm run prepare-ekg-images -- --all
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { CATEGORIES, casesFor, selectCategories, imageDir } = require('./lib/ekg-source');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'web', 'public', 'ekg');
const COLORS = 64;

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
};
const has = (name) => process.argv.includes(`--${name}`);

async function run() {
  const selected = selectCategories({ category: arg('category'), all: has('all') });
  if (!selected.length) {
    console.error('Kategori verin: --category norm  (veya tumu icin --all)');
    console.error(`Kategoriler: ${CATEGORIES.map((c) => c.code).join(', ')}`);
    process.exit(1);
  }

  let done = 0;
  let srcBytes = 0;
  let outBytes = 0;

  for (const cat of selected) {
    const outDir = path.join(PUBLIC_DIR, cat.code);
    // Kategori klasoru sifirdan yazilir: kaynaktan cikarilan bir vakanin gorseli
    // hedefte kalirsa depoda sahipsiz dosya olarak birikirdi.
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    const cases = casesFor(cat);
    const srcDir = imageDir(cat);
    process.stdout.write(`${cat.code.padEnd(6)} ${String(cases.length).padStart(3)} gorsel `);

    for (const c of cases) {
      const src = path.join(srcDir, `ECG_${c.ecgId}.png`);
      if (!fs.existsSync(src)) throw new Error(`Gorsel bulunamadi: ${src}`);
      const out = path.join(outDir, `ECG_${c.ecgId}.png`);

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
  console.log(`Hedef: web/public/ekg/`);
}

run().catch((err) => {
  console.error('Islem basarisiz:', err.message);
  process.exit(1);
});
