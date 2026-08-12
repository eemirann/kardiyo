-- Sorunun kaynaktaki yeri (hangi set, kacinci soru)
--
-- Ice aktarma sorulari govdelerine gore eslestiriyordu; kaynak setlerde ayni soru
-- yalnizca yas/cinsiyet degistirilerek tekrarlandigi (ve bazilari birebir ayni oldugu)
-- icin 50 soruluk setler veritabaninda 50'ye ulasmiyordu.
--
-- source_key ile her set-soru cifti kendi kaydini alir ("kalp-yetmezligi#24");
-- tekrar ice aktarmada ayni kayit guncellenir, cogaltilmaz.

ALTER TABLE questions ADD COLUMN IF NOT EXISTS source_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_source_key
  ON questions (source_key) WHERE source_key IS NOT NULL;
