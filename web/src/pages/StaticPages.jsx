import { Link } from 'react-router-dom';
import { Icon } from '../components/ui';

function Page({ title, lead, children }) {
  return (
    <div className="mx-auto max-w-3xl px-margin-mobile py-8 md:px-margin-desktop md:py-12">
      <h1 className="text-headline-lg-mobile text-on-surface md:text-headline-lg">{title}</h1>
      {lead && <p className="mt-3 text-body-lg text-secondary">{lead}</p>}
      <div className="prose-clinical mt-8 text-body-md text-on-surface">{children}</div>
    </div>
  );
}

export function AboutPage() {
  return (
    <Page
      title="Hakkımızda"
      lead="10 Adımda Kardiyoloji, kardiyoloji eğitimini vaka temelli ve ölçülebilir hale getirmek için kuruldu."
    >
      <p>
        Platformumuz; güncel kılavuzlara dayalı soru bankası, ayrıntılı çözümler, video dersler ve
        süreli deneme sınavlarını tek çatı altında toplar. Amacımız, öğrenmeyi pasif okuma yerine
        aktif problem çözme üzerine kurmak.
      </p>
      <h3>Nasıl çalışıyor?</h3>
      <ul>
        <li>Her soru, patofizyolojik gerekçesi ve çalışma referanslarıyla birlikte açıklanır.</li>
        <li>Doğru cevaplar zorluğa göre puan kazandırır; ilerleme rozetlerle takip edilir.</li>
        <li>Konu bazlı doğruluk oranın, zayıf olduğun alanları net biçimde gösterir.</li>
      </ul>
      <p className="text-secondary">
        İçerikler eğitim amaçlıdır ve hasta tedavisinde güncel kılavuzların yerini almaz.
      </p>
    </Page>
  );
}

export function ContactPage() {
  return (
    <Page title="İletişim" lead="Soru, öneri, iş birliği ve premium üyelik talepleri için bize ulaşın.">
      <div className="not-prose grid gap-gutter sm:grid-cols-2">
        <div className="card p-6">
          <Icon name="mail" size={24} className="text-primary" />
          <h3 className="mt-3 text-body-lg font-semibold">E-posta</h3>
          <a href="mailto:10adimdacarido@gmail.com" className="text-body-md text-primary hover:underline">
            10adimdacarido@gmail.com
          </a>
        </div>
        <div className="card p-6">
          <Icon name="workspace_premium" size={24} className="text-primary" />
          <h3 className="mt-3 text-body-lg font-semibold">Premium üyelik</h3>
          <p className="text-body-md text-secondary">
            Premium erişim talebini e-posta ile ilet; hesabın yönetici tarafından yükseltilir.
          </p>
        </div>
      </div>
    </Page>
  );
}

export function AdvertisePage() {
  return (
    <Page
      title="Reklam Verin"
      lead="Kardiyoloji alanında çalışan hekim ve öğrencilerden oluşan odaklı bir kitleye ulaşın."
    >
      <h3>Reklam alanlarımız</h3>
      <ul>
        <li><strong>Üst banner (728×90):</strong> Tüm sayfalarda, başlık altında.</li>
        <li><strong>Sağ kolon (300×250):</strong> Soru çözme, video ve profil sayfalarında sabit.</li>
        <li><strong>Soru altı:</strong> Soru kartının hemen altında, yüksek görünürlük.</li>
        <li><strong>Video altı:</strong> Video izleme sayfasında oynatıcının altında.</li>
      </ul>
      <p>
        Her kampanya için gösterim ve tıklama sayıları raporlanır. Başlangıç ve bitiş tarihi
        belirleyebilir, aynı alanda birden fazla banner'ı ağırlıklı olarak dönüştürebilirsiniz.
      </p>
      <p>
        Teklif için{' '}
        <a href="mailto:10adimdacarido@gmail.com" className="text-primary hover:underline">
          10adimdacarido@gmail.com
        </a>{' '}
        adresine yazın.
      </p>
    </Page>
  );
}

export function TermsPage() {
  return (
    <Page title="Kullanım Koşulları" lead="Son güncelleme: 11 Ağustos 2026">
      <h3>1. Hizmetin kapsamı</h3>
      <p>
        10 Adımda Kardiyoloji, tıp eğitimi amacıyla soru bankası, video ders ve deneme sınavı hizmeti sunar.
        İçerikler bilgilendirme amaçlıdır; tanı ve tedavi kararlarında tek başına dayanak alınamaz.
      </p>
      <h3>2. Hesap</h3>
      <p>
        Hesap bilgilerinin gizliliğinden kullanıcı sorumludur. Hesabın paylaşılması, içeriklerin
        kopyalanması veya izinsiz dağıtılması durumunda hesap askıya alınabilir.
      </p>
      <h3>3. İçerik hakları</h3>
      <p>
        Sitedeki tüm sorular, çözümler ve videolar 10 Adımda Kardiyoloji'ye aittir; izinsiz çoğaltılamaz.
      </p>
      <h3>4. Premium üyelik</h3>
      <p>
        Premium üyelik, premium işaretli içeriklere erişim ve reklamsız kullanım sağlar. Üyelik
        süresi dolduğunda hesap otomatik olarak ücretsiz üyeliğe döner.
      </p>
      <h3>5. Değişiklikler</h3>
      <p>Koşullarda değişiklik yapılması hâlinde bu sayfa güncellenir.</p>
    </Page>
  );
}

export function PrivacyPage() {
  return (
    <Page title="Gizlilik Politikası" lead="Son güncelleme: 11 Ağustos 2026">
      <h3>Hangi verileri topluyoruz?</h3>
      <ul>
        <li>Hesap bilgileri: ad soyad, e-posta adresi ve şifrenizin geri döndürülemez özeti (hash).</li>
        <li>Kullanım verileri: çözdüğünüz sorular, cevaplarınız, puan ve rozetleriniz, izlediğiniz videolar.</li>
        <li>Reklam ölçümü: reklam gösterim ve tıklama sayıları.</li>
      </ul>
      <h3>Verileri neden işliyoruz?</h3>
      <p>
        İlerlemenizi kaydetmek, istatistik ve sıralama üretmek, hizmeti geliştirmek ve reklam
        performansını ölçmek için.
      </p>
      <h3>Çerezler</h3>
      <p>
        Oturumunuzu açık tutmak için httpOnly bir oturum çerezi kullanırız. Reklam sağlayıcıları
        (ör. Google AdSense) kendi çerezlerini kullanabilir.
      </p>
      <h3>Haklarınız</h3>
      <p>
        Hesabınıza ait verilerin silinmesini{' '}
        <a href="mailto:10adimdacarido@gmail.com" className="text-primary hover:underline">
          10adimdacarido@gmail.com
        </a>{' '}
        adresinden talep edebilirsiniz.
      </p>
    </Page>
  );
}

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-container-max-width flex-col items-center px-margin-mobile py-14 text-center md:py-24 md:px-margin-desktop">
      <Icon name="heart_broken" size={56} className="text-primary" />
      <h1 className="mt-4 text-headline-lg text-on-surface md:text-display-lg">404</h1>
      <p className="mt-2 text-body-lg text-secondary">Aradığın sayfa bulunamadı.</p>
      <Link to="/" className="btn-primary mt-6 px-8 py-3">
        Ana sayfaya dön
      </Link>
    </div>
  );
}
