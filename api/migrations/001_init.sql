-- KardiyoAkademi - ilk sema

CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_premium      BOOLEAN NOT NULL DEFAULT FALSE,
  premium_until   TIMESTAMPTZ,
  is_blocked      BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_url      TEXT,
  total_points    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_points ON users (total_points DESC);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens (user_id);

CREATE TABLE IF NOT EXISTS topics (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  icon        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
  id          SERIAL PRIMARY KEY,
  topic_id    INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'classic' CHECK (type IN ('case', 'classic')),
  difficulty  TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  body        TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  is_premium  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions (topic_id, is_active);

CREATE TABLE IF NOT EXISTS question_options (
  id          SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  text        TEXT NOT NULL,
  is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_options_question ON question_options (question_id);

CREATE TABLE IF NOT EXISTS exams (
  id               SERIAL PRIMARY KEY,
  title            TEXT NOT NULL,
  description      TEXT,
  topic_id         INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  is_premium       BOOLEAN NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_questions (
  exam_id     INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (exam_id, question_id)
);

CREATE TABLE IF NOT EXISTS exam_sessions (
  id            SERIAL PRIMARY KEY,
  exam_id       INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  finished_at   TIMESTAMPTZ,
  score         INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count   INTEGER NOT NULL DEFAULT 0,
  blank_count   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON exam_sessions (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS attempts (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id        INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option_id INTEGER REFERENCES question_options(id) ON DELETE SET NULL,
  is_correct         BOOLEAN NOT NULL,
  points_awarded     INTEGER NOT NULL DEFAULT 0,
  duration_ms        INTEGER,
  exam_session_id    INTEGER REFERENCES exam_sessions(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attempts_user_time ON attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_question ON attempts (question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_session ON attempts (exam_session_id);
-- Bir sinav oturumunda ayni soru en fazla bir kez cevaplanabilir (cevap degistirme UPDATE ile yapilir)
CREATE UNIQUE INDEX IF NOT EXISTS uq_attempts_session_question
  ON attempts (exam_session_id, question_id) WHERE exam_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS videos (
  id               SERIAL PRIMARY KEY,
  topic_id         INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  source           TEXT NOT NULL CHECK (source IN ('youtube', 'vimeo', 'upload')),
  url              TEXT,
  storage_key      TEXT,
  duration_seconds INTEGER,
  thumbnail_url    TEXT,
  is_premium       BOOLEAN NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_videos_topic ON videos (topic_id, is_active);

CREATE TABLE IF NOT EXISTS video_progress (
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id        INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  completed       BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

CREATE TABLE IF NOT EXISTS badges (
  id          SERIAL PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT 'military_tech',
  rule_type   TEXT NOT NULL CHECK (rule_type IN
                ('questions_solved', 'topic_mastery', 'accuracy', 'points_total',
                 'exams_completed', 'videos_completed')),
  rule_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id  INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS ad_slots (
  id              SERIAL PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  provider        TEXT NOT NULL DEFAULT 'custom' CHECK (provider IN ('adsense', 'custom')),
  adsense_snippet TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS ads (
  id         SERIAL PRIMARY KEY,
  slot_id    INTEGER NOT NULL REFERENCES ad_slots(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  image_url  TEXT NOT NULL,
  target_url TEXT NOT NULL,
  starts_at  TIMESTAMPTZ,
  ends_at    TIMESTAMPTZ,
  weight     INTEGER NOT NULL DEFAULT 1 CHECK (weight > 0),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ads_slot ON ads (slot_id, is_active);

CREATE TABLE IF NOT EXISTS ad_events (
  id         SERIAL PRIMARY KEY,
  ad_id      INTEGER NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('impression', 'click')),
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_events_ad ON ad_events (ad_id, type);
