/**
 * .docx dosyasindan duz metin cikarir (bagimliliksiz).
 *
 * EKG vaka metinleri Word belgesi olarak geliyor. Tek ihtiyacimiz paragraf
 * metinleri oldugu icin bir Word kutuphanesi eklemek yerine dosyayi kendi
 * formatinda okuyoruz: .docx aslinda bir zip; icindeki word/document.xml
 * paragraflari <w:p>, metin parcalarini <w:t> etiketleriyle tutar.
 *
 * Word bir cumleyi imla denetimi veya bicim degisikligi yuzunden birden fazla
 * <w:t> parcasina bolebilir; parcalar birlestirilerek paragraf metni elde edilir.
 */
const fs = require('fs');
const zlib = require('zlib');

/** Zip arsivinden tek bir girdiyi acar. */
function zipEntry(file, name) {
  const buf = fs.readFileSync(file);

  // End of Central Directory kaydi dosyanin sonundadir (degisken uzunluklu
  // yorum alani yuzunden sabit konumda degil), imzasini geriye tarayarak buluyoruz.
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) throw new Error(`${file}: zip dizini bulunamadi (dosya bozuk olabilir)`);

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let i = 0; i < count; i += 1) {
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);

    if (buf.toString('utf8', p + 46, p + 46 + nameLen) === name) {
      // Yerel baslikta ad/extra alanlarinin uzunlugu merkezi dizindekinden
      // farkli olabilir; veri baslangicini yerel baslikdan hesapliyoruz.
      const start =
        localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
      const data = buf.subarray(start, start + compressedSize);
      return method === 0 ? data : zlib.inflateRawSync(data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${file}: arsivde ${name} yok`);
}

const unescapeXml = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** Belgedeki paragraflari sirasiyla, bosluklari kirpilmis olarak doner. */
function docxParagraphs(file) {
  const xml = zipEntry(file, 'word/document.xml').toString('utf8');
  return xml
    .split(/<w:p[ >]/)
    .slice(1)
    .map((p) =>
      [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
        .map((m) => unescapeXml(m[1]))
        .join('')
        .trim()
    );
}

module.exports = { docxParagraphs };
