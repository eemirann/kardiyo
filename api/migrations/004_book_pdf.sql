-- Konu anlatimi PDF olarak da sunulabilsin.
--
-- Bir kitabin pdf_url'i doluysa arayuz bolum listesi yerine PDF okuyucusunu gosterir.
-- Dosyalar web/public/kilavuzlar/ altinda duruyor ve Vercel tarafindan sunuluyor.

ALTER TABLE books ADD COLUMN IF NOT EXISTS pdf_url TEXT;
