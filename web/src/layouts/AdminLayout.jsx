import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/ui';

const MENU = [
  { to: '/admin', end: true, icon: 'dashboard', label: 'Genel Bakış' },
  { to: '/admin/sorular', icon: 'quiz', label: 'Sorular' },
  { to: '/admin/konular', icon: 'category', label: 'Konular' },
  { to: '/admin/sinavlar', icon: 'timer', label: 'Sınavlar' },
  { to: '/admin/videolar', icon: 'play_circle', label: 'Videolar' },
  { to: '/admin/kartlar', icon: 'style', label: 'Flashcard' },
  { to: '/admin/kitaplar', icon: 'menu_book', label: 'Konu Anlatımı' },
  { to: '/admin/kullanicilar', icon: 'group', label: 'Kullanıcılar' },
  { to: '/admin/reklamlar', icon: 'campaign', label: 'Reklamlar' },
  { to: '/admin/rozetler', icon: 'military_tech', label: 'Rozetler' },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface-container-low">
      {/* Sol rail */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-surface-variant bg-surface-container-lowest transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-surface-variant px-5">
          <Link to="/" className="text-body-lg font-bold text-primary">
            10 Adımda Kardiyoloji
          </Link>
          <button type="button" className="lg:hidden" onClick={() => setOpen(false)} aria-label="Kapat">
            <Icon name="close" size={22} />
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {MENU.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              end={m.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  isActive
                    ? 'bg-primary/10 font-semibold text-primary'
                    : 'text-secondary hover:bg-surface-container-high'
                }`
              }
            >
              <Icon name={m.icon} size={20} />
              {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-surface-variant p-3">
          <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-secondary hover:bg-surface-container-high">
            <Icon name="arrow_back" size={20} /> Siteye dön
          </Link>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between border-b border-surface-variant bg-surface-container-lowest px-5">
          <button type="button" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Menü">
            <Icon name="menu" size={24} />
          </button>
          <div className="text-label-sm uppercase tracking-wider text-secondary">Yönetim Paneli</div>
          <div className="flex items-center gap-2 text-body-md text-on-surface">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary text-label-sm">
              {user.fullName[0].toUpperCase()}
            </span>
            <span className="hidden sm:block">{user.fullName}</span>
          </div>
        </header>
        <main className="p-5 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
