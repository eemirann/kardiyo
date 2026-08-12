/**
 * Idempotent migration runner.
 * migrations/ klasorundeki .sql dosyalarini alfabetik sirayla calistirir,
 * calistirilanlari schema_migrations tablosuna yazar ve bir daha calistirmaz.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

/**
 * @param {{closePool?: boolean}} opts  Sunucu acilisinda cagrilirken havuz kapatilmamali.
 */
async function run({ closePool = true } = {}) {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      process.stdout.write(`-> ${file} calistiriliyor... `);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log('tamam');
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.log('HATA');
        throw err;
      }
    }
    console.log(count === 0 ? 'Veritabani zaten guncel.' : `${count} migration uygulandi.`);
  } finally {
    client.release();
    if (closePool) await pool.end();
  }
}

module.exports = { run };

if (require.main === module) {
  run().catch((err) => {
    // Baglanti hic kurulamadiginda Node bos mesajli AggregateError firlatiyor;
    // sebebi gorunsun diye kodu ve alt hatalari da yazdiriyoruz.
    const detail =
      [err.code, err.message].filter(Boolean).join(' ') ||
      (err.errors || []).map((e) => `${e.code || ''} ${e.message || ''}`.trim()).join(' | ') ||
      String(err);
    console.error(`Migration basarisiz: ${detail}`);
    if (!process.env.DATABASE_URL)
      console.error('DATABASE_URL tanimli degil — ortam degiskenlerini kontrol edin.');
    process.exit(1);
  });
}
