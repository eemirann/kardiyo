import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { AdminHeader, DataTable, Field, Modal, RowActions, StatusPill, Toggle } from '../../components/admin';
import { DifficultyChip, ErrorBox, Icon, PageLoader, Spinner } from '../../components/ui';

// Varsayilan 5 sik; form 2 ile 6 arasinda sik eklemeye/silmeye izin verir (API siniri 6)
const LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

const emptyForm = (topicId) => ({
  topicId: topicId || '',
  type: 'classic',
  difficulty: 'medium',
  imageUrl: '',
  imageAlt: '',
  body: '',
  explanation: '',
  isPremium: false,
  isActive: true,
  options: LABELS.slice(0, 5).map((label) => ({ label, text: '', isCorrect: false })),
});

export default function AdminQuestions() {
  const toast = useToast();
  const [topics, setTopics] = useState([]);
  const [data, setData] = useState({ questions: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ topicId: '', search: '' });
  const [page, setPage] = useState(0);

  const [editing, setEditing] = useState(null); // {id|null, form}
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const PAGE_SIZE = 20;

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    if (filters.topicId) params.set('topicId', filters.topicId);
    if (filters.search) params.set('search', filters.search);
    api
      .get(`/admin/questions?${params}`)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => {
    api.get('/admin/topics').then((d) => setTopics(d.topics)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const openNew = () => setEditing({ id: null, form: emptyForm(topics[0]?.id) });

  const openEdit = (q) =>
    setEditing({
      id: q.id,
      form: {
        topicId: q.topic_id,
        type: q.type,
        difficulty: q.difficulty,
        imageUrl: q.image_url || '',
        imageAlt: q.image_alt || '',
        body: q.body,
        explanation: q.explanation,
        isPremium: q.is_premium,
        isActive: q.is_active,
        options: (q.options || []).map((o) => ({
          label: o.label,
          text: o.text,
          isCorrect: o.isCorrect,
        })),
      },
    });

  const save = async (e) => {
    e.preventDefault();
    const f = editing.form;
    const filled = f.options.filter((o) => o.text.trim());
    if (filled.length < 2) {
      toast.error('En az 2 şık doldurulmalı');
      return;
    }
    if (filled.filter((o) => o.isCorrect).length !== 1) {
      toast.error('Tam olarak bir şık doğru işaretlenmeli');
      return;
    }

    const payload = { ...f, topicId: Number(f.topicId), options: filled };
    setSaving(true);
    try {
      if (editing.id) await api.put(`/admin/questions/${editing.id}`, payload);
      else await api.post('/admin/questions', payload);
      toast.success(editing.id ? 'Soru güncellendi' : 'Soru eklendi');
      setEditing(null);
      load();
    } catch (err) {
      toast.error('Kaydedilemedi', err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (q) => {
    if (!window.confirm(`Bu soru ve ${q.attempt_count} cevap kaydı silinecek. Emin misiniz?`)) return;
    try {
      await api.del(`/admin/questions/${q.id}`);
      toast.success('Soru silindi');
      load();
    } catch (err) {
      toast.error('Silinemedi', err.message);
    }
  };

  const totalPages = Math.ceil(data.total / PAGE_SIZE);

  return (
    <div>
      <AdminHeader
        title="Sorular"
        description={`Toplam ${data.total} soru.`}
        action={
          <div className="flex gap-2">
            <button type="button" onClick={() => setBulkOpen(true)} className="btn-outline">
              <Icon name="upload_file" size={18} /> Toplu ekle
            </button>
            <button type="button" onClick={openNew} className="btn-primary" disabled={topics.length === 0}>
              <Icon name="add" size={18} /> Yeni soru
            </button>
          </div>
        }
      />

      {topics.length === 0 && (
        <div className="mb-4">
          <ErrorBox message="Önce en az bir konu eklemelisiniz (Konular sayfası)." />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          className="input max-w-xs"
          value={filters.topicId}
          onChange={(e) => {
            setPage(0);
            setFilters({ ...filters, topicId: e.target.value });
          }}
        >
          <option value="">Tüm konular</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          className="input max-w-xs"
          placeholder="Soru metninde ara…"
          value={filters.search}
          onChange={(e) => {
            setPage(0);
            setFilters({ ...filters, search: e.target.value });
          }}
        />
      </div>

      <ErrorBox message={error} onRetry={load} />

      {loading ? (
        <PageLoader />
      ) : (
        <>
          <DataTable
            columns={['Soru', 'Konu', 'Zorluk', 'Durum', 'Cevap', '']}
            empty="Bu filtrede soru yok."
          >
            {data.questions.length > 0 &&
              data.questions.map((q) => (
                <tr key={q.id} className="hover:bg-surface-container-low">
                  <td className="max-w-md px-4 py-3">
                    <div
                      className="line-clamp-2 text-body-md text-on-surface"
                      dangerouslySetInnerHTML={{ __html: q.body }}
                    />
                    <div className="mt-1 flex gap-2 text-caption text-secondary">
                      <span>#{q.id}</span>
                      <span>{q.type === 'case' ? 'Vaka' : 'Klasik'}</span>
                      {q.is_premium && <span className="text-primary">Premium</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-body-md text-secondary">{q.topic_name}</td>
                  <td className="px-4 py-3">
                    <DifficultyChip difficulty={q.difficulty} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill active={q.is_active} />
                  </td>
                  <td className="px-4 py-3 text-body-md text-secondary">{q.attempt_count}</td>
                  <td className="px-4 py-3">
                    <RowActions onEdit={() => openEdit(q)} onDelete={() => remove(q)} />
                  </td>
                </tr>
              ))}
          </DataTable>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button type="button" className="btn-outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <Icon name="arrow_back" size={18} /> Önceki
              </button>
              <span className="text-body-md text-secondary">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                className="btn-outline"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Sonraki <Icon name="arrow_forward" size={18} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Soru formu */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Soru #${editing.id} düzenle` : 'Yeni soru'}
        wide
      >
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Konu">
                <select
                  className="input"
                  required
                  value={editing.form.topicId}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, topicId: e.target.value } })}
                >
                  <option value="">Seçin…</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tür">
                <select
                  className="input"
                  value={editing.form.type}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, type: e.target.value } })}
                >
                  <option value="classic">Klasik soru</option>
                  <option value="case">Vaka sorusu</option>
                </select>
              </Field>
              <Field label="Zorluk" hint="Kolay 5 · Orta 10 · Zor 20 puan">
                <select
                  className="input"
                  value={editing.form.difficulty}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, difficulty: e.target.value } })}
                >
                  <option value="easy">Kolay</option>
                  <option value="medium">Orta</option>
                  <option value="hard">Zor</option>
                </select>
              </Field>
            </div>

            <Field
              label="Görsel (EKG vb.)"
              hint="Dosyayı web/public/ekg/ klasörüne koyup yolunu yazın: /ekg/dosya-adi.png — boş bırakılabilir."
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="flex-1 space-y-2">
                  <input
                    className="input font-mono text-sm"
                    value={editing.form.imageUrl}
                    placeholder="/ekg/inferior-stemi-01.png"
                    onChange={(e) =>
                      setEditing({ ...editing, form: { ...editing.form, imageUrl: e.target.value } })
                    }
                  />
                  <input
                    className="input"
                    value={editing.form.imageAlt}
                    placeholder="Görsel açıklaması (görme engelliler ve görsel yüklenmezse)"
                    onChange={(e) =>
                      setEditing({ ...editing, form: { ...editing.form, imageAlt: e.target.value } })
                    }
                  />
                </div>
                {/* Yol yanlissa tarayici kirik gorsel gosterir; onizleme bunu aninda belli eder */}
                {editing.form.imageUrl.trim() && (
                  <img
                    src={editing.form.imageUrl.trim()}
                    alt="Önizleme"
                    className="h-24 w-40 shrink-0 rounded-lg border border-outline-variant bg-white object-contain"
                  />
                )}
              </div>
            </Field>

            <Field label="Soru metni" hint="Basit HTML kullanabilirsiniz: <p>, <strong>, <ul>, <table>…">
              <textarea
                className="input min-h-[140px] font-mono text-sm"
                required
                value={editing.form.body}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, body: e.target.value } })}
                placeholder="<p>65 yaşında erkek hasta…</p>"
              />
            </Field>

            <Field label="Şıklar" hint="Doğru şıkkı işaretleyin. Boş bıraktığınız şıklar kaydedilmez.">
              <div className="space-y-2">
                {editing.form.options.map((o, i) => (
                  <div key={o.label} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct"
                      className="border-outline text-primary focus:ring-primary"
                      checked={o.isCorrect}
                      onChange={() =>
                        setEditing({
                          ...editing,
                          form: {
                            ...editing.form,
                            options: editing.form.options.map((x, j) => ({ ...x, isCorrect: i === j })),
                          },
                        })
                      }
                    />
                    <span className="w-6 text-label-sm text-secondary">{o.label})</span>
                    <input
                      className="input flex-1"
                      value={o.text}
                      placeholder={`${o.label} şıkkı`}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          form: {
                            ...editing.form,
                            options: editing.form.options.map((x, j) =>
                              i === j ? { ...x, text: e.target.value } : x
                            ),
                          },
                        })
                      }
                    />
                    {editing.form.options.length > 2 && (
                      <button
                        type="button"
                        title="Bu şıkkı kaldır"
                        className="btn-ghost px-2 py-1.5 text-error hover:bg-error-container"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            form: {
                              ...editing.form,
                              // Etiketler her zaman A'dan basliyor: silinince yeniden harflenir
                              options: editing.form.options
                                .filter((_, j) => j !== i)
                                .map((x, j) => ({ ...x, label: LABELS[j] })),
                            },
                          })
                        }
                      >
                        <Icon name="close" size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {editing.form.options.length < LABELS.length && (
                <button
                  type="button"
                  className="btn-outline mt-3 px-3 py-1.5 text-label-sm"
                  onClick={() =>
                    setEditing({
                      ...editing,
                      form: {
                        ...editing.form,
                        options: [
                          ...editing.form.options,
                          { label: LABELS[editing.form.options.length], text: '', isCorrect: false },
                        ],
                      },
                    })
                  }
                >
                  <Icon name="add" size={16} /> Şık ekle
                </button>
              )}
            </Field>

            <Field label="Ayrıntılı çözüm">
              <textarea
                className="input min-h-[140px] font-mono text-sm"
                value={editing.form.explanation}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, explanation: e.target.value } })}
                placeholder="<p><strong>Doğru Cevap: B)</strong> …</p>"
              />
            </Field>

            <div className="flex flex-wrap gap-6">
              <Toggle
                checked={editing.form.isPremium}
                onChange={(v) => setEditing({ ...editing, form: { ...editing.form, isPremium: v } })}
                label="Premium içerik"
              />
              <Toggle
                checked={editing.form.isActive}
                onChange={(v) => setEditing({ ...editing, form: { ...editing.form, isActive: v } })}
                label="Yayında"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-surface-variant pt-4">
              <button type="button" className="btn-outline" onClick={() => setEditing(null)}>
                Vazgeç
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Spinner /> : <Icon name="save" size={18} />} Kaydet
              </button>
            </div>
          </form>
        )}
      </Modal>

      <BulkModal open={bulkOpen} onClose={() => setBulkOpen(false)} onDone={load} topics={topics} />
    </div>
  );
}

/** JSON ile toplu soru ice aktarma. */
function BulkModal({ open, onClose, onDone, topics }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);

  const example = JSON.stringify(
    [
      {
        topicId: topics[0]?.id ?? 1,
        type: 'classic',
        difficulty: 'medium',
        body: '<p>Soru metni…</p>',
        explanation: '<p>Çözüm…</p>',
        isPremium: false,
        options: [
          { label: 'A', text: 'Birinci şık', isCorrect: false },
          { label: 'B', text: 'İkinci şık', isCorrect: true },
        ],
      },
    ],
    null,
    2
  );

  const submit = async () => {
    let parsed;
    try {
      parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('JSON bir dizi olmalı.');
    } catch (err) {
      toast.error('JSON okunamadı', err.message);
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/admin/questions/bulk', { questions: parsed });
      setReport(res);
      if (res.createdCount) toast.success(`${res.createdCount} soru eklendi`);
      onDone();
    } catch (err) {
      toast.error('İçe aktarılamadı', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Toplu soru ekle" wide>
      <p className="mb-3 text-body-md text-secondary">
        Soruları JSON dizisi olarak yapıştırın. Hatalı kayıtlar atlanır ve aşağıda raporlanır.
      </p>
      <details className="mb-3">
        <summary className="cursor-pointer text-label-sm text-primary">Örnek format</summary>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-container-low p-3 text-caption">{example}</pre>
      </details>
      <textarea
        className="input min-h-[240px] font-mono text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="[ { … } ]"
      />
      {report && (
        <div className="mt-3 rounded-lg bg-surface-container-low p-3 text-body-md">
          <div className="text-success">{report.createdCount} soru eklendi.</div>
          {report.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-caption text-error">
              {report.errors.map((e) => (
                <li key={e.index}>
                  #{e.index + 1}: {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-3">
        <button type="button" className="btn-outline" onClick={onClose}>
          Kapat
        </button>
        <button type="button" className="btn-primary" onClick={submit} disabled={busy || !text.trim()}>
          {busy ? <Spinner /> : <Icon name="upload" size={18} />} İçe aktar
        </button>
      </div>
    </Modal>
  );
}
