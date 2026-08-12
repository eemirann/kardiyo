import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { AdminHeader, DataTable, Field, Modal, RowActions, StatusPill, Toggle } from '../../components/admin';
import { DifficultyChip, ErrorBox, Icon, PageLoader, Spinner } from '../../components/ui';

const empty = {
  title: '',
  description: '',
  topicId: '',
  durationMinutes: 30,
  isPremium: false,
  isActive: true,
  questionIds: [],
};

export default function AdminExams() {
  const toast = useToast();
  const [exams, setExams] = useState([]);
  const [topics, setTopics] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [qFilter, setQFilter] = useState('');

  const load = () => {
    setLoading(true);
    api
      .get('/admin/exams')
      .then((d) => {
        setExams(d.exams);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get('/admin/topics').then((d) => setTopics(d.topics)).catch(() => {});
    // Soru secici icin tum sorularin ozeti
    api.get('/admin/questions?limit=200').then((d) => setQuestions(d.questions)).catch(() => {});
  }, []);

  const openEdit = async (exam) => {
    try {
      const d = await api.get(`/admin/exams/${exam.id}`);
      setEditing({
        id: exam.id,
        form: {
          title: d.exam.title,
          description: d.exam.description || '',
          topicId: d.exam.topic_id || '',
          durationMinutes: d.exam.duration_minutes,
          isPremium: d.exam.is_premium,
          isActive: d.exam.is_active,
          questionIds: d.questionIds,
        },
      });
    } catch (err) {
      toast.error('Sınav yüklenemedi', err.message);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (editing.form.questionIds.length === 0) {
      toast.error('En az bir soru seçmelisiniz');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...editing.form,
        topicId: editing.form.topicId ? Number(editing.form.topicId) : null,
        durationMinutes: Number(editing.form.durationMinutes),
      };
      if (editing.id) await api.put(`/admin/exams/${editing.id}`, payload);
      else await api.post('/admin/exams', payload);
      toast.success(editing.id ? 'Sınav güncellendi' : 'Sınav oluşturuldu');
      setEditing(null);
      load();
    } catch (err) {
      toast.error('Kaydedilemedi', err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (exam) => {
    if (!window.confirm(`"${exam.title}" ve tüm oturum kayıtları silinecek. Emin misiniz?`)) return;
    try {
      await api.del(`/admin/exams/${exam.id}`);
      toast.success('Sınav silindi');
      load();
    } catch (err) {
      toast.error('Silinemedi', err.message);
    }
  };

  const toggleQuestion = (id) =>
    setEditing((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        questionIds: prev.form.questionIds.includes(id)
          ? prev.form.questionIds.filter((x) => x !== id)
          : [...prev.form.questionIds, id],
      },
    }));

  const visibleQuestions = questions.filter((q) =>
    qFilter ? String(q.topic_id) === qFilter : true
  );

  return (
    <div>
      <AdminHeader
        title="Deneme Sınavları"
        description="Süreli sınavlar oluşturun ve sorularını seçin."
        action={
          <button type="button" className="btn-primary" onClick={() => setEditing({ id: null, form: empty })}>
            <Icon name="add" size={18} /> Yeni sınav
          </button>
        }
      />

      <ErrorBox message={error} onRetry={load} />

      {loading ? (
        <PageLoader />
      ) : (
        <DataTable columns={['Sınav', 'Konu', 'Soru', 'Süre', 'Katılım', 'Durum', '']} empty="Henüz sınav yok.">
          {exams.length > 0 &&
            exams.map((e) => (
              <tr key={e.id} className="hover:bg-surface-container-low">
                <td className="px-4 py-3">
                  <div className="text-body-md text-on-surface">{e.title}</div>
                  {e.is_premium && <span className="text-caption text-primary">Premium</span>}
                </td>
                <td className="px-4 py-3 text-body-md text-secondary">{e.topic_name || 'Karma'}</td>
                <td className="px-4 py-3 text-body-md text-secondary">{e.question_count}</td>
                <td className="px-4 py-3 text-body-md text-secondary">{e.duration_minutes} dk</td>
                <td className="px-4 py-3 text-body-md text-secondary">{e.session_count}</td>
                <td className="px-4 py-3">
                  <StatusPill active={e.is_active} />
                </td>
                <td className="px-4 py-3">
                  <RowActions onEdit={() => openEdit(e)} onDelete={() => remove(e)} />
                </td>
              </tr>
            ))}
        </DataTable>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Sınavı düzenle' : 'Yeni sınav'}
        wide
      >
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Sınav adı">
              <input
                className="input"
                required
                minLength={3}
                value={editing.form.title}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, title: e.target.value } })}
              />
            </Field>
            <Field label="Açıklama">
              <textarea
                className="input"
                rows={2}
                value={editing.form.description}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, description: e.target.value } })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Konu" hint="Boş bırakılırsa karma sınav olur.">
                <select
                  className="input"
                  value={editing.form.topicId}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, topicId: e.target.value } })}
                >
                  <option value="">Karma</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Süre (dakika)">
                <input
                  type="number"
                  min={1}
                  max={600}
                  className="input"
                  required
                  value={editing.form.durationMinutes}
                  onChange={(e) =>
                    setEditing({ ...editing, form: { ...editing.form, durationMinutes: e.target.value } })
                  }
                />
              </Field>
            </div>

            <Field label={`Sorular (${editing.form.questionIds.length} seçili)`}>
              <select className="input mb-2" value={qFilter} onChange={(e) => setQFilter(e.target.value)}>
                <option value="">Tüm konular</option>
                {topics.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-outline-variant p-2">
                {visibleQuestions.map((q) => (
                  <label
                    key={q.id}
                    className="flex cursor-pointer items-start gap-2 rounded p-2 hover:bg-surface-container-low"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-outline text-primary focus:ring-primary"
                      checked={editing.form.questionIds.includes(q.id)}
                      onChange={() => toggleQuestion(q.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className="line-clamp-1 text-body-md text-on-surface"
                        dangerouslySetInnerHTML={{ __html: q.body }}
                      />
                      <span className="mt-0.5 flex items-center gap-2 text-caption text-secondary">
                        #{q.id} · {q.topic_name} <DifficultyChip difficulty={q.difficulty} />
                      </span>
                    </span>
                  </label>
                ))}
                {visibleQuestions.length === 0 && (
                  <p className="p-3 text-center text-body-md text-secondary">Bu filtrede soru yok.</p>
                )}
              </div>
            </Field>

            <div className="flex flex-wrap gap-6">
              <Toggle
                checked={editing.form.isPremium}
                onChange={(v) => setEditing({ ...editing, form: { ...editing.form, isPremium: v } })}
                label="Premium sınav"
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
    </div>
  );
}
