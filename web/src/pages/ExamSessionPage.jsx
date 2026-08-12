import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ErrorBox, Icon, PageLoader, RichText, Spinner } from '../components/ui';

/** Sinav ekrani: geri sayim, soru navigasyonu, otomatik kaydetme. */
export default function ExamSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshUser } = useAuth();

  const [session, setSession] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/exams/sessions/${sessionId}`)
      .then((d) => {
        if (cancelled) return;
        if (d.session.finished) {
          navigate(`/sinav/${sessionId}/sonuc`, { replace: true });
          return;
        }
        setSession(d.session);
        setAnswers(
          Object.fromEntries(
            d.session.questions
              .filter((q) => q.selectedOptionId)
              .map((q) => [q.id, q.selectedOptionId])
          )
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate]);

  const finish = useCallback(
    async (auto = false) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setFinishing(true);
      try {
        const res = await api.post(`/exams/sessions/${sessionId}/finish`);
        if (res.newBadges?.length) toast.badges(res.newBadges);
        refreshUser();
        if (auto) toast.error('Süre doldu', 'Sınavın otomatik olarak tamamlandı.');
        navigate(`/sinav/${sessionId}/sonuc`, { replace: true });
      } catch (err) {
        finishedRef.current = false;
        toast.error('Sınav tamamlanamadı', err.message);
      } finally {
        setFinishing(false);
      }
    },
    [sessionId, navigate, toast, refreshUser]
  );

  // Geri sayim; bitis zamani sunucudan gelir
  useEffect(() => {
    if (!session) return undefined;
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(session.expiresAt) - Date.now()) / 1000));
      setRemaining(secs);
      if (secs === 0) finish(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session, finish]);

  const selectOption = async (questionId, optionId) => {
    const next = answers[questionId] === optionId ? null : optionId;
    setAnswers((prev) => {
      const copy = { ...prev };
      if (next === null) delete copy[questionId];
      else copy[questionId] = next;
      return copy;
    });
    try {
      await api.post(`/exams/sessions/${sessionId}/answer`, { questionId, optionId: next });
    } catch (err) {
      toast.error('Cevap kaydedilemedi', err.message);
    }
  };

  if (loading) return <PageLoader label="Sınav hazırlanıyor…" />;
  if (error)
    return (
      <div className="mx-auto max-w-container-max-width px-margin-mobile py-10 md:px-margin-desktop">
        <ErrorBox message={error} />
      </div>
    );
  if (!session) return null;

  const q = session.questions[index];
  const answeredCount = Object.keys(answers).length;
  const lowTime = remaining <= 60;

  return (
    <div className="mx-auto flex max-w-container-max-width flex-col gap-gutter px-margin-mobile py-8 md:flex-row md:px-margin-desktop">
      <section className="min-w-0 flex-1">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-surface-variant bg-surface-container px-6 py-4">
            <div>
              <div className="text-label-sm uppercase tracking-wider text-secondary">
                {session.examTitle}
              </div>
              <div className="text-body-lg font-semibold text-on-surface">
                Soru {index + 1} / {session.questions.length}
              </div>
            </div>
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                lowTime ? 'bg-error text-on-error' : 'bg-surface-container-lowest text-on-surface'
              }`}
            >
              <Icon name="timer" size={20} />
              <span className="text-body-lg font-semibold">
                {String(Math.floor(remaining / 60)).padStart(2, '0')}:
                {String(remaining % 60).padStart(2, '0')}
              </span>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <RichText html={q.body} className="mb-6 text-body-md text-on-surface" />
            <div className="flex flex-col gap-3">
              {q.options.map((o) => (
                <label
                  key={o.id}
                  className={`flex cursor-pointer items-start rounded-lg border p-4 transition-colors ${
                    answers[q.id] === o.id
                      ? 'border-primary bg-primary/5'
                      : 'border-outline-variant hover:bg-surface-container-low'
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    className="mr-4 mt-1 border-outline text-primary focus:ring-primary"
                    checked={answers[q.id] === o.id}
                    onChange={() => selectOption(q.id, o.id)}
                  />
                  <span className="flex-1 text-body-md text-on-surface">
                    <strong className="mr-2">{o.label})</strong>
                    {o.text}
                  </span>
                </label>
              ))}
            </div>
            {answers[q.id] && (
              <button
                type="button"
                onClick={() => selectOption(q.id, answers[q.id])}
                className="mt-3 text-caption text-secondary hover:text-primary"
              >
                Cevabı temizle (boş bırak)
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="btn-outline"
          >
            <Icon name="arrow_back" size={18} /> Önceki
          </button>
          {index < session.questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="btn-outline border-primary text-primary"
            >
              Sonraki <Icon name="arrow_forward" size={18} />
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmOpen(true)} className="btn-primary">
              <Icon name="done_all" size={18} /> Sınavı Bitir
            </button>
          )}
        </div>
      </section>

      {/* Sag panel: soru izgarasi */}
      <aside className="w-full shrink-0 md:w-64">
        <div className="card p-4 md:sticky md:top-24">
          <div className="mb-3 text-label-sm uppercase tracking-wider text-secondary">
            Soru Durumu
          </div>
          <div className="grid grid-cols-6 gap-2 md:grid-cols-5">
            {session.questions.map((question, i) => (
              <button
                key={question.id}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-9 rounded-lg text-label-sm transition-colors ${
                  answers[question.id]
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-secondary hover:bg-surface-container-high'
                } ${i === index ? 'ring-2 ring-primary ring-offset-2' : ''}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-4 border-t border-surface-variant pt-3 text-caption text-secondary">
            Cevaplanan: <strong className="text-on-surface">{answeredCount}</strong> /{' '}
            {session.questions.length}
          </div>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="btn-primary mt-4 w-full py-3"
          >
            Sınavı Bitir
          </button>
        </div>
      </aside>

      {confirmOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-level2">
            <h3 className="text-headline-md text-on-surface">Sınavı bitirmek istiyor musun?</h3>
            <p className="mt-2 text-body-md text-secondary">
              {session.questions.length - answeredCount > 0
                ? `${session.questions.length - answeredCount} soru boş kalacak. `
                : 'Tüm soruları cevapladın. '}
              Bitirdikten sonra cevaplarını değiştiremezsin.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmOpen(false)} className="btn-outline">
                Devam et
              </button>
              <button
                type="button"
                onClick={() => finish(false)}
                disabled={finishing}
                className="btn-primary"
              >
                {finishing ? <Spinner /> : <Icon name="done_all" size={18} />}
                Bitir ve sonucu gör
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
