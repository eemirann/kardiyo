/**
 * E-posta gonderimi (Resend).
 *
 * Ayarlar bos ise gonderim kapali olur: uygulama calismaya devam eder, mail
 * yerine baglanti sunucu gunlugune yazilir. Boylece yerelde API anahtari
 * olmadan da kayit akisi bastan sona denenebiliyor (bkz. storage.js'teki ayni
 * desen: R2 ayarlari eksikse yukleme kapanir, site ayakta kalir).
 */
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const isEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

/**
 * Tek bir e-posta gonderir.
 * Gonderim basarisiz olursa HATA FIRLATMAZ: cagiran uclarin (kayit gibi) mail
 * saglayicisi yuzunden komple dusmesini istemiyoruz; sonuc nesnesine bakilir.
 * @returns {Promise<{sent: boolean, skipped?: boolean, error?: string}>}
 */
async function sendMail({ to, subject, html }) {
  if (!isEnabled()) {
    console.warn(`[mail] Gonderim kapali (RESEND_API_KEY/MAIL_FROM yok). Alici: ${to} — ${subject}`);
    return { sent: false, skipped: true };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, html }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[mail] Resend ${res.status}: ${detail}`);
      return { sent: false, error: `Resend ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error(`[mail] Gonderilemedi: ${err.message}`);
    return { sent: false, error: err.message };
  }
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Dogrulama e-postasinin govdesi. Stil satir ici: mail istemcileri <style> etiketini siler. */
function verificationEmailHtml(fullName, link) {
  return `<!doctype html>
<html lang="tr"><body style="margin:0;padding:24px;background:#f4f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1b1f">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
    <h1 style="margin:0 0 16px;font-size:20px;color:#b3261e">10 Adımda Kardiyoloji</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6">Merhaba ${esc(fullName)},</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6">
      Hesabını etkinleştirmek için aşağıdaki bağlantıya tıkla. Bağlantı 24 saat geçerlidir.
    </p>
    <p style="margin:0 0 24px">
      <a href="${esc(link)}" style="display:inline-block;background:#b3261e;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600">E-postamı Doğrula</a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#49454f">
      Buton çalışmazsa bu adresi tarayıcına yapıştırabilirsin:
    </p>
    <p style="margin:0 0 24px;font-size:13px;line-height:1.6;word-break:break-all;color:#49454f">${esc(link)}</p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#49454f">
      Bu kaydı sen yapmadıysan bu e-postayı yok sayabilirsin.
    </p>
  </div>
</body></html>`;
}

/**
 * Dogrulama baglantisini gonderir.
 * Gonderim kapaliyken baglantiyi gunluge yazar; yerelde akisi denemenin yolu budur.
 */
async function sendVerificationEmail({ to, fullName, link }) {
  const result = await sendMail({
    to,
    subject: 'E-posta adresini doğrula — 10 Adımda Kardiyoloji',
    html: verificationEmailHtml(fullName, link),
  });
  if (result.skipped) console.warn(`[mail] Dogrulama baglantisi: ${link}`);
  return result;
}

module.exports = { isEnabled, sendMail, sendVerificationEmail, verificationEmailHtml };
