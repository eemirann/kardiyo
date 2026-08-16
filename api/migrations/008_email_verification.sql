-- E-posta dogrulama
--
-- Kayit olan kullanici artik dogrudan oturum acmiyor: adresine tek kullanimlik
-- bir bag gonderiliyor ve dogrulanana kadar giris yapamiyor. Amac sahte/yanlis
-- adreslerle hesap acilmasini engellemek ve ileride sifre sifirlama gibi
-- akislar icin gereken temeli kurmak.
--
-- Token'lar refresh_tokens ile ayni deseni izler: veritabaninda yalnizca
-- SHA-256 ozeti durur, ham deger sadece e-postadaki baglantida bulunur.
-- Boylece veritabanini okuyan biri baskasinin hesabini dogrulayamaz.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Bu migration'dan onceki hesaplar dogrulanmis sayilir; aksi halde mevcut
-- kullanicilarin tamami bir anda disarida kalirdi. Zorunluluk yalnizca yeni
-- kayitlara isler.
UPDATE users SET email_verified_at = now() WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_verif_user ON email_verification_tokens (user_id);
