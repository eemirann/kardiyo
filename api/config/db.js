const { Pool } = require('pg');

const useSsl =
  String(process.env.DATABASE_SSL).toLowerCase() === 'true' ||
  /sslmode=require/i.test(process.env.DATABASE_URL || '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Beklenmeyen veritabani hatasi:', err);
});

/** Tek seferlik sorgu. */
function query(text, params) {
  return pool.query(text, params);
}

/**
 * Verilen fonksiyonu tek bir transaction icinde calistirir.
 * Hata olursa ROLLBACK yapar ve hatayi yeniden firlatir.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
