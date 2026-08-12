import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Icon, PageLoader, ErrorBox, ProgressBar, EmptyState } from '../components/ui';

export default function TopicsPage() {
  const { user } = useAuth();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api
      .get('/topics')
      .then((d) => {
        // Soru bankasi sayfasi: sorusu olmayan konu bos sayfaya goturuyordu
        // (yalnizca videosu olan konular video sayfasinda listeleniyor)
        setTopics(d.topics.filter((t) => t.question_count > 0));
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <PageLoader />;

  return (
    <div className="mx-auto max-w-container-max-width px-margin-mobile py-10 md:px-margin-desktop">
      <h1 className="text-headline-lg text-on-surface">Soru Bankası Konuları</h1>
      <p className="mt-2 text-body-md text-secondary">
        Bir konu seç ve çözmeye başla. Her doğru cevap zorluğa göre 5–20 puan kazandırır.
      </p>

      <div className="mt-6">
        <ErrorBox message={error} onRetry={load} />
      </div>

      {topics.length === 0 && !error ? (
        <div className="mt-8">
          <EmptyState
            icon="quiz"
            title="Henüz konu eklenmemiş"
            description="Yönetici panelinden konu ve soru eklendiğinde burada görünecek."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((t) => (
            <Link
              key={t.id}
              to={`/soru-bankasi/${t.slug}`}
              className="card flex flex-col p-6 transition-shadow hover:shadow-level2"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon name={t.icon || 'cardiology'} size={24} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-body-lg font-semibold text-on-surface">{t.name}</h2>
                  <div className="mt-0.5 flex gap-3 text-caption text-secondary">
                    <span>{t.question_count} soru</span>
                    <span>{t.video_count} video</span>
                  </div>
                </div>
                <Icon name="chevron_right" size={20} className="text-secondary" />
              </div>

              {t.description && (
                <p className="mt-3 flex-1 text-body-md text-secondary">{t.description}</p>
              )}

              {user && t.question_count > 0 && (
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-caption text-secondary">
                    <span>İlerleme</span>
                    <span>
                      {t.solved_count}/{t.question_count}
                    </span>
                  </div>
                  <ProgressBar value={t.solved_count} max={t.question_count} />
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
