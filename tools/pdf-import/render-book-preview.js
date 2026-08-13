/**
 * "10 Adimda Kardiyoloji" kitabinin ilk sayfalarini ana sayfadaki onizleme icin
 * gorsele cevirir.
 *
 * Cikti: web/public/kitap/sayfa-01.png ... sayfa-10.png
 *
 * Kitabin tam metni artik siteden servis edilmiyor; indirme linkleri Zenodo
 * kaydina gidiyor (bkz. web/src/components/BookPreview.jsx). Bu yuzden PDF
 * web/public altina kopyalanmiyor.
 *
 *   npm run book
 */
const fs = require('fs');
const path = require('path');
const { pdf } = require('pdf-to-img');
const sharp = require('sharp');

const SRC = 'C:/Users/LENOVO/Desktop/kardiyo/OKU/10 Adımda Kardiyo/10 Adımda Kardiyoloji.pdf';
const OUT = path.join(__dirname, '..', '..', 'web', 'public', 'kitap');
const PAGES = 10;
const SCALE = 1.4; // ~1150px genislik: ekranda net, dosya boyutu makul

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const doc = await pdf(SRC, { scale: SCALE });
  console.log(`Kitap: ${doc.length} sayfa | onizleme: ilk ${PAGES}`);

  let i = 0;
  let total = 0;
  for await (const page of doc) {
    i += 1;
    if (i > PAGES) break;
    // PNG olarak ~500 KB/sayfa cikiyor; ana sayfada gosterilecegi icin JPEG'e ceviriyoruz
    const file = path.join(OUT, `sayfa-${String(i).padStart(2, '0')}.jpg`);
    const buf = await sharp(page).resize({ width: 1000 }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    fs.writeFileSync(file, buf);
    total += buf.length;
    console.log(`  sayfa ${i}: ${(buf.length / 1024).toFixed(0)} KB`);
  }

  const size = fs.statSync(SRC).size;

  fs.writeFileSync(
    path.join(OUT, 'kitap.json'),
    JSON.stringify(
      {
        title: '10 Adımda Kardiyoloji',
        totalPages: doc.length,
        previewPages: Math.min(PAGES, doc.length),
        pdfSizeMb: Number((size / 1024 / 1024).toFixed(1)),
      },
      null,
      2
    )
  );

  console.log(`\nOnizleme toplam: ${(total / 1024 / 1024).toFixed(1)} MB`);
  console.log(`PDF: ${(size / 1024 / 1024).toFixed(1)} MB -> ${pdfOut}`);
})();
