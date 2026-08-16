/** Ortak HTTP yardimcilari: uygulama hatasi, async sarmalayici, zod dogrulama. */

class AppError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || null;
  }
}

const badRequest = (msg, code) => new AppError(400, msg, code);
const unauthorized = (msg = 'Giris yapmalisiniz.') => new AppError(401, msg);
const forbidden = (msg = 'Bu islem icin yetkiniz yok.', code) => new AppError(403, msg, code);
const notFound = (msg = 'Kayit bulunamadi.') => new AppError(404, msg);
const premiumRequired = (msg = 'Bu icerik premium uyelere ozeldir.') =>
  new AppError(403, msg, 'PREMIUM_REQUIRED');

/** Async route handler'lardaki hatalari express error middleware'ine tasir. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Zod semasi ile req[source] dogrular; hata olursa 400 doner. */
function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const first = result.error.issues[0];
      return next(badRequest(`${first.path.join('.') || 'deger'}: ${first.message}`, 'VALIDATION'));
    }
    req[source] = result.data;
    next();
  };
}

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  premiumRequired,
  asyncHandler,
  validate,
};
