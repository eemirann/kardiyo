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
 * EKG Quiz — gorsel odakli, iki asamali vaka sorulari.
 *
 * Sayfa iki gorunumden olusur:
 *   /ekg                -> kategori kartlari (soru bankasi konu listesiyle ayni duzen)
 *   /ekg?kategori=mi    -> o kategorinin vakalari
 * Secim adres cubugunda durdugu icin baglanti paylasilabilir ve geri tusu
 * kategoriler arasinda gezinir.
 *
 * Her vaka iki soru sorar: once "hangi tani?", cevaplandiktan sonra ayni EKG'nin
 * altinda "bu hastada ne yapilmali?". Ikinci soru sunucudan ancak birincinin
 * cevabiyla birlikte gelir (bkz. migrations/009_question_followup.sql): govdesi
 * dogru taniyi acikca yazdigi icin onceden gonderilseydi cevabi ele verirdi.
 *
 * Sorular soru bankasiyla ayni tabloda durur; cevaplama, puanlama ve rozetler
 * ayni uctan (/questions/:id/answer) geciyor.
 */
const CATEGORY_PARAM = 'kategori';
// Kategori basina 30 vaka var; API tek istekte en fazla 100 soru veriyor
// (api/routes/questions.js listSchema), yani tek istek yetiyor.
const PAGE_SIZE = 100;

export default function EkgQuizPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramCode = searchParams.get(CATEGORY_PARAM);
  const category = EKG_CATEGORIES.find((c) => c.code === paramCode) || null;

  const openCategory = (code) => {
    setSearchParams(code ? { [CATEGORY_PARAM]: code } : {});
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
            Hastanın geliş hikâyesini oku, EKG'yi yorumla, tanıyı koy, tedaviyi seç.
          </p>
        </div>
      </div>

      {category ? (
        <CategoryQuiz category={category} onBack={() => openCategory(null)} />
      ) : (
        <CategoryPicker onOpen={openCategory} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ kategoriler */

/**
 * Kategori kartlari. Sayi ve ilerleme /topics ucundan gelir; bu konular
 * /konular listesinde gizli oldugu icin slug listesiyle acikca isteniyor.
 */
function CategoryPicker({ onOpen }) {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const slugs = EKG_CATEGORIES.map((c) => ekgTopicSlug(c.code)).join(',');
    api
      .get(`/topics?slugs=${slugs}`)
      .then(({ topics }) => {
        setStats(Object.fromEntries(topics.map((t) => [t.slug, t])));
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (loading) return <div className="mt-8"><PageLoader /></div>;

  return (
    <>
      {error && (
        <div className="mt-6">
          <ErrorBox message={error} onRetry={load} />
        </div>
      )}

      <p className="mt-8 text-body-md text-secondary">
        Bir kategori seç ve çözmeye başla. Her vakada önce tanıyı, sonra klinik yaklaşımı sorar.
      </p>

      <div className="mt-5 grid gap-gutter sm:grid-cols-2">
        {EKG_CATEGORIES.map((c) => {
          const t = stats[ekgTopicSlug(c.code)];
          const total = t?.question_count ?? 0;
          const solved = t?.solved_count ?? 0;
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => onOpen(c.code)}
              className="card flex flex-col p-6 text-left transition-shadow hover:shadow-level2"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon name="monitor_heart" size={24} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-body-lg font-semibold text-on-surface">{c.name}</h2>
                  <div className="mt-0.5 text-caption text-secondary">{total} vaka</div>
                </div>
                <Icon name="chevron_right" size={20} className="text-secondary" />
              </div>

              {user && total > 0 && (
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-caption text-secondary">
                    <span>İlerleme</span>
                    <span>
                      {solved}/{total}
                    </span>
                  </div>
                  <ProgressBar value={solved} max={total} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------------ quiz */

function CategoryQuiz({ category, onBack }) {
  const { user, refreshUser } = useAuth();
  const toast = useToast();

  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Cevaplama durumu soru id'sine gore tutulur; bir vakada iki soru olabiliyor.
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [startedAt, setStartedAt] = useState(Date.now());

  const current = questions[index];
  const currentResult = current ? answers[current.id]?.result : null;
  // Ikinci asama sorusu ilk sorunun cevabiyla birlikte geldi
  const followUp = currentResult?.followUp || null;

  const load = useCallback(() => {
    setLoading(true);
    api
      .get(`/questions?topic=${ekgTopicSlug(category.code)}&limit=${PAGE_SIZE}`)
      .then(({ questions }) => {
        setQuestions(questions);
        setIndex(0);
        setAnswers({});
        setSelected({});
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [category.code]);

  useEffect(load, [load]);

  // Vaka degisince kronometre sifirlanir
  useEffect(() => {
    setStartedAt(Date.now());
  }, [index, current?.id]);

  const solvedCount = useMemo(
    () => Object.values(answers).filter((a) => a.result?.isCorrect).length,
    [answers]
  );
  const answeredCount = Object.keys(answers).length;

  const submitAnswer = async (question) => {
    const optionId = selected[question.id];
    if (!optionId || answers[question.id]) return;

    setSubmittingId(question.id);
    try {
      const result = await api.post(`/questions/${question.id}/answer`, {
        optionId,
        durationMs: Date.now() - startedAt,
      });
      setAnswers((prev) => ({ ...prev, [question.id]: { selectedOptionId: optionId, result } }));

      if (result.pointsAwarded > 0) toast.points(result.pointsAwarded);
      if (result.newBadges?.length) toast.badges(result.newBadges);
      if (result.pointsAwarded > 0 || result.newBadges?.length) refreshUser();
    } catch (err) {
      toast.error('Cevap kaydedilemedi', err.message);
    } finally {
      setSubmittingId(null);
    }
  };

  const goTo = (next) => {
    if (next < 0 || next >= questions.length) return;
    setIndex(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const questionProps = (question, step) => ({
    question,
    step,
    state: answers[question.id] || null,
    selectedId: selected[question.id] ?? null,
    onSelect: (optionId) => setSelected((prev) => ({ ...prev, [question.id]: optionId })),
    onSubmit: () => submitAnswer(question),
    submitting: submittingId === question.id,
    user,
  });

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 flex items-center gap-1 text-body-md text-primary"
      >
        <Icon name="arrow_back" size={18} />
        Tüm kategoriler
      </button>

      <h2 className="mt-3 text-headline-md text-on-surface">
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
              {solvedCount} doğru / {answeredCount} cevap
            </span>
          </div>

          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-variant bg-surface-container px-6 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-body-lg font-semibold text-on-surface">
                  Vaka {index + 1} / {questions.length}
                </h3>
                <DifficultyChip difficulty={current.difficulty} showPoints />
                {current.isPremium && <PremiumChip />}
              </div>
              {current.alreadySolved && !currentResult && (
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

              <QuestionStep {...questionProps(current, { no: 1, title: 'Hangi tanı?' })} />

              {/* Ikinci asama: ilk soru cevaplandiktan sonra ayni EKG'nin altinda */}
              {followUp && (
                <div className="mt-8 border-t border-surface-variant pt-8">
                  <QuestionStep
                    {...questionProps(followUp, { no: 2, title: 'Klinik yaklaşım nedir?' })}
                  />
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
    </>
  );
}

/* ------------------------------------------------------------------- tek adim */

/**
 * Bir vakanin tek asamasi: baslik, siklar, cevap kutusu ve cozum.
 * Iki asama da ayni bileseni kullaniyor; aralarindaki tek fark basliklari.
 */
function QuestionStep({ question, step, state, selectedId, onSelect, onSubmit, submitting, user }) {
  const answered = Boolean(state?.result);
  const result = state?.result || null;

  return (
    <>
      {/* Ilk adimda govde hikayeyi de tasiyor; ikincide yalnizca soru kokudur */}
      <RichText html={question.body} className="text-body-md text-on-surface" />

      <h4 className="mb-4 mt-8 flex items-center gap-2 text-headline-md text-on-surface">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-caption font-semibold text-primary">
          {step.no}
        </span>
        {step.title}
      </h4>

      <div className="mb-6 flex flex-col gap-3">
        {question.options.map((o) => (
          <label
            key={o.id}
            className={`flex cursor-pointer items-start rounded-lg border p-4 transition-colors ${optionClassFor(
              o,
              { selectedId, answer: state }
            )}`}
          >
            <input
              type="radio"
              name={`ekg-answer-${question.id}`}
              className="mr-4 mt-1 border-outline text-primary focus:ring-primary"
              checked={answered ? state.selectedOptionId === o.id : selectedId === o.id}
              disabled={answered}
              onChange={() => onSelect(o.id)}
            />
            <span className="flex-1 text-body-md">
              <strong className="mr-2">{o.label})</strong>
              {o.text}
            </span>
            {answered && o.id === result.correctOptionId && (
              <Icon name="check_circle" size={20} className="ml-2 shrink-0" />
            )}
            {answered && o.id === state.selectedOptionId && !result.isCorrect && (
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
              onClick={onSubmit}
              disabled={!selectedId || submitting}
              className="btn-primary px-8 py-3"
            >
              {submitting ? <Spinner /> : <Icon name="task_alt" size={18} />}
              {step.no === 1 ? 'Tanıyı Kontrol Et' : 'Cevabı Kontrol Et'}
            </button>
          ) : (
            <Link to="/giris" state={{ from: '/ekg' }} className="btn-primary px-8 py-3">
              <Icon name="login" size={18} />
              Cevaplamak için giriş yap
            </Link>
          )}
        </div>
      ) : (
        <>
          <div
            className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
              result.isCorrect
                ? 'bg-success-container text-on-success-container'
                : 'bg-error-container text-on-error-container'
            }`}
          >
            <Icon name={result.isCorrect ? 'check_circle' : 'cancel'} size={24} />
            <div className="flex-1">
              <div className="text-body-md font-semibold">
                {result.isCorrect
                  ? step.no === 1
                    ? 'Doğru tanı!'
                    : 'Doğru cevap!'
                  : step.no === 1
                    ? 'Yanlış tanı'
                    : 'Yanlış cevap'}
              </div>
              <div className="text-caption">
                Doğru şık: {result.correctOptionLabel}
                {result.pointsAwarded > 0 && ` · +${result.pointsAwarded} puan`}
              </div>
            </div>
          </div>

          {result.explanation && (
            <div className="mt-6 border-t border-surface-variant pt-6">
              <details className="group" open>
                <summary className="flex cursor-pointer list-none items-center justify-between">
                  <h5 className="flex items-center gap-2 text-headline-md text-primary">
                    <Icon name="psychology" size={24} />
                    Ayrıntılı Çözüm
                  </h5>
                  <Icon
                    name="expand_more"
                    size={22}
                    className="text-secondary transition-transform group-open:rotate-180"
                  />
                </summary>
                <RichText
                  html={result.explanation}
                  className="mt-4 rounded-lg bg-surface-container-low p-5 text-body-md text-on-surface"
                />
              </details>
            </div>
          )}
        </>
      )}
    </>
  );
}
