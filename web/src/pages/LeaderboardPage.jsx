import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import AdSlot from '../components/AdSlot';
import { EmptyState, ErrorBox, Icon, PageLoader } from '../components/ui';

const PERIODS = [
  { value: 'all', label: 'Tüm Zamanlar' },
  { value: 'week', label: 'Bu Hafta' },
];

const MEDAL = { 1: 'text-[#d4af37]', 2: 'text-[#a8a9ad]', 3: 'text-[#b08d57]' };

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/leaderboard?period=${period}&limit=100`)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="mx-auto grid max-w-container-max-width gap-gutter px-margin-mobile py-6 md:py-10 md:grid-cols-[1fr_300px] md:px-margin-desktop">
      <div>
        <h1 className="text-headline-lg-mobile text-on-surface md:text-headline-lg">Sıralama Tablosu</h1>
        <p className="mt-2 text-body-md text-secondary">
          Doğru cevaplarla puan kazan, listede yüksel. Zorluk arttıkça puan artar (5 / 10 / 20).
        </p>

        <div className="mt-6 flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`chip-btn border px-3 py-2 ${
                period === p.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-outline-variant text-secondary hover:border-primary'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <ErrorBox message={error} />
        </div>

        {loading ? (
          <PageLoader />
        ) : data?.entries.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon="leaderboard"
              title="Bu dönemde henüz puan toplanmamış"
              description="İlk soruyu çözen sen ol."
              action={
                <Link to="/konular" className="btn-primary mt-2">
                  Soru çözmeye başla
                </Link>
              }
            />
          </div>
        ) : (
          <>
            {/* Kullanicinin kendi siralamasi ilk 100'de degilse ustte gosterilir */}
            {data.me && !data.entries.some((e) => e.userId === data.me.userId) && (
              <div className="mt-6 rounded-xl border-2 border-primary bg-primary/5 px-4 py-3">
                <Row entry={data.me} highlight />
              </div>
            )}

            <div className="card mt-6 divide-y divide-surface-variant">
              {data.entries.map((e) => (
                <div
                  key={e.userId}
                  className={`px-4 ${e.userId === user?.id ? 'bg-primary/5' : ''}`}
                >
                  <Row entry={e} highlight={e.userId === user?.id} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <aside className="space-y-4">
        <div className="card p-5">
          <h2 className="text-body-lg font-semibold text-on-surface">Puan nasıl kazanılır?</h2>
          <ul className="mt-3 space-y-2 text-body-md text-secondary">
            <li className="flex items-center justify-between">
              <span>Kolay soru</span> <strong className="text-primary">5 puan</strong>
            </li>
            <li className="flex items-center justify-between">
              <span>Orta soru</span> <strong className="text-primary">10 puan</strong>
            </li>
            <li className="flex items-center justify-between">
              <span>Zor soru</span> <strong className="text-primary">20 puan</strong>
            </li>
          </ul>
          <p className="mt-3 text-caption text-secondary">
            Puan yalnızca bir soruyu <strong>ilk kez</strong> doğru çözdüğünde verilir; aynı soruyu
            tekrar çözmek puan kazandırmaz.
          </p>
        </div>
        <AdSlot code="sidebar" />
      </aside>
    </div>
  );
}

function Row({ entry, highlight }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-label-sm ${
          entry.rank <= 3 ? 'bg-surface-container' : 'bg-surface-container-low text-secondary'
        }`}
      >
        {entry.rank <= 3 ? (
          <Icon name="emoji_events" size={20} className={MEDAL[entry.rank]} filled />
        ) : (
          entry.rank
        )}
      </span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-label-sm text-primary">
        {entry.fullName[0].toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-body-md text-on-surface">
          {entry.fullName}
          {highlight && <span className="ml-2 text-caption text-primary">(sen)</span>}
        </div>
        <div className="text-caption text-secondary">{entry.correctCount} doğru cevap</div>
      </div>
      <div className="text-body-lg font-semibold text-primary">{entry.points}</div>
    </div>
  );
}
