# Yayına alma (Render + Vercel, ücretsiz)

Mimari: **Neon** (veritabanı, zaten kurulu ve dolu) → **Render** (API) → **Vercel** (arayüz).

Sıra önemli: önce API'yi yayına al, adresini öğren, sonra arayüzü o adresle kur.

## Canlı adresler

| Katman | Adres |
|---|---|
| Site | https://kardiyo-eta.vercel.app |
| API | https://kardiyo-api.onrender.com (`/health` ile kontrol edilir) |
| Veritabanı | Neon — `ep-red-darkness-…eu-central-1.aws.neon.tech/neondb` |

Render servis kimliği: `srv-d9u8n6ijobas73ejmtig` · Vercel projesi: `erb-as/kardiyo`

Aşağıdaki 1-3. adımlar tamamlandı; belge yeniden kurulum ve sorun giderme için duruyor.

---

## 0. Başlamadan önce

Elinde şunlar olacak:

- GitHub hesabı (depo: `eemirann/kardiyo`)
- Neon bağlantı adresi — `api/.env` dosyandaki `DATABASE_URL` satırının değeri.
  Bu adresi bir yere kopyala, Render'a gireceksin.

Veritabanı hazır: 10 konu, 408 soru, 22 deneme, e-kitap, flashcard desteleri ve yönetici
hesabı zaten içinde. Render'da `seed` çalıştırmana **gerek yok**.

---

## 1. Render — API

1. [render.com](https://render.com) → GitHub ile giriş yap.
2. **New → Blueprint** de.
3. `eemirann/kardiyo` deposunu seç. Render kökteki `render.yaml` dosyasını okuyup
   `kardiyo-api` servisini önerecek.
4. Sorulan ortam değişkenlerini doldur:

   | Değişken | Değer |
   |---|---|
   | `DATABASE_URL` | Neon adresin (`postgresql://…?sslmode=require`) |
   | `CORS_ORIGINS` | Şimdilik `http://localhost:5173` yaz — 3. adımda güncelleyeceğiz |
   | `ADMIN_EMAIL` | `admin@10adimdakardiyoloji.com` (seed çalıştırmayacağın için sadece formalite) |
   | `ADMIN_PASSWORD` | Herhangi bir değer |
   | `R2_*` (5 adet) | Boş bırak — dosya yükleme kapalı kalır, video linki çalışmaya devam eder |

   `JWT_ACCESS_SECRET` ve `JWT_REFRESH_SECRET` otomatik üretilir, sen girmeyeceksin.

5. **Apply** de. İlk kurulum 3-5 dakika sürer. Build sırasında migration çalışır
   (zaten uygulanmış olanları atlar).
6. Servis yeşile döndüğünde adresini kopyala: `https://kardiyo-api.onrender.com` gibi.
7. Kontrol et: tarayıcıda `https://<API-ADRESİN>/health` aç. Şunu görmelisin:
   `{"ok":true,"db":true,"time":"…"}`

> **Ücretsiz plan uyarısı:** servis 15 dakika istek almazsa uykuya dalar; sonraki ilk
> istek ~50 saniye sürer. Kullanıcıların "site açılmıyor" demesini istemiyorsan aylık
> 7 $'lık Starter plana geçmek yeterli.

---

## 2. Vercel — arayüz

1. [vercel.com](https://vercel.com) → GitHub ile giriş yap.
2. **Add New → Project** → `eemirann/kardiyo` deposunu içe aktar.
3. Ayarlar:
   - **Root Directory:** `web`  ← *bunu değiştirmeyi unutma, varsayılan kök gelir*
   - **Framework Preset:** Vite (otomatik gelir)
   - Build ve output ayarlarına dokunma.
4. **Environment Variables** bölümüne ekle:

   | Ad | Değer |
   |---|---|
   | `VITE_API_URL` | 1. adımda kopyaladığın Render adresi (sonunda `/` olmadan) |

   Bu değişken derleme sırasında gömülür; sonradan değiştirirsen **yeniden deploy**
   etmen gerekir.
5. **Deploy** de. Biten adresi kopyala: `https://kardiyo.vercel.app` gibi.

---

## 3. İkisini birbirine tanıt (CORS)

API, tanımadığı bir adresten gelen isteği reddeder. Render'a dön:

1. `kardiyo-api` → **Environment** → `CORS_ORIGINS` değerini Vercel adresinle değiştir:

   ```
   https://kardiyo.vercel.app
   ```

   Birden fazla adres virgülle ayrılır, aralarında boşluk olmasın.
2. **Save changes** → servis otomatik yeniden başlar.

Vercel her dal ve her önizleme için ayrı adres üretir (`kardiyo-git-…vercel.app`).
Bunlarda giriş yapmak istersen o adresleri de `CORS_ORIGINS`'e eklemen gerekir.

---

## 4. Kontrol listesi

Vercel adresini aç ve sırayla dene:

- [ ] Ana sayfa açılıyor, konu başlıkları ve sıralama tablosu doluyor (API bağlantısı çalışıyor)
- [ ] Kayıt ol / giriş yap çalışıyor — sayfayı yenilediğinde oturum açık kalıyor
      (kalmıyorsa: çerez sorunu, bkz. aşağıdaki not)
- [ ] Bir soru çöz, puanın artıyor
- [ ] `/sinavlar` sayfasında 22 deneme görünüyor, biri başlatılıp bitirilebiliyor
- [ ] `/kartlar`, `/kitaplar`, `/hesaplayicilar` açılıyor
- [ ] Yönetici hesabıyla `/admin` açılıyor

> **Oturum kalıcı değilse:** yenileme çerezi `SameSite=None; Secure` ile gönderiliyor,
> bu yalnızca HTTPS'te çalışır. Her iki adres de `https://` olmalı ve Render'daki
> `NODE_ENV` mutlaka `production` olmalı (blueprint bunu zaten ayarlıyor).

---

## 5. Sonrasında

**Alan adı eklerken** (`10adimdakardiyoloji.com`):

1. Vercel → Project → Settings → Domains → alan adını ekle, gösterilen A/CNAME
   kayıtlarını alan adı paneline gir.
2. Render → Settings → Custom Domain → `api.10adimdakardiyoloji.com` ekle, verilen
   CNAME'i gir.
3. Vercel'de `VITE_API_URL`'i `https://api.10adimdakardiyoloji.com` yap ve **yeniden
   deploy et**.
4. Render'da `CORS_ORIGINS`'e yeni adresleri ekle:
   `https://10adimdakardiyoloji.com,https://www.10adimdakardiyoloji.com`

**Yönetici şifresi:** Neon'daki hesap seed varsayılanıyla oluşturuldu. Yayına aldıktan
sonra `/profil` sayfasından şifreni değiştir.

**İçerik güncelleme:** yeni soru/deneme eklemek için kendi bilgisayarından
`cd api && npm run import-exams` yeterli — aynı Neon veritabanına yazar, Render'a
dokunmaya gerek yok.

**Kod güncelleme:** `main` dalına her push'ta Vercel ve Render otomatik yeniden deploy eder.
