import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { AdminHeader, DataTable, Field, Modal, RowActions, StatusPill, Toggle } from '../../components/admin';
import { ErrorBox, Icon, PageLoader, Spinner } from '../../components/ui';

const empty = {
  name: '',
  slug: '',
  description: '',
  icon: 'cardiology',
  sortOrder: 0,
  isActive: true,
  isListed: true,
};

export default function AdminTopics() {
  const toast = useToast();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get('/admin/topics')
      .then((d) => {
        setTopics(d.topics);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...editing.form, sortOrder: Number(editing.form.sortOrder) || 0 };
      if (editing.id) await api.put(`/admin/topics/${editing.id}`, payload);
      else await api.post('/admin/topics', payload);
      toast.success(editing.id ? 'Konu güncellendi' : 'Konu eklendi');
      setEditing(null);
      load();
    } catch (err) {
      toast.error('Kaydedilemedi', err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`"${t.name}" konusu silinsin mi?`)) return;
    try {
      await api.del(`/admin/topics/${t.id}`);
      toast.success('Konu silindi');
      load();
    } catch (err) {
      toast.error('Silinemedi', err.message);
    }
  };

  return (
    <div>
      <AdminHeader
        title="Konular"
        description="Soru bankası ve videoların gruplandığı ana başlıklar."
        action={
          <button type="button" className="btn-primary" onClick={() => setEditing({ id: null, form: empty })}>
            <Icon name="add" size={18} /> Yeni konu
          </button>
        }
      />

      <ErrorBox message={error} onRetry={load} />

      {loading ? (
        <PageLoader />
      ) : (
        <DataTable columns={['Sıra', 'Konu', 'Slug', 'Durum', '']} empty="Henüz konu yok.">
          {topics.length > 0 &&
            topics.map((t) => (
              <tr key={t.id} className="hover:bg-surface-container-low">
                <td className="px-4 py-3 text-body-md text-secondary">{t.sort_order}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon name={t.icon || 'cardiology'} size={20} className="text-primary" />
                    <div>
                      <div className="text-body-md text-on-surface">{t.name}</div>
                      {t.description && <div className="text-caption text-secondary">{t.description}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-caption text-secondary">{t.slug}</td>
                <td className="px-4 py-3">
                  <StatusPill active={t.is_active} />
                </td>
                <td className="px-4 py-3">
                  <RowActions
                    onEdit={() =>
                      setEditing({
                        id: t.id,
                        form: {
                          name: t.name,
                          slug: t.slug,
                          description: t.description || '',
                          icon: t.icon || '',
                          sortOrder: t.sort_order,
                          isActive: t.is_active,
                          isListed: t.is_listed,
                        },
                      })
                    }
                    onDelete={() => remove(t)}
                  />
                </td>
              </tr>
            ))}
        </DataTable>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Konuyu düzenle' : 'Yeni konu'}>
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Konu adı">
              <input
                className="input"
                required
                minLength={2}
                value={editing.form.name}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })}
              />
            </Field>
            <Field label="Slug (adres)" hint="Boş bırakılırsa addan otomatik üretilir.">
              <input
                className="input font-mono"
                value={editing.form.slug}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, slug: e.target.value } })}
                placeholder="ekg-analizi"
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
            <div className="grid grid-cols-2 gap-4">
              <Field label="İkon" hint="Material Symbols adı">
                <input
                  className="input font-mono"
                  value={editing.form.icon}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, icon: e.target.value } })}
                  placeholder="monitor_heart"
                />
              </Field>
              <Field label="Sıra">
                <input
                  type="number"
                  className="input"
                  value={editing.form.sortOrder}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, sortOrder: e.target.value } })}
                />
              </Field>
            </div>
            <Toggle
              checked={editing.form.isActive}
              onChange={(v) => setEditing({ ...editing, form: { ...editing.form, isActive: v } })}
              label="Yayında"
            />
            <div>
              <Toggle
                checked={editing.form.isListed}
                onChange={(v) => setEditing({ ...editing, form: { ...editing.form, isListed: v } })}
                label="Konular sayfasında listele"
              />
              <p className="mt-1 text-caption text-secondary">
                Kendi sayfası olan bölümlerde (EKG Quiz) kapatın; konu çalışmaya devam eder.
              </p>
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
