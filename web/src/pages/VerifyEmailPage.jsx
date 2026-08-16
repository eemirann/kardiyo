import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Icon, PageLoader } from '../components/ui';
import { ResendVerification } from './AuthPages';

/**
 * E-postadaki dogrulama baginin indigi sayfa (/eposta-dogrula?token=...).
 *
 * Token gecerliyse sunucu ayni istekte oturumu da acar, bu yuzden kullanici
 * giris ekranina ugramadan dogrudan icerige gider. Bag gecersiz/suresi dolmus
 * ise yeniden gonderme yolu sunulur.
 */
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const { verifyEmail } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const token = params.get('token');
  const [error, setError] = useState('');
  // React 18 gelistirme modunda effect iki kez kosuyor; token tek kullanimlik
  // oldugu icin ikinci istek "gecersiz bag" hatasi verirdi.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!token) {
      setError('Bağlantı eksik görünüyor. E-postadaki bağlantıyı olduğu gibi açtığından emin ol.');
      return;
    }

    verifyEmail(token)
      .then((user) => {
        toast.success(`Hoş geldin, ${user.fullName.split(' ')[0]}!`, 'Hesabın etkinleşti.');
        navigate('/konular', { replace: true });
      })
      .catch((err) =>
        // Beklenen durum icin arayuzun dilinde bir metin; digerlerinde sunucununki
        setError(
          err.code === 'INVALID_TOKEN'
            ? 'Bu bağlantı geçersiz ya da süresi dolmuş.'
            : err.message
        )
      );
  }, [token, verifyEmail, toast, navigate]);

  if (!error) return <PageLoader label="E-postan doğrulanıyor…" />;

  return (
    <div className="mx-auto flex max-w-container-max-width justify-center px-margin-mobile py-8 md:px-margin-desktop md:py-16">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="flex items-start gap-3">
            <Icon name="link_off" size={28} className="mt-0.5 shrink-0 text-error" />
            <div>
              <h1 className="text-headline-lg-mobile text-on-surface md:text-headline-lg">
                Bağlantı Çalışmadı
              </h1>
              <p className="mt-2 text-body-md text-secondary">{error}</p>
            </div>
          </div>
          <p className="mt-6 text-body-md text-on-surface">
            Bağlantılar 24 saat geçerlidir ve yalnızca bir kez kullanılabilir. Yeni bir bağlantı
            istemek için e-posta adresini gir.
          </p>
          <ResendVerificationByEmail />
          <Link
            to="/giris"
            className="mt-4 block text-center text-body-md text-primary hover:underline"
          >
            Giriş ekranına dön
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Adres bilinmedigi icin once e-postayi sorar, sonra yeniden gonderme dugmesini acar. */
function ResendVerificationByEmail() {
  const [email, setEmail] = useState('');
  const [confirmed, setConfirmed] = useState('');

  if (confirmed) {
    return (
      <div className="mt-6">
        <ResendVerification email={confirmed} />
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setConfirmed(email.trim());
      }}
      className="mt-6 flex flex-col gap-3"
    >
      <label className="label" htmlFor="verify-email">
        E-posta
      </label>
      <input
        id="verify-email"
        type="email"
        required
        autoComplete="email"
        className="input"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="ornek@eposta.com"
      />
      <button type="submit" className="btn-primary py-3">
        <Icon name="mail" size={18} />
        Yeni bağlantı iste
      </button>
    </form>
  );
}
