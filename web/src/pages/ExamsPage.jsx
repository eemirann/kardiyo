import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { EmptyState, ErrorBox, Icon, PageLoader, PremiumChip, Spinner } from '../components/ui';

export default function ExamsPage() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startingId, setStartingId] = useState(null);
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api
      .get('/exams')
      .then((d) => {
        setExams(d.exams);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  /**
   * Denemeler alt kategorilerine gore gruplanir; kategorisi olmayanlar en sona
   * "Diger denemeler" basligi altina duser. API zaten sort_order'a gore sirali
   * dondugu icin hem gruplarin hem de icindeki denemelerin sirasi korunur.
   */
  const groups = [];
  for (const exam of exams) {
    const name = exam.category || 'Diğer denemeler';
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.exams.push(exam);
    else {
      const existing = groups.find((g) => g.name === name);
      if (existing) existing.exams.push(exam);
      else groups.push({ name, exams: [exam] });
    }
  }

  const start = async (exam) => {
    if (!user) {
      navigate('/giris', { state: { from: '/sinavlar' } });
      return;
    }
    setStartingId(exam.id);
    try {
      const { session } = await api.post(`/exams/${exam.id}/start`);
      navigate(`/sinav/${session.id}`);
    } catch (err) {
      toast.error('Sınav başlatılamadı', err.message);
    } finally {
      setStartingId(null);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="mx-auto max-w-container-max-width px-margin-mobile py-10 md:px-margin-desktop">
      <h1 className="text-headline-lg text-on-surface">Deneme Sınavları</h1>
      <p className="mt-2 text-body-md text-secondary">
        Süreli, gerçek sınav temposunda çalış. Bitirdiğinde skor kartın ve yanlış analizin hazır olur.
      </p>

      <div className="mt-6">
        <ErrorBox message={error} onRetry={load} />
      </div>

      {exams.length === 0 && !error ? (
        <div className="mt-8">
          <EmptyState
            icon="timer"
            title="Henüz deneme sınavı yok"
            description="Yönetici panelinden sınav oluşturulduğunda burada listelenecek."
          />
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.name} className="mt-10 first:mt-8">
            <div className="flex items-baseline gap-3 border-b border-surface-variant pb-2">
              <h2 className="text-headline-md text-on-surface">{g.name}</h2>
              <span className="text-caption text-secondary">{g.exams.length} deneme</span>
            </div>
            <div className="mt-5 grid gap-gutter md:grid-cols-2 lg:grid-cols-3">
              {g.exams.map((e) => (
            <div key={e.id} className="card flex flex-col p-6">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-body-lg font-semibold text-on-surface">{e.title}</h2>
                {e.isPremium && <PremiumChip />}
              </div>
              {e.description && <p className="mt-2 flex-1 text-body-md text-secondary">{e.description}</p>}

              <div className="mt-4 flex flex-wrap gap-4 text-caption text-secondary">
                <span className="flex items-center gap-1">
                  <Icon name="quiz" size={16} /> {e.questionCount} soru
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="timer" size={16} /> {e.durationMinutes} dk
                </span>
                {e.topicName && (
                  <span className="flex items-center gap-1">
                    <Icon name="category" size={16} /> {e.topicName}
                  </span>
                )}
              </div>

              {e.bestScore !== null && e.bestScore !== undefined && (
                <div className="mt-3 rounded-lg bg-surface-container-low px-3 py-2 text-caption text-secondary">
                  En iyi skorun: <strong className="text-primary">{e.bestScore}</strong>/100
                </div>
              )}

              <button
                type="button"
                onClick={() => start(e)}
                disabled={startingId === e.id}
                className="btn-primary mt-5 py-3"
              >
                {startingId === e.id ? <Spinner /> : <Icon name="play_arrow" size={18} />}
                Sınava Başla
              </button>
            </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
