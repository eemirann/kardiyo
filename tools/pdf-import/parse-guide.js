/**
 * Kardiyovaskuler Farmakoloji kilavuzunu yapisal JSON'a cevirir.
 *
 * Konum (x) degerlerinden blok turu anlasilir:
 *   54 -> govde metni / baslik / tablo basligi
 *   60 -> tablo satiri
 *   63 -> numarali alt baslik ("1. Etken Maddeler...")
 *   67 -> ozel kutu (TUS/USMLE Vurgusu, Braunwald, Kritik Hata, Ince Nokta)
 */
const fs = require('fs');
const { extractLines } = require('./layout');

const SRC = 'C:/Users/LENOVO/Desktop/kardiyo/OKU/11- Kardiyovaskuler_Farmakoloji_Detayli_watermark.pdf';

const NOISE = [
  /^\d+\s*\/\s*\d+$/,
  /^10 ADIMDA KARD/i,
  /^10_adımda_kardiyoloji$/i,
  /Kardiyovaskler Farmakoloji/i,
  /^KARDİYOVASKÜLER FARMAKOLOJİ —/,
  /^Kardiyovasküler Farmakoloji Kılavuzu/,
  /^[·\s]*$/,
];
const isNoise = (t) => !t || NOISE.some((re) => re.test(t));

/** Kutu basligi mi? (buyuk harfli, x=67) */
const isCalloutTitle = (l) =>
  l.x >= 65 && l.text === l.text.toUpperCase() && /[A-ZÇĞİÖŞÜ]{4}/.test(l.text);

(async () => {
  const raw = await extractLines(SRC);
  const lines = raw.filter((l) => !isNoise(l.text));

  const chapters = [];
  let chapter = null;
  let section = null;
  let block = null;

  const pushBlock = (b) => {
    if (!section) return;
    section.blocks.push(b);
    block = b;
  };

  for (const l of lines) {
    const t = l.text;

    // BÖLÜM n Basligi
    const chapM = t.match(/^BÖLÜM\s+(\d+)\s+(.+)$/);
    if (chapM) {
      chapter = { number: Number(chapM[1]), title: chapM[2].trim(), subtitle: '', sections: [] };
      chapters.push(chapter);
      section = null;
      block = null;
      continue;
    }

    // n.m Alt bolum basligi
    const secM = t.match(/^(\d+)\.(\d+)\s+(.+)$/);
    if (secM && chapter && Number(secM[1]) === chapter.number && l.x < 58) {
      section = {
        number: `${secM[1]}.${secM[2]}`,
        title: secM[3].trim(),
        blocks: [],
      };
      chapter.sections.push(section);
      block = null;
      continue;
    }

    // Bolum alt basligi (BÖLÜM satirindan hemen sonraki aciklama)
    if (chapter && !section && !chapter.subtitle) {
      chapter.subtitle = t;
      continue;
    }
    if (!section) continue;

    // Numarali alt baslik
    if (l.x >= 62 && l.x < 66 && /^\d+\.\s+[A-ZÇĞİÖŞÜ]/.test(t)) {
      pushBlock({ type: 'heading', text: t.replace(/^\d+\.\s*/, '') });
      continue;
    }

    // Tablo basligi
    if (/^Tablo\s+[\d.]+/.test(t)) {
      pushBlock({ type: 'table', caption: t, rows: [] });
      continue;
    }

    // Tablo satiri
    if (l.x >= 58 && l.x < 62 && block?.type === 'table') {
      block.rows.push(l.cells.length > 1 ? l.cells : [l.text]);
      continue;
    }

    // Ozel kutu
    if (isCalloutTitle(l)) {
      pushBlock({ type: 'callout', title: t, text: '' });
      continue;
    }
    if (l.x >= 65 && block?.type === 'callout') {
      block.text += (block.text ? ' ' : '') + t;
      continue;
    }

    // Govde paragrafi: yeni cumle basi mi devam mi?
    const startsNew =
      /^[A-ZÇĞİÖŞÜ0-9★✚⚠•]/.test(t) &&
      (block?.type !== 'paragraph' || /[.:;)]$/.test(block.text) || /^[A-ZÇĞİÖŞÜ][^.]*:/.test(t));

    if (block?.type === 'paragraph' && !startsNew) {
      block.text += ' ' + t;
    } else {
      pushBlock({ type: 'paragraph', text: t });
    }
  }

  // Temizlik
  for (const c of chapters) {
    for (const s of c.sections) {
      s.blocks = s.blocks
        .map((b) => {
          if (b.text) b.text = b.text.replace(/\s+/g, ' ').trim();
          return b;
        })
        .filter((b) => (b.type === 'table' ? b.rows.length : b.text));
    }
  }

  fs.writeFileSync('guide.json', JSON.stringify(chapters, null, 2));

  console.log(`Bölüm: ${chapters.length}`);
  for (const c of chapters) {
    const blocks = c.sections.reduce((n, s) => n + s.blocks.length, 0);
    console.log(`  ${c.number}. ${c.title} — ${c.sections.length} alt bölüm, ${blocks} blok`);
  }
  const all = chapters.flatMap((c) => c.sections.flatMap((s) => s.blocks));
  const byType = all.reduce((a, b) => ({ ...a, [b.type]: (a[b.type] || 0) + 1 }), {});
  console.log('Blok türleri:', JSON.stringify(byType));
})();
