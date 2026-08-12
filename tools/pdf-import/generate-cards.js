/**
 * guide.json'dan flashcard uretir.
 *
 * Uc kural:
 *  1) Ozel kutular (TUS/USMLE Vurgusu, Kritik Hata, Braunwald, Ince Nokta) -> kavram karti
 *  2) "X: aciklama" bicimli tanim paragraflari -> ilgili alt basliga gore soru
 *  3) Tablolar -> anahtar sutun + kalan sutunlar (ticari ad, doz vb.)
 */
const fs = require('fs');
const guide = require('./guide.json');

const cards = [];
const push = (c) => {
  const front = c.front.replace(/\s+/g, ' ').trim();
  const back = c.back.replace(/\s+/g, ' ').trim();
  if (front.length < 6 || back.length < 25) return;
  cards.push({ ...c, front, back });
};

/** Kutu basligindaki isaret/etiket kismini ayikla. */
function calloutParts(title) {
  const clean = title.replace(/^[★✚⚠•\s]+/, '').trim();
  const [kind, ...rest] = clean.split(/\s+—\s+|\s+-\s+/);
  return { kind: kind.trim(), topic: rest.join(' — ').trim() };
}

const KIND_LABEL = {
  'TUS/USMLE VURGUSU': 'Sınav vurgusu',
  'KRİTİK HATA / MALPRAKTİS ÖNLEMİ': 'Kritik hata',
  'BRAUNWALD KLİNİK PRATİK KÖŞESİ': 'Klinik pratik',
  'FARMAKOLOJİK İNCE NOKTA': 'İnce nokta',
};

for (const chapter of guide) {
  for (const section of chapter.sections) {
    const ref = `Bölüm ${section.number} — ${section.title}`;
    let heading = '';

    for (const b of section.blocks) {
      if (b.type === 'heading') {
        heading = b.text;
        continue;
      }

      // --- 1) Ozel kutular
      if (b.type === 'callout') {
        const { kind, topic } = calloutParts(b.title);
        const label = KIND_LABEL[kind] || null;
        // Buyuk harfli baslik metnini bozmadan cumleye cevir (Turkce 'i' sorunu icin locale)
        // Konu basligi yoksa kutu turunun kendisi konudur; etiketi tekrar yazma
        const front = topic
          ? `${section.title} — ${sentenceCase(topic)}${label ? ` (${label})` : ''}`
          : `${section.title} — ${label || sentenceCase(kind)}`;
        push({
          front,
          back: b.text,
          kind: label || 'Kavram',
          chapter: chapter.number,
          section: section.number,
          reference: ref,
        });
        continue;
      }

      // --- 3) Tablolar
      if (b.type === 'table') {
        const rows = b.rows.filter((r) => r.length >= 2);
        if (rows.length < 2) continue;
        const header = rows[0];
        const isTrade = header.some((h) => /Ticari/i.test(h));
        const isDose = header.some((h) => /Doz|Titrasyon|Hedef/i.test(h));

        for (const row of rows.slice(1)) {
          if (row.length < 2) continue;
          const key = (row[isTrade && row.length > 2 ? 1 : 0] || '')
            .replace(/[\s/·,;-]+$/, '')
            .trim();
          const rest = row.filter((_, i) => i !== (isTrade && row.length > 2 ? 1 : 0));
          if (!key || key.length > 90) continue;

          const question = isTrade
            ? `${key} — Türkiye'deki ticari adı?`
            : isDose
              ? `${key} — doz / titrasyon?`
              : `${key} — ${header.slice(1).join(' / ')}?`;

          // Arka yuz: on yuzde sorulan sutun haric kalan sutunlar
          const keyIdx = isTrade && row.length > 2 ? 1 : 0;
          const back = row
            .map((v, i) => (i === keyIdx || !v ? null : header[i] ? `${header[i]}: ${v}` : v))
            .filter(Boolean)
            .join(' · ');

          push({
            front: question,
            back: back || rest.join(' · '),
            kind: isTrade ? 'Ticari ad' : isDose ? 'Doz' : 'Tablo',
            chapter: chapter.number,
            section: section.number,
            reference: `${ref} · ${b.caption}`,
          });
        }
        continue;
      }

      // --- 2) Tanim paragraflari: "X: aciklama" veya "X (…): aciklama"
      const m = b.text.match(/^([^:]{4,70}):\s+(.{40,})$/);
      if (m) {
        const term = m[1].trim();
        // Cumle icindeki iki nokta degil, gercek terim olmali
        if (/[.!?]/.test(term)) continue;
        const suffix = /Mekanizma/i.test(heading)
          ? ' — etki mekanizması?'
          : /Yan Etki|Kontrendikasyon/i.test(heading)
            ? ' — yan etki / kontrendikasyon?'
            : /Endikasyon/i.test(heading)
              ? ' — klinik endikasyon?'
              : /Doz/i.test(heading)
                ? ' — doz ve titrasyon?'
                : ' — nedir?';
        push({
          front: term + suffix,
          back: m[2].trim(),
          kind: heading || 'Kavram',
          chapter: chapter.number,
          section: section.number,
          reference: ref,
        });
      }
    }
  }
}

/**
 * TAMAMI BUYUK baslikligi okunur cumleye cevirir.
 * Turkce locale sart: toLowerCase() 'I' -> 'i̇' bozulmasini onler.
 * Kisaltmalar (TUS, USMLE, AF, HFrEF...) korunur.
 */
function sentenceCase(s) {
  if (s !== s.toLocaleUpperCase('tr-TR')) return s; // zaten karisik yazim
  const KEEP = /^(TUS|USMLE|AF|KY|HT|EE|IL|MRA|ARNI|ACEİ|ARB|SGLT2İ|DKMP|HOKMP|EKG|IV|PO|TTR|NLRP3|CRP|INR|VS)$/;
  const words = s.split(/\s+/).map((w) => {
    if (KEEP.test(w) || /^[^A-ZÇĞİÖŞÜ]+$/.test(w)) return w;
    return w.charAt(0) + w.slice(1).toLocaleLowerCase('tr-TR');
  });
  return words.join(' ');
}

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));

const byKind = cards.reduce((a, c) => ({ ...a, [c.kind]: (a[c.kind] || 0) + 1 }), {});
console.log(`Toplam kart: ${cards.length}`);
console.log('Türlere göre:', JSON.stringify(byKind, null, 1));
console.log('\nÖrnekler:');
for (const c of [cards[0], cards[3], cards[Math.floor(cards.length / 2)], cards[cards.length - 1]]) {
  if (!c) continue;
  console.log(`\n  ÖN : ${c.front}`);
  console.log(`  ARKA: ${c.back.slice(0, 150)}${c.back.length > 150 ? '…' : ''}`);
  console.log(`  REF : ${c.reference}`);
}
