import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { AdminHeader, DataTable, Field, Modal, RowActions, StatusPill, Toggle } from '../../components/admin';
import { ErrorBox, Icon, PageLoader, Spinner } from '../../components/ui';

const emptyBook = {
  title: '',
  slug: '',
  subtitle: '',
  description: '',
  coverUrl: '',
  isPremium: false,
  isActive: true,
  sortOrder: 0,
};

const emptyChapter = { bookId: '', number: '', title: '', subtitle: '', sortOrder: 0 };

const emptySection = {
  chapterId: '',
  topicId: '',
  number: '',
  slug: '',
  title: '',
  content: '',
  isPremium: false,
  sortOrder: 0,
};

export default function AdminBooks() {
  const toast = useToast();
  const [books, setBooks] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState(null); // secili kitap
  const [chapters, setChapters] = useState([]);
  const [treeLoading, setTreeLoading] = useState(false);

  const [editingBook, setEditingBook] = useState(null);
  const [editingChapter, setEditingChapter] = useState(null);
  const [editingSection, setEditingSection] = useState(null);

  const loadBooks = useCallback(() => {
    setLoading(true);
    api
      .get('/admin/books')
      .then((d) => {
        setBooks(d.books);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadTree = useCallback(
    (bookId) => {
      if (!bookId) {
        setChapters([]);
        return;
      }
      setTreeLoading(true);
      api
        .get(`/admin/books/${bookId}/tree`)
        .then((d) => setChapters(d.chapters))
        .catch((e) => toast.error('İçindekiler yüklenemedi', e.message))
        .finally(() => setTreeLoading(false));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    []
  );

  useEffect(() => {
    loadBooks();
    api.get('/admin/topics').then((d) => setTopics(d.topics)).catch(() => {});
  }, [loadBooks]);

  useEffect(() => {
    loadTree(selected?.id);
  }, [selected, loadTree]);

  const setBookForm = (patch) =>
    setEditingBook((prev) => ({ ...prev, form: { ...prev.form, ...patch } }));
  const setChapterForm = (patch) =>
    setEditingChapter((prev) => ({ ...prev, form: { ...prev.form, ...patch } }));
  const setSectionForm = (patch) =>
    setEditingSection((prev) => ({ ...prev, form: { ...prev.form, ...patch } }));

  // ------------------------------------------------------------------ Kitap

  const saveBook = async (e) => {
    e.preventDefault();
    const f = editingBook.form;
    setSaving(true);
    try {
      const payload = {
        ...f,
        slug: f.slug || undefined,
        subtitle: f.subtitle || null,
        description: f.description || null,
        coverUrl: f.coverUrl || null,
        sortOrder: Number(f.sortOrder) || 0,
      };
      if (editingBook.id) await api.put(`/admin/books/${editingBook.id}`, payload);
      else await api.post('/admin/books', payload);
      toast.success(editingBook.id ? 'Kitap güncellendi' : 'Kitap eklendi');
      setEditingBook(null);
      loadBooks();
    } catch (err) {
      toast.error('Kaydedilemedi', err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeBook = async (b) => {
    if (
      !window.confirm(
        `"${b.title}" kitabı, ${b.chapter_count} bölümü ve ${b.section_count} alt bölümüyle birlikte silinsin mi? Bu işlem geri alınamaz.`
      )
    )
      return;
    try {
      await api.del(`/admin/books/${b.id}`);
      toast.success('Kitap silindi');
      if (selected?.id === b.id) setSelected(null);
      loadBooks();
    } catch (err) {
      toast.error('Silinemedi', err.message);
    }
  };

  // ------------------------------------------------------------------ Bölüm

  const saveChapter = async (e) => {
    e.preventDefault();
    const f = editingChapter.form;
    setSaving(true);
    try {
      const payload = {
        ...f,
        bookId: Number(f.bookId),
        subtitle: f.subtitle || null,
        sortOrder: Number(f.sortOrder) || 0,
      };
      if (editingChapter.id) await api.put(`/admin/book-chapters/${editingChapter.id}`, payload);
      else await api.post('/admin/book-chapters', payload);
      toast.success(editingChapter.id ? 'Bölüm güncellendi' : 'Bölüm eklendi');
      setEditingChapter(null);
      loadTree(selected.id);
      loadBooks();
    } catch (err) {
      toast.error('Kaydedilemedi', err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeChapter = async (ch) => {
    if (
      !window.confirm(
        `"${ch.number} ${ch.title}" bölümü ve ${ch.sections.length} alt bölümü silinsin mi?`
      )
    )
      return;
    try {
      await api.del(`/admin/book-chapters/${ch.id}`);
      toast.success('Bölüm silindi');
      loadTree(selected.id);
      loadBooks();
    } catch (err) {
      toast.error('Silinemedi', err.message);
    }
  };

  // -------------------------------------------------------------- Alt bölüm

  /** Agac icerigi tasimadigi icin duzenlemede tam kayit ayrica cekilir. */
  const openSection = async (s) => {
    try {
      const { section } = await api.get(`/admin/book-sections/${s.id}`);
      setEditingSection({
        id: section.id,
        form: {
          chapterId: section.chapter_id,
          topicId: section.topic_id || '',
          number: section.number,
          slug: section.slug,
          title: section.title,
          content: section.content || '',
          isPremium: section.is_premium,
          sortOrder: section.sort_order,
        },
      });
    } catch (err) {
      toast.error('Alt bölüm açılamadı', err.message);
    }
  };

  const saveSection = async (e) => {
    e.preventDefault();
    const f = editingSection.form;
    setSaving(true);
    try {
      const payload = {
        ...f,
        chapterId: Number(f.chapterId),
        topicId: f.topicId ? Number(f.topicId) : null,
        slug: f.slug || undefined,
        sortOrder: Number(f.sortOrder) || 0,
      };
      if (editingSection.id) await api.put(`/admin/book-sections/${editingSection.id}`, payload);
      else await api.post('/admin/book-sections', payload);
      toast.success(editingSection.id ? 'Alt bölüm güncellendi' : 'Alt bölüm eklendi');
      setEditingSection(null);
      loadTree(selected.id);
      loadBooks();
    } catch (err) {
      toast.error('Kaydedilemedi', err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeSection = async (s) => {
    if (!window.confirm(`"${s.number} ${s.title}" alt bölümü silinsin mi?`)) return;
    try {
      await api.del(`/admin/book-sections/${s.id}`);
      toast.success('Alt bölüm silindi');
      loadTree(selected.id);
      loadBooks();
    } catch (err) {
      toast.error('Silinemedi', err.message);
    }
  };

  return (
    <div>
      <AdminHeader
        title="Konu Anlatımı"
        description="Kitapları, bölümleri ve alt bölüm içeriklerini yönetin."
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setEditingBook({ id: null, form: emptyBook })}
          >
            <Icon name="add" size={18} /> Yeni kitap
          </button>
        }
      />

      <ErrorBox message={error} onRetry={loadBooks} />

      {loading ? (
        <PageLoader />
      ) : (
        <DataTable
          columns={['Kitap', 'Bölüm', 'Alt bölüm', 'Sıra', 'Durum', '']}
          empty="Henüz kitap yok."
        >
          {books.length > 0 &&
            books.map((b) => (
              <tr
                key={b.id}
                className={`hover:bg-surface-container-low ${
                  selected?.id === b.id ? 'bg-surface-container-low' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-left text-body-md text-on-surface hover:text-primary"
                    onClick={() => setSelected(selected?.id === b.id ? null : b)}
                    title="İçindekileri düzenle"
                  >
                    {b.title}
                  </button>
                  {b.is_premium && <span className="ml-2 text-caption text-primary">Premium</span>}
                  <div className="font-mono text-caption text-secondary">{b.slug}</div>
                </td>
                <td className="px-4 py-3 text-body-md text-secondary">{b.chapter_count}</td>
                <td className="px-4 py-3 text-body-md text-secondary">{b.section_count}</td>
                <td className="px-4 py-3 text-body-md text-secondary">{b.sort_order}</td>
                <td className="px-4 py-3">
                  <StatusPill active={b.is_active} />
                </td>
                <td className="px-4 py-3">
                  <RowActions
                    onEdit={() =>
                      setEditingBook({
                        id: b.id,
                        form: {
                          title: b.title,
                          slug: b.slug,
                          subtitle: b.subtitle || '',
                          description: b.description || '',
                          coverUrl: b.cover_url || '',
                          isPremium: b.is_premium,
                          isActive: b.is_active,
                          sortOrder: b.sort_order,
                        },
                      })
                    }
                    onDelete={() => removeBook(b)}
                  />
                </td>
              </tr>
            ))}
        </DataTable>
      )}

      {/* ------------------------------------------------------- İçindekiler */}

      {selected && (
        <div className="mt-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-headline-md text-on-surface">{selected.title} — içindekiler</h2>
              <p className="text-body-md text-secondary">
                Bölüm ekleyin, alt bölümlerin içeriğini düzenleyin.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-outline" onClick={() => setSelected(null)}>
                <Icon name="close" size={18} /> Kapat
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  setEditingChapter({
                    id: null,
                    form: {
                      ...emptyChapter,
                      bookId: selected.id,
                      number: String(chapters.length + 1),
                      sortOrder: chapters.length,
                    },
                  })
                }
              >
                <Icon name="add" size={18} /> Yeni bölüm
              </button>
            </div>
          </div>

          {treeLoading ? (
            <PageLoader />
          ) : chapters.length === 0 ? (
            <div className="card px-4 py-10 text-center text-secondary">
              Bu kitapta henüz bölüm yok.
            </div>
          ) : (
            <div className="space-y-4">
              {chapters.map((ch) => (
                <div key={ch.id} className="card overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-variant bg-surface-container px-4 py-3">
                    <div>
                      <div className="text-body-lg font-semibold text-on-surface">
                        {ch.number}. {ch.title}
                      </div>
                      {ch.subtitle && (
                        <div className="text-caption text-secondary">{ch.subtitle}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1.5 text-label-sm"
                        onClick={() =>
                          setEditingSection({
                            id: null,
                            form: {
                              ...emptySection,
                              chapterId: ch.id,
                              number: `${ch.number}.${ch.sections.length + 1}`,
                              sortOrder: ch.sections.length,
                            },
                          })
                        }
                      >
                        <Icon name="add" size={18} /> Alt bölüm
                      </button>
                      <RowActions
                        onEdit={() =>
                          setEditingChapter({
                            id: ch.id,
                            form: {
                              bookId: ch.book_id,
                              number: ch.number,
                              title: ch.title,
                              subtitle: ch.subtitle || '',
                              sortOrder: ch.sort_order,
                            },
                          })
                        }
                        onDelete={() => removeChapter(ch)}
                      />
                    </div>
                  </div>

                  {ch.sections.length === 0 ? (
                    <p className="px-4 py-6 text-center text-body-md text-secondary">
                      Alt bölüm yok.
                    </p>
                  ) : (
                    <ul className="divide-y divide-surface-variant">
                      {ch.sections.map((s) => (
                        <li
                          key={s.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-container-low"
                        >
                          <div className="min-w-0">
                            <button
                              type="button"
                              className="text-left text-body-md text-on-surface hover:text-primary"
                              onClick={() => openSection(s)}
                            >
                              {s.number} {s.title}
                            </button>
                            <div className="text-caption text-secondary">
                              <span className="font-mono">{s.slug}</span>
                              {' · '}
                              {s.content_length > 0
                                ? `${s.content_length.toLocaleString('tr-TR')} karakter`
                                : 'içerik boş'}
                              {s.is_premium && ' · Premium'}
                            </div>
                          </div>
                          <RowActions
                            onEdit={() => openSection(s)}
                            onDelete={() => removeSection(s)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ Modallar */}

      <Modal
        open={Boolean(editingBook)}
        onClose={() => setEditingBook(null)}
        title={editingBook?.id ? 'Kitabı düzenle' : 'Yeni kitap'}
      >
        {editingBook && (
          <form onSubmit={saveBook} className="space-y-4">
            <Field label="Başlık">
              <input
                className="input"
                required
                minLength={2}
                value={editingBook.form.title}
                onChange={(e) => setBookForm({ title: e.target.value })}
              />
            </Field>
            <Field label="Alt başlık">
              <input
                className="input"
                value={editingBook.form.subtitle}
                onChange={(e) => setBookForm({ subtitle: e.target.value })}
              />
            </Field>
            <Field label="Adres (slug)" hint="Boş bırakılırsa başlıktan üretilir.">
              <input
                className="input font-mono"
                value={editingBook.form.slug}
                onChange={(e) => setBookForm({ slug: e.target.value })}
              />
            </Field>
            <Field label="Açıklama">
              <textarea
                className="input"
                rows={3}
                value={editingBook.form.description}
                onChange={(e) => setBookForm({ description: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kapak görseli (URL)">
                <input
                  type="url"
                  className="input"
                  value={editingBook.form.coverUrl}
                  onChange={(e) => setBookForm({ coverUrl: e.target.value })}
                />
              </Field>
              <Field label="Sıra">
                <input
                  type="number"
                  className="input"
                  value={editingBook.form.sortOrder}
                  onChange={(e) => setBookForm({ sortOrder: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-6">
              <Toggle
                checked={editingBook.form.isPremium}
                onChange={(v) => setBookForm({ isPremium: v })}
                label="Premium içerik"
              />
              <Toggle
                checked={editingBook.form.isActive}
                onChange={(v) => setBookForm({ isActive: v })}
                label="Yayında"
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-surface-variant pt-4">
              <button type="button" className="btn-outline" onClick={() => setEditingBook(null)}>
                Vazgeç
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Spinner /> : <Icon name="save" size={18} />} Kaydet
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(editingChapter)}
        onClose={() => setEditingChapter(null)}
        title={editingChapter?.id ? 'Bölümü düzenle' : 'Yeni bölüm'}
      >
        {editingChapter && (
          <form onSubmit={saveChapter} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[100px_1fr]">
              <Field label="No" hint="Örn. 3">
                <input
                  className="input"
                  required
                  value={editingChapter.form.number}
                  onChange={(e) => setChapterForm({ number: e.target.value })}
                />
              </Field>
              <Field label="Başlık">
                <input
                  className="input"
                  required
                  minLength={2}
                  value={editingChapter.form.title}
                  onChange={(e) => setChapterForm({ title: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Alt başlık">
              <input
                className="input"
                value={editingChapter.form.subtitle}
                onChange={(e) => setChapterForm({ subtitle: e.target.value })}
              />
            </Field>
            <Field label="Sıra">
              <input
                type="number"
                className="input"
                value={editingChapter.form.sortOrder}
                onChange={(e) => setChapterForm({ sortOrder: e.target.value })}
              />
            </Field>
            <div className="flex justify-end gap-3 border-t border-surface-variant pt-4">
              <button type="button" className="btn-outline" onClick={() => setEditingChapter(null)}>
                Vazgeç
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Spinner /> : <Icon name="save" size={18} />} Kaydet
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(editingSection)}
        onClose={() => setEditingSection(null)}
        title={editingSection?.id ? 'Alt bölümü düzenle' : 'Yeni alt bölüm'}
        wide
      >
        {editingSection && (
          <form onSubmit={saveSection} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[110px_1fr]">
              <Field label="No" hint="Örn. 3.2">
                <input
                  className="input"
                  required
                  value={editingSection.form.number}
                  onChange={(e) => setSectionForm({ number: e.target.value })}
                />
              </Field>
              <Field label="Başlık">
                <input
                  className="input"
                  required
                  minLength={2}
                  value={editingSection.form.title}
                  onChange={(e) => setSectionForm({ title: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Adres (slug)" hint="Boş bırakılırsa no + başlıktan üretilir.">
              <input
                className="input font-mono"
                value={editingSection.form.slug}
                onChange={(e) => setSectionForm({ slug: e.target.value })}
              />
            </Field>
            <Field
              label="İçerik (HTML)"
              hint="p, ul, ol, table, h3, h4, strong, code gibi etiketler kullanılabilir; sunucuda temizlenir."
            >
              <textarea
                className="input min-h-[320px] font-mono text-sm"
                value={editingSection.form.content}
                onChange={(e) => setSectionForm({ content: e.target.value })}
                placeholder="<p>…</p>"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Konu" hint="Soru bankasıyla eşleştirmek için.">
                <select
                  className="input"
                  value={editingSection.form.topicId}
                  onChange={(e) => setSectionForm({ topicId: e.target.value })}
                >
                  <option value="">Konusuz</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Sıra">
                <input
                  type="number"
                  className="input"
                  value={editingSection.form.sortOrder}
                  onChange={(e) => setSectionForm({ sortOrder: e.target.value })}
                />
              </Field>
            </div>
            <Toggle
              checked={editingSection.form.isPremium}
              onChange={(v) => setSectionForm({ isPremium: v })}
              label="Premium içerik"
            />
            <div className="flex justify-end gap-3 border-t border-surface-variant pt-4">
              <button type="button" className="btn-outline" onClick={() => setEditingSection(null)}>
                Vazgeç
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Spinner /> : <Icon name="save" size={18} />} Kaydet
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
