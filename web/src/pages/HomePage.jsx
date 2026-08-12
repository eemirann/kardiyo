import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/ui';

const FEATURES = [
  {
    icon: 'menu_book',
    title: 'İnteraktif E-Kitap',
    text: '"10 Adımda Kardiyoloji" ve güncellenmiş ders notlarıyla konuların patofizyolojik mantığını kavrayın.',
    to: '/kitaplar',
  },
  {
    icon: 'play_circle',
    title: 'Mikro-Öğrenme Video Seti',
    text: 'Odaklanma sürenizi bozmayan, 10-15 dakikalık yapay zekâ destekli modüllerle klinik pratikleri öğrenin.',
    to: '/videolar',
  },
  {
    icon: 'quiz',
    title: 'Vaka Odaklı Soru Bankası',
    text: 'TUS/USMLE konseptindeki klinik senaryolu sorular ve detaylı patofizyolojik çözümlerle kendinizi test edin.',
    to: '/konular',
  },
  {
    icon: 'style',
    title: 'Flashcard Desteleri',
    text: 'Aralıklı tekrar algoritmasıyla çalışın; her gün tekrar sırası gelen kartlar karşınıza gelsin.',
    to: '/kartlar',
  },
  {
    icon: 'timer',
    title: 'Süreli Deneme Sınavları',
    text: 'Gerçek sınav temposunda çalışın; bitiminde skor kartı, konu dağılımı ve yanlış analizi.',
    to: '/sinavlar',
  },
  {
    icon: 'calculate',
    title: 'Klinik Hesaplayıcılar',
    text: 'CHA₂DS₂-VASc, HAS-BLED, HEART, Wells ve daha fazlası; sonucun klinik yorumuyla birlikte.',
    to: '/hesaplayicilar',
  },
  {
    icon: 'emoji_events',
    title: 'Puan, Rozet ve Sıralama',
    text: 'Her doğru cevap puan kazandırır, hedefleri tamamladıkça rozet açılır, sıralamada yerinizi görün.',
    to: '/siralama',
  },
];

export default function HomePage() {
  const { user } = useAuth();
  const [topics, setTopics] = useState([]);
  const [top, setTop] = useState([]);

  useEffect(() => {
    // Ana sayfadaki kartlar soru bankasina goturuyor; sorusuz konular gosterilmez
    api
      .get('/topics')
      .then((d) => setTopics(d.topics.filter((t) => t.question_count > 0)))
      .catch(() => {});
    api.get('/leaderboard?period=all&limit=5').then((d) => setTop(d.entries)).catch(() => {});
  }, []);

  const totalQuestions = topics.reduce((sum, t) => sum + t.question_count, 0);

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-container-max-width px-margin-mobile pb-12 pt-12 md:px-margin-desktop md:pb-16 md:pt-20">
        <div className="grid items-center gap-gutter md:grid-cols-2">
          <div>
            <span className="chip bg-primary/10 text-primary">
              <Icon name="verified" size={14} /> ESC · AHA · UpToDate ışığında
            </span>
            <h1 className="mt-4 text-headline-lg-mobile text-on-surface md:text-display-lg">
              Tıp eğitimini karmaşadan kurtarın,{' '}
              <span className="text-primary">klinik düşünmeyi</span> hızlandırın.
            </h1>
            <p className="mt-4 max-w-xl text-body-lg text-secondary">
              Yoğun komite maratonları, yüzlerce sayfalık boğucu textbook'lar ve nöbet aralarında
              sınava hazırlanma stresi… Hepimiz aynı yollardan geçiyoruz. 10 Adımda Kardiyoloji, tam
              bu karmaşanın ortasında ihtiyaç duyduğunuz akılcı ve nokta atışı öğrenme rehberi
              olarak doğdu.
            </p>
            <p className="mt-3 max-w-xl text-body-md text-secondary">
              Amacımız; teorik tıp bilgisini güncel uluslararası kılavuzlar ışığında süzmek ve hasta
              başında veya sınavlarda (TUS / USMLE) doğrudan kullanabileceğiniz pratik bir klinik
              vizyona dönüştürmektir.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <Link to="/konular" className="btn-primary px-8 py-3">
                  Çözmeye Devam Et
                </Link>
              ) : (
                <Link to="/kayit" className="btn-primary px-8 py-3">
                  Ücretsiz Başla
                </Link>
              )}
              <Link to="/kitaplar" className="btn-outline px-8 py-3">
                <Icon name="menu_book" size={18} /> Hemen Notlara Ulaş
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-8">
              <div>
                <div className="text-headline-md text-primary">{totalQuestions || '—'}</div>
                <div className="text-caption uppercase tracking-wider text-secondary">Aktif soru</div>
              </div>
              <div>
                <div className="text-headline-md text-primary">{topics.length || '—'}</div>
                <div className="text-caption uppercase tracking-wider text-secondary">Konu başlığı</div>
              </div>
              <div>
                <div className="text-headline-md text-primary">7/24</div>
                <div className="text-caption uppercase tracking-wider text-secondary">Erişim</div>
              </div>
            </div>
          </div>

          {/* Ornek soru onizlemesi */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-surface-variant bg-surface-container px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="chip bg-primary/10 text-primary">Vaka Sorusu</span>
                <span className="text-body-lg font-semibold">Örnek</span>
              </div>
              <div className="flex items-center gap-2 text-secondary">
                <Icon name="timer" size={20} />
                <span className="text-caption">02:30</span>
              </div>
            </div>
            <div className="p-6">
              <p className="mb-5 text-body-md leading-relaxed text-on-surface">
                65 yaşında erkek hasta, artan efor dispnesi ve ortopne ile başvuruyor. LVEF %30.
                Ramipril ve bisoprolol kullanıyor. Mortalite faydası için eklenmesi gereken ajan?
              </p>
              <div className="flex flex-col gap-2">
                {['Furosemid', 'Spironolakton', 'Digoksin', 'İvabradin'].map((opt, i) => (
                  <div
                    key={opt}
                    className={`rounded-lg border px-4 py-3 text-body-md ${
                      i === 1
                        ? 'border-success bg-success-container text-on-success-container'
                        : 'border-outline-variant text-on-surface'
                    }`}
                  >
                    <strong className="mr-2">{'ABCD'[i]})</strong>
                    {opt}
                    {i === 1 && <Icon name="check_circle" size={18} className="float-right" />}
                  </div>
                ))}
              </div>
              <p className="mt-4 border-l-2 border-primary pl-3 text-caption text-secondary">
                RALES ve EMPHASIS-HF çalışmalarında MRA'lar mortaliteyi anlamlı azaltmıştır.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Ozellikler */}
      <section className="bg-surface-container-low py-16">
        <div className="mx-auto max-w-container-max-width px-margin-mobile md:px-margin-desktop">
          <h2 className="text-headline-lg text-on-surface">Sitede sizi neler bekliyor?</h2>
          <div className="mt-8 grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => {
              // Karsiligi olan bir sayfa varsa kartin tamami link olsun.
              const Wrapper = f.to ? Link : 'div';
              return (
                <Wrapper
                  key={f.title}
                  {...(f.to ? { to: f.to } : {})}
                  className={`card p-6${f.to ? ' block transition-shadow hover:shadow-level2' : ''}`}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon name={f.icon} size={24} />
                  </span>
                  <h3 className="mt-4 text-body-lg font-semibold text-on-surface">{f.title}</h3>
                  <p className="mt-2 text-body-md text-secondary">{f.text}</p>
                </Wrapper>
              );
            })}
          </div>

          <p className="mt-8 text-body-lg text-on-surface">
            Sadece ezberleyen değil, mekanizmayı anlayan ve yöneten bir hekim olma yolculuğunda
            birlikteyiz.
          </p>
        </div>
      </section>

      {/* Guvenilirlik seridi */}
      <section className="mx-auto max-w-container-max-width px-margin-mobile pt-16 md:px-margin-desktop">
        <div className="card flex flex-wrap items-center gap-6 p-6">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon name="verified_user" size={28} />
          </span>
          <div className="min-w-[260px] flex-1">
            <h2 className="text-headline-md text-on-surface">Güvenilir ve kanıtlanmış içerik</h2>
            <p className="mt-2 text-body-md text-secondary">
              Zenodo üzerinde 800'den fazla indirmeye ulaşarak yüzlerce tıp öğrencisi ve intörn
              hekimin komite ve klinik süreçlerine katkı sağlayan "10 Adımda Kardiyoloji" kitabı,
              güncellenmiş yeni versiyonu ve etkileşimli içerikleriyle şimdi tamamen tek çatı
              altında bir sitede.
            </p>
          </div>
        </div>
      </section>

      {/* Konular */}
      <section className="mx-auto max-w-container-max-width px-margin-mobile pb-16 pt-12 md:px-margin-desktop">
        <div className="flex items-end justify-between">
          <h2 className="text-headline-lg text-on-surface">Konu başlıkları</h2>
          <Link to="/konular" className="text-label-sm text-primary hover:underline">
            Tümünü gör
          </Link>
        </div>
        <div className="mt-6 grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
          {topics.slice(0, 6).map((t) => (
            <Link key={t.id} to={`/soru-bankasi/${t.slug}`} className="card p-5 transition-shadow hover:shadow-level2">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-primary">
                  <Icon name={t.icon || 'cardiology'} size={22} />
                </span>
                <div>
                  <div className="text-body-lg font-semibold text-on-surface">{t.name}</div>
                  <div className="text-caption text-secondary">{t.question_count} soru</div>
                </div>
              </div>
              {t.description && <p className="mt-3 text-body-md text-secondary">{t.description}</p>}
            </Link>
          ))}
        </div>
      </section>

      {/* Video dersler */}
      <section className="bg-surface-container-low py-16">
        <div className="mx-auto max-w-container-max-width px-margin-mobile md:px-margin-desktop">
          <div className="grid items-center gap-gutter md:grid-cols-2">
            <div>
              <span className="chip bg-primary/10 text-primary">
                <Icon name="play_circle" size={14} /> Mikro-öğrenme
              </span>
              <h2 className="mt-4 text-headline-lg text-on-surface">
                Bilişsel yükü azaltan, klinik odaklı video dersler
              </h2>
              <p className="mt-4 text-body-lg text-secondary">
                Saatlerce süren, sadece slayttaki yazıları okuyan monoton ders videolarını unutun.
                Video Eğitim Seti; tıp fakültesindeki yoğun temponuza ve ideal odaklanma sürenize
                uygun olarak mikro-öğrenme modeliyle kurgulandı.
              </p>
              <p className="mt-3 text-body-md text-secondary">
                Kardiyolojinin en karmaşık patofizyolojik süreçlerini, EKG analizlerini ve güncel
                tedavi algoritmalarını hasta başındaki bir hekim gözüyle, sıkılmadan ve interaktif
                bir şekilde öğrenin.
              </p>
              <Link to="/videolar" className="btn-primary mt-8 px-8 py-3">
                Ders Videolarını İncele
              </Link>
            </div>

            <blockquote className="card border-l-4 border-primary p-8">
              <Icon name="format_quote" size={32} className="text-primary" />
              <p className="mt-2 text-headline-md leading-snug text-on-surface">
                Ezberlemeyin, mekanizmayı kavrayın. Hasta başında ve sınavlarda kendinizden emin
                adımlarla ilerleyin!
              </p>
            </blockquote>
          </div>
        </div>
      </section>

      {/* Siralama onizleme + premium */}
      <section className="mx-auto grid max-w-container-max-width gap-gutter px-margin-mobile pb-20 pt-16 md:grid-cols-2 md:px-margin-desktop">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-headline-md text-on-surface">Sıralama tablosu</h3>
            <Link to="/siralama" className="text-label-sm text-primary hover:underline">
              Tümü
            </Link>
          </div>
          <div className="mt-4 divide-y divide-surface-variant">
            {top.length === 0 && (
              <p className="py-6 text-body-md text-secondary">
                Henüz sıralama oluşmadı. İlk sırayı sen kap!
              </p>
            )}
            {top.map((e) => (
              <div key={e.userId} className="flex items-center gap-3 py-3">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-label-sm ${
                    e.rank === 1
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-secondary'
                  }`}
                >
                  {e.rank}
                </span>
                <span className="flex-1 truncate text-body-md text-on-surface">{e.fullName}</span>
                <span className="text-body-md font-semibold text-primary">{e.points}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card flex flex-col justify-between p-6">
          <div>
            <span className="chip bg-primary text-on-primary">
              <Icon name="workspace_premium" size={14} /> Premium
            </span>
            <h3 className="mt-4 text-headline-md text-on-surface">Reklamsız ve sınırsız erişim</h3>
            <ul className="mt-4 space-y-2 text-body-md text-secondary">
              {[
                'Premium işaretli tüm sorular ve vakalar',
                'Premium video derslerin tamamı',
                'Reklamsız, dikkat dağıtmayan çalışma ekranı',
                'Tüm deneme sınavlarına erişim',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Icon name="check_circle" size={18} className="mt-0.5 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <Link to="/iletisim" className="btn-primary mt-6 self-start px-8 py-3">
            Premium hakkında bilgi al
          </Link>
        </div>
      </section>
    </div>
  );
}
