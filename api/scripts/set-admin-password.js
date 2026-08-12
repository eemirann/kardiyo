/**
 * Yonetici sifresini degistirir (ve istenirse bir kullaniciyi yonetici yapar).
 *
 *   npm run set-admin-password                    -> .env'deki ADMIN_EMAIL hesabi
 *   npm run set-admin-password -- kisi@ornek.com  -> belirtilen hesap
 *   npm run set-admin-password -- kisi@ornek.com --promote  -> hesabi yonetici de yapar
 *
 * Sifre ekranda gorunmez ve hicbir yere yazilmaz; sadece bcrypt ozeti veritabanina
 * gider. Sifre degisince o kullanicinin acik oturumlari (refresh token) iptal edilir.
 */
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

/** Terminalde yazilani gostermeden okur. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const onData = (char) => {
      // Yazilan karakterleri ekrana basma; sadece soruyu goster
      if ([`\n`, `\r`, ``].includes(char.toString())) {
        process.stdin.removeListener('data', onData);
        return;
      }
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(question);
    };
    process.stdin.on('data', onData);
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function run() {
  const args = process.argv.slice(2);
  const promote = args.includes('--promote');
  const email = (args.find((a) => !a.startsWith('--')) || process.env.ADMIN_EMAIL || '').trim();

  if (!email) {
    console.error('Hesap adresi verilmedi ve .env icinde ADMIN_EMAIL yok.');
    process.exit(1);
  }

  const { rows } = await pool.query('SELECT id, email, role FROM users WHERE lower(email) = lower($1)', [
    email,
  ]);
  const user = rows[0];
  if (!user) {
    console.error(`Kullanici bulunamadi: ${email}`);
    process.exit(1);
  }

  console.log(`Hesap: ${user.email} (rol: ${user.role})`);
  if (user.role !== 'admin' && !promote) {
    console.error('Bu hesap yonetici degil. Yonetici yapmak icin --promote ekleyin.');
    process.exit(1);
  }

  const pw = await askHidden('Yeni sifre (en az 8 karakter): ');
  if (pw.length < 8 || pw.length > 72) {
    console.error('Sifre 8-72 karakter olmali.');
    process.exit(1);
  }
  const pw2 = await askHidden('Yeni sifre (tekrar): ');
  if (pw !== pw2) {
    console.error('Sifreler eslesmiyor.');
    process.exit(1);
  }
  if (pw === 'Admin1234!') {
    console.error('Bu, belgelerdeki varsayilan sifre. Baska bir sifre secin.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(pw, 12);
  await pool.query(
    promote
      ? "UPDATE users SET password_hash = $2, role = 'admin' WHERE id = $1"
      : 'UPDATE users SET password_hash = $2 WHERE id = $1',
    [user.id, hash]
  );
  // Sifre degisti: eski oturumlar gecersiz olsun
  const { rowCount } = await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [user.id]);

  console.log(`\nSifre guncellendi.${promote ? ' Hesap yonetici yapildi.' : ''}`);
  console.log(`${rowCount} acik oturum kapatildi.`);
  console.log('Not: .env icindeki ADMIN_PASSWORD artik gecerli degil, guncelleyin ya da silin.');
  await pool.end();
}

run().catch((err) => {
  console.error('Islem basarisiz:', err.message);
  process.exit(1);
});
