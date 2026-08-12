/**
 * Test yardimcilari.
 * Testler GERCEK bir Postgres veritabanina baglanir (TEST_DATABASE_URL veya DATABASE_URL).
 * Her calistirmada tablolar temizlenip taze veri kurulur; bu yuzden URL'in
 * uretim veritabanina isaret ETMEDIGINDEN emin olun.
 */
require('dotenv').config();

if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../app');
const { pool, query } = require('../config/db');

/** Tum veri tablolarini bosaltir (sema korunur). */
async function resetDatabase() {
  await query(`
    TRUNCATE ad_events, ads, ad_slots, user_badges, badges, video_progress, videos,
             attempts, exam_sessions, exam_questions, exams, question_options, questions,
             topics, refresh_tokens, users
    RESTART IDENTITY CASCADE
  `);
}

async function createUser({ email, password = 'Sifre1234', role = 'user', isPremium = false }) {
  const hash = await bcrypt.hash(password, 4);
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, full_name, role, is_premium)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [email, hash, `Test ${email}`, role, isPremium]
  );
  return rows[0];
}

/** Giris yapip access token dondurur. */
async function loginAs(email, password = 'Sifre1234') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Giris basarisiz: ${res.status} ${res.text}`);
  return res.body.accessToken;
}

async function createTopic(name = 'EKG Analizi', slug = 'ekg-analizi') {
  const { rows } = await query(
    'INSERT INTO topics (name, slug) VALUES ($1, $2) RETURNING *',
    [name, slug]
  );
  return rows[0];
}

/**
 * Soru + siklar olusturur. Dogru sik varsayilan olarak "B".
 * @returns {Promise<{question, options, correctOption}>}
 */
async function createQuestion({
  topicId,
  difficulty = 'medium',
  isPremium = false,
  body = '<p>Test sorusu</p>',
  explanation = '<p>Test cozumu</p>',
} = {}) {
  const { rows } = await query(
    `INSERT INTO questions (topic_id, difficulty, body, explanation, is_premium)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [topicId, difficulty, body, explanation, isPremium]
  );
  const question = rows[0];

  const options = [];
  for (const [i, [label, isCorrect]] of [['A', false], ['B', true], ['C', false]].entries()) {
    const { rows: o } = await query(
      `INSERT INTO question_options (question_id, label, text, is_correct, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [question.id, label, `${label} secenegi`, isCorrect, i]
    );
    options.push(o[0]);
  }
  return { question, options, correctOption: options.find((o) => o.is_correct) };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = {
  app,
  request,
  pool,
  query,
  resetDatabase,
  createUser,
  loginAs,
  createTopic,
  createQuestion,
  auth,
};
