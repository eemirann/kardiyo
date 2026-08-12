import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AdSlot from '../components/AdSlot';
import {
  EmptyState,
  ErrorBox,
  Icon,
  PageLoader,
  PremiumChip,
  ProgressBar,
  formatDuration,
} from '../components/ui';

/** YouTube/Vimeo linkinden gomulu oynatici adresi uretir. */
function embedUrl(video) {
  if (video.source === 'youtube') {
    const m = video.url?.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : null;
  }
  if (video.source === 'vimeo') {
    const m = video.url?.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : null;
  }
  return null;
}

export function VideosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const topic = searchParams.get('konu') || '';
  const [videos, setVideos] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/topics').then((d) => setTopics(d.topics)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/videos${topic ? `?topic=${topic}` : ''}`)
      .then((d) => {
        setVideos(d.videos);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [topic]);

  if (loading) return <PageLoader />;

  return (
    <div className="mx-auto max-w-container-max-width px-margin-mobile py-10 md:px-margin-desktop">
      <h1 className="text-headline-lg text-on-surface">Video Dersler</h1>
      <p className="mt-2 text-body-md text-secondary">
        Konu anlatımları ve pratik uygulamalar. Kaldığın yerden devam edebilirsin.
      </p>

      <div className="mt-6 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setSearchParams({})}
          className={`chip border ${
            !topic ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-secondary'
          }`}
        >
          Tümü
        </button>
        {topics.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSearchParams({ konu: t.slug })}
            className={`chip border ${
              topic === t.slug
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-outline-variant text-secondary hover:border-primary'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <ErrorBox message={error} />
      </div>

      {videos.length === 0 && !error ? (
        <div className="mt-8">
          <EmptyState icon="play_circle" title="Bu filtrede video yok" />
        </div>
      ) : (
        <div className="mt-8 grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <Link key={v.id} to={`/video/${v.id}`} className="card flex flex-col overflow-hidden transition-shadow hover:shadow-level2">
              <div className="relative flex aspect-video items-center justify-center bg-inverse-surface">
                {v.thumbnailUrl ? (
                  <img src={v.thumbnailUrl} alt={v.title} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <Icon name={v.locked ? 'lock' : 'play_circle'} size={48} className="text-inverse-on-surface" />
                )}
                {v.durationSeconds > 0 && (
                  <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-caption text-white">
                    {formatDuration(v.durationSeconds)}
                  </span>
                )}
                {v.isPremium && <PremiumChip className="absolute left-2 top-2" />}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h2 className="text-body-lg font-semibold text-on-surface">{v.title}</h2>
                {v.topicName && <div className="mt-1 text-caption text-secondary">{v.topicName}</div>}
                {v.description && (
                  <p className="mt-2 line-clamp-2 flex-1 text-body-md text-secondary">{v.description}</p>
                )}
                {v.completed ? (
                  <div className="mt-3 flex items-center gap-1.5 text-caption text-success">
                    <Icon name="check_circle" size={16} /> Tamamlandı
                  </div>
                ) : v.watchedSeconds > 0 && v.durationSeconds ? (
                  <ProgressBar value={v.watchedSeconds} max={v.durationSeconds} className="mt-3" />
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function VideoDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [video, setVideo] = useState(null);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const lastSent = useRef(0);

  useEffect(() => {
    api
      .get(`/videos/${id}`)
      .then((d) => setVideo(d.video))
      .catch((e) => setError(e.message));
  }, [id]);

  /** Ilerlemeyi en fazla 15 saniyede bir sunucuya yollar. */
  const reportProgress = (seconds, completed = false) => {
    if (!user) return;
    if (!completed && seconds - lastSent.current < 15) return;
    lastSent.current = seconds;
    api
      .post(`/videos/${id}/progress`, { watchedSeconds: Math.floor(seconds), completed })
      .then((res) => {
        if (res.newBadges?.length) toast.badges(res.newBadges);
      })
      .catch(() => {});
  };

  if (error)
    return (
      <div className="mx-auto max-w-container-max-width px-margin-mobile py-10 md:px-margin-desktop">
        <ErrorBox message={error} />
        {error.includes('premium') && (
          <p className="mt-4 text-body-md text-secondary">
            Bu içerik premium üyelere özel.{' '}
            <Link to="/iletisim" className="text-primary hover:underline">
              Premium hakkında bilgi al
            </Link>
          </p>
        )}
      </div>
    );
  if (!video) return <PageLoader />;

  const embed = embedUrl(video);

  return (
    <div className="mx-auto grid max-w-container-max-width gap-gutter px-margin-mobile py-10 md:grid-cols-[1fr_300px] md:px-margin-desktop">
      <div>
        <div className="overflow-hidden rounded-xl bg-inverse-surface">
          {/* 'file' = dogrudan mp4/webm baglantisi, 'upload' = R2'ye yuklenen dosya */}
          {(video.source === 'upload' || video.source === 'file') && video.url ? (
            <video
              ref={videoRef}
              src={video.url}
              controls
              className="aspect-video w-full"
              onTimeUpdate={(e) => reportProgress(e.target.currentTime)}
              onEnded={(e) => reportProgress(e.target.currentTime, true)}
            />
          ) : embed ? (
            <iframe
              src={embed}
              title={video.title}
              className="aspect-video w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex aspect-video items-center justify-center text-inverse-on-surface">
              Video kaynağı okunamadı.
            </div>
          )}
        </div>

        <h1 className="mt-5 text-headline-lg text-on-surface">{video.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-caption text-secondary">
          {video.topicName && <span className="chip bg-surface-container">{video.topicName}</span>}
          {video.durationSeconds > 0 && <span>{formatDuration(video.durationSeconds)}</span>}
          {video.completed && (
            <span className="flex items-center gap-1 text-success">
              <Icon name="check_circle" size={16} /> Tamamlandı
            </span>
          )}
        </div>
        {video.description && (
          <p className="mt-4 text-body-md leading-relaxed text-secondary">{video.description}</p>
        )}

        {/* Gomulu oynaticida ilerleme otomatik takip edilemedigi icin elle isaretleme */}
        {user && !video.completed && video.source !== 'upload' && (
          <button
            type="button"
            onClick={() => {
              reportProgress(video.durationSeconds || 1, true);
              setVideo({ ...video, completed: true });
              toast.success('Video tamamlandı olarak işaretlendi');
            }}
            className="btn-outline mt-5"
          >
            <Icon name="check" size={18} /> İzledim olarak işaretle
          </button>
        )}

        <AdSlot code="video_below" className="mt-8" />
      </div>

      <aside className="space-y-4">
        <div className="card p-4">
          <div className="text-label-sm uppercase tracking-wider text-secondary">Sonraki adım</div>
          <p className="mt-2 text-body-md text-secondary">
            Bu konuyu pekiştirmek için soru bankasına geç.
          </p>
          <Link
            to={video.topicSlug ? `/soru-bankasi/${video.topicSlug}` : '/konular'}
            className="btn-primary mt-3 w-full"
          >
            <Icon name="quiz" size={18} /> Soruları çöz
          </Link>
        </div>
        <AdSlot code="sidebar" />
      </aside>
    </div>
  );
}
