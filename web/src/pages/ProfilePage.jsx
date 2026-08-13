import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AdSlot from '../components/AdSlot';
import {
  DifficultyChip,
  ErrorBox,
  Icon,
  PageLoader,
  ProgressBar,
  StatCard,
  formatDate,
} from '../components/ui';

const TABS = [
  { id: 'stats', label: 'İstatistikler', icon: 'insights' },
  { id: 'badges', label: 'Rozetler', icon: 'military_tech' },
  { id: 'history', label: 'Geçmiş', icon: 'history' },
  { id: 'settings', label: 'Ayarlar', icon: 'settings' },
];

export default function ProfilePage() {
  const { user, isPremium } = useAuth();
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [badges, setBadges] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/me/stats'), api.get('/me/badges'), api.get('/me/history')])
      .then(([s, b, h]) => {
        setStats(s);
        setBadges(b.badges);
        setHistory(h.history);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error)
    return (
      <div className="mx-auto max-w-container-max-width px-margin-mobile py-6 md:py-10 md:px-margin-desktop">
        <ErrorBox message={error} />
      </div>
    );
  if (!stats) return <PageLoader />;

  const earnedBadges = badges.filter((b) => b.earned);

  return (
    <div className="mx-auto max-w-container-max-width px-margin-mobile py-6 md:py-10 md:px-margin-desktop">
      {/* Ust profil karti */}
      <div className="card flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-headline-lg text-on-primary">
          {user.fullName[0].toUpperCase()}
        </span>
        <div className="flex-1">
          <h1 className="text-headline-lg-mobile text-on-surface md:text-headline-lg">{user.fullName}</h1>
          <p className="text-body-md text-secondary">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="chip bg-primary/10 text-primary">
              <Icon name="stars" size={14} /> {stats.totalPoints} puan
            </span>
            <span className="chip bg-surface-container text-secondary">
              <Icon name="military_tech" size={14} /> {earnedBadges.length} rozet
            </span>
            {isPremium ? (
              <span className="chip bg-primary text-on-primary">
                <Icon name="workspace_premium" size={14} /> Premium üye
              </span>
            ) : (
              <span className="chip bg-surface-container text-secondary">Ücretsiz üye</span>
            )}
            <span className="chip bg-surface-container text-secondary">
              Üyelik: {formatDate(user.createdAt)}
            </span>
          </div>
        </div>
        <Link to="/siralama" className="btn-outline">
          <Icon name="leaderboard" size={18} /> Sıralamadaki yerim
        </Link>
      </div>

      {/* Sekmeler */}
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-surface-variant">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 whitespace-nowrap px-4 py-3 text-label-sm transition-colors ${
              tab === t.id
                ? 'border-b-2 border-primary font-bold text-primary'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <Icon name={t.icon} size={18} /> {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-gutter lg:grid-cols-[1fr_300px]">
        <div>
          {tab === 'stats' && <StatsTab stats={stats} />}
          {tab === 'badges' && <BadgesTab badges={badges} />}
          {tab === 'history' && <HistoryTab history={history} />}
          {tab === 'settings' && <SettingsTab />}
        </div>
        <aside className="space-y-4">
          <AdSlot code="sidebar" />
        </aside>
      </div>
    </div>
  );
}

function StatsTab({ stats }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="stars" label="Toplam puan" value={stats.totalPoints} hint={`Bu hafta +${stats.weekPoints}`} />
        <StatCard icon="quiz" label="Çözülen soru" value={stats.solvedQuestions} hint={`${stats.totalAttempts} deneme`} />
        <StatCard icon="target" label="Doğruluk" value={`%${stats.accuracy}`} hint={`${stats.correctAttempts} doğru`} />
        <StatCard icon="timer" label="Bitirilen sınav" value={stats.finishedExams} hint={`Ort. ${stats.averageExamScore}`} />
      </div>

      <div className="card p-6">
        <h2 className="text-headline-md text-on-surface">Konu Bazlı Performans</h2>
        <div className="mt-5 space-y-5">
          {stats.topics.map((t) => (
            <div key={t.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <Link
                  to={`/soru-bankasi/${t.slug}`}
                  className="min-w-0 truncate text-body-md text-on-surface hover:text-primary"
                >
                  {t.name}
                </Link>
                <span className="whitespace-nowrap text-caption text-secondary">
                  {t.solved}/{t.totalQuestions} soru · {t.attempts > 0 ? `%${t.accuracy} doğruluk` : 'henüz deneme yok'}
                </span>
              </div>
              <ProgressBar value={t.solved} max={t.totalQuestions || 1} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BadgesTab({ badges }) {
  return (
    <div className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
      {badges.map((b) => (
        <div
          key={b.code}
          className={`card flex gap-4 p-5 ${b.earned ? '' : 'opacity-60 grayscale'}`}
        >
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
              b.earned ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary'
            }`}
          >
            <Icon name={b.icon} size={26} filled={b.earned} />
          </span>
          <div className="min-w-0">
            <div className="text-body-lg font-semibold text-on-surface">{b.name}</div>
            <p className="mt-0.5 text-caption text-secondary">{b.description}</p>
            <div className="mt-2 text-caption text-primary">
              {b.earned ? `Kazanıldı · ${formatDate(b.earnedAt)}` : 'Henüz kazanılmadı'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryTab({ history }) {
  if (history.length === 0)
    return <p className="card p-8 text-center text-body-md text-secondary">Henüz cevap geçmişin yok.</p>;

  return (
    <div className="card divide-y divide-surface-variant">
      {history.map((h) => (
        <div key={h.id} className="flex items-start gap-3 p-4">
          <Icon
            name={h.isCorrect ? 'check_circle' : 'cancel'}
            size={22}
            className={h.isCorrect ? 'text-success' : 'text-error'}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/soru-bankasi/${h.topicSlug}`} className="text-body-md text-on-surface hover:text-primary">
                {h.topicName}
              </Link>
              <DifficultyChip difficulty={h.difficulty} />
              {h.inExam && <span className="chip bg-surface-container text-secondary">Sınav</span>}
            </div>
            <p
              className="mt-1 line-clamp-2 text-caption text-secondary"
              dangerouslySetInnerHTML={{ __html: h.excerpt }}
            />
          </div>
          <div className="whitespace-nowrap text-right">
            {h.pointsAwarded > 0 && <div className="text-body-md text-primary">+{h.pointsAwarded}</div>}
            <div className="text-caption text-secondary">
              {new Date(h.createdAt).toLocaleDateString('tr-TR')}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingsTab() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(user.fullName);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', repeat: '' });
  const [busy, setBusy] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.patch('/me/profile', { fullName });
      setUser({ ...user, fullName: res.user.full_name });
      toast.success('Profil güncellendi');
    } catch (err) {
      toast.error('Güncellenemedi', err.message);
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.newPassword !== pw.repeat) {
      toast.error('Şifreler eşleşmiyor');
      return;
    }
    setBusy(true);
    try {
      await api.post('/me/password', {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword,
      });
      setPw({ currentPassword: '', newPassword: '', repeat: '' });
      toast.success('Şifren değiştirildi', 'Diğer cihazlardaki oturumların kapatıldı.');
    } catch (err) {
      toast.error('Şifre değiştirilemedi', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={saveProfile} className="card space-y-4 p-6">
        <h2 className="text-headline-md text-on-surface">Profil Bilgileri</h2>
        <div>
          <label className="label" htmlFor="pname">Ad Soyad</label>
          <input id="pname" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} minLength={2} required />
        </div>
        <div>
          <label className="label" htmlFor="pemail">E-posta</label>
          <input id="pemail" className="input opacity-60" value={user.email} disabled />
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>Kaydet</button>
      </form>

      <form onSubmit={changePassword} className="card space-y-4 p-6">
        <h2 className="text-headline-md text-on-surface">Şifre Değiştir</h2>
        <div>
          <label className="label" htmlFor="cpw">Mevcut şifre</label>
          <input id="cpw" type="password" className="input" required
            value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="npw">Yeni şifre</label>
          <input id="npw" type="password" className="input" required minLength={8}
            value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="rpw">Yeni şifre (tekrar)</label>
          <input id="rpw" type="password" className="input" required
            value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} />
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>Şifreyi Değiştir</button>
      </form>
    </div>
  );
}
