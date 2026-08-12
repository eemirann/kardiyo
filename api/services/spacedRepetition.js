/**
 * SM-2 (SuperMemo 2) aralikli tekrar algoritmasi.
 *
 * Kullanici karti dort dugmeden biriyle degerlendirir:
 *   0 Tekrar (bilemedim) · 1 Zor · 2 İyi · 3 Kolay
 *
 * SM-2'nin 0-5 kalite olcegine su sekilde eslenir:
 *   0 -> 2 (basarisiz), 1 -> 3, 2 -> 4, 3 -> 5
 */

const GRADES = { AGAIN: 0, HARD: 1, GOOD: 2, EASY: 3 };
const QUALITY = { 0: 2, 1: 3, 2: 4, 3: 5 };

const MIN_EASE = 1.3;
/** Ilk iki basarili tekrarin sabit araliklari (gun). */
const FIRST_INTERVALS = [1, 6];

/**
 * Bir sonraki tekrar durumunu hesaplar.
 *
 * @param {{easeFactor:number, intervalDays:number, repetitions:number, lapses:number}} state
 * @param {number} grade 0-3
 * @returns {{easeFactor:number, intervalDays:number, repetitions:number, lapses:number, dueAt:Date}}
 */
function schedule(state, grade) {
  const q = QUALITY[grade] ?? 4;
  let { easeFactor, intervalDays, repetitions, lapses } = {
    easeFactor: Number(state.easeFactor) || 2.5,
    intervalDays: Number(state.intervalDays) || 0,
    repetitions: Number(state.repetitions) || 0,
    lapses: Number(state.lapses) || 0,
  };

  // Kolaylik katsayisi guncellemesi (SM-2 formulu)
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < MIN_EASE) easeFactor = MIN_EASE;

  if (grade === GRADES.AGAIN) {
    // Bilinemedi: seri sifirlanir, kart ayni oturumda tekrar gosterilir (10 dk sonra)
    repetitions = 0;
    lapses += 1;
    intervalDays = 0;
    return {
      easeFactor: round2(easeFactor),
      intervalDays,
      repetitions,
      lapses,
      dueAt: new Date(Date.now() + 10 * 60 * 1000),
    };
  }

  if (repetitions < FIRST_INTERVALS.length) {
    intervalDays = FIRST_INTERVALS[repetitions];
  } else {
    intervalDays = Math.round(intervalDays * easeFactor);
  }

  // "Zor" cevabinda araligi kisalt, "Kolay"da uzat
  if (grade === GRADES.HARD) intervalDays = Math.max(1, Math.round(intervalDays * 0.6));
  if (grade === GRADES.EASY) intervalDays = Math.round(intervalDays * 1.3);

  repetitions += 1;

  return {
    easeFactor: round2(easeFactor),
    intervalDays,
    repetitions,
    lapses,
    dueAt: new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000),
  };
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Arayuzde dugme altinda gosterilecek "sonraki tekrar" metni. */
function previewIntervals(state) {
  return Object.values(GRADES).map((g) => {
    const next = schedule(state, g);
    return { grade: g, intervalDays: next.intervalDays };
  });
}

module.exports = { GRADES, schedule, previewIntervals };
