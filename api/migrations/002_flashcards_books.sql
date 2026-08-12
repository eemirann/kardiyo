-- Flashcard (aralikli tekrar) ve e-kitap modulleri

-- ---------------------------------------------------------------- Flashcard

CREATE TABLE IF NOT EXISTS flashcard_decks (
  id          SERIAL PRIMARY KEY,
  topic_id    INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  icon        TEXT DEFAULT 'style',
  is_premium  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flashcards (
  id         SERIAL PRIMARY KEY,
  deck_id    INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
  front      TEXT NOT NULL,
  back       TEXT NOT NULL,
  hint       TEXT,
  kind       TEXT,   -- "Kritik hata", "Ticari ad", "Sinav vurgusu" gibi etiket
  reference  TEXT,   -- kaynak bolum
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flashcards_deck ON flashcards (deck_id, is_active);

-- SM-2 aralikli tekrar durumu (kullanici x kart)
CREATE TABLE IF NOT EXISTS flashcard_reviews (
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id          INTEGER NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  ease_factor      NUMERIC(4,2) NOT NULL DEFAULT 2.50,
  interval_days    INTEGER NOT NULL DEFAULT 0,
  repetitions      INTEGER NOT NULL DEFAULT 0,
  lapses           INTEGER NOT NULL DEFAULT 0,
  total_reviews    INTEGER NOT NULL DEFAULT 0,
  last_grade       SMALLINT,
  last_reviewed_at TIMESTAMPTZ,
  due_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_due ON flashcard_reviews (user_id, due_at);

-- ---------------------------------------------------------------- E-kitap

CREATE TABLE IF NOT EXISTS books (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  subtitle    TEXT,
  description TEXT,
  cover_url   TEXT,
  is_premium  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS book_chapters (
  id         SERIAL PRIMARY KEY,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  number     TEXT NOT NULL,
  title      TEXT NOT NULL,
  subtitle   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_chapters_book ON book_chapters (book_id, sort_order);

CREATE TABLE IF NOT EXISTS book_sections (
  id          SERIAL PRIMARY KEY,
  chapter_id  INTEGER NOT NULL REFERENCES book_chapters(id) ON DELETE CASCADE,
  topic_id    INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  number      TEXT NOT NULL,
  slug        TEXT NOT NULL,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',  -- sanitize edilmis HTML
  is_premium  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (chapter_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_sections_chapter ON book_sections (chapter_id, sort_order);

CREATE TABLE IF NOT EXISTS book_progress (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL REFERENCES book_sections(id) ON DELETE CASCADE,
  completed  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, section_id)
);

-- ---------------------------------------------------------------- Rozet kurallari

-- Yeni kural turleri: kart tekrari ve okunan bolum
ALTER TABLE badges DROP CONSTRAINT IF EXISTS badges_rule_type_check;
ALTER TABLE badges ADD CONSTRAINT badges_rule_type_check CHECK (rule_type IN (
  'questions_solved', 'topic_mastery', 'accuracy', 'points_total',
  'exams_completed', 'videos_completed', 'cards_reviewed', 'sections_read'
));

-- ---------------------------------------------------------------- Reklam alanlari

INSERT INTO ad_slots (code, name, provider) VALUES
  ('flashcard_side', 'Flashcard Yan Alan', 'custom'),
  ('book_bottom', 'Kitap Sayfası Altı', 'custom'),
  ('calculator_bottom', 'Hesaplayıcı Altı', 'custom')
ON CONFLICT (code) DO NOTHING;
