-- Denemeler icin alt kategori ve siralama
--
-- 20 deneme tek bir listede karisik goruntuleniyordu; artik seriler ("Kardiyovaskuler
-- Klinik Farmakoloji", "Kardiyoloji Karma Denemeler") kendi basligi altinda ve
-- deneme numarasi sirasiyla listeleniyor.

ALTER TABLE exams ADD COLUMN IF NOT EXISTS category   TEXT;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_exams_order ON exams (sort_order, id);
