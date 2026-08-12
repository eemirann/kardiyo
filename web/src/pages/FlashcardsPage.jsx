import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import AdSlot from '../components/AdSlot';
import {
  EmptyState,
  ErrorBox,
  Icon,
  PageLoader,
  PremiumChip,
  ProgressBar,
} from '../components/ui';

export default function FlashcardsPage() {
  const { user } = useAuth();
  const [decks, setDecks] = useState([]);
  const [due, setDue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    const calls = [api.get('/flashcards/decks')];
    if (user) calls.push(api.get('/flashcards/due'));
    Promise.all(calls)
      .then(([d, dueRes]) => {
        setDecks(d.decks);
        if (dueRes) setDue(dueRes);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [user]);

  if (loading) return <PageLoader />;

  const totalDue = due?.decks.reduce((n, d) => n + d.total, 0) || 0;

  return (
    <div className="mx-auto grid max-w-container-max-width gap-gutter px-margin-mobile py-10 md:grid-cols-[1fr_300px] md:px-margin-desktop">
      <div>
        <h1 className="text-headline-lg text-on-surface">Flashcard Desteleri</h1>
        <p className="mt-2 text-body-md text-secondary">
          İki mod var: <strong>Serbest çalışma</strong> ile desteyi baştan sona gözden geçir,
          <strong> aralıklı tekrar</strong> ile kartları unutmadan hemen önce tekrar et.
        </p>

        {/* Bugunun tekrar ozeti */}
        {user && (
          <div className="card mt-6 flex flex-wrap items-center gap-4 p-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon name="event_repeat" size={26} />
            </span>
            <div className="flex-1">
              <div className="text-body-lg font-semibold text-on-surface">
                {totalDue > 0
                  ? `Bugün tekrar edilecek ${totalDue} kartın var`
                  : 'Bugünlük tekrarın bitti 🎉'}
              </div>
              <div className="text-caption text-secondary">
                {due?.stats.learned || 0} kart öğrenildi · {due?.stats.mature || 0} kart kalıcı
                hafızada · toplam {due?.stats.reviews || 0} tekrar
              </div>
            </div>
            {totalDue > 0 && due?.decks[0] && (
              <Link to={`/kartlar/${due.decks[0].slug}?mod=tekrar`} className="btn-primary">
                <Icon name="play_arrow" size={18} /> Tekrara başla
              </Link>
            )}
          </div>
        )}

        <div className="mt-6">
          <ErrorBox message={error} onRetry={load} />
        </div>

        {decks.length === 0 && !error ? (
          <div className="mt-6">
            <EmptyState icon="style" title="Henüz deste yok" description="Yakında kartlar eklenecek." />
          </div>
        ) : (
          <div className="mt-6 grid gap-gutter sm:grid-cols-2">
            {decks.map((d) => (
              <div key={d.id} className="card flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-navy/10 text-brand-navy">
                    <Icon name={d.icon || 'style'} size={24} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-body-lg font-semibold text-on-surface">{d.title}</h2>
                    <div className="text-caption text-secondary">
                      {d.cardCount} kart{d.topicName ? ` · ${d.topicName}` : ''}
                    </div>
                  </div>
                  {d.isPremium && <PremiumChip />}
                </div>

                {d.description && (
                  <p className="mt-3 flex-1 text-body-md text-secondary">{d.description}</p>
                )}

                {user && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-caption text-secondary">
                      <span>Öğrenilen</span>
                      <span>
                        {d.learnedCount}/{d.cardCount}
                      </span>
                    </div>
                    <ProgressBar value={d.learnedCount} max={d.cardCount || 1} />
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/kartlar/${d.slug}`}
                    className={`btn-outline flex-1 ${d.locked ? 'pointer-events-none opacity-50' : ''}`}
                  >
                    <Icon name="menu_book" size={18} /> Serbest çalış
                  </Link>
                  <Link
                    to={`/kartlar/${d.slug}?mod=tekrar`}
                    className={`btn-primary flex-1 ${d.locked || !user ? 'pointer-events-none opacity-50' : ''}`}
                  >
                    <Icon name="event_repeat" size={18} />
                    Tekrar {d.dueCount > 0 && `(${d.dueCount})`}
                  </Link>
                </div>
                {!user && (
                  <p className="mt-2 text-caption text-secondary">
                    Aralıklı tekrar için{' '}
                    <Link to="/giris" className="text-primary hover:underline">
                      giriş yap
                    </Link>
                    .
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <div className="card p-5">
          <h2 className="text-body-lg font-semibold text-on-surface">Aralıklı tekrar nedir?</h2>
          <p className="mt-2 text-body-md text-secondary">
            Bir bilgiyi tam unutmak üzereyken tekrar etmek, kalıcı hafızaya en verimli geçiş
            yoludur. Kartı ne kadar iyi bildiğini söylersin, sistem bir sonraki tekrarı ona göre
            planlar.
          </p>
          <ul className="mt-3 space-y-1.5 text-caption text-secondary">
            <li>
              <strong className="text-error">Tekrar</strong> — bilemedim, 10 dakika sonra yeniden
            </li>
            <li>
              <strong className="text-warning">Zor</strong> — güçlükle hatırladım, kısa aralık
            </li>
            <li>
              <strong className="text-success">İyi</strong> — hatırladım, normal aralık
            </li>
            <li>
              <strong className="text-primary">Kolay</strong> — çok kolaydı, uzun aralık
            </li>
          </ul>
        </div>
        <AdSlot code="flashcard_side" />
      </aside>
    </div>
  );
}
