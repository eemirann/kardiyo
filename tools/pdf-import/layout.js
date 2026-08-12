/**
 * PDF'i konum bilgisiyle satirlara cevirir.
 * Her satir: { page, y, x, text }  (x = satirin en soldaki parcasinin x'i)
 * Boylece "A." sik etiketlerinin y'sini kullanarak siklari ayirabiliyoruz.
 */
const fs = require('fs');
const pdfjs = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js');

async function extractLines(file) {
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument(data).promise;
  const lines = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent({ normalizeWhitespace: true });
    const byY = new Map();

    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = Math.round(item.transform[5] * 2) / 2; // 0.5 pt tolerans
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y).push({ x, str: item.str, w: item.width || 0 });
    }

    const ys = [...byY.keys()].sort((a, b) => b - a); // ustten alta
    for (const y of ys) {
      const parts = byY.get(y).sort((a, b) => a.x - b.x);
      const text = parts.map((s) => s.str).join('').replace(/\s+/g, ' ').trim();

      // Yatay bosluk buyukse ayri hucre kabul et (tablo sutunlari)
      const cells = [];
      let cur = '';
      for (let i = 0; i < parts.length; i++) {
        cur += parts[i].str;
        const next = parts[i + 1];
        if (!next) break;
        if (next.x - (parts[i].x + parts[i].w) > 4) {
          cells.push(cur.trim());
          cur = '';
        }
      }
      if (cur.trim()) cells.push(cur.trim());

      if (text) lines.push({ page: p, y, x: parts[0].x, text, cells });
    }
  }
  return lines;
}

module.exports = { extractLines };

if (require.main === module) {
  extractLines(process.argv[2]).then((lines) => {
    fs.writeFileSync(
      process.argv[3],
      lines.map((l) => `${l.page}\t${l.y}\t${Math.round(l.x)}\t${l.text}`).join('\n')
    );
    console.log('satir:', lines.length);
  });
}
