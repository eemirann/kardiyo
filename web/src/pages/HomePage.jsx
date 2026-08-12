import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/ui';

const FEATURES = [
  {
    icon: 'quiz',
    title: 'Vaka Temelli Soru Bankası',
    text: 'Gerçek klinik senaryolardan üretilmiş sorular ve her soruda patofizyolojik gerekçesiyle ayrıntılı çözüm.',
  },
  {
    icon: 'style',
    title: 'Flashcard Desteleri',
    text: 'Aralıklı tekrar algoritmasıyla çalış; her gün tekrar sırası gelen kartlar önüne gelsin.',
    to: '/kartlar',
  },
  {
    icon: 'menu_book',
    title: 'Konu Anlatımı',
    text: 'Bölüm bölüm okunabilen kardiyoloji rehberi; okuduğun bölümler işaretlenir.',
    to: '/kitaplar',
  },
  {
    icon: 'calculate',
    title: 'Klinik Hesaplayıcılar',
    text: 'CHA₂DS₂-VASc, HAS-BLED, HEART, Wells ve daha fazlası; sonucun klinik yorumuyla birlikte.',
    to: '/hesaplayicilar',
  },
  {
    icon: 'timer',
    title: 'Süreli Deneme Sınavları',
    text: 'Gerçek sınav temposunda çalış; bitiminde skor kartı, konu dağılımı ve yanlış analizi.',
  },
  {
    icon: 'play_circle',
    title: 'Video Dersler',
    text: 'Konu anlatımları ve EKG okuma pratikleri; kaldığın yerden devam et.',
  },
  {
    icon: 'emoji_events',
    title: 'Puan, Rozet ve Sıralama',
    text: 'Her doğru cevap puan kazandırır, hedefleri tamamladıkça rozet açılır, sıralamada yerini gör.',
  },
];

export default function HomePage() {
  const { user } = useAuth();
  const [topics, setTopics] = useState([]);
  const [top, setTop] = useState([]);

  useEffect(() => {
    api.get('/topics').then((d) => setTopics(d.topics)).catch(() => {});
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
              <Icon name="verified" size={14} /> Kılavuz temelli içerik
            </span>
            <h1 className="mt-4 text-headline-lg-mobile text-on-surface md:text-display-lg">
              Kardiyolojiyi <span className="text-primary">vakalarla</span> öğren, sınavda fark yarat.
            </h1>
            <p className="mt-4 max-w-xl text-body-lg text-secondary">
              Soru bankası, video dersler ve süreli denemeler tek platformda. Her doğru cevabın puan
              kazandırır; ilerlemeni rozetler ve sıralama tablosuyla takip et.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <Link to="/konular" className="btn-primary px-8 py-3">
                  Çözmeye Devam Et
                </Link>
              ) : (
                <>
                  <Link to="/kayit" className="btn-primary px-8 py-3">
                    Ücretsiz Başla
                  </Link>
                  <Link to="/giris" className="btn-outline px-8 py-3">
                    Giriş Yap
                  </Link>
                </>
              )}
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
          <h2 className="text-headline-lg text-on-surface">Neler sunuyoruz?</h2>
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
        </div>
      </section>

      {/* Konular */}
      <section className="mx-auto max-w-container-max-width px-margin-mobile py-16 md:px-margin-desktop">
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

      {/* Siralama onizleme + premium */}
      <section className="mx-auto grid max-w-container-max-width gap-gutter px-margin-mobile pb-20 md:grid-cols-2 md:px-margin-desktop">
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
