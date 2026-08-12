const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Render/Vercel gibi proxy arkasinda dogru IP ve secure cookie icin
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // Ayni origin istekleri ve curl/Postman (origin yok) serbest
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: ${origin} izinli degil`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Genel istek siniri (auth uclarinda ayrica daha sikisi var)
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 100000 : 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', async (_req, res) => {
  try {
    await require('./config/db').query('SELECT 1');
    res.json({ ok: true, db: true, time: new Date().toISOString() });
  } catch {
    res.status(503).json({ ok: false, db: false });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/topics', require('./routes/topics'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/exams', require('./routes/exams'));
app.use('/api/videos', require('./routes/videos'));
app.use('/api/flashcards', require('./routes/flashcards'));
app.use('/api/books', require('./routes/books'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/me', require('./routes/me'));
app.use('/api/ads', require('./routes/ads'));
app.use('/api/admin', require('./routes/admin'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
