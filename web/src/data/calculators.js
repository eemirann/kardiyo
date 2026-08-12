/**
 * Klinik hesaplayicilar.
 * Kaynak: OKU/🧮 KARDİYOLOJİ VE ACİL TIP İNTERAKTİF HESAPLAMA ARAÇLARI KILAVUZU.docx
 *
 * Iki tur:
 *   type: 'score' -> puanlanan kriter listesi (checkbox/secim), toplam puana gore yorum
 *   type: 'formula' -> sayisal girdiler, formulle hesaplanan deger(ler)
 */

export const CALCULATORS = [
  // ------------------------------------------------ Aritmi & Antikoagulasyon
  {
    slug: 'cha2ds2-vasc',
    name: 'CHA₂DS₂-VASc Skoru',
    category: 'Aritmi & Antikoagülasyon',
    icon: 'monitor_heart',
    summary: 'Non-valvüler atriyal fibrilasyonda yıllık inme riski ve antikoagülan kararı.',
    indication:
      'Non-valvüler Atriyal Fibrilasyon (AF) hastalarında yıllık tromboembolik inme riskini ' +
      'değerlendirmek ve oral antikoagülan (OAK) tedavi başlama kararını vermek için kullanılır.',
    type: 'score',
    // Cinsiyet kriteri toplam yorumu da etkiledigi icin ayri tutuluyor
    fields: [
      { id: 'chf', label: 'Konjestif kalp yetmezliği / sol ventrikül disfonksiyonu', points: 1, code: 'C' },
      { id: 'htn', label: 'Hipertansiyon öyküsü', points: 1, code: 'H' },
      { id: 'age75', label: 'Yaş ≥ 75', points: 2, code: 'A₂' },
      { id: 'dm', label: 'Diabetes mellitus', points: 1, code: 'D' },
      { id: 'stroke', label: 'İnme / TİA / sistemik emboli öyküsü', points: 2, code: 'S₂' },
      { id: 'vasc', label: 'Vasküler hastalık (geçirilmiş Mİ, PAH, aort plağı)', points: 1, code: 'V' },
      { id: 'age65', label: 'Yaş 65–74', points: 1, code: 'A' },
      { id: 'female', label: 'Kadın cinsiyet', points: 1, code: 'Sc' },
    ],
    /** Yorum cinsiyete gore degisir. */
    interpret(score, values) {
      const female = Boolean(values.female);
      if (female) {
        if (score <= 1) return { level: 'low', title: 'Düşük risk', text: 'Antikoagülan tedavi gerekmez.' };
        if (score === 2)
          return { level: 'medium', title: 'Orta risk', text: 'Oral antikoagülan (DOAC) tedavisi düşünülmelidir.' };
        return { level: 'high', title: 'Yüksek risk', text: 'Oral antikoagülan (DOAC) tedavisi kesin endikedir.' };
      }
      if (score === 0) return { level: 'low', title: 'Düşük risk', text: 'Antikoagülan tedavi gerekmez.' };
      if (score === 1)
        return { level: 'medium', title: 'Orta risk', text: 'Oral antikoagülan (DOAC) tedavisi düşünülmelidir.' };
      return { level: 'high', title: 'Yüksek risk', text: 'Oral antikoagülan (DOAC) tedavisi kesin endikedir.' };
    },
    note:
      'Kadın cinsiyet tek başına risk faktörü sayılmaz; eşik değerler kadınlarda 1 puan yukarıdadır.',
  },

  {
    slug: 'has-bled',
    name: 'HAS-BLED Skoru',
    category: 'Aritmi & Antikoagülasyon',
    icon: 'bloodtype',
    summary: 'Antikoagülan alan AF hastalarında majör kanama riski.',
    indication:
      'Antikoagülan tedavi alan veya başlanacak AF hastalarında majör kanama riskini değerlendirir.',
    type: 'score',
    fields: [
      { id: 'htn', label: 'Kontrolsüz hipertansiyon (sistolik KB > 160 mmHg)', points: 1, code: 'H' },
      { id: 'renal', label: 'Böbrek fonksiyon bozukluğu', points: 1, code: 'A' },
      { id: 'liver', label: 'Karaciğer fonksiyon bozukluğu', points: 1, code: 'A' },
      { id: 'stroke', label: 'İnme öyküsü', points: 1, code: 'S' },
      { id: 'bleeding', label: 'Geçirilmiş majör kanama veya kanamaya eğilim', points: 1, code: 'B' },
      { id: 'inr', label: 'Değişken INR (TTR < %60)', points: 1, code: 'L' },
      { id: 'elderly', label: 'Yaş > 65', points: 1, code: 'E' },
      { id: 'drugs', label: 'Antiplatelet / NSAİİ kullanımı', points: 1, code: 'D' },
      { id: 'alcohol', label: 'Aşırı alkol kullanımı', points: 1, code: 'D' },
    ],
    interpret(score) {
      if (score >= 3)
        return {
          level: 'high',
          title: 'Yüksek kanama riski',
          text:
            'Yüksek HAS-BLED skoru antikoagülanı KESMEK için değil, düzeltilebilir kanama risk ' +
            'faktörlerini gidermek ve hastayı yakın takibe almak için kullanılır.',
        };
      return {
        level: 'low',
        title: 'Düşük–orta kanama riski',
        text: 'Standart takip ile antikoagülasyona devam edilebilir.',
      };
    },
  },

  // ------------------------------------------------ Iskemi & Acil
  {
    slug: 'heart-skoru',
    name: 'HEART Skoru',
    category: 'İskemi & Acil Kardiyoloji',
    icon: 'ecg_heart',
    summary: 'Acil serviste göğüs ağrısında 6 haftalık majör kardiyak olay riski.',
    indication:
      'Acil servise göğüs ağrısı ile başvuran hastalarda 6 haftalık Majör Olumsuz Kardiyak Olay ' +
      '(MACE) riskini belirler.',
    type: 'score',
    fields: [
      {
        id: 'history', label: 'Öykü (History)', code: 'H',
        options: [
          { label: 'Düşük şüphe', points: 0 },
          { label: 'Orta şüphe', points: 1 },
          { label: 'Yüksek şüphe', points: 2 },
        ],
      },
      {
        id: 'ecg', label: 'EKG', code: 'E',
        options: [
          { label: 'Normal', points: 0 },
          { label: 'Non-spesifik repolarizasyon bozukluğu', points: 1 },
          { label: 'Belirgin ST depresyonu', points: 2 },
        ],
      },
      {
        id: 'age', label: 'Yaş', code: 'A',
        options: [
          { label: '< 45', points: 0 },
          { label: '45 – 64', points: 1 },
          { label: '≥ 65', points: 2 },
        ],
      },
      {
        id: 'risk', label: 'Risk faktörleri', code: 'R',
        options: [
          { label: 'Risk faktörü yok', points: 0 },
          { label: '1 – 2 risk faktörü', points: 1 },
          { label: '≥3 risk faktörü veya KAH öyküsü', points: 2 },
        ],
      },
      {
        id: 'troponin', label: 'Troponin', code: 'T',
        options: [
          { label: '≤ Normal sınır', points: 0 },
          { label: 'Normalin 1 – 3 katı', points: 1 },
          { label: 'Normalin > 3 katı', points: 2 },
        ],
      },
    ],
    interpret(score) {
      if (score <= 3)
        return {
          level: 'low',
          title: 'Düşük risk (%0.9–1.7 MACE)',
          text: 'Acil servisten taburculuk düşünülebilir.',
        };
      if (score <= 6)
        return {
          level: 'medium',
          title: 'Orta risk (%12–16.6 MACE)',
          text: 'Hastaneye yatış, klinik gözlem ve seri kardiyak testler.',
        };
      return {
        level: 'high',
        title: 'Yüksek risk (%50–65 MACE)',
        text: 'Acil koroner anjiyografi / girişimsel yaklaşım.',
      };
    },
  },

  // ------------------------------------------------ VTE & Pulmoner
  {
    slug: 'wells-pe',
    name: 'Wells Skoru (Pulmoner Emboli)',
    category: 'Venöz Tromboemboli',
    icon: 'pulmonology',
    summary: 'PE şüphesinde klinik ön olasılık.',
    indication: 'Pulmoner emboli şüphesi olan hastalarda klinik ön olasılığı değerlendirir.',
    type: 'score',
    fields: [
      { id: 'dvt', label: 'DVT klinik belirti ve bulguları (bacakta objektif şişlik, ağrı)', points: 3 },
      { id: 'alt', label: 'Alternatif tanı pulmoner emboliden daha az olası', points: 3 },
      { id: 'hr', label: 'Kalp hızı > 100/dk', points: 1.5 },
      { id: 'immob', label: 'Son 4 haftada cerrahi veya ≥3 gün immobilizasyon', points: 1.5 },
      { id: 'history', label: 'Geçirilmiş DVT veya PE öyküsü', points: 1.5 },
      { id: 'hemoptysis', label: 'Hemoptizi', points: 1 },
      { id: 'cancer', label: 'Aktif kanser (tedavisi süren veya son 6 ayda tedavi almış)', points: 1 },
    ],
    interpret(score) {
      if (score <= 4)
        return {
          level: 'low',
          title: 'PE olası değil',
          text: 'Yüksek duyarlılıklı D-Dimer testi istenmelidir.',
        };
      return {
        level: 'high',
        title: 'PE olası',
        text: 'Zaman kaybetmeden BT pulmoner anjiyografi istenmelidir.',
      };
    },
  },

  {
    slug: 'spesi',
    name: 'sPESI',
    category: 'Venöz Tromboemboli',
    icon: 'emergency',
    summary: 'Tanısı kesin PE hastalarında 30 günlük mortalite riski.',
    indication:
      'Tanısı kesinleşmiş pulmoner emboli hastalarında 30 günlük mortalite riskini değerlendirir.',
    type: 'score',
    fields: [
      { id: 'age80', label: 'Yaş > 80', points: 1 },
      { id: 'cancer', label: 'Aktif kanser öyküsü', points: 1 },
      { id: 'cardiopulm', label: 'Kronik kardiyopulmoner hastalık (KY, KOAH vb.)', points: 1 },
      { id: 'hr', label: 'Nabız ≥ 110/dk', points: 1 },
      { id: 'sbp', label: 'Sistolik kan basıncı < 100 mmHg', points: 1 },
      { id: 'sat', label: 'Arteryel O₂ satürasyonu < %90', points: 1 },
    ],
    interpret(score) {
      if (score === 0)
        return {
          level: 'low',
          title: 'Düşük risk',
          text: '30 günlük mortalite düşük; seçilmiş vakalarda evde tedavi düşünülebilir.',
        };
      return {
        level: 'high',
        title: 'Yüksek risk',
        text: 'Hastaneye yatış ve yakın takip gerektirir.',
      };
    },
  },

  // ------------------------------------------------ Biyometrik & Hemodinamik
  {
    slug: 'bki-bsa',
    name: 'BKİ ve Vücut Yüzey Alanı',
    category: 'Biyometrik & Hemodinamik',
    icon: 'straighten',
    summary: 'Beden kitle indeksi ve Mosteller formülüyle vücut yüzey alanı.',
    indication:
      'Obezite evrelemesi, ekokardiyografik indeksleme ve kardiyak ilaç dozlamaları için temel ' +
      'parametreler.',
    type: 'formula',
    inputs: [
      { id: 'height', label: 'Boy', unit: 'cm', min: 50, max: 250, step: 1 },
      { id: 'weight', label: 'Kilo', unit: 'kg', min: 10, max: 300, step: 0.1 },
    ],
    compute({ height, weight }) {
      const m = height / 100;
      const bmi = weight / (m * m);
      const bsa = Math.sqrt((height * weight) / 3600);
      const cls =
        bmi < 18.5 ? 'Zayıf'
        : bmi < 25 ? 'Normal'
        : bmi < 30 ? 'Fazla kilolu'
        : bmi < 35 ? 'Obezite (Sınıf I)'
        : bmi < 40 ? 'Obezite (Sınıf II)'
        : 'Morbid obezite (Sınıf III)';
      return {
        results: [
          { label: 'Beden Kitle İndeksi', value: bmi.toFixed(1), unit: 'kg/m²', primary: true },
          { label: 'Vücut Yüzey Alanı (Mosteller)', value: bsa.toFixed(2), unit: 'm²' },
        ],
        interpretation: {
          level: bmi < 25 ? 'low' : bmi < 30 ? 'medium' : 'high',
          title: cls,
          text:
            'BKİ = ağırlık / boy² · BSA = √(boy × ağırlık / 3600). ' +
            'Obezitede natriüretik peptid düzeyleri yalancı düşük ölçülebilir.',
        },
      };
    },
  },

  {
    slug: 'ortalama-arter-basinci',
    name: 'Ortalama Arter Basıncı & Nabız Basıncı',
    category: 'Biyometrik & Hemodinamik',
    icon: 'vital_signs',
    summary: 'MAP ve nabız basıncı hesabı.',
    indication: 'Doku perfüzyonunu ve organ perfüzyon basıncını değerlendirmede kullanılır.',
    type: 'formula',
    inputs: [
      { id: 'sbp', label: 'Sistolik kan basıncı', unit: 'mmHg', min: 40, max: 300, step: 1 },
      { id: 'dbp', label: 'Diyastolik kan basıncı', unit: 'mmHg', min: 20, max: 200, step: 1 },
    ],
    compute({ sbp, dbp }) {
      const map = (sbp + 2 * dbp) / 3;
      const pp = sbp - dbp;
      return {
        results: [
          { label: 'Ortalama Arter Basıncı (MAP)', value: map.toFixed(0), unit: 'mmHg', primary: true },
          { label: 'Nabız Basıncı', value: pp.toFixed(0), unit: 'mmHg' },
        ],
        interpretation: {
          level: map < 65 ? 'high' : 'low',
          title: map < 65 ? 'MAP < 65 mmHg — organ perfüzyonu riskte' : 'MAP yeterli',
          text:
            'MAP = (SKB + 2×DKB) / 3. Şok tablosunda hedef genellikle MAP ≥ 65 mmHg\'dir. ' +
            'Geniş nabız basıncı aort yetmezliği veya arteriyel sertliği düşündürür.',
        },
      };
    },
  },

  {
    slug: 'cockcroft-gault',
    name: 'Cockcroft-Gault Kreatinin Klirensi',
    category: 'Biyometrik & Hemodinamik',
    icon: 'science',
    summary: 'NOAC/DOAC, LMWH ve digoksin doz ayarı için kreatinin klirensi.',
    indication:
      'Yeni nesil oral antikoagülanlar (NOAC/DOAC), düşük molekül ağırlıklı heparinler ve ' +
      'digoksin gibi renal atılan kardiyak ilaçların doz ayarında kullanılır.',
    type: 'formula',
    inputs: [
      { id: 'age', label: 'Yaş', unit: 'yıl', min: 18, max: 120, step: 1 },
      { id: 'weight', label: 'Kilo', unit: 'kg', min: 10, max: 300, step: 0.1 },
      { id: 'creatinine', label: 'Serum kreatinin', unit: 'mg/dL', min: 0.1, max: 15, step: 0.01 },
      {
        id: 'sex',
        label: 'Cinsiyet',
        type: 'select',
        options: [
          { label: 'Erkek (f = 1.00)', value: 1 },
          { label: 'Kadın (f = 0.85)', value: 0.85 },
        ],
      },
    ],
    compute({ age, weight, creatinine, sex }) {
      const crcl = ((140 - age) * weight * sex) / (72 * creatinine);
      const level = crcl >= 50 ? 'low' : crcl >= 30 ? 'medium' : 'high';
      const text =
        crcl < 15
          ? 'DOAC\'lar kontrendike kabul edilir; hematoloji/nefroloji ile birlikte değerlendirin.'
          : crcl < 30
            ? 'Ciddi böbrek yetmezliği: çoğu DOAC için doz azaltımı veya kontrendikasyon söz konusudur.'
            : crcl < 50
              ? 'Orta böbrek yetmezliği: DOAC ve LMWH dozlarını ilaç prospektüsüne göre azaltın.'
              : 'Standart dozlama uygundur.';
      return {
        results: [
          { label: 'Kreatinin Klirensi (CrCl)', value: crcl.toFixed(1), unit: 'mL/dk', primary: true },
        ],
        interpretation: {
          level,
          title: `CrCl ${crcl.toFixed(0)} mL/dk`,
          text: `${text} Formül: [(140 − yaş) × ağırlık × f] / (72 × kreatinin).`,
        },
      };
    },
  },
];

export const CALCULATOR_CATEGORIES = [...new Set(CALCULATORS.map((c) => c.category))];

export const findCalculator = (slug) => CALCULATORS.find((c) => c.slug === slug);
