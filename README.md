# 10 Adımda Kardiyoloji

Kardiyoloji eğitim platformu: vaka temelli soru bankası, ayrıntılı çözümler, video dersler,
süreli deneme sınavları, puan/rozet/sıralama sistemi, premium üyelik ve reklam yönetimi.

```
kardiyo/
├─ api/     Node.js + Express + PostgreSQL API
├─ web/     React (Vite) + Tailwind arayüz
└─ docs/    Tasarım sistemi (DESIGN.md) ve ilk mockup
```

## Özellikler

**Kullanıcı**
- E-posta ile kayıt/giriş (JWT access + httpOnly refresh cookie)
- Konu bazlı soru çözme, anında doğru/yanlış geri bildirimi ve ayrıntılı çözüm
- Zorluğa göre puan (kolay 5 / orta 10 / zor 20) — puan yalnızca bir soru **ilk kez** doğru çözüldüğünde verilir
- Otomatik rozetler (kurallar veritabanında, kod değişikliği gerektirmez)
- Sıralama tablosu (tüm zamanlar / bu hafta)
- Süreli deneme sınavı: geri sayım sunucuda, sonunda skor kartı ve yanlış analizi
  (20 deneme × 20 soru: 10 kardiyovasküler farmakoloji + 10 karma kardiyoloji)
- Video dersler (YouTube/Vimeo veya yüklenen dosya), izleme takibi
- Flashcard desteleri (`/kartlar`): aralıklı tekrar (SM-2 benzeri), günlük tekrar kuyruğu,
  klavye kısayolları (boşluk çevirir, 1-4 değerlendirir)
- Konu anlatımı (`/kitaplar`): bölüm/altbölüm hiyerarşisi, okundu işaretleme, kaldığın yerden devam
- Klinik hesaplayıcılar (`/hesaplayicilar`): CHA₂DS₂-VASc, HAS-BLED, HEART, Wells (PE), sPESI,
  BKİ/VYA, ortalama arter basıncı, Cockcroft-Gault — tamamı istemci tarafında, sonuç yorumuyla
- Profil: konu bazlı doğruluk, geçmiş, rozet vitrini, şifre değiştirme

**Yönetici (`/admin`)**
- Soru CRUD + JSON ile toplu içe aktarma
- Konu, deneme sınavı ve video yönetimi (dosya yükleme dahil)
- Flashcard yönetimi (`/admin/kartlar`): deste CRUD, kart CRUD (deste filtresi + arama +
  sayfalama) ve JSON ile toplu kart ekleme
- Konu anlatımı yönetimi (`/admin/kitaplar`): kitap CRUD, bölüm/alt bölüm ağacı ve alt bölüm
  HTML içerik düzenleyici
- Kullanıcı yönetimi: premium ver/al (tarihli), yönetici yap, engelle
- Reklam yönetimi: kendi banner'ların (gösterim/tıklama/CTR raporlu) veya AdSense kodu
- Rozet tanımlama

**Güvenlik**
- Doğru şık ve çözüm, cevap gönderilene kadar API'den dönmez
- Premium kontrolü sunucu tarafında (arayüzde gizlemek yeterli değil)
- `helmet`, CORS beyaz listesi, rate limit (girişte daha sıkı), `zod` doğrulama
- Admin girdisi olan HTML `sanitize-html` ile temizlenir

## Yerel kurulum

### 1. Veritabanı (Neon)

[neon.tech](https://neon.tech) üzerinde ücretsiz bir proje aç ve bağlantı adresini kopyala:

```
postgresql://kullanici:sifre@ep-xxxx.eu-central-1.aws.neon.tech/kardiyo?sslmode=require
```

### 2. API

```bash
cd api
npm install
cp .env.example .env      # DATABASE_URL ve JWT secret'larını doldur
npm run migrate           # tabloları oluşturur
npm run seed              # konular, örnek sorular, rozetler, admin hesabı
npm run import-content    # farmakoloji içeriği: 50 soru, deneme, e-kitap, 75 flashcard
npm run import-exams      # 20 deneme sınavı / 400 soru
npm run dev               # http://localhost:4000
```

Her iki içe aktarma da tekrar çalıştırılabilir: aynı içerik varsa güncellenir, çoğaltılmaz
(eşleştirme sorunun tam gövdesi ve sınavın başlığı üzerinden yapılır). Kaynak dosyalar
`api/data/{questions,guide,cards,exams}.json`; bunlar `tools/pdf-import` altındaki
betiklerle `OKU/` klasöründeki PDF'lerden üretilir:

```bash
cd tools/pdf-import
npm install
npm run all               # questions + guide + cards + exams JSON'larını yeniden üretir
```

`JWT_ACCESS_SECRET` ve `JWT_REFRESH_SECRET` için rastgele değer üret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Seed sonrası admin girişi `.env` içindeki `ADMIN_EMAIL` / `ADMIN_PASSWORD` ile yapılır
(varsayılan `admin@10adimdakardiyoloji.com` / `Admin1234!` — **yayına almadan önce değiştir**).

### 3. Web

```bash
cd web
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:4000
npm run dev               # http://localhost:5173
```

## Testler

Testler gerçek bir Postgres'e bağlanır ve **tabloları boşaltır**. Neon'da ayrı bir test
branch'i/veritabanı oluşturup adresini `TEST_DATABASE_URL` olarak ver:

```bash
cd api
TEST_DATABASE_URL="postgresql://…/kardiyo_test?sslmode=require" npm run migrate
TEST_DATABASE_URL="postgresql://…/kardiyo_test?sslmode=require" npm test
```

Kapsam: kayıt/giriş, engellenen kullanıcı, doğru şıkkın sızmaması, premium erişim kontrolü,
puanlama (ilk doğruda puan, tekrarda puan yok), rozet verme, sıralama, admin yetkisi,
HTML temizleme, sınav süresi ve skor hesabı, premium kullanıcıya reklam gösterilmemesi.

## Yayına alma

| Katman | Servis | Not |
|---|---|---|
| Veritabanı | **Neon** | Ücretsiz plan, `sslmode=require` |
| API | **Render** (Web Service) | `api/` klasörü, Node runtime |
| Arayüz | **Vercel** | `web/` klasörü, Vite preset |
| Medya | **Cloudflare R2** | Opsiyonel; yalnızca dosya yükleme için |

### Render (API)

- Root Directory: `api`
- Build Command: `npm install`
- Start Command: `npm start`
- Pre-Deploy Command: `npm run migrate`
- Ortam değişkenleri: `.env.example`'daki tüm anahtarlar.
  `DATABASE_SSL=true`, `NODE_ENV=production`,
  `CORS_ORIGINS=https://10adimdakardiyoloji.com,https://www.10adimdakardiyoloji.com`

İlk deploydan sonra bir kez `npm run seed` çalıştır (Render Shell'den) — konular, rozetler,
reklam alanları ve admin hesabı oluşur.

### Vercel (web)

- Root Directory: `web`
- Framework Preset: Vite
- Ortam değişkeni: `VITE_API_URL=https://api.10adimdakardiyoloji.com`

`vercel.json` içindeki rewrite kuralı sayesinde React Router adresleri (`/profil`, `/admin/…`)
doğrudan açıldığında da çalışır.

### Alan adı

1. Alan adını satın al (Namecheap, GoDaddy, Turhost…).
2. **Vercel** → Project → Settings → Domains → `10adimdakardiyoloji.com` ekle, gösterilen
   A/CNAME kayıtlarını alan adı paneline gir.
3. **Render** → Settings → Custom Domain → `api.10adimdakardiyoloji.com` ekle, verilen CNAME'i gir.
4. Render'daki `CORS_ORIGINS` değerine yeni alan adını ekle ve API'yi yeniden başlat.
5. SSL sertifikaları her iki serviste de otomatik gelir (birkaç dakika sürebilir).

### Cloudflare R2 (dosya yükleme — opsiyonel)

1. Cloudflare → R2 → bucket oluştur (`kardiyo-media`).
2. R2 API token üret (Object Read & Write).
3. Bucket'a genel erişim adresi bağla (`media.10adimdakardiyoloji.com`).
4. Render'a `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
   `R2_PUBLIC_URL` değişkenlerini gir.
5. Bucket CORS ayarına Vercel alan adını `PUT` izniyle ekle (tarayıcı doğrudan yükleme yapar).

Bu değişkenler boşsa dosya yükleme kapalı olur; YouTube/Vimeo linkiyle video eklemek çalışmaya
devam eder.

## Reklam yerleşimleri

| Kod | Yer |
|---|---|
| `header` | Tüm sayfalarda, başlığın altında |
| `sidebar` | Soru çözme, video, profil ve sıralama sayfalarında sağ kolon |
| `question_bottom` | Soru kartının altında ve sınav sonuç sayfasında |
| `video_below` | Video oynatıcının altında |

Her alan ya kendi banner'larını (ağırlıklı rastgele, tarih aralıklı) ya da AdSense kodunu
gösterir. **Premium üyelere ve yöneticilere hiçbir reklam gösterilmez.**

## İçerik notu

Sorular ve çözümler eğitim amaçlıdır; hasta tedavisinde güncel kılavuzlar esas alınmalıdır.
