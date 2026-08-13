import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import AdSlot from '../components/AdSlot';
import { DifficultyChip, ErrorBox, Icon, PageLoader, QuestionImage, RichText } from '../components/ui';

export default function ExamResultPage() {
  const { sessionId } = useParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api
      .get(`/exams/sessions/${sessionId}/result`)
      .then((d) => setResult(d.result))
      .catch((e) => setError(e.message));
  }, [sessionId]);

  if (error)
    return (
      <div className="mx-auto max-w-container-max-width px-margin-mobile py-10 md:px-margin-desktop">
        <ErrorBox message={error} />
      </div>
    );
  if (!result) return <PageLoader label="Sonuçlar hesaplanıyor…" />;

  const shown = result.questions.filter((q) => {
    if (filter === 'wrong') return q.selectedOptionId && !q.isCorrect;
    if (filter === 'blank') return !q.selectedOptionId;
    if (filter === 'correct') return q.isCorrect;
    return true;
  });

  const scoreColor =
    result.score >= 70 ? 'text-success' : result.score >= 50 ? 'text-warning' : 'text-error';

  return (
    <div className="mx-auto max-w-container-max-width px-margin-mobile py-10 md:px-margin-desktop">
      {/* Skor karti */}
      <div className="card p-6 md:p-8">
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
          <div className="flex h-32 w-32 shrink-0 flex-col items-center justify-center rounded-full border-8 border-surface-container">
            <span className={`text-display-lg ${scoreColor}`}>{result.score}</span>
            <span className="text-caption text-secondary">/ 100</span>
          </div>
          <div className="flex-1">
            <h1 className="text-headline-lg text-on-surface">Sınav Sonucun</h1>
            <p className="mt-1 text-body-md text-secondary">
              {new Date(result.finishedAt).toLocaleString('tr-TR')} tarihinde tamamlandı
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: 'check_circle', label: 'Doğru', value: result.correctCount, cls: 'text-success' },
                { icon: 'cancel', label: 'Yanlış', value: result.wrongCount, cls: 'text-error' },
                { icon: 'radio_button_unchecked', label: 'Boş', value: result.blankCount, cls: 'text-secondary' },
                { icon: 'stars', label: 'Kazanılan puan', value: result.earnedPoints, cls: 'text-primary' },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-surface-container-low p-3 text-center">
                  <Icon name={s.icon} size={20} className={s.cls} />
                  <div className={`text-headline-md ${s.cls}`}>{s.value}</div>
                  <div className="text-caption text-secondary">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/sinavlar" className="btn-outline">
                <Icon name="arrow_back" size={18} /> Sınavlara dön
              </Link>
              <Link to="/profil" className="btn-primary">
                <Icon name="insights" size={18} /> İstatistiklerim
              </Link>
            </div>
          </div>
        </div>
      </div>

      <AdSlot code="question_bottom" className="mt-6" />

      {/* Soru analizi */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-headline-md text-on-surface">Soru Analizi</h2>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: 'all', label: `Tümü (${result.questions.length})` },
            { value: 'wrong', label: `Yanlış (${result.wrongCount})` },
            { value: 'blank', label: `Boş (${result.blankCount})` },
            { value: 'correct', label: `Doğru (${result.correctCount})` },
          ].map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`chip border ${
                filter === f.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-outline-variant text-secondary hover:border-primary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {shown.map((q, i) => (
          <div key={q.id} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-surface-variant bg-surface-container px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-body-md font-semibold text-on-surface">Soru {i + 1}</span>
                <DifficultyChip difficulty={q.difficulty} />
                {q.topicName && <span className="chip bg-surface-container-high text-secondary">{q.topicName}</span>}
              </div>
              <span
                className={`chip ${
                  q.isCorrect
                    ? 'bg-success-container text-on-success-container'
                    : q.selectedOptionId
                      ? 'bg-error-container text-on-error-container'
                      : 'bg-surface-container-high text-secondary'
                }`}
              >
                {q.isCorrect ? 'Doğru' : q.selectedOptionId ? 'Yanlış' : 'Boş'}
              </span>
            </div>
            <div className="p-5">
              <QuestionImage src={q.imageUrl} alt={q.imageAlt} className="mb-4" />
              <RichText html={q.body} className="mb-4 text-body-md text-on-surface" />
              <div className="flex flex-col gap-2">
                {q.options.map((o) => {
                  let cls = 'border-outline-variant text-secondary';
                  if (o.isCorrect) cls = 'border-success bg-success-container text-on-success-container';
                  else if (o.id === q.selectedOptionId)
                    cls = 'border-error bg-error-container text-on-error-container';
                  return (
                    <div key={o.id} className={`rounded-lg border px-4 py-2.5 text-body-md ${cls}`}>
                      <strong className="mr-2">{o.label})</strong>
                      {o.text}
                      {o.isCorrect && <Icon name="check_circle" size={18} className="float-right" />}
                      {!o.isCorrect && o.id === q.selectedOptionId && (
                        <Icon name="cancel" size={18} className="float-right" />
                      )}
                    </div>
                  );
                })}
              </div>
              {q.explanation && (
                <details className="mt-4 border-t border-surface-variant pt-4">
                  <summary className="flex cursor-pointer items-center gap-2 text-body-md font-semibold text-primary">
                    <Icon name="psychology" size={20} /> Ayrıntılı Çözüm
                  </summary>
                  <RichText
                    html={q.explanation}
                    className="mt-3 rounded-lg bg-surface-container-low p-4 text-body-md"
                  />
                </details>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
