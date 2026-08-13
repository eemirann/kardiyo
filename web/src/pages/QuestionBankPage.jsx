import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AdSlot from '../components/AdSlot';
import {
  DifficultyChip,
  EmptyState,
  ErrorBox,
  Icon,
  PageLoader,
  PremiumChip,
  ProgressBar,
  QuestionImage,
  RichText,
  Spinner,
  optionClass as optionClassFor,
} from '../components/ui';

const DIFFICULTIES = [
  { value: '', label: 'Tümü' },
  { value: 'easy', label: 'Kolay' },
  { value: 'medium', label: 'Orta' },
  { value: 'hard', label: 'Zor' },
];

/**
 * Soru cozme ekrani — docs/mockup.html'deki duzenin calisan hali:
 * sol konu listesi, ortada soru karti, altinda ayrintili cozum.
 */
export default function QuestionBankPage() {
  const { topicSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const toast = useToast();

  const difficulty = searchParams.get('zorluk') || '';
  const onlyUnsolved = searchParams.get('cozulmemis') === '1';

  const [topics, setTopics] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Yalnizca mobilde anlamli: yan panel varsayilan olarak kapali gelir
  const [navOpen, setNavOpen] = useState(false);

  // Cevaplama durumu: soru id -> { selectedOptionId, result }
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);

  const current = questions[index];
  const currentState = current ? answers[current.id] : null;
  const answered = Boolean(currentState?.result);

  useEffect(() => {
    api.get('/topics').then((d) => setTopics(d.topics)).catch(() => {});
  }, []);

  const loadQuestions = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ topic: topicSlug, limit: '100' });
    if (difficulty) params.set('difficulty', difficulty);
    if (onlyUnsolved) params.set('unsolved', '1');

    api
      .get(`/questions?${params}`)
      .then((d) => {
        setQuestions(d.questions);
        setIndex(0);
        setAnswers({});
        setSelected(null);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [topicSlug, difficulty, onlyUnsolved]);

  useEffect(loadQuestions, [loadQuestions]);

  // Soru degisince secim ve kronometre sifirlanir
  useEffect(() => {
    setSelected(currentState?.selectedOptionId ?? null);
    setStartedAt(Date.now());
    setElapsed(0);
  }, [index, current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (answered) return undefined;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt, answered]);

  const solvedCount = useMemo(
    () => Object.values(answers).filter((a) => a.result?.isCorrect).length,
    [answers]
  );

  const activeTopic = topics.find((t) => t.slug === topicSlug);

  const submitAnswer = async () => {
    if (!selected || !current || answered) return;
    setSubmitting(true);
    try {
      const result = await api.post(`/questions/${current.id}/answer`, {
        optionId: selected,
        durationMs: Date.now() - startedAt,
      });
      setAnswers((prev) => ({ ...prev, [current.id]: { selectedOptionId: selected, result } }));

      if (result.pointsAwarded > 0) toast.points(result.pointsAwarded);
      if (result.newBadges?.length) toast.badges(result.newBadges);
      if (result.pointsAwarded > 0 || result.newBadges?.length) refreshUser();
    } catch (err) {
      toast.error('Cevap kaydedilemedi', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const goTo = (next) => {
    if (next < 0 || next >= questions.length) return;
    setIndex(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const optionClass = (option) =>
    optionClassFor(option, { selectedId: selected, answer: currentState });

  return (
    <div className="mx-auto flex max-w-container-max-width flex-col gap-gutter px-margin-mobile py-6 md:py-10 md:flex-row md:px-margin-desktop">
      {/* Sol: konu listesi (mockup'taki sidebar) */}
      <aside className="w-full shrink-0 md:w-64 lg:w-72">
        {/* Telefonda panel katli gelir: acikken 10 konu + filtreler soru
            kartini ekranin cok asagisina itiyordu. md'den itibaren degismedi. */}
        <button
          type="button"
          onClick={() => setNavOpen((v) => !v)}
          aria-expanded={navOpen}
          className="card flex w-full items-center justify-between gap-2 px-4 py-3 text-left md:hidden"
        >
          <span className="min-w-0">
            <span className="block text-caption uppercase tracking-wider text-secondary">
              Konu ve filtreler
            </span>
            <span className="block truncate text-body-md font-semibold text-on-surface">
              {activeTopic?.name || 'Konu seç'}
            </span>
          </span>
          <Icon
            name="expand_more"
            size={22}
            className={`shrink-0 text-secondary transition-transform ${navOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <div
          className={`card p-unit md:sticky md:top-24 md:mt-0 md:block ${
            navOpen ? 'mt-2 block' : 'hidden'
          }`}
        >
          <h2 className="mb-3 px-3 pt-2 text-label-sm uppercase tracking-wider text-secondary">
            Soru Bankası Konuları
          </h2>
          <nav className="flex flex-col gap-1">
            {topics.map((t) => {
              const active = t.slug === topicSlug;
              return (
                <Link
                  key={t.id}
                  to={`/soru-bankasi/${t.slug}`}
                  onClick={() => setNavOpen(false)}
                  className={`flex items-center justify-between rounded px-3 py-2.5 transition-colors ${
                    active
                      ? 'bg-surface-container-high font-bold text-primary'
                      : 'text-on-surface hover:bg-surface-container-highest'
                  }`}
                >
                  <span className="truncate">{t.name}</span>
                  {active ? (
                    <Icon name="chevron_right" size={18} />
                  ) : (
                    <span className="text-caption text-secondary">{t.question_count}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 space-y-3 border-t border-surface-variant px-3 pb-2 pt-4">
            <div>
              <span className="label">Zorluk</span>
              <div className="flex flex-wrap gap-1.5">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setFilter('zorluk', d.value)}
                    className={`chip-btn border ${
                      difficulty === d.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-outline-variant text-secondary hover:border-primary'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            {user && (
              <label className="flex cursor-pointer items-center gap-2 text-body-md text-secondary">
                <input
                  type="checkbox"
                  className="rounded border-outline text-primary focus:ring-primary"
                  checked={onlyUnsolved}
                  onChange={(e) => setFilter('cozulmemis', e.target.checked ? '1' : '')}
                />
                Sadece çözmediklerim
              </label>
            )}
          </div>
        </div>

        <AdSlot code="sidebar" className="mt-4 hidden md:block" />
      </aside>

      {/* Sag: soru karti */}
      <section className="min-w-0 flex-1">
        <ErrorBox message={error} onRetry={loadQuestions} />

        {loading ? (
          <PageLoader label="Sorular yükleniyor…" />
        ) : questions.length === 0 ? (
          <EmptyState
            icon="quiz"
            title={onlyUnsolved ? 'Bu filtrede çözülmemiş soru kalmadı' : 'Bu konuda henüz soru yok'}
            description={
              onlyUnsolved
                ? 'Tebrikler! Filtreyi kaldırarak soruları tekrar çözebilirsin.'
                : 'Yakında bu konuya sorular eklenecek.'
            }
            action={
              <Link to="/konular" className="btn-outline mt-2">
                Diğer konulara dön
              </Link>
            }
          />
        ) : (
          <>
            {/* Ilerleme */}
            <div className="mb-4 flex items-center gap-4">
              <ProgressBar value={index + 1} max={questions.length} className="flex-1" />
              <span className="whitespace-nowrap text-caption text-secondary">
                {solvedCount} doğru / {Object.keys(answers).length} cevap
              </span>
            </div>

            <div className="card overflow-hidden">
              {/* Soru basligi */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-variant bg-surface-container px-4 py-3 md:px-6 md:py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="chip bg-primary/10 text-primary">
                    {current.type === 'case' ? 'Vaka Sorusu' : 'Klasik Soru'}
                  </span>
                  <h3 className="text-body-lg font-semibold text-on-surface">
                    Soru {index + 1} / {questions.length}
                  </h3>
                  <DifficultyChip difficulty={current.difficulty} showPoints />
                  {current.isPremium && <PremiumChip />}
                </div>
                <div className="flex items-center gap-2 text-secondary">
                  <Icon name="timer" size={20} />
                  <span className="text-caption">
                    {String(Math.floor(elapsed / 60)).padStart(2, '0')}:
                    {String(elapsed % 60).padStart(2, '0')}
                  </span>
                </div>
              </div>

              <div className="p-5 md:p-8">
                <QuestionImage src={current.imageUrl} alt={current.imageAlt} className="mb-6" />
                <RichText html={current.body} className="mb-6 text-body-md text-on-surface" />

                {current.alreadySolved && !answered && (
                  <p className="mb-4 flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-caption text-secondary">
                    <Icon name="history" size={16} />
                    Bu soruyu daha önce doğru çözmüştün; tekrar çözmek puan kazandırmaz.
                  </p>
                )}

                {/* Siklar */}
                <div className="mb-8 flex flex-col gap-3">
                  {current.options.map((o) => (
                    <label
                      key={o.id}
                      className={`flex cursor-pointer items-start rounded-lg border p-4 transition-colors ${optionClass(
                        o
                      )}`}
                    >
                      <input
                        type="radio"
                        name={`answer-${current.id}`}
                        className="mr-4 mt-1 border-outline text-primary focus:ring-primary"
                        checked={
                          answered ? currentState.selectedOptionId === o.id : selected === o.id
                        }
                        disabled={answered}
                        onChange={() => setSelected(o.id)}
                      />
                      <span className="flex-1 text-body-md">
                        <strong className="mr-2">{o.label})</strong>
                        {o.text}
                      </span>
                      {answered && o.id === currentState.result.correctOptionId && (
                        <Icon name="check_circle" size={20} className="ml-2 shrink-0" />
                      )}
                      {answered &&
                        o.id === currentState.selectedOptionId &&
                        !currentState.result.isCorrect && (
                          <Icon name="cancel" size={20} className="ml-2 shrink-0" />
                        )}
                    </label>
                  ))}
                </div>

                {/* Aksiyon */}
                {!answered ? (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={submitAnswer}
                      disabled={!selected || submitting || !user}
                      className="btn-primary px-8 py-3"
                    >
                      {submitting ? <Spinner /> : <Icon name="task_alt" size={18} />}
                      {user ? 'Cevabı Kontrol Et' : 'Cevaplamak için giriş yap'}
                    </button>
                  </div>
                ) : (
                  <div
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
                      currentState.result.isCorrect
                        ? 'bg-success-container text-on-success-container'
                        : 'bg-error-container text-on-error-container'
                    }`}
                  >
                    <Icon
                      name={currentState.result.isCorrect ? 'check_circle' : 'cancel'}
                      size={24}
                    />
                    <div className="flex-1">
                      <div className="text-body-md font-semibold">
                        {currentState.result.isCorrect ? 'Doğru cevap!' : 'Yanlış cevap'}
                      </div>
                      <div className="text-caption">
                        Doğru şık: {currentState.result.correctOptionLabel}
                        {currentState.result.pointsAwarded > 0 &&
                          ` · +${currentState.result.pointsAwarded} puan`}
                      </div>
                    </div>
                  </div>
                )}

                {/* Ayrintili cozum */}
                {answered && currentState.result.explanation && (
                  <div className="mt-6 border-t border-surface-variant pt-6">
                    <details className="group" open>
                      <summary className="flex cursor-pointer list-none items-center justify-between">
                        <h4 className="flex items-center gap-2 text-headline-md text-primary">
                          <Icon name="psychology" size={24} />
                          Ayrıntılı Çözüm
                        </h4>
                        <Icon
                          name="expand_more"
                          size={22}
                          className="text-secondary transition-transform group-open:rotate-180"
                        />
                      </summary>
                      <RichText
                        html={currentState.result.explanation}
                        className="mt-4 rounded-lg bg-surface-container-low p-5 text-body-md text-on-surface"
                      />
                    </details>
                  </div>
                )}
              </div>
            </div>

            <AdSlot code="question_bottom" className="mt-6" />

            {/* Navigasyon */}
            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                disabled={index === 0}
                className="btn-outline"
              >
                <Icon name="arrow_back" size={18} />
                Önceki Soru
              </button>
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                disabled={index >= questions.length - 1}
                className="btn-outline border-primary text-primary"
              >
                Sonraki Soru
                <Icon name="arrow_forward" size={18} />
              </button>
            </div>

            {/* Soru izgarasi */}
            <div className="card mt-6 p-4">
              <div className="mb-3 text-label-sm uppercase tracking-wider text-secondary">
                {activeTopic?.name || 'Sorular'}
              </div>
              <div className="flex flex-wrap gap-2">
                {questions.map((q, i) => {
                  const state = answers[q.id];
                  const cls = state
                    ? state.result.isCorrect
                      ? 'bg-success text-white'
                      : 'bg-error text-white'
                    : i === index
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-secondary hover:bg-surface-container-high';
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => goTo(i)}
                      className={`h-9 w-9 rounded-lg text-label-sm transition-colors ${cls} ${
                        i === index ? 'ring-2 ring-primary ring-offset-2' : ''
                      }`}
                      aria-label={`Soru ${i + 1}`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
