/**
 * EKG Quiz kategorileri.
 *
 * Her kategori kaynaktaki bir klasore ve veritabaninda bir konuya karsilik gelir
 * (slug: ekg-<code>). Konular /konular listesinde gorunmez; yalnizca /ekg
 * sayfasindaki seciciden acilir.
 *
 * DIKKAT: code ve sira, ice aktarma tarafiyla birebir ayni olmali —
 * api/scripts/lib/ekg-source.js icindeki CATEGORIES listesi.
 */

export const EKG_CATEGORIES = [
  { code: 'norm', name: 'Normal Sinüs Ritmi', short: 'Normal Sinüs' },
  { code: 'mi', name: 'Miyokard Enfarktüsü', short: 'MI' },
  { code: 'cd', name: 'İleti Bozuklukları', short: 'İleti Boz.' },
  { code: 'hyp', name: 'Hipertrofi Paterni', short: 'Hipertrofi' },
  { code: 'sttc', name: 'MI Dışı ST-T Değişiklikleri', short: 'ST-T' },
  { code: 'svt', name: 'Supraventriküler Taşikardiler', short: 'SVT' },
  { code: 'vt', name: 'Ventriküler Aritmiler', short: 'Ventriküler' },
  { code: 'axis', name: 'Aks Sapmaları', short: 'Aks Sapması' },
  { code: 'pace', name: 'Pacemaker Ritimleri', short: 'Pacemaker' },
];

export const ekgTopicSlug = (code) => `ekg-${code}`;
