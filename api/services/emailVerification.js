/**
 * E-posta dogrulama token'lari.
 *
 * Desen refresh token'larla ayni (bkz. services/tokens.js): rastgele ham deger
 * uretilir, veritabaninda yalnizca SHA-256 ozeti tutulur. Ham deger sadece
 * e-postadaki baglantida gecer.
 */
const crypto = require('crypto');
const { query, withTransaction } = require('../config/db');
const { PUBLIC_USER_FIELDS } = require('../middleware/auth');

const TTL_HOURS = 24;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Yeni dogrulama token'i uretir ve ham degeri doner.
 * Ayni kullanicinin kullanilmamis eski token'lari iptal edilir; boylece "yeniden
 * gonder" dendiginde eski baglanti calismaz ve her zaman tek gecerli bag olur.
 */
async function issueVerificationToken(userId) {
  const raw = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE email_verification_tokens SET used_at = now()
        WHERE user_id = $1 AND used_at IS NULL`,
      [userId]
    );
    await client.query(
      'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, hashToken(raw), expiresAt]
    );
  });

  return { token: raw, expiresAt };
}

/**
 * Token'i harcar ve kullaniciyi dogrulanmis isaretler.
 * Token gecersiz/suresi dolmus/kullanilmissa null doner.
 *
 * Isaretleme ve harcama tek transaction'da: ayni baglantiya iki kez tiklanirsa
 * ikinci istek UPDATE'ten satir alamaz ve null doner.
 * @returns {Promise<object|null>} dogrulanmis kullanici satiri
 */
async function consumeVerificationToken(raw) {
  if (!raw) return null;

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE email_verification_tokens SET used_at = now()
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
        RETURNING user_id`,
      [hashToken(raw)]
    );
    const record = rows[0];
    if (!record) return null;

    const { rows: users } = await client.query(
      `UPDATE users SET email_verified_at = COALESCE(email_verified_at, now())
        WHERE id = $1 RETURNING ${PUBLIC_USER_FIELDS}`,
      [record.user_id]
    );
    return users[0] || null;
  });
}

/** Kullanici dogrulanmayi bekliyor mu (yeniden gonder ucu icin). */
async function findUnverifiedUser(email) {
  const { rows } = await query(
    `SELECT ${PUBLIC_USER_FIELDS} FROM users
      WHERE email = $1 AND email_verified_at IS NULL AND NOT is_blocked`,
    [email]
  );
  return rows[0] || null;
}

module.exports = {
  issueVerificationToken,
  consumeVerificationToken,
  findUnverifiedUser,
  TTL_HOURS,
};
