const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { query } = require('../config/db');
const { asyncHandler, validate, badRequest, unauthorized, forbidden } = require('../utils/http');
const { requireAuth, PUBLIC_USER_FIELDS } = require('../middleware/auth');
const {
  signAccessToken,
  issueRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken,
  refreshCookieOptions,
  REFRESH_COOKIE,
} = require('../services/tokens');

const router = express.Router();

// Kaba kuvvet denemelerine karsi giris/kayit siniri
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Cok fazla deneme yaptiniz. Lutfen 15 dakika sonra tekrar deneyin.' },
});

const registerSchema = z.object({
  email: z.string().email('Gecerli bir e-posta adresi girin.').toLowerCase().trim(),
  password: z.string().min(8, 'Sifre en az 8 karakter olmali.').max(72),
  fullName: z.string().min(2, 'Ad soyad en az 2 karakter olmali.').max(120).trim(),
});

const loginSchema = z.object({
  email: z.string().email('Gecerli bir e-posta adresi girin.').toLowerCase().trim(),
  password: z.string().min(1, 'Sifre gerekli.'),
});

/** Access token + refresh cookie'yi birlikte doner. */
async function respondWithSession(res, user) {
  const { token, } = await issueRefreshToken(user.id);
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
  return {
    accessToken: signAccessToken(user),
    user: publicUser(user),
  };
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role,
    isPremium: u.is_premium,
    premiumUntil: u.premium_until,
    avatarUrl: u.avatar_url,
    totalPoints: u.total_points,
    createdAt: u.created_at,
  };
}

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, fullName } = req.body;

    const exists = await query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.rowCount) throw badRequest('Bu e-posta adresi zaten kayitli.', 'EMAIL_TAKEN');

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3) RETURNING ${PUBLIC_USER_FIELDS}`,
      [email, passwordHash, fullName]
    );

    res.status(201).json(await respondWithSession(res, rows[0]));
  })
);

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];

    // Kullanici yoksa da bcrypt calistirip zamanlama farkini kapatiyoruz
    const ok = await bcrypt.compare(password, user ? user.password_hash : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    if (!user || !ok) throw unauthorized('E-posta veya sifre hatali.');
    if (user.is_blocked) throw forbidden('Hesabiniz engellenmis.');

    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
    res.json(await respondWithSession(res, user));
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const raw = req.cookies[REFRESH_COOKIE];
    if (!raw) throw unauthorized('Oturum bulunamadi.');

    const record = await findValidRefreshToken(raw);
    if (!record) throw unauthorized('Oturum suresi dolmus, tekrar giris yapin.');

    const { rows } = await query(`SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE id = $1`, [
      record.user_id,
    ]);
    const user = rows[0];
    if (!user || user.is_blocked) throw unauthorized('Oturum gecersiz.');

    // Token rotasyonu: eskisini iptal et, yenisini ver
    await revokeRefreshToken(raw);
    res.json(await respondWithSession(res, user));
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const raw = req.cookies[REFRESH_COOKIE];
    if (raw) await revokeRefreshToken(raw);
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
    res.json({ ok: true });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user) });
  })
);

module.exports = router;
module.exports.publicUser = publicUser;
