const { query } = require('../config/db');
const { verifyAccessToken } = require('../services/tokens');
const { unauthorized, forbidden, asyncHandler } = require('../utils/http');

const PUBLIC_USER_FIELDS =
  'id, email, full_name, role, is_premium, premium_until, is_blocked, avatar_url, total_points, created_at';

/** Authorization: Bearer <token> basligindan kullaniciyi cozer. */
async function loadUser(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  let payload;
  try {
    payload = verifyAccessToken(header.slice(7));
  } catch {
    return null;
  }
  const { rows } = await query(`SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE id = $1`, [
    payload.sub,
  ]);
  return rows[0] || null;
}

/** Zorunlu giris. */
const requireAuth = asyncHandler(async (req, _res, next) => {
  const user = await loadUser(req);
  if (!user) throw unauthorized();
  if (user.is_blocked) throw forbidden('Hesabiniz engellenmis.');
  req.user = user;
  next();
});

/** Girisi zorunlu tutmaz ama varsa req.user'i doldurur (reklam/premium kontrolu icin). */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const user = await loadUser(req);
  if (user && !user.is_blocked) req.user = user;
  next();
});

/** requireAuth'tan SONRA kullanilir. */
function requireAdmin(req, _res, next) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'admin') return next(forbidden());
  next();
}

/** Premium erisimi: premium uye veya admin. premium_until gecmisse premium sayilmaz. */
function hasPremiumAccess(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!user.is_premium) return false;
  if (user.premium_until && new Date(user.premium_until) < new Date()) return false;
  return true;
}

module.exports = { requireAuth, optionalAuth, requireAdmin, hasPremiumAccess, PUBLIC_USER_FIELDS };
