-- EKG Quiz: gorselli sorular ve listelenmeyen konular
--
-- EKG bolumunde her soru bir EKG goruntusuyle acilir: ustte gorsel, altinda
-- hastanin gelis hikayesi, sonra "hangi tani" siklari. Gorseli soru govdesine
-- <img> olarak gommek yerine ayri kolonda tutuyoruz; boylece sayfa gorseli
-- kendi duzeninde (genis, tiklaninca tam boy) gosterebiliyor ve yonetici
-- panelinde ayri bir alan olarak yonetilebiliyor.
--
-- image_url site ici mutlak yoldur ("/ekg/inferior-stemi-01.png"); dosyalar
-- web/public/ekg/ altinda durur ve Vercel tarafindan sunulur (bkz. kilavuzlar
-- ve kitap klasorleri). NULL = gorselsiz normal soru, mevcut sorular etkilenmez.

ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_alt TEXT NOT NULL DEFAULT '';

-- Kendi sayfasi olan konular (EKG Quiz gibi) /konular listesinde tekrar
-- gorunmesin diye. is_active'den farki: konu tamamen kapanmaz, yalnizca genel
-- listeden cikar; kendi sayfasi ve yonetici paneli calismaya devam eder.
ALTER TABLE topics ADD COLUMN IF NOT EXISTS is_listed BOOLEAN NOT NULL DEFAULT TRUE;
