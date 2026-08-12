import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { AdminHeader } from '../../components/admin';
import { ErrorBox, Icon, PageLoader, StatCard } from '../../components/ui';

const SHORTCUTS = [
  { to: '/admin/sorular', icon: 'add_circle', label: 'Yeni soru ekle' },
  { to: '/admin/videolar', icon: 'video_call', label: 'Video ekle' },
  { to: '/admin/sinavlar', icon: 'timer', label: 'Deneme sınavı oluştur' },
  { to: '/admin/reklamlar', icon: 'campaign', label: 'Reklam yönet' },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/stats')
      .then((d) => setStats(d.stats))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!stats) return <PageLoader />;

  const ctr = stats.ad_impressions_week
    ? ((stats.ad_clicks_week / stats.ad_impressions_week) * 100).toFixed(1)
    : '0.0';

  return (
    <div>
      <AdminHeader title="Genel Bakış" description="Son 7 günün özeti." />

      <div className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="group" label="Kullanıcı" value={stats.users} hint={`+${stats.new_users_week} bu hafta`} to="/admin/kullanicilar" />
        <StatCard icon="workspace_premium" label="Premium üye" value={stats.premium_users} to="/admin/kullanicilar" />
        <StatCard icon="quiz" label="Aktif soru" value={stats.questions} to="/admin/sorular" />
        <StatCard icon="play_circle" label="Video" value={stats.videos} to="/admin/videolar" />
        <StatCard icon="timer" label="Sınav" value={stats.exams} to="/admin/sinavlar" />
        <StatCard icon="trending_up" label="Cevap (7 gün)" value={stats.attempts_week} />
        <StatCard icon="visibility" label="Reklam gösterimi" value={stats.ad_impressions_week} hint="son 7 gün" to="/admin/reklamlar" />
        <StatCard icon="ads_click" label="Reklam tıklaması" value={stats.ad_clicks_week} hint={`CTR %${ctr}`} to="/admin/reklamlar" />
      </div>

      <h2 className="mb-4 mt-8 text-headline-md text-on-surface">Hızlı işlemler</h2>
      <div className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
        {SHORTCUTS.map((s) => (
          <Link key={s.to} to={s.to} className="card flex items-center gap-3 p-5 hover:shadow-level2">
            <Icon name={s.icon} size={24} className="text-primary" />
            <span className="text-body-md text-on-surface">{s.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
