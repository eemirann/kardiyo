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
const {
  issueVerificationToken,
  consumeVerificationToken,
  findUnverifiedUser,
} = require('../services/emailVerification');
const { sendVerificationEmail } = require('../services/mailer');

const router = express.Router();

// Kaba kuvvet denemelerine karsi giris/kayit siniri
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Cok fazla deneme yaptiniz. Lutfen 15 dakika sonra tekrar deneyin.' },
});

// Yeniden gonderme daha dar: her istek bir e-posta demek, spam sikayeti riski var
const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Cok fazla istek. Lutfen 15 dakika sonra tekrar deneyin.' },
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

const verifySchema = z.object({
  token: z.string().min(16, 'Gecersiz dogrulama bagi.').max(200).trim(),
});

const resendSchema = z.object({
  email: z.string().email('Gecerli bir e-posta adresi girin.').toLowerCase().trim(),
});

/** Arayuzun kok adresi; dogrulama baglantisi buraya isaret eder. */
function appUrl() {
  const configured = process.env.APP_URL || (process.env.CORS_ORIGINS || '').split(',')[0];
  return (configured || 'http://localhost:5173').trim().replace(/\/$/, '');
}

/** Dogrulama token'i uretip e-postayi gonderir. */
async function sendVerification(user) {
  const { token } = await issueVerificationToken(user.id);
  await sendVerificationEmail({
    to: user.email,
    fullName: user.full_name,
    link: `${appUrl()}/eposta-dogrula?token=${token}`,
  });
}

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
    emailVerified: Boolean(u.email_verified_at),
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

    // Oturum acilmaz: hesap, e-postadaki bag tiklanana kadar giris yapamaz.
    await sendVerification(rows[0]);
    res.status(201).json({ pendingVerification: true, email });
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
    if (!user.email_verified_at) {
      throw forbidden(
        'E-posta adresinizi dogrulamadan giris yapamazsiniz. Kutunuzu kontrol edin.',
        'EMAIL_NOT_VERIFIED'
      );
    }

    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
    res.json(await respondWithSession(res, user));
  })
);

/**
 * E-postadaki bagin ucu. Dogrulamayi yapip HEMEN oturum acar: kullanici linke
 * tikladiginda tekrar giris ekranina dusmeden icerige giriyor.
 */
router.post(
  '/verify-email',
  authLimiter,
  validate(verifySchema),
  asyncHandler(async (req, res) => {
    const user = await consumeVerificationToken(req.body.token);
    if (!user) throw badRequest('Dogrulama bagi gecersiz veya suresi dolmus.', 'INVALID_TOKEN');
    if (user.is_blocked) throw forbidden('Hesabiniz engellenmis.');

    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
    res.json(await respondWithSession(res, user));
  })
);

/**
 * Dogrulama e-postasini yeniden gonderir.
 * Adres kayitli olmasa da, hesap zaten dogrulanmis olsa da ayni yanit doner:
 * aksi halde bu uc "bu e-posta sistemde var mi" sorusunun cevabina donusurdu.
 */
router.post(
  '/resend-verification',
  resendLimiter,
  validate(resendSchema),
  asyncHandler(async (req, res) => {
    const user = await findUnverifiedUser(req.body.email);
    if (user) await sendVerification(user);
    res.json({ ok: true });
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
