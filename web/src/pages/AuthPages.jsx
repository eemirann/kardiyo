import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ErrorBox, Icon, Spinner } from '../components/ui';

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="mx-auto flex max-w-container-max-width justify-center px-margin-mobile py-16 md:px-margin-desktop">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <h1 className="text-headline-lg text-on-surface">{title}</h1>
          <p className="mt-2 text-body-md text-secondary">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <div className="mt-4 text-center text-body-md text-secondary">{footer}</div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Hoş geldin, ${user.fullName.split(' ')[0]}!`);
      navigate(location.state?.from || '/konular', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Giriş Yap"
      subtitle="Kaldığın yerden devam et."
      footer={
        <>
          Hesabın yok mu?{' '}
          <Link to="/kayit" className="text-primary hover:underline">
            Ücretsiz üye ol
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <ErrorBox message={error} />
        <div>
          <label className="label" htmlFor="email">
            E-posta
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="ornek@eposta.com"
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Şifre
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            className="input"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
          />
        </div>
        <button type="submit" className="btn-primary py-3" disabled={busy}>
          {busy ? <Spinner /> : <Icon name="login" size={18} />}
          Giriş Yap
        </button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', password2: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.password2) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    setBusy(true);
    try {
      await register(form.fullName, form.email, form.password);
      toast.success('Hesabın oluşturuldu!', 'İlk soruyu çözerek ilk rozetini kazan.');
      navigate('/konular', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Ücretsiz Üye Ol"
      subtitle="Soru çözmeye hemen başla, puanların ve rozetlerin kaydedilsin."
      footer={
        <>
          Zaten üye misin?{' '}
          <Link to="/giris" className="text-primary hover:underline">
            Giriş yap
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <ErrorBox message={error} />
        <div>
          <label className="label" htmlFor="fullName">
            Ad Soyad
          </label>
          <input
            id="fullName"
            required
            minLength={2}
            autoComplete="name"
            className="input"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder="Dr. Ayşe Yılmaz"
          />
        </div>
        <div>
          <label className="label" htmlFor="remail">
            E-posta
          </label>
          <input
            id="remail"
            type="email"
            required
            autoComplete="email"
            className="input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="ornek@eposta.com"
          />
        </div>
        <div>
          <label className="label" htmlFor="rpassword">
            Şifre
          </label>
          <input
            id="rpassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="input"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="En az 8 karakter"
          />
        </div>
        <div>
          <label className="label" htmlFor="rpassword2">
            Şifre (tekrar)
          </label>
          <input
            id="rpassword2"
            type="password"
            required
            className="input"
            value={form.password2}
            onChange={(e) => setForm({ ...form, password2: e.target.value })}
          />
        </div>
        <button type="submit" className="btn-primary py-3" disabled={busy}>
          {busy ? <Spinner /> : <Icon name="person_add" size={18} />}
          Hesap Oluştur
        </button>
        <p className="text-caption text-secondary">
          Üye olarak{' '}
          <Link to="/kullanim-kosullari" className="text-primary hover:underline">
            Kullanım Koşulları
          </Link>{' '}
          ve{' '}
          <Link to="/gizlilik" className="text-primary hover:underline">
            Gizlilik Politikası
          </Link>
          'nı kabul etmiş olursun.
        </p>
      </form>
    </AuthShell>
  );
}
