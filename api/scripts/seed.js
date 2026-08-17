/**
 * Baslangic verisi: konular, ornek sorular, rozetler, reklam alanlari, admin kullanici,
 * bir deneme sinavi ve ornek videolar.
 * Tekrar calistirilabilir (var olan kayitlari gunceller, cogaltmaz).
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const TOPICS = [
  { slug: 'kalp-yetmezligi', name: 'Kalp Yetmezliği', icon: 'ecg_heart', order: 1,
    description: 'HFrEF/HFpEF tanı ve tedavisi, kılavuz temelli medikal tedavi.' },
  { slug: 'ekg-analizi', name: 'EKG Analizi', icon: 'monitor_heart', order: 2,
    description: 'Ritim, ileti bozuklukları ve iskemi bulgularının yorumlanması.' },
  { slug: 'kapak-hastaliklari', name: 'Kapak Hastalıkları', icon: 'cardiology', order: 3,
    description: 'Darlık ve yetmezliklerin derecelendirilmesi, girişim endikasyonları.' },
  { slug: 'koroner-arter-hastaligi', name: 'Koroner Arter Hastalığı', icon: 'vital_signs', order: 4,
    description: 'Akut koroner sendromlar, stabil angina ve revaskülarizasyon.' },
  { slug: 'aritmiler', name: 'Aritmiler', icon: 'graphic_eq', order: 5,
    description: 'Atriyal fibrilasyon, SVT, ventriküler aritmiler ve tedavileri.' },
];

const QUESTIONS = [
  {
    topic: 'kalp-yetmezligi', type: 'case', difficulty: 'hard',
    body: `<p>65 yaşında erkek hasta, son 3 aydır artan efor dispnesi ve ortopne şikayeti ile polikliniğe başvuruyor. Fizik muayenesinde bilateral bazal krepitan raller ve S3 gallop ritmi duyuluyor. Ekokardiyografisinde sol ventrikül ejeksiyon fraksiyonu (LVEF) %30 olarak saptanıyor. Hastanın mevcut tedavisi ramipril 10 mg/gün ve bisoprolol 10 mg/gün içermektedir.</p>
<p>Bu hastanın tedavisinde mortalite faydası sağlamak amacıyla eklenmesi gereken en uygun ajan aşağıdakilerden hangisidir?</p>`,
    explanation: `<p><strong>Doğru Cevap: B) Spironolakton</strong></p>
<p><strong>Patofizyolojik Gerekçe:</strong> Düşük ejeksiyon fraksiyonlu kalp yetmezliği (HFrEF) tedavisinde, renin-anjiyotensin-aldosteron sisteminin (RAAS) aşırı aktivasyonu miyokardiyal fibrozis ve olumsuz remodeling'e yol açar. ACE inhibitörleri ve beta-blokerler temel tedaviyi oluşturur. Ancak "aldosteron kaçışı" fenomeni nedeniyle tek başına ACEi kullanımı aldosteron seviyelerini uzun vadede baskılamakta yetersiz kalabilir.</p>
<p>Mineralokortikoid reseptör antagonistleri (MRA) olan spironolakton veya eplerenon, NYHA Sınıf II-IV semptomları olan ve LVEF ≤%35 olan hastalarda, RALES ve EMPHASIS-HF çalışmalarında gösterildiği üzere, standart tedaviye eklendiğinde hem mortaliteyi hem de kalp yetmezliği nedenli hastaneye yatışları anlamlı oranda azaltır.</p>
<p><strong>Diğer Seçenekler Neden Yanlış?</strong></p>
<ul>
<li><em>Furosemid:</em> Semptomatik rahatlama sağlar ancak mortalite faydası gösterilmemiştir.</li>
<li><em>Digoksin:</em> Hastaneye yatışı azaltabilir, genel mortalite üzerine etkisi nötrdür.</li>
<li><em>İvabradin:</em> Maksimum tolere edilen beta-bloker dozuna rağmen kalp hızı ≥70/dk olan sinüs ritmindeki hastalarda endikedir.</li>
<li><em>Amlodipin:</em> Kalp yetmezliğinde mortalite faydası yoktur.</li>
</ul>`,
    options: [
      ['A', 'Furosemid', false], ['B', 'Spironolakton', true], ['C', 'Digoksin', false],
      ['D', 'İvabradin', false], ['E', 'Amlodipin', false],
    ],
  },
  {
    topic: 'kalp-yetmezligi', type: 'classic', difficulty: 'easy',
    body: '<p>HFrEF tedavisinde "dörtlü tedavi" (four pillars) olarak adlandırılan ilaç gruplarından biri <strong>değildir</strong>?</p>',
    explanation: '<p><strong>Doğru Cevap: D) Kalsiyum kanal blokeri</strong></p><p>Güncel kılavuzlarda HFrEF için dört temel sütun: ARNI/ACEi, beta-bloker, MRA ve SGLT2 inhibitörüdür. Dihidropiridin dışı kalsiyum kanal blokerleri negatif inotropik etkileri nedeniyle HFrEF\'te kontrendikedir.</p>',
    options: [
      ['A', 'ARNI (sakubitril/valsartan)', false], ['B', 'Beta-bloker', false],
      ['C', 'SGLT2 inhibitörü', false], ['D', 'Kalsiyum kanal blokeri', true],
      ['E', 'Mineralokortikoid reseptör antagonisti', false],
    ],
  },
  {
    topic: 'kalp-yetmezligi', type: 'classic', difficulty: 'medium',
    body: '<p>NT-proBNP düzeyi kalp yetmezliği tanısında kullanılır. Aşağıdaki durumlardan hangisi NT-proBNP düzeyini <strong>yalancı düşük</strong> gösterebilir?</p>',
    explanation: '<p><strong>Doğru Cevap: C) Obezite</strong></p><p>Obez hastalarda natriüretik peptid düzeyleri, artmış klirens ve azalmış üretim nedeniyle beklenenden düşük ölçülür; bu nedenle obezlerde daha düşük eşik değerler kullanılır. Böbrek yetmezliği, ileri yaş ve atriyal fibrilasyon ise düzeyleri yükseltir.</p>',
    options: [
      ['A', 'Böbrek yetmezliği', false], ['B', 'İleri yaş', false], ['C', 'Obezite', true],
      ['D', 'Atriyal fibrilasyon', false], ['E', 'Pulmoner emboli', false],
    ],
  },
  {
    topic: 'ekg-analizi', type: 'classic', difficulty: 'easy',
    body: '<p>Normal bir erişkin EKG\'sinde PR mesafesinin normal sınırları aşağıdakilerden hangisidir?</p>',
    explanation: '<p><strong>Doğru Cevap: B) 120-200 ms</strong></p><p>PR mesafesi 120 ms altında ise pre-eksitasyon (WPW) veya junctional ritim, 200 ms üzerinde ise birinci derece AV blok düşünülür.</p>',
    options: [
      ['A', '80-120 ms', false], ['B', '120-200 ms', true], ['C', '200-280 ms', false],
      ['D', '60-100 ms', false], ['E', '300-400 ms', false],
    ],
  },
  {
    topic: 'ekg-analizi', type: 'case', difficulty: 'medium',
    body: '<p>58 yaşında erkek hasta, 40 dakikadır süren tipik göğüs ağrısı ile acile başvuruyor. EKG\'de D2, D3 ve aVF derivasyonlarında 3 mm ST elevasyonu izleniyor. Hastanın kan basıncı 85/55 mmHg.</p><p>Bu hastada öncelikle yapılması gereken ek EKG değerlendirmesi hangisidir?</p>',
    explanation: '<p><strong>Doğru Cevap: A) Sağ prekordiyal derivasyonlar (V3R-V4R)</strong></p><p>İnferior MI\'da hipotansiyon varlığı sağ ventrikül tutulumunu düşündürür. V4R\'de ≥1 mm ST elevasyonu tanı koydurur. Sağ ventrikül infarktüsünde nitrat ve diüretik kontrendikedir; tedavi sıvı yüklemesidir.</p>',
    options: [
      ['A', 'Sağ prekordiyal derivasyonlar (V3R-V4R)', true],
      ['B', 'Uzun ritim şeridi (D2)', false],
      ['C', 'Lewis derivasyonu', false],
      ['D', 'Efor testi', false],
      ['E', 'Sinyal ortalamalı EKG', false],
    ],
  },
  {
    topic: 'ekg-analizi', type: 'classic', difficulty: 'hard',
    body: '<p>Geniş QRS taşikardisinde ventriküler taşikardi lehine olan EKG bulgusu aşağıdakilerden hangisidir?</p>',
    explanation: '<p><strong>Doğru Cevap: D) AV disosiasyon</strong></p><p>AV disosiasyon, füzyon ve yakalama (capture) vuruları ventriküler taşikardi için yüksek özgüllüğe sahip bulgulardır. Brugada ve Vereckei algoritmalarının temelini oluştururlar.</p>',
    options: [
      ['A', 'QRS süresi 110 ms', false], ['B', 'Düzenli RR mesafesi', false],
      ['C', 'Sol aks sapması', false], ['D', 'AV disosiasyon', true],
      ['E', 'Adenozin ile sonlanma', false],
    ],
  },
  {
    topic: 'kapak-hastaliklari', type: 'classic', difficulty: 'medium',
    body: '<p>Ciddi aort darlığı tanımı için ekokardiyografik kriterlerden hangisi <strong>doğrudur</strong>?</p>',
    explanation: '<p><strong>Doğru Cevap: B) Ortalama gradiyent ≥40 mmHg</strong></p><p>Ciddi aort darlığı: kapak alanı &lt;1.0 cm², ortalama gradiyent ≥40 mmHg, pik hız ≥4 m/sn. Düşük akım-düşük gradiyent formlarında dobutamin stres eko gerekebilir.</p>',
    options: [
      ['A', 'Kapak alanı > 1.5 cm²', false], ['B', 'Ortalama gradiyent ≥40 mmHg', true],
      ['C', 'Pik hız < 3 m/sn', false], ['D', 'Kapak alanı 1.2 cm²', false],
      ['E', 'Ortalama gradiyent 15 mmHg', false],
    ],
  },
  {
    topic: 'kapak-hastaliklari', type: 'case', difficulty: 'hard', isPremium: true,
    body: '<p>72 yaşında kadın hasta, semptomatik ciddi aort darlığı nedeniyle değerlendiriliyor. STS skoru %9, kırılganlık (frailty) mevcut, porselen aorta saptanıyor.</p><p>Bu hastada en uygun tedavi yaklaşımı hangisidir?</p>',
    explanation: '<p><strong>Doğru Cevap: C) TAVI (transkateter aort kapak implantasyonu)</strong></p><p>Yüksek cerrahi risk, ileri yaş, kırılganlık ve porselen aorta varlığında TAVI cerrahiye tercih edilir. Kalp ekibi (heart team) kararı esastır.</p>',
    options: [
      ['A', 'Cerrahi aort kapak replasmanı', false], ['B', 'Balon valvüloplasti ve takip', false],
      ['C', 'TAVI', true], ['D', 'Sadece medikal tedavi', false], ['E', 'Ross prosedürü', false],
    ],
  },
  {
    topic: 'koroner-arter-hastaligi', type: 'classic', difficulty: 'easy',
    body: '<p>STEMI tanısı konulan bir hastada primer PKG yapılamayacaksa, fibrinolitik tedavi ilk tıbbi temastan sonra en geç kaç dakika içinde uygulanmalıdır?</p>',
    explanation: '<p><strong>Doğru Cevap: B) 10 dakika</strong></p><p>Kılavuzlar, primer PKG\'ye 120 dakika içinde ulaşılamayacaksa ilk tıbbi temastan itibaren 10 dakika içinde fibrinolitik başlanmasını önerir.</p>',
    options: [
      ['A', '5 dakika', false], ['B', '10 dakika', true], ['C', '30 dakika', false],
      ['D', '60 dakika', false], ['E', '120 dakika', false],
    ],
  },
  {
    topic: 'koroner-arter-hastaligi', type: 'case', difficulty: 'medium',
    body: '<p>54 yaşında diyabetik erkek hasta, NSTEMI tanısıyla yatırılıyor. GRACE skoru 152 olarak hesaplanıyor, hemodinamisi stabil.</p><p>Bu hastada koroner anjiyografi ne zaman planlanmalıdır?</p>',
    explanation: '<p><strong>Doğru Cevap: B) İlk 24 saat içinde (erken invaziv)</strong></p><p>GRACE skoru &gt;140 olan hastalar yüksek risklidir ve 24 saat içinde erken invaziv strateji önerilir. Hemodinamik instabilite, dirençli angina veya malign aritmi varlığında ise acil (&lt;2 saat) girişim gerekir.</p>',
    options: [
      ['A', 'İlk 2 saat içinde (acil)', false], ['B', 'İlk 24 saat içinde (erken invaziv)', true],
      ['C', '72 saat sonra', false], ['D', 'Taburculuk sonrası elektif', false],
      ['E', 'Anjiyografi gerekmez', false],
    ],
  },
  {
    topic: 'aritmiler', type: 'classic', difficulty: 'medium',
    body: '<p>Non-valvüler atriyal fibrilasyonda antikoagülasyon kararı için kullanılan skorlama sistemi hangisidir?</p>',
    explanation: '<p><strong>Doğru Cevap: A) CHA₂DS₂-VASc</strong></p><p>CHA₂DS₂-VASc tromboembolik riski, HAS-BLED ise kanama riskini değerlendirir. Erkekte ≥2, kadında ≥3 puanda oral antikoagülan endikedir.</p>',
    options: [
      ['A', 'CHA₂DS₂-VASc', true], ['B', 'GRACE', false], ['C', 'TIMI', false],
      ['D', 'Wells', false], ['E', 'EuroSCORE II', false],
    ],
  },
  {
    topic: 'aritmiler', type: 'case', difficulty: 'hard', isPremium: true,
    body: '<p>28 yaşında kadın hasta, ani başlayan çarpıntı ile acile başvuruyor. Nabız 190/dk, düzenli, dar QRS taşikardi izleniyor. Kan basıncı 110/70 mmHg, hasta stabil. Vagal manevralar etkisiz.</p><p>Bir sonraki adım nedir?</p>',
    explanation: '<p><strong>Doğru Cevap: B) IV adenozin 6 mg hızlı puşe</strong></p><p>Stabil, düzenli, dar QRS taşikardide vagal manevra sonrası ilk basamak adenozindir. Etkisizse 12 mg tekrarlanır. İnstabilite varsa senkronize kardiyoversiyon uygulanır.</p>',
    options: [
      ['A', 'Senkronize kardiyoversiyon', false], ['B', 'IV adenozin 6 mg hızlı puşe', true],
      ['C', 'IV amiodaron infüzyonu', false], ['D', 'IV digoksin', false],
      ['E', 'Oral beta-bloker ve taburculuk', false],
    ],
  },
];

const BADGES = [
  { code: 'ilk-adim', name: 'İlk Adım', description: 'İlk sorunu doğru cevapladın.',
    icon: 'flag', rule_type: 'questions_solved', rule_params: { count: 1 }, sort_order: 1 },
  { code: 'cozucu-10', name: 'Isınma Turu', description: '10 farklı soruyu doğru cevapladın.',
    icon: 'target', rule_type: 'questions_solved', rule_params: { count: 10 }, sort_order: 2 },
  { code: 'cozucu-100', name: 'Yüz Soru Kulübü', description: '100 farklı soruyu doğru cevapladın.',
    icon: 'workspace_premium', rule_type: 'questions_solved', rule_params: { count: 100 }, sort_order: 3 },
  { code: 'puan-500', name: 'Yükselen Değer', description: 'Toplam 500 puana ulaştın.',
    icon: 'trending_up', rule_type: 'points_total', rule_params: { points: 500 }, sort_order: 4 },
  { code: 'puan-2000', name: 'Kardiyoloji Ustası', description: 'Toplam 2000 puana ulaştın.',
    icon: 'emoji_events', rule_type: 'points_total', rule_params: { points: 2000 }, sort_order: 5 },
  { code: 'keskin-nisanci', name: 'Keskin Nişancı', description: 'En az 50 denemede %90 doğruluk yakaladın.',
    icon: 'crisis_alert', rule_type: 'accuracy', rule_params: { minAttempts: 50, accuracy: 90 }, sort_order: 6 },
  { code: 'ekg-uzmani', name: 'EKG Uzmanı', description: 'EKG Analizi konusunda 20 denemede %80 doğruluk.',
    icon: 'monitor_heart', rule_type: 'topic_mastery',
    rule_params: { topicSlug: 'ekg-analizi', count: 20, accuracy: 80 }, sort_order: 7 },
  { code: 'kalp-yetmezligi-uzmani', name: 'Kalp Yetmezliği Uzmanı',
    description: 'Kalp Yetmezliği konusunda 20 denemede %80 doğruluk.',
    icon: 'ecg_heart', rule_type: 'topic_mastery',
    rule_params: { topicSlug: 'kalp-yetmezligi', count: 20, accuracy: 80 }, sort_order: 8 },
  { code: 'sinav-maratoncusu', name: 'Sınav Maratoncusu', description: '5 deneme sınavını tamamladın.',
    icon: 'timer', rule_type: 'exams_completed', rule_params: { count: 5 }, sort_order: 9 },
  { code: 'izleyici', name: 'Dikkatli İzleyici', description: '10 video dersi tamamladın.',
    icon: 'play_circle', rule_type: 'videos_completed', rule_params: { count: 10 }, sort_order: 10 },
];

const AD_SLOTS = [
  { code: 'header', name: 'Üst Banner (728x90)', provider: 'custom' },
  { code: 'sidebar', name: 'Sağ Kolon (300x250)', provider: 'custom' },
  { code: 'question_bottom', name: 'Soru Altı', provider: 'custom' },
  { code: 'video_below', name: 'Video Altı', provider: 'custom' },
];

const VIDEOS = [
  { topic: 'kalp-yetmezligi', title: 'HFrEF Tedavisinde Dörtlü Tedavi',
    description: 'ARNI, beta-bloker, MRA ve SGLT2 inhibitörünün kılavuz temelli kullanımı.',
    source: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', duration: 900, order: 1 },
  { topic: 'ekg-analizi', title: 'EKG Okumaya Sistematik Yaklaşım',
    description: 'Hız, ritim, aks, aralıklar ve morfoloji: 5 adımda EKG yorumu.',
    source: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', duration: 1200, order: 2 },
  { topic: 'aritmiler', title: 'Atriyal Fibrilasyonda Hız mı Ritim mi?',
    description: 'Strateji seçimi, antikoagülasyon ve ablasyon endikasyonları.',
    source: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    duration: 1500, order: 3, isPremium: true },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- Konular
    const topicIds = {};
    for (const t of TOPICS) {
      const { rows } = await client.query(
        `INSERT INTO topics (name, slug, description, icon, sort_order)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (slug) DO UPDATE
           SET name = EXCLUDED.name, description = EXCLUDED.description,
               icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order
         RETURNING id`,
        [t.name, t.slug, t.description, t.icon, t.order]
      );
      topicIds[t.slug] = rows[0].id;
    }

    // --- Admin kullanici
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@10adimdacardio.com').toLowerCase();
    const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin1234!', 10);
    const { rows: adminRows } = await client.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_premium)
       VALUES ($1,$2,$3,'admin',TRUE)
       ON CONFLICT (email) DO UPDATE SET role = 'admin', is_premium = TRUE
       RETURNING id`,
      [adminEmail, adminHash, process.env.ADMIN_NAME || 'Sistem Yöneticisi']
    );
    const adminId = adminRows[0].id;

    // --- Sorular (body'nin ilk 60 karakteri ayni ise tekrar eklenmez)
    const questionIds = [];
    for (const q of QUESTIONS) {
      const { rows: existing } = await client.query(
        'SELECT id FROM questions WHERE topic_id = $1 AND LEFT(body, 60) = LEFT($2, 60)',
        [topicIds[q.topic], q.body]
      );
      let qid;
      if (existing[0]) {
        qid = existing[0].id;
        await client.query('DELETE FROM question_options WHERE question_id = $1', [qid]);
        await client.query(
          `UPDATE questions SET type=$2, difficulty=$3, body=$4, explanation=$5,
                  is_premium=$6, updated_at=now() WHERE id=$1`,
          [qid, q.type, q.difficulty, q.body, q.explanation, Boolean(q.isPremium)]
        );
      } else {
        const { rows } = await client.query(
          `INSERT INTO questions (topic_id, type, difficulty, body, explanation, is_premium, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [topicIds[q.topic], q.type, q.difficulty, q.body, q.explanation, Boolean(q.isPremium), adminId]
        );
        qid = rows[0].id;
      }
      questionIds.push(qid);

      for (const [i, [label, text, isCorrect]] of q.options.entries()) {
        await client.query(
          `INSERT INTO question_options (question_id, label, text, is_correct, sort_order)
           VALUES ($1,$2,$3,$4,$5)`,
          [qid, label, text, isCorrect, i]
        );
      }
    }

    // --- Rozetler
    for (const b of BADGES) {
      await client.query(
        `INSERT INTO badges (code, name, description, icon, rule_type, rule_params, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (code) DO UPDATE
           SET name=EXCLUDED.name, description=EXCLUDED.description, icon=EXCLUDED.icon,
               rule_type=EXCLUDED.rule_type, rule_params=EXCLUDED.rule_params,
               sort_order=EXCLUDED.sort_order`,
        [b.code, b.name, b.description, b.icon, b.rule_type, JSON.stringify(b.rule_params), b.sort_order]
      );
    }

    // --- Reklam alanlari
    for (const s of AD_SLOTS) {
      await client.query(
        `INSERT INTO ad_slots (code, name, provider) VALUES ($1,$2,$3)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`,
        [s.code, s.name, s.provider]
      );
    }

    // --- Videolar
    for (const v of VIDEOS) {
      const { rows: exists } = await client.query('SELECT id FROM videos WHERE title = $1', [v.title]);
      if (exists[0]) continue;
      await client.query(
        `INSERT INTO videos (topic_id, title, description, source, url, duration_seconds,
                is_premium, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [topicIds[v.topic], v.title, v.description, v.source, v.url, v.duration,
         Boolean(v.isPremium), v.order]
      );
    }

    // --- Ornek deneme sinavi
    const { rows: examRows } = await client.query(
      `INSERT INTO exams (title, description, duration_minutes)
       SELECT 'Kardiyoloji Genel Deneme - 1',
              'Tüm konulardan karma 10 soruluk süreli deneme sınavı.', 20
        WHERE NOT EXISTS (SELECT 1 FROM exams WHERE title = 'Kardiyoloji Genel Deneme - 1')
       RETURNING id`
    );
    if (examRows[0]) {
      const examId = examRows[0].id;
      // Premium olmayan sorulardan ilk 10 tanesi
      const { rows: picked } = await client.query(
        'SELECT id FROM questions WHERE is_premium = FALSE AND is_active ORDER BY id LIMIT 10'
      );
      for (const [i, q] of picked.entries()) {
        await client.query(
          'INSERT INTO exam_questions (exam_id, question_id, sort_order) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
          [examId, q.id, i]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Seed tamam: ${TOPICS.length} konu, ${questionIds.length} soru, ${BADGES.length} rozet, ${VIDEOS.length} video.`);
    console.log(`Admin girisi: ${adminEmail} / ${process.env.ADMIN_PASSWORD || 'Admin1234!'}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed basarisiz:', err.message);
  process.exit(1);
});
