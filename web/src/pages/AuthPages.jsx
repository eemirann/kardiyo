import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ErrorBox, Icon, Spinner } from '../components/ui';

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="mx-auto flex max-w-container-max-width justify-center px-margin-mobile py-8 md:px-margin-desktop md:py-16">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <h1 className="text-headline-lg-mobile text-on-surface md:text-headline-lg">{title}</h1>
          <p className="mt-2 text-body-md text-secondary">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <div className="mt-4 text-center text-body-md text-secondary">{footer}</div>
      </div>
    </div>
  );
}

/**
 * "Doğrulama bağlantısını yeniden gönder" düğmesi.
 * Hem kayıt sonrası bekleme ekranında hem de doğrulanmamış hesapla giriş
 * denendiğinde kullanılır.
 */
export function ResendVerification({ email }) {
  const { resendVerification } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const resend = async () => {
    setBusy(true);
    try {
      await resendVerification(email);
      setSent(true);
      toast.success('Bağlantı yeniden gönderildi', 'Gelen kutunu ve spam klasörünü kontrol et.');
    } catch (err) {
      toast.error('Gönderilemedi', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={resend} disabled={busy || sent} className="btn-outline w-full">
      {busy ? <Spinner /> : <Icon name="mail" size={18} />}
      {sent ? 'Gönderildi' : 'Bağlantıyı yeniden gönder'}
    </button>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setUnverified('');
    setBusy(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Hoş geldin, ${user.fullName.split(' ')[0]}!`);
      navigate(location.state?.from || '/konular', { replace: true });
    } catch (err) {
      setError(err.message);
      // Doğrulanmamış hesap: hatayla birlikte yeniden gönderme yolu sunulur
      if (err.code === 'EMAIL_NOT_VERIFIED') setUnverified(form.email);
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
        {unverified && <ResendVerification email={unverified} />}
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', password2: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Kayıt tamamlandığında forma değil, "e-postanı kontrol et" ekranına geçilir
  const [sentTo, setSentTo] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.password2) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    setBusy(true);
    try {
      const data = await register(form.fullName, form.email, form.password);
      setSentTo(data.email);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <AuthShell
        title="E-postanı Kontrol Et"
        subtitle={`${sentTo} adresine bir doğrulama bağlantısı gönderdik.`}
        footer={
          <>
            Yanlış adres mi girdin?{' '}
            <Link to="/kayit" onClick={() => setSentTo('')} className="text-primary hover:underline">
              Baştan dene
            </Link>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-lg bg-surface-container-low p-4">
            <Icon name="mark_email_unread" size={24} className="mt-0.5 shrink-0 text-primary" />
            <p className="text-body-md text-on-surface">
              Bağlantıya tıkladığında hesabın etkinleşir ve otomatik giriş yaparsın. Bağlantı 24
              saat geçerli. E-posta görünmüyorsa spam klasörünü kontrol et.
            </p>
          </div>
          <ResendVerification email={sentTo} />
          <Link to="/giris" className="text-center text-body-md text-primary hover:underline">
            Giriş ekranına dön
          </Link>
        </div>
      </AuthShell>
    );
  }

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
