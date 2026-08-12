import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/ui';
import AdSlot from '../components/AdSlot';

/**
 * Basliktaki kisa ad. "Dr. Ayse Yilmaz" -> "Dr. Ayse"
 * (ilk kelime unvan ise tek basina anlamsiz kaliyor).
 */
function shortName(fullName = '') {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 1 && /\.$/.test(parts[0])) return `${parts[0]} ${parts[1]}`;
  return parts[0] || 'Üye';
}

const NAV = [
  { to: '/konular', label: 'Soru Bankası' },
  { to: '/kartlar', label: 'Flashcard' },
  { to: '/kitaplar', label: 'Konu Anlatımı' },
  { to: '/sinavlar', label: 'Denemeler' },
  { to: '/videolar', label: 'Videolar' },
  { to: '/hesaplayicilar', label: 'Hesaplayıcılar' },
];

/** Logo + isim. */
function BrandLink({ className = '' }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 ${className}`}>
      <img src="/logo-mark.png" alt="" className="h-10 w-10 shrink-0 object-contain" />
      <span className="leading-tight">
        <span className="block text-body-lg font-bold text-primary">10 Adımda</span>
        <span className="block text-caption font-semibold uppercase tracking-wider text-brand-navy">
          Kardiyoloji
        </span>
      </span>
    </Link>
  );
}

/** Mockup'taki TopAppBar: sabit, yari saydam, alt cizgili. */
function TopAppBar() {
  const { user, logout, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="fixed top-0 z-50 w-full border-b border-outline-variant/30 bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-container-max-width items-center justify-between px-margin-mobile md:px-margin-desktop">
        <BrandLink />

        <nav className="hidden gap-5 lg:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive
                  ? 'border-b-2 border-primary pb-1 font-bold text-primary'
                  : 'text-secondary transition-colors hover:text-primary-container'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-container-high"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary text-label-sm">
                  {user.fullName?.[0]?.toUpperCase() || 'K'}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-label-sm text-on-surface">
                    {shortName(user.fullName)}
                  </span>
                  <span className="block text-caption text-primary">{user.totalPoints} puan</span>
                </span>
                <Icon name="expand_more" size={18} className="text-secondary" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-surface-variant bg-surface-container-lowest shadow-level2">
                  <div className="border-b border-surface-variant px-4 py-3">
                    <div className="truncate text-body-md text-on-surface">{user.fullName}</div>
                    <div className="truncate text-caption text-secondary">{user.email}</div>
                  </div>
                  <Link to="/profil" className="flex items-center gap-2 px-4 py-2.5 hover:bg-surface-container-low">
                    <Icon name="person" size={18} /> Profilim
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" className="flex items-center gap-2 px-4 py-2.5 hover:bg-surface-container-low">
                      <Icon name="admin_panel_settings" size={18} /> Yönetim Paneli
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-error hover:bg-surface-container-low"
                  >
                    <Icon name="logout" size={18} /> Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/giris" className="btn-ghost hidden sm:inline-flex">
                Giriş Yap
              </Link>
              <Link to="/kayit" className="btn-primary">
                Ücretsiz Üye Ol
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="btn-ghost lg:hidden"
            aria-label="Menü"
          >
            <Icon name={menuOpen ? 'close' : 'menu'} size={24} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="flex flex-col border-t border-surface-variant bg-surface-container-lowest px-margin-mobile py-2 lg:hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-3 ${isActive ? 'bg-surface-container-high font-bold text-primary' : 'text-on-surface'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-16 w-full border-t border-outline-variant bg-surface-container-lowest">
      <div className="mx-auto grid max-w-container-max-width grid-cols-1 gap-gutter px-margin-mobile py-12 md:grid-cols-4 md:px-margin-desktop md:py-16">
        <div className="flex flex-col gap-3">
          <img src="/logo.png" alt="10 Adımda Kardiyoloji" className="h-24 w-auto self-start object-contain" />
          <p className="text-caption text-secondary">
            Kardiyoloji eğitiminde vaka temelli soru bankası, flashcard'lar, konu anlatımları,
            video dersler ve klinik hesaplayıcılar.
          </p>
          <p className="text-caption text-secondary">
            © {new Date().getFullYear()} 10 Adımda Kardiyoloji. Tüm hakları saklıdır.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-label-sm uppercase tracking-wider text-on-surface">İçerik</div>
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} className="text-caption text-secondary hover:text-primary">
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-label-sm uppercase tracking-wider text-on-surface">Kurumsal</div>
          <Link to="/hakkimizda" className="text-caption text-secondary hover:text-primary">
            Hakkımızda
          </Link>
          <Link to="/iletisim" className="text-caption text-secondary hover:text-primary">
            İletişim
          </Link>
          <Link to="/reklam" className="text-caption text-secondary hover:text-primary">
            Reklam Verin
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-label-sm uppercase tracking-wider text-on-surface">Yasal</div>
          <Link to="/kullanim-kosullari" className="text-caption text-secondary hover:text-primary">
            Kullanım Koşulları
          </Link>
          <Link to="/gizlilik" className="text-caption text-secondary hover:text-primary">
            Gizlilik Politikası
          </Link>
        </div>
      </div>
      <div className="border-t border-surface-variant px-margin-mobile py-4 text-center text-caption text-secondary md:px-margin-desktop">
        Bu sitedeki içerikler eğitim amaçlıdır; hasta tedavisinde güncel kılavuzlar esas alınmalıdır.
      </div>
    </footer>
  );
}

export default function SiteLayout() {
  return (
    <div className="flex min-h-screen flex-col pt-20">
      <TopAppBar />
      <AdSlot
        code="header"
        className="mx-auto w-full max-w-container-max-width px-margin-mobile pt-4 md:px-margin-desktop"
      />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
