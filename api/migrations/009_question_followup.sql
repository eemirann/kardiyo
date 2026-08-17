-- Iki asamali sorular: "once tani, sonra tedavi"
--
-- EKG Quiz'de her kayit iki soru soruyor: once "hangi tani?", tani verildikten
-- sonra "bu hastada ne yapilmali?". Ikinci soru birincinin cevabini ele verir
-- ("Doğru tanı 'İnferior MI' olarak belirlenmiştir. Bu hastada ...") — bu yuzden
-- listede yan yana duramaz, yalnizca birinci soru cevaplandiktan SONRA acilir.
--
-- Cozum: ikinci soru normal bir soru satiri olarak durur ama parent_question_id
-- ile birinciye baglanir. Boylece cevaplama, puanlama ve rozetler mevcut
-- /questions/:id/answer ucundan degismeden calisir.
--
-- Devam sorulari listelerde ve sayimlarda TEK BASINA GORUNMEZ (bkz.
-- routes/questions.js ve routes/topics.js): aksi halde soru bankasinda cevabi
-- ele veren govdesiyle tek basina cikar, EKG sayfasinda da vaka sayisi ikiye
-- katlanirdi. Yalnizca birinci sorunun cevabiyla birlikte donerler.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS parent_question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_questions_parent ON questions (parent_question_id);
