require('dotenv').config();

const requiredEnv = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const missing = requiredEnv.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Eksik ortam degiskenleri: ${missing.join(', ')} (.env dosyasini kontrol edin)`);
  process.exit(1);
}

const app = require('./app');
const { pool } = require('./config/db');

const port = Number(process.env.PORT || 4000);

/**
 * Migration'lar acilista calisir: Render'in ucretsiz planinda pre-deploy komutu
 * ve Shell yok, build asamasinda calistirmak da veritabanini derlemeye baglar.
 * Idempotent (schema_migrations tablosu tutuluyor). MIGRATE_ON_BOOT=false ile kapatilir.
 */
async function start() {
  if (process.env.MIGRATE_ON_BOOT !== 'false') {
    try {
      await require('./scripts/migrate').run({ closePool: false });
    } catch (err) {
      console.error('Migration basarisiz, sunucu baslatilmiyor:', err.message);
      process.exit(1);
    }
  }

  const server = app.listen(port, () => {
    console.log(`10 Adımda Kardiyoloji API ${port} portunda calisiyor`);
  });

  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      console.log(`${signal} alindi, kapatiliyor...`);
      server.close(() => pool.end().then(() => process.exit(0)));
    });
  }
}

start();
