import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { EmptyState, ErrorBox, Icon, PageLoader, ProgressBar } from '../components/ui';

/** Degerlendirme dugmeleri — SM-2 not olcegiyle ayni sirada. */
const GRADES = [
  { grade: 0, label: 'Tekrar', key: '1', className: 'bg-error text-on-error' },
  { grade: 1, label: 'Zor', key: '2', className: 'bg-warning text-white' },
  { grade: 2, label: 'İyi', key: '3', className: 'bg-success text-white' },
  { grade: 3, label: 'Kolay', key: '4', className: 'bg-primary text-on-primary' },
];

const formatInterval = (days) => {
  if (!days || days < 1) return '10 dk';
  if (days === 1) return '1 gün';
  if (days < 30) return `${days} gün`;
  if (days < 365) return `${Math.round(days / 30)} ay`;
  return `${(days / 365).toFixed(1)} yıl`;
};

export default function FlashcardStudyPage() {
  const { deckSlug } = useParams();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mod') === 'tekrar' ? 'review' : 'study';
  const { user, refreshUser } = useAuth();
  const toast = useToast();

  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [known, setKnown] = useState({ good: 0, again: 0 });

  const current = cards[index];

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ mode, limit: '80' });
    if (mode === 'study') params.set('shuffle', '0');
    api
      .get(`/flashcards/decks/${deckSlug}/cards?${params}`)
      .then((d) => {
        setDeck(d.deck);
        setCards(d.cards);
        setIndex(0);
        setFlipped(false);
        setDone(0);
        setKnown({ good: 0, again: 0 });
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [deckSlug, mode]);

  const advance = useCallback(
    (requeue = false) => {
      setFlipped(false);
      setDone((n) => n + 1);
      if (requeue) {
        // Bilinemeyen kart destenin sonuna eklenir
        setCards((list) => {
          const copy = [...list];
          const [card] = copy.splice(index, 1);
          copy.push(card);
          return copy;
        });
        return; // index ayni kalir, siradaki kart gelir
      }
      setIndex((i) => i + 1);
    },
    [index]
  );

  const grade = useCallback(
    async (g) => {
      if (!current || busy) return;
      setBusy(true);
      try {
        if (mode === 'review' && user) {
          const res = await api.post(`/flashcards/cards/${current.id}/review`, { grade: g });
          if (res.newBadges?.length) {
            toast.badges(res.newBadges);
            refreshUser();
          }
        }
        setKnown((k) => (g === 0 ? { ...k, again: k.again + 1 } : { ...k, good: k.good + 1 }));
        advance(g === 0);
      } catch (err) {
        toast.error('Kaydedilemedi', err.message);
      } finally {
        setBusy(false);
      }
    },
    [current, busy, mode, user, advance, toast, refreshUser]
  );

  // Klavye kisayollari: boşluk çevirir, 1-4 değerlendirir
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
        return;
      }
      if (!flipped) return;
      const g = GRADES.find((x) => x.key === e.key);
      if (g) {
        e.preventDefault();
        grade(g.grade);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipped, grade]);

  if (loading) return <PageLoader label="Kartlar yükleniyor…" />;
  if (error)
    return (
      <div className="mx-auto max-w-container-max-width px-margin-mobile py-6 md:py-10 md:px-margin-desktop">
        <ErrorBox message={error} />
        <Link to="/kartlar" className="btn-outline mt-4">
          <Icon name="arrow_back" size={18} /> Destelere dön
        </Link>
      </div>
    );

  // Deste bitti
  if (!current) {
    return (
      <div className="mx-auto max-w-2xl px-margin-mobile py-8 md:px-margin-desktop md:py-16">
        <EmptyState
          icon={cards.length === 0 ? 'task_alt' : 'celebration'}
          title={
            cards.length === 0
              ? mode === 'review'
                ? 'Bu destede bugün tekrar edilecek kart yok'
                : 'Bu destede kart yok'
              : 'Deste tamamlandı!'
          }
          description={
            cards.length === 0
              ? mode === 'review'
                ? 'Yarın tekrar uğra ya da serbest çalışma moduna geç.'
                : undefined
              : `${done} kart çalıştın · ${known.good} bildin · ${known.again} tekrar edilecek`
          }
          action={
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <Link to="/kartlar" className="btn-outline">
                Destelere dön
              </Link>
              {mode === 'review' && (
                <Link to={`/kartlar/${deckSlug}`} className="btn-primary">
                  Serbest çalış
                </Link>
              )}
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-margin-mobile py-8 md:px-margin-desktop">
      {/* Ust bilgi */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/kartlar" className="text-caption text-secondary hover:text-primary">
            ← {deck?.title}
          </Link>
          <div className="text-label-sm uppercase tracking-wider text-secondary">
            {mode === 'review' ? 'Aralıklı tekrar' : 'Serbest çalışma'}
          </div>
        </div>
        <div className="text-caption text-secondary">
          {index + 1} / {cards.length} · {known.good} bilindi
        </div>
      </div>

      <ProgressBar value={done} max={cards.length} className="mb-6" />

      {/* Kart */}
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="card flex min-h-[320px] w-full flex-col items-center justify-center gap-4 p-8 text-center transition-shadow hover:shadow-level2"
      >
        {current.kind && (
          <span className="chip bg-brand-navy/10 text-brand-navy">{current.kind}</span>
        )}

        <div className="text-headline-md leading-snug text-on-surface">{current.front}</div>

        {!flipped ? (
          <span className="mt-2 flex items-center gap-2 text-caption text-secondary">
            <Icon name="touch_app" size={18} /> Cevabı görmek için tıkla (veya boşluk tuşu)
          </span>
        ) : (
          <>
            <div className="w-full border-t border-surface-variant pt-4 text-body-lg leading-relaxed text-on-surface">
              {current.back}
            </div>
            {current.reference && (
              <div className="text-caption text-secondary">{current.reference}</div>
            )}
          </>
        )}
      </button>

      {/* Degerlendirme */}
      {flipped ? (
        mode === 'review' ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {GRADES.map((g) => (
              <button
                key={g.grade}
                type="button"
                disabled={busy}
                onClick={() => grade(g.grade)}
                className={`btn flex-col py-3 ${g.className} disabled:opacity-60`}
              >
                <span className="text-body-md font-semibold">{g.label}</span>
                <span className="text-caption opacity-80">
                  {g.grade === 0
                    ? '10 dk'
                    : formatInterval(estimateInterval(current.state, g.grade))}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => grade(0)}
              className="btn-outline flex-1 border-error text-error"
            >
              <Icon name="replay" size={18} /> Tekrar göster
            </button>
            <button type="button" onClick={() => grade(2)} className="btn-primary flex-1">
              <Icon name="check" size={18} /> Biliyorum
            </button>
          </div>
        )
      ) : (
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={() => setFlipped(true)} className="btn-primary px-10 py-3">
            <Icon name="flip" size={18} /> Kartı çevir
          </button>
        </div>
      )}

      {/* Dokunmatikte klavye kisayolu yok; yalnizca masaustunde gosteriliyor */}
      <p className="mt-6 hidden text-center text-caption text-secondary md:block">
        Kısayollar: <kbd className="rounded bg-surface-container px-1.5 py-0.5">Boşluk</kbd> çevir ·
        <kbd className="mx-1 rounded bg-surface-container px-1.5 py-0.5">1-4</kbd> değerlendir
      </p>
    </div>
  );
}

/**
 * Dugme altindaki tahmini araligi sunucuya sormadan hesaplar
 * (api/services/spacedRepetition.js ile ayni kural).
 */
function estimateInterval(state, grade) {
  const ease = state?.easeFactor ?? 2.5;
  const reps = state?.repetitions ?? 0;
  const prev = state?.intervalDays ?? 0;

  let interval = reps === 0 ? 1 : reps === 1 ? 6 : Math.round(prev * ease);
  if (grade === 1) interval = Math.max(1, Math.round(interval * 0.6));
  if (grade === 3) interval = Math.round(interval * 1.3);
  return interval;
}
