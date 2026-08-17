import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { EKG_CATEGORIES, ekgTopicSlug } from '../data/ekg-categories';
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

/**
 * EKG Quiz — gorsel odakli vaka sorulari.
 *
 * Sorular soru bankasiyla ayni tabloda durur; her EKG kategorisi kendi konusudur
 * (ekg-norm, ekg-mi, ...) ve bu sayfa seçili kategorinin konusunu ceker. Duzen
 * gorseli one alir: ustte EKG, altinda hastanin gelis hikayesi, sonra "hangi
 * tani" siklari. Cevaplama, puanlama ve rozetler soru bankasiyla ayni uctan
 * (/questions/:id/answer) geciyor. Konular /konular listesinde gorunmez
 * (topics.is_listed = false).
 *
 * Secili kategori adres cubugunda tutulur (/ekg?kategori=mi): baglanti
 * paylasilabilir ve geri tusu kategoriler arasinda gezinir.
 */
const CATEGORY_PARAM = 'kategori';
// Kategori basina 30 vaka var; API tek istekte en fazla 100 soru veriyor
// (api/routes/questions.js listSchema), yani tek istek yetiyor.
const PAGE_SIZE = 100;

export default function EkgQuizPage() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();

  const [searchParams, setSearchParams] = useSearchParams();
  // Adreste gecersiz/eksik kategori varsa ilk kategoriye duseriz
  const paramCode = searchParams.get(CATEGORY_PARAM);
  const category =
    EKG_CATEGORIES.find((c) => c.code === paramCode) || EKG_CATEGORIES[0];

  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Cevaplama durumu: soru id -> { selectedOptionId, result }
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [startedAt, setStartedAt] = useState(Date.now());

  const current = questions[index];
  const currentState = current ? answers[current.id] : null;
  const answered = Boolean(currentState?.result);

  const load = useCallback(() => {
    setLoading(true);
    const slug = ekgTopicSlug(category.code);

    api
      .get(`/questions?topic=${slug}&limit=${PAGE_SIZE}`)
      .then(({ questions }) => {
        setQuestions(questions);
        setIndex(0);
        setAnswers({});
        setSelected(null);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [category.code]);

  useEffect(load, [load]);

  // Soru degisince secim ve kronometre sifirlanir
  useEffect(() => {
    setSelected(currentState?.selectedOptionId ?? null);
    setStartedAt(Date.now());
  }, [index, current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const solvedCount = useMemo(
    () => Object.values(answers).filter((a) => a.result?.isCorrect).length,
    [answers]
  );

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

  const optionClass = (option) =>
    optionClassFor(option, { selectedId: selected, answer: currentState });

  // Kategori degistiginde vaka listesi bastan yuklenir; cevaplanmis vakalar sifirlanir
  const selectCategory = (code) => {
    if (code === category.code) return;
    setSearchParams({ [CATEGORY_PARAM]: code });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="mx-auto max-w-4xl px-margin-mobile py-6 md:py-10 md:px-margin-desktop">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon name="monitor_heart" size={26} />
        </span>
        <div>
          <h1 className="text-headline-lg-mobile text-on-surface md:text-headline-lg">EKG Quiz</h1>
          <p className="text-body-md text-secondary">
            Hastanın geliş hikâyesini oku, EKG'yi yorumla, tanıyı koy.
          </p>
        </div>
      </div>

      {/* Kategori secici: her biri kendi konusundaki 30 vakayi acar */}
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="EKG kategorileri">
        {EKG_CATEGORIES.map((c) => {
          const active = c.code === category.code;
          return (
            <button
              key={c.code}
              type="button"
              role="tab"
              aria-selected={active}
              title={c.name}
              onClick={() => selectCategory(c.code)}
              className={`rounded-full border px-4 py-2 text-caption transition-colors ${
                active
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-outline-variant bg-surface-container-lowest text-secondary hover:bg-surface-container-low'
              }`}
            >
              {c.short}
            </button>
          );
        })}
      </div>

      <h2 className="mt-6 text-headline-md text-on-surface">
        {category.name}
        {!loading && questions.length > 0 && (
          <span className="ml-2 text-body-md font-normal text-secondary">
            · {questions.length} vaka
          </span>
        )}
      </h2>

      {loading && (
        <div className="mt-8">
          <PageLoader />
        </div>
      )}

      {!loading && error && (
        <div className="mt-6">
          <ErrorBox message={error} onRetry={load} />
        </div>
      )}

      {!loading && !error && questions.length === 0 && (
        <div className="mt-8">
          <EmptyState
            icon="monitor_heart"
            title="Bu kategoride henüz vaka yok"
            description="Yeni vakalar eklendiğinde burada göreceksin."
          />
        </div>
      )}

      {!loading && current && (
        <>
          <div className="mb-4 mt-6 flex items-center gap-4">
            <ProgressBar value={index + 1} max={questions.length} className="flex-1" />
            <span className="whitespace-nowrap text-caption text-secondary">
              {solvedCount} doğru / {Object.keys(answers).length} cevap
            </span>
          </div>

          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-variant bg-surface-container px-6 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-body-lg font-semibold text-on-surface">
                  Vaka {index + 1} / {questions.length}
                </h2>
                <DifficultyChip difficulty={current.difficulty} showPoints />
                {current.isPremium && <PremiumChip />}
              </div>
              {current.alreadySolved && !answered && (
                <span className="flex items-center gap-1.5 text-caption text-secondary">
                  <Icon name="history" size={16} />
                  Daha önce doğru çözdün; tekrarı puan kazandırmaz.
                </span>
              )}
            </div>

            <div className="p-5 md:p-8">
              {/* EKG gorseli: sayfanin yildizi, en ustte ve genis */}
              <QuestionImage
                src={current.imageUrl}
                alt={current.imageAlt || 'EKG kaydı'}
                className="mb-6"
              />

              {/* Hastanin gelis hikayesi */}
              <RichText html={current.body} className="text-body-md text-on-surface" />

              <h3 className="mb-4 mt-8 flex items-center gap-2 text-headline-md text-on-surface">
                <Icon name="help" size={22} className="text-primary" />
                Hangi tanı?
              </h3>

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
                      name={`ekg-answer-${current.id}`}
                      className="mr-4 mt-1 border-outline text-primary focus:ring-primary"
                      checked={answered ? currentState.selectedOptionId === o.id : selected === o.id}
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

              {!answered ? (
                <div className="flex justify-center">
                  {user ? (
                    <button
                      type="button"
                      onClick={submitAnswer}
                      disabled={!selected || submitting}
                      className="btn-primary px-8 py-3"
                    >
                      {submitting ? <Spinner /> : <Icon name="task_alt" size={18} />}
                      Tanıyı Kontrol Et
                    </button>
                  ) : (
                    <Link to="/giris" state={{ from: '/ekg' }} className="btn-primary px-8 py-3">
                      <Icon name="login" size={18} />
                      Cevaplamak için giriş yap
                    </Link>
                  )}
                </div>
              ) : (
                <div
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
                    currentState.result.isCorrect
                      ? 'bg-success-container text-on-success-container'
                      : 'bg-error-container text-on-error-container'
                  }`}
                >
                  <Icon name={currentState.result.isCorrect ? 'check_circle' : 'cancel'} size={24} />
                  <div className="flex-1">
                    <div className="text-body-md font-semibold">
                      {currentState.result.isCorrect ? 'Doğru tanı!' : 'Yanlış tanı'}
                    </div>
                    <div className="text-caption">
                      Doğru şık: {currentState.result.correctOptionLabel}
                      {currentState.result.pointsAwarded > 0 &&
                        ` · +${currentState.result.pointsAwarded} puan`}
                    </div>
                  </div>
                </div>
              )}

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

          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="btn-outline"
            >
              <Icon name="arrow_back" size={18} />
              Önceki Vaka
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === questions.length - 1}
              className="btn-primary"
            >
              Sonraki Vaka
              <Icon name="arrow_forward" size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
