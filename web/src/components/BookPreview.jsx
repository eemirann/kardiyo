import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './ui';

/**
 * "10 Adimda Kardiyoloji" kitabinin ilk sayfalarini gercek kitap hissiyle gosterir.
 *
 * Sayfalar web/public/kitap altinda hazir gorseller (PDF'ten uretiliyor,
 * tools/pdf-import/render-book-preview.js). Sayfa cevirme, sayfanin sol kenari
 * etrafinda donmesiyle yapiliyor; animasyon suresi boyunca yeni sayfa altta duruyor.
 */
const TOTAL_PREVIEW = 10;
const TOTAL_PAGES = 74;
// Kitabin tam metni Zenodo kaydindan sunuluyor; indirmeler orada sayiliyor.
const BOOK_URL = 'https://zenodo.org/records/17442239';
const PDF_SIZE = '20 MB';

const src = (i) => `/kitap/sayfa-${String(i + 1).padStart(2, '0')}.jpg`;

export default function BookPreview() {
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState(null); // {dir, from}
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const go = useCallback(
    (dir) => {
      setTurn((busy) => {
        if (busy) return busy;
        const target = page + (dir === 'next' ? 1 : -1);
        if (target < 0 || target >= TOTAL_PREVIEW) return busy;

        timer.current = setTimeout(() => {
          setPage(target);
          setTurn(null);
        }, 520);
        return { dir, from: page };
      });
    },
    [page]
  );

  // Klavye ile gezinme
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go('next');
      if (e.key === 'ArrowLeft') go('prev');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const target = turn ? turn.from + (turn.dir === 'next' ? 1 : -1) : page;
  const isFirst = page === 0 && !turn;
  const isLast = page === TOTAL_PREVIEW - 1 && !turn;

  return (
    // Genislik sinirlanmazsa sayfa yuksekligi hero'yu asiyor ve solda bosluk kaliyor
    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-4">
      <div className="card overflow-hidden p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-label-sm uppercase tracking-wider text-primary">Kitap</div>
            <div className="text-body-lg font-semibold text-on-surface">10 Adımda Kardiyoloji</div>
          </div>
          <span className="chip bg-surface-container text-secondary">
            {TOTAL_PAGES} sayfa · ilk {TOTAL_PREVIEW} sayfa önizleme
          </span>
        </div>

        {/* Sayfa yuzeyi: tiklanabilir; sag yari ileri, sol yari geri */}
        <div className="book-stage relative select-none">
          <img
            src={src(target)}
            alt={`Sayfa ${target + 1}`}
            className="book-page w-full"
            draggable={false}
            loading={target < 2 ? 'eager' : 'lazy'}
          />

          {turn && (
            <img
              key={`${turn.from}-${turn.dir}`}
              src={src(turn.dir === 'next' ? turn.from : turn.from - 1)}
              alt=""
              aria-hidden="true"
              className={`book-page book-sheet ${
                turn.dir === 'next' ? 'book-turn-out' : 'book-turn-in'
              }`}
              draggable={false}
            />
          )}

          <button
            type="button"
            onClick={() => go('prev')}
            disabled={isFirst}
            aria-label="Önceki sayfa"
            className="absolute inset-y-0 left-0 w-1/2 cursor-w-resize disabled:cursor-default"
          />
          <button
            type="button"
            onClick={() => go('next')}
            disabled={isLast}
            aria-label="Sonraki sayfa"
            className="absolute inset-y-0 right-0 w-1/2 cursor-e-resize disabled:cursor-default"
          />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            className="btn-ghost px-2 py-1.5 disabled:opacity-40"
            onClick={() => go('prev')}
            disabled={isFirst}
          >
            <Icon name="chevron_left" size={20} />
          </button>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_PREVIEW }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === target ? 'w-5 bg-primary' : 'w-1.5 bg-outline-variant'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            className="btn-ghost px-2 py-1.5 disabled:opacity-40"
            onClick={() => go('next')}
            disabled={isLast}
          >
            <Icon name="chevron_right" size={20} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a href={BOOK_URL} target="_blank" rel="noreferrer" className="btn-primary">
          <Icon name="download" size={18} /> Kitabı indir ({PDF_SIZE})
        </a>
        <a href={BOOK_URL} target="_blank" rel="noreferrer" className="btn-outline">
          <Icon name="open_in_new" size={18} /> Tamamını oku
        </a>
      </div>
    </div>
  );
}
