-- Dogrudan video baglantisi ('file') kaynak turu
--
-- Dosya yukleme (Cloudflare R2) yapilandirilmadiginda yonetici yalnizca YouTube/Vimeo
-- ekleyebiliyordu. 'file' turu, kendi barindirdiginiz mp4/webm adresini eklemeyi saglar;
-- oynatici bu videoyu tarayicinin yerlesik <video> oynaticisiyla gosterir.

ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_source_check;
ALTER TABLE videos ADD CONSTRAINT videos_source_check
  CHECK (source IN ('youtube', 'vimeo', 'file', 'upload'));
