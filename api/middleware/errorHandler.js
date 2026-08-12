const { AppError } = require('../utils/http');

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Endpoint bulunamadi.', path: req.originalUrl });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  // Postgres unique ihlali
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Bu kayit zaten mevcut.', code: 'DUPLICATE' });
  }
  console.error('Sunucu hatasi:', err);
  res.status(500).json({ error: 'Sunucu hatasi olustu.' });
}

module.exports = { notFoundHandler, errorHandler };
