const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, isPremium: user.is_premium },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Rastgele refresh token uretir, hash'ini DB'ye yazar ve ham token'i doner. */
async function issueRefreshToken(userId) {
  const raw = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, hashToken(raw), expiresAt]
  );
  return { token: raw, expiresAt };
}

/** Gecerli (suresi dolmamis, iptal edilmemis) refresh token kaydini doner. */
async function findValidRefreshToken(raw) {
  const { rows } = await query(
    `SELECT * FROM refresh_tokens
      WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
    [hashToken(raw)]
  );
  return rows[0] || null;
}

async function revokeRefreshToken(raw) {
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [
    hashToken(raw),
  ]);
}

async function revokeAllForUser(userId) {
  await query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  );
}

const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
  maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
});

module.exports = {
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  refreshCookieOptions,
  REFRESH_COOKIE: 'kardiyo_refresh',
};
