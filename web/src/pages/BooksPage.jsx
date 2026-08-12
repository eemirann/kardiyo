import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AdSlot from '../components/AdSlot';
import {
  EmptyState,
  ErrorBox,
  Icon,
  PageLoader,
  PremiumChip,
  ProgressBar,
  RichText,
} from '../components/ui';

/** Kitap listesi. */
export function BooksPage() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/books')
      .then((d) => setBooks(d.books))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="mx-auto max-w-container-max-width px-margin-mobile py-10 md:px-margin-desktop">
      <h1 className="text-headline-lg text-on-surface">Konu Anlatımları</h1>
      <p className="mt-2 text-body-md text-secondary">
        Kılavuz temelli, bölüm bölüm okunabilen konu anlatımları. Okuduğun bölümler işaretlenir.
      </p>

      <div className="mt-6">
        <ErrorBox message={error} />
      </div>

      {books.length === 0 && !error ? (
        <div className="mt-6">
          <EmptyState icon="menu_book" title="Henüz konu anlatımı yok" />
        </div>
      ) : (
        <div className="mt-8 grid gap-gutter md:grid-cols-2 lg:grid-cols-3">
          {books.map((b) => (
            <Link
              key={b.id}
              to={`/kitaplar/${b.slug}`}
              className="card flex flex-col p-6 transition-shadow hover:shadow-level2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-navy/10 text-brand-navy">
                  <Icon name="menu_book" size={26} />
                </span>
                {b.isPremium && <PremiumChip />}
              </div>
              <h2 className="mt-4 text-body-lg font-semibold text-on-surface">{b.title}</h2>
              {b.subtitle && <p className="text-caption text-secondary">{b.subtitle}</p>}
              {b.description && (
                <p className="mt-2 flex-1 text-body-md text-secondary">{b.description}</p>
              )}
              <div className="mt-4 flex gap-4 text-caption text-secondary">
                <span>{b.chapterCount} bölüm</span>
                <span>{b.sectionCount} konu</span>
              </div>
              {b.readCount > 0 && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-caption text-secondary">
                    <span>Okunan</span>
                    <span>
                      {b.readCount}/{b.sectionCount}
                    </span>
                  </div>
                  <ProgressBar value={b.readCount} max={b.sectionCount || 1} />
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Kitap icindekiler. */
export function BookTocPage() {
  const { bookSlug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/books/${bookSlug}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [bookSlug]);

  if (error)
    return (
      <div className="mx-auto max-w-container-max-width px-margin-mobile py-10 md:px-margin-desktop">
        <ErrorBox message={error} />
      </div>
    );
  if (!data) return <PageLoader />;

  const allSections = data.chapters.flatMap((c) => c.sections);
  const readCount = allSections.filter((s) => s.isRead).length;
  const firstUnread = allSections.find((s) => !s.isRead) || allSections[0];

  return (
    <div className="mx-auto grid max-w-container-max-width gap-gutter px-margin-mobile py-10 md:grid-cols-[1fr_300px] md:px-margin-desktop">
      <div>
        <h1 className="text-headline-lg text-on-surface">{data.book.title}</h1>
        {data.book.subtitle && (
          <p className="mt-1 text-body-lg text-secondary">{data.book.subtitle}</p>
        )}
        {data.book.description && (
          <p className="mt-3 text-body-md text-secondary">{data.book.description}</p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-4">
          {firstUnread && (
            <Link to={`/kitaplar/${bookSlug}/${firstUnread.slug}`} className="btn-primary">
              <Icon name="play_arrow" size={18} />
              {readCount > 0 ? 'Kaldığın yerden devam et' : 'Okumaya başla'}
            </Link>
          )}
          <span className="text-caption text-secondary">
            {readCount}/{allSections.length} bölüm okundu
          </span>
        </div>
        <ProgressBar value={readCount} max={allSections.length || 1} className="mt-3" />

        <div className="mt-8 space-y-6">
          {data.chapters.map((ch) => (
            <div key={ch.id} className="card overflow-hidden">
              <div className="border-b border-surface-variant bg-surface-container px-5 py-4">
                <div className="text-label-sm uppercase tracking-wider text-primary">
                  Bölüm {ch.number}
                </div>
                <h2 className="text-body-lg font-semibold text-on-surface">{ch.title}</h2>
                {ch.subtitle && <p className="text-caption text-secondary">{ch.subtitle}</p>}
              </div>
              <div className="divide-y divide-surface-variant">
                {ch.sections.map((s) => (
                  <Link
                    key={s.id}
                    to={`/kitaplar/${bookSlug}/${s.slug}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-surface-container-low"
                  >
                    <Icon
                      name={s.isRead ? 'check_circle' : 'radio_button_unchecked'}
                      size={20}
                      className={s.isRead ? 'text-success' : 'text-secondary/50'}
                    />
                    <span className="w-12 shrink-0 text-caption text-secondary">{s.number}</span>
                    <span className="min-w-0 flex-1 text-body-md text-on-surface">{s.title}</span>
                    {s.locked && <Icon name="lock" size={16} className="text-primary" />}
                    <span className="whitespace-nowrap text-caption text-secondary">
                      {s.readingMinutes} dk
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="space-y-4">
        <AdSlot code="sidebar" />
      </aside>
    </div>
  );
}

/** Tek bolum okuma sayfasi. */
export function BookSectionPage() {
  const { bookSlug, sectionSlug } = useParams();
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [read, setRead] = useState(false);

  useEffect(() => {
    setData(null);
    setRead(false);
    api
      .get(`/books/${bookSlug}/${sectionSlug}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [bookSlug, sectionSlug]);

  const markRead = async () => {
    if (!user || !data) return;
    try {
      const res = await api.post(`/books/sections/${data.section.id}/read`);
      setRead(true);
      if (res.newBadges?.length) {
        toast.badges(res.newBadges);
        refreshUser();
      } else {
        toast.success('Bölüm okundu olarak işaretlendi');
      }
    } catch (err) {
      toast.error('İşaretlenemedi', err.message);
    }
  };

  if (error)
    return (
      <div className="mx-auto max-w-container-max-width px-margin-mobile py-10 md:px-margin-desktop">
        <ErrorBox message={error} />
        {error.includes('premium') && (
          <p className="mt-3 text-body-md text-secondary">
            Bu bölüm premium üyelere özel.{' '}
            <Link to="/iletisim" className="text-primary hover:underline">
              Premium hakkında bilgi al
            </Link>
          </p>
        )}
      </div>
    );
  if (!data) return <PageLoader />;

  const { section, prev, next, position } = data;

  return (
    <div className="mx-auto max-w-3xl px-margin-mobile py-10 md:px-margin-desktop">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-caption text-secondary">
        <Link to="/kitaplar" className="hover:text-primary">
          Konu Anlatımı
        </Link>
        <span>/</span>
        <Link to={`/kitaplar/${bookSlug}`} className="hover:text-primary">
          {data.book.title}
        </Link>
        <span>/</span>
        <span>Bölüm {section.chapterNumber}</span>
      </nav>

      <div className="text-label-sm uppercase tracking-wider text-primary">
        {section.chapterTitle}
      </div>
      <h1 className="mt-1 text-headline-lg text-on-surface">
        {section.number} {section.title}
      </h1>
      <div className="mt-2 text-caption text-secondary">
        {position.index} / {position.total} bölüm
      </div>

      <RichText html={section.content} className="mt-8 text-body-md leading-relaxed" />

      <AdSlot code="book_bottom" className="mt-10" />

      {/* Alt aksiyonlar */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-surface-variant pt-6">
        {prev ? (
          <Link to={`/kitaplar/${bookSlug}/${prev.slug}`} className="btn-outline">
            <Icon name="arrow_back" size={18} /> {prev.number}
          </Link>
        ) : (
          <span />
        )}

        {user && (
          <button
            type="button"
            onClick={markRead}
            disabled={read}
            className={read ? 'btn-outline border-success text-success' : 'btn-primary'}
          >
            <Icon name={read ? 'check_circle' : 'check'} size={18} />
            {read ? 'Okundu' : 'Okudum olarak işaretle'}
          </button>
        )}

        {next ? (
          <Link to={`/kitaplar/${bookSlug}/${next.slug}`} className="btn-outline border-primary text-primary">
            {next.number} <Icon name="arrow_forward" size={18} />
          </Link>
        ) : (
          <span />
        )}
      </div>

      {next && (
        <Link
          to={`/kitaplar/${bookSlug}/${next.slug}`}
          className="card mt-4 block p-4 hover:shadow-level2"
        >
          <div className="text-caption text-secondary">Sıradaki bölüm</div>
          <div className="text-body-md text-on-surface">
            {next.number} {next.title}
          </div>
        </Link>
      )}
    </div>
  );
}
