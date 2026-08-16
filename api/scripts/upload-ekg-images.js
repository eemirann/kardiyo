/**
 * EKG kayit gorsellerini (ecg_only PNG'leri) Cloudflare R2'ye yukler.
 *
 * Kaynak: OKU/EKG/<sira>- <kod>_quiz_output/ecg_only/ECG_<id>.png
 * Hedef:  ekg/<kod>/ECG_<id>.png  ->  ${R2_PUBLIC_URL}/ekg/<kod>/ECG_<id>.png
 *
 * Gorseller depoya degil R2'ye konuyor: 270 kayit ~104 MB tutuyor ve git
 * gecmisini kalici olarak sisirirdi.
 *
 *   npm run upload-ekg-images -- --category norm
 *   npm run upload-ekg-images -- --all
 *   npm run upload-ekg-images -- --category norm --dry-run
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { HeadObjectCommand } = require('@aws-sdk/client-s3');
const storage = require('../services/storage');
const { CATEGORIES, casesFor, sourceRoot } = require('./lib/ekg-source');

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
};
const has = (name) => process.argv.includes(`--${name}`);

/** Ayni anahtar R2'de zaten varsa tekrar yuklenmez (betik yeniden calistirilabilir). */
async function exists(key) {
  const { S3Client } = require('@aws-sdk/client-s3');
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  try {
    await client.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function run() {
  const dryRun = has('dry-run');
  const category = arg('category');
  const all = has('all');

  if (!category && !all) {
    console.error('Kategori verin: --category norm  (veya tumu icin --all)');
    console.error(`Kategoriler: ${CATEGORIES.map((c) => c.code).join(', ')}`);
    process.exit(1);
  }
  if (!dryRun && !storage.isEnabled()) {
    console.error(
      'R2 ayarlari eksik. api/.env icinde R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,\n' +
        'R2_SECRET_ACCESS_KEY, R2_BUCKET ve R2_PUBLIC_URL dolu olmali.'
    );
    process.exit(1);
  }

  const selected = all ? CATEGORIES : CATEGORIES.filter((c) => c.code === category);
  if (!selected.length) {
    console.error(`Bilinmeyen kategori: ${category}`);
    console.error(`Kategoriler: ${CATEGORIES.map((c) => c.code).join(', ')}`);
    process.exit(1);
  }

  let uploaded = 0;
  let skipped = 0;
  let bytes = 0;

  for (const cat of selected) {
    const cases = casesFor(cat);
    console.log(`\n${cat.code} (${cat.name}) — ${cases.length} gorsel`);

    for (const c of cases) {
      const file = path.join(sourceRoot(), cat.dir, 'ecg_only', `ECG_${c.ecgId}.png`);
      if (!fs.existsSync(file)) throw new Error(`Gorsel bulunamadi: ${file}`);
      const size = fs.statSync(file).size;

      if (dryRun) {
        bytes += size;
        uploaded += 1;
        continue;
      }

      if (await exists(c.imageKey)) {
        skipped += 1;
        continue;
      }

      await storage.putObject({
        key: c.imageKey,
        body: fs.readFileSync(file),
        contentType: 'image/png',
      });
      bytes += size;
      uploaded += 1;
      process.stdout.write('.');
    }
    if (!dryRun) process.stdout.write('\n');
  }

  const mb = (bytes / (1024 * 1024)).toFixed(1);
  console.log(
    dryRun
      ? `\n[deneme] ${uploaded} gorsel yuklenecek (${mb} MB). Ornek adres:\n  ${
          storage.publicUrlFor(casesFor(selected[0])[0].imageKey) || '(R2_PUBLIC_URL bos)'
        }`
      : `\nYuklenen: ${uploaded} (${mb} MB) | Zaten vardi: ${skipped}`
  );
}

run().catch((err) => {
  console.error('\nIslem basarisiz:', err.message);
  process.exit(1);
});
