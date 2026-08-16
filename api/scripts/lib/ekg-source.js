/**
 * OKU/EKG altindaki vaka verisini okur.
 *
 * Klasor duzeni (uretici aracin ciktisi, oldugu gibi birakildi):
 *   OKU/EKG/1- norm_quiz_output/
 *     quiz_data.json        30 vaka
 *     ecg_only/ECG_<id>.png 12 derivasyonlu kayit  <- kullandigimiz
 *     question1_cards/, question2_cards/, answer_cards/  <- kullanilmiyor
 *
 * Soru/cevap kartlari kullanilmiyor: onlar soruyu ve siklari gorselin icine
 * basiyor, biz metni ve siklari HTML olarak sunuyoruz (secilebilir, ekran
 * okuyucuya uygun, mobilde okunakli).
 *
 * Her vakadan yalnizca Q1 ("hangi tani?") soru olarak aliniyor. Q2'nin govdesi
 * dogru taniyi acikca yaziyor ("Dogru bulgu 'X' olarak belirlenmistir..."), bu
 * yuzden ayri bir soru olarak listede yan yana durunca cevabi ele verirdi.
 * Bunun yerine Q2'nin DOGRU SIKKI (klinik yaklasim) cozum metnine ekleniyor:
 * kaynakta vaka basina acıklama olmadigi icin cozum aksi halde yalnizca dogru
 * sikkin tekrarindan ibaret kalıyordu.
 */
const fs = require('fs');
const path = require('path');
const { fixDiacritics } = require('./tr-diacritics');

/** Kaynak klasorler; kod degeri hem R2 anahtarinda hem source_key'de gecer. */
const CATEGORIES = [
  { code: 'norm', dir: '1- norm_quiz_output', name: 'Normal EKG' },
  { code: 'mi', dir: '2- mi_quiz_output', name: 'Miyokard Enfarktusu' },
  { code: 'cd', dir: '3- cd_quiz_output', name: 'Iletim Bozukluklari' },
  { code: 'hyp', dir: '4- hyp_quiz_output', name: 'Hipertrofi' },
  { code: 'sttc', dir: '5- sttc_quiz_output', name: 'ST-T Degisiklikleri' },
  { code: 'svt', dir: '6- svt_quiz_output', name: 'Supraventrikuler Aritmiler' },
  { code: 'vt', dir: '7- vt_quiz_output', name: 'Ventrikuler Aritmiler' },
  { code: 'axis', dir: '8- axis_quiz_output', name: 'Aks Sapmalari' },
  { code: 'pace', dir: '9- pace_quiz_output', name: 'Pacemaker Ritimleri' },
];

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Depo kokundeki OKU/EKG klasoru (bu dosya api/scripts/lib/ altinda). */
const sourceRoot = () => path.join(__dirname, '..', '..', '..', 'OKU', 'EKG');

/**
 * Bir kategorinin vakalarini normalize edilmis halde doner.
 * Metinlerin Turkce karakterleri burada geri konur; siklar kaynakta zaten dogru.
 */
function casesFor(category) {
  const file = path.join(sourceRoot(), category.dir, 'quiz_data.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));

  return raw.map((e) => {
    const correctIndex = LABELS.indexOf(String(e.q1_correct_letter).trim().toUpperCase());
    if (correctIndex < 0 || correctIndex >= e.q1_options.length) {
      throw new Error(`${category.code}/${e.ecg_id}: gecersiz dogru sik "${e.q1_correct_letter}"`);
    }

    return {
      category: category.code,
      ecgId: e.ecg_id,
      diagnosis: e.diagnosis,
      narrative: fixDiacritics(e.narrative),
      question: fixDiacritics(e.q1_question),
      options: e.q1_options.map((text, i) => ({
        label: LABELS[i],
        text,
        isCorrect: i === correctIndex,
      })),
      correctLabel: LABELS[correctIndex],
      correctText: e.q1_options[correctIndex],
      // Q2'nin dogru sikki: "bu tani konduysa ne yapilmali" — cozumun govdesi
      clinicalApproach: fixDiacritics(e.q2_correct_answer),
      imageKey: `ekg/${category.code}/ECG_${e.ecg_id}.png`,
      sourceKey: `ekg#${category.code}#${e.ecg_id}`,
    };
  });
}

/** --category / --all bayraklarini kategori listesine cevirir. */
function selectCategories({ category, all }) {
  if (all) return CATEGORIES;
  return CATEGORIES.filter((c) => c.code === category);
}

module.exports = { CATEGORIES, LABELS, casesFor, selectCategories, sourceRoot };
