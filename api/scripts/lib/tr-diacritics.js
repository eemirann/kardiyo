/**
 * EKG vaka metinlerindeki Turkce karakterleri geri koyar.
 *
 * Kaynak JSON'da hasta hikayeleri ve soru koklerinin aksanlari dusmus
 * ("38 yasinda kadin hasta ... degerlendiriliyor"), siklar ise duzgun. Metinler
 * sablon uretimi oldugu icin kelime kumesi dar (270 vakada 300 benzersiz
 * kelime), bu yuzden tahmin yerine acik bir sozluk kullaniyoruz: yalnizca
 * listedeki kelimeler degisir, listede olmayan hicbir sey bozulmaz.
 *
 * Anahtarlar kucuk harf; buyuk harfle baslayan kelimelerde karsiligin ilk harfi
 * Turkce kurallarina gore buyutulur.
 */

// Kelime bazli duzeltmeler (kucuk harf anahtar -> duzgun yazim)
const WORDS = {
  agirlik: 'ağırlık',
  agrisi: 'ağrısı',
  agriya: 'ağrıya',
  akcigerler: 'akciğerler',
  aksam: 'akşam',
  anindaki: 'anındaki',
  asagidakilerden: 'aşağıdakilerden',
  asiri: 'aşırı',
  atim: 'atım',
  atimi: 'atımı',
  attigini: 'attığını',
  bagli: 'bağlı',
  bas: 'baş',
  baski: 'baskı',
  basinci: 'basıncı',
  baslangicli: 'başlangıçlı',
  baslayan: 'başlayan',
  baslayip: 'başlayıp',
  // Kaynaktaki yazim hatasi: "aniden basleyip aniden sonlanan"
  basleyip: 'başlayıp',
  baska: 'başka',
  basvuru: 'başvuru',
  basvurdugu: 'başvurduğu',
  basvuruyor: 'başvuruyor',
  bayilma: 'bayılma',
  birkac: 'birkaç',
  bozuklugu: 'bozukluğu',
  bulanti: 'bulantı',
  bulgularina: 'bulgularına',
  carpinti: 'çarpıntı',
  cekilen: 'çekilen',
  ceneye: 'çeneye',
  dakikadir: 'dakikadır',
  darligi: 'darlığı',
  degerlendirmede: 'değerlendirmede',
  degerlendiriliyor: 'değerlendiriliyor',
  degiskenlik: 'değişkenlik',
  dengesizligi: 'dengesizliği',
  disi: 'dışı',
  disinda: 'dışında',
  diuretik: 'diüretik',
  dolgunlugu: 'dolgunluğu',
  donemde: 'dönemde',
  donmesi: 'dönmesi',
  dun: 'dün',
  duzenli: 'düzenli',
  duzensiz: 'düzensiz',
  duzensizlik: 'düzensizlik',
  eslik: 'eşlik',
  gecen: 'geçen',
  gecirilmis: 'geçirilmiş',
  genc: 'genç',
  gogsune: 'göğsüne',
  gogus: 'göğüs',
  gore: 'göre',
  gostermeyen: 'göstermeyen',
  gosteriyor: 'gösteriyor',
  hastaligi: 'hastalığı',
  hastalik: 'hastalık',
  hastanin: 'hastanın',
  hastasi: 'hastası',
  hicbir: 'hiçbir',
  hizi: 'hızı',
  hizli: 'hızlı',
  icin: 'için',
  ilac: 'ilaç',
  iliskisi: 'ilişkisi',
  is: 'iş',
  kadin: 'kadın',
  kendiliginden: 'kendiliğinden',
  kontrolsuz: 'kontrolsüz',
  kontrolu: 'kontrolü',
  kontrolunde: 'kontrolünde',
  kullanimi: 'kullanımı',
  kullanimina: 'kullanımına',
  kullanmiyor: 'kullanmıyor',
  lisansi: 'lisansı',
  nabiz: 'nabız',
  olasi: 'olası',
  olculen: 'ölçülen',
  once: 'önce',
  oncesi: 'öncesi',
  oykusu: 'öyküsü',
  oykusunde: 'öyküsünde',
  ozellik: 'özellik',
  ozgecmisinde: 'özgeçmişinde',
  poliklinigi: 'polikliniği',
  poliklinigine: 'polikliniğine',
  rahatsizligi: 'rahatsızlığı',
  saglik: 'sağlık',
  saglikli: 'sağlıklı',
  saturasyonu: 'satürasyonu',
  seklinde: 'şeklinde',
  sertligi: 'sertliği',
  sikayetiyle: 'şikâyetiyle',
  sikismasi: 'sıkışması',
  sikistirici: 'sıkıştırıcı',
  sinus: 'sinüs',
  sira: 'sıra',
  sirasinda: 'sırasında',
  sirtina: 'sırtına',
  soguk: 'soğuk',
  stimulan: 'stimülan',
  sureli: 'süreli',
  suregelen: 'süregelen',
  suren: 'süren',
  takilan: 'takılan',
  tani: 'tanı',
  tanili: 'tanılı',
  taramasinda: 'taramasında',
  tarzinda: 'tarzında',
  tasikardik: 'taşikardik',
  tesadufen: 'tesadüfen',
  uyanirken: 'uyanırken',
  uzeri: 'üzeri',
  venoz: 'venöz',
  yapisal: 'yapısal',
  yaptirdigi: 'yaptırdığı',
  yas: 'yaş',
  yasam: 'yaşam',
  yasinda: 'yaşında',
  yayilan: 'yayılan',
  yayilim: 'yayılım',
  yetmezligi: 'yetmezliği',
  yil: 'yıl',
  yonlendiriliyor: 'yönlendiriliyor',
};

// Zaten kismi Turkce karakter tasiyan kaynak yazimlar da ayni karsiliga gitmeli
WORDS['sağlik'] = 'sağlık';
WORDS['sağlikli'] = 'sağlıklı';

/**
 * Q2 klinik yaklasim metinlerinin ek kelimeleri.
 * Bu alanin bir kismi kaynakta duzgun yazilmis, bir kismi aksansiz; ayni sozluk
 * ikisini de dogru sonuca goturur (dogru yazilmis kelimeler zaten eslesmez).
 */
Object.assign(WORDS, {
  acisindan: 'açısından',
  antikoagulasyon: 'antikoagülasyon',
  arastirilmali: 'araştırılmalı',
  arastirilmalidir: 'araştırılmalıdır',
  bagimliligi: 'bağımlılığı',
  baglamin: 'bağlamın',
  baglaminda: 'bağlamında',
  baslanmali: 'başlanmalı',
  bifasikuler: 'bifasiküler',
  calisma: 'çalışma',
  degerlendirilmeli: 'değerlendirilmeli',
  degerlendirilmelidir: 'değerlendirilmelidir',
  degerlendirme: 'değerlendirme',
  diffuz: 'difüz',
  diuretiklerden: 'diüretiklerden',
  dugum: 'düğüm',
  dusukse: 'düşükse',
  gecirilir: 'geçirilir',
  gecirilmesi: 'geçirilmesi',
  gelisen: 'gelişen',
  gelisirse: 'gelişirse',
  genis: 'geniş',
  gorulmesi: 'görülmesi',
  gozden: 'gözden',
  gundeme: 'gündeme',
  ilaclar: 'ilaçlar',
  // Kaynakta "Izlem"/"Izole" seklinde, noktali I ile yazilmasi gerekirken ASCII
  // I ile gecen kelimeler: karsiligi ayni, ama buyuk harfe cevrilirken "İ" olur.
  izlem: 'izlem',
  izole: 'izole',
  kacinilmalidir: 'kaçınılmalıdır',
  kaybina: 'kaybına',
  olumcul: 'ölümcül',
  onerilir: 'önerilir',
  oskultasyon: 'oskültasyon',
  ozel: 'özel',
  reperfuzyon: 'reperfüzyon',
  ruptur: 'rüptür',
  sag: 'sağ',
  saptandiginda: 'saptandığında',
  sarttir: 'şarttır',
  supheyle: 'şüpheyle',
  varliginda: 'varlığında',
  ventrikul: 'ventrikül',
  ventrikuler: 'ventriküler',
  yakin: 'yakın',
  yuk: 'yük',
  yuklenmesi: 'yüklenmesi',
  yuksek: 'yüksek',
});

/**
 * EKG deneme sinavlarindaki sik metinlerinin ek kelimeleri.
 * Bu kaynakta siklarin yazimi tutarsiz: ayni terim bir soruda "Ventriküler
 * Taşikardi", digerinde "Ventrikuler Tasikardi" olarak geciyor. Dogru yazimi
 * zaten kaynakta bulunan kelimeler burada tek karsiliga baglaniyor.
 */
Object.assign(WORDS, {
  bloğu: 'bloğu',
  blogu: 'bloğu',
  degisikligi: 'değişikliği',
  fasikuler: 'fasiküler',
  genisleme: 'genişleme',
  // Karsiligi ayni; kaynakta ASCII "I" ile yazildigi icin buyuk harfe
  // cevrilirken "İnferior" olsun diye listede ("izlem"/"izole" ile ayni durum).
  inferior: 'inferior',
  tasikardi: 'taşikardi',
});

/**
 * Kelime bazli sozlugun yakalayamadigi kaliplar.
 * Tek basina anlamli baska bir kelime olan ("su", "on", "sok") yazimlar sozluge
 * konamaz; yalnizca gectikleri kalip degistiriliyor.
 */
const PHRASES = [
  [/\bSu anda\b/g, 'Şu anda'],
  [/\bon yuk\b/g, 'ön yük'],
  [/\bkardiyojenik sok\b/g, 'kardiyojenik şok'],
];

/** Turkce buyuk harf: i -> İ (varsayilan I olurdu). */
const upperFirst = (s) => (s[0] === 'i' ? 'İ' : s[0].toLocaleUpperCase('tr')) + s.slice(1);

// Duzeltme sonrasi olusan "şikâyetiyle" gibi kelimeler bolunmesin diye
// duzeltme isaretli harfler (â, î, û) de kelime karakteri sayilir.
const WORD_RE = /[A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû]+/g;

/** Metindeki bilinen kelimelerin aksanlarini geri koyar. */
function fixDiacritics(text) {
  let out = String(text ?? '');
  for (const [re, replacement] of PHRASES) out = out.replace(re, replacement);

  return out.replace(WORD_RE, (word) => {
    // Arama Turkce locale ile YAPILMAZ: "Izlem".toLocaleLowerCase('tr') noktasiz
    // "ızlem" verir ve sozlukteki "izlem" ile eslesmezdi. Kaynak ASCII yazildigi
    // icin dogru davranis I'yi i olarak okumak.
    const fixed = WORDS[word.toLowerCase()];
    if (!fixed) return word;
    // Ilk harfi buyukse karsiligini da buyut ("Ozgecmisinde" -> "Özgeçmişinde")
    return word[0] === word[0].toLocaleUpperCase('tr') ? upperFirst(fixed) : fixed;
  });
}

/**
 * Denetim icin: metinde sozlukte olmayan ve hic Turkce karakter icermeyen
 * kelimeleri doner. Gozden kacan bir yazim varsa dry-run ciktisinda gorunur.
 */
function suspiciousWords(text) {
  const found = new Set();
  for (const word of String(text ?? '').match(WORD_RE) || []) {
    if (WORDS[word.toLowerCase()]) continue;
    if (/[çğıöşüÇĞİÖŞÜ]/.test(word)) continue;
    found.add(word);
  }
  return found;
}

module.exports = { fixDiacritics, suspiciousWords, WORDS };
