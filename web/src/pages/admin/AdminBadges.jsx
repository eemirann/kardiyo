import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { AdminHeader, DataTable, Field, Modal, RowActions, StatusPill, Toggle } from '../../components/admin';
import { ErrorBox, Icon, PageLoader, Spinner } from '../../components/ui';

/** Her kural tipinin hangi parametreleri aldigini tanimlar. */
const RULES = {
  questions_solved: {
    label: 'N farklı soruyu doğru çöz',
    fields: [{ key: 'count', label: 'Soru sayısı', type: 'number' }],
  },
  points_total: {
    label: 'Toplam N puana ulaş',
    fields: [{ key: 'points', label: 'Puan', type: 'number' }],
  },
  accuracy: {
    label: 'Genel doğruluk oranı',
    fields: [
      { key: 'minAttempts', label: 'En az deneme', type: 'number' },
      { key: 'accuracy', label: 'Doğruluk (%)', type: 'number' },
    ],
  },
  topic_mastery: {
    label: 'Bir konuda ustalaş',
    fields: [
      { key: 'topicSlug', label: 'Konu slug', type: 'topic' },
      { key: 'count', label: 'En az deneme', type: 'number' },
      { key: 'accuracy', label: 'Doğruluk (%)', type: 'number' },
    ],
  },
  exams_completed: {
    label: 'N sınav tamamla',
    fields: [{ key: 'count', label: 'Sınav sayısı', type: 'number' }],
  },
  videos_completed: {
    label: 'N video tamamla',
    fields: [{ key: 'count', label: 'Video sayısı', type: 'number' }],
  },
};

const empty = {
  code: '',
  name: '',
  description: '',
  icon: 'military_tech',
  ruleType: 'questions_solved',
  ruleParams: { count: 10 },
  sortOrder: 0,
  isActive: true,
};

export default function AdminBadges() {
  const toast = useToast();
  const [badges, setBadges] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get('/admin/badges')
      .then((d) => {
        setBadges(d.badges);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get('/admin/topics').then((d) => setTopics(d.topics)).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const f = editing.form;
      // Sayisal parametreler string olarak gelmesin
      const ruleParams = Object.fromEntries(
        Object.entries(f.ruleParams).map(([k, v]) => [k, k === 'topicSlug' ? v : Number(v)])
      );
      const payload = { ...f, ruleParams, sortOrder: Number(f.sortOrder) || 0 };
      if (editing.id) await api.put(`/admin/badges/${editing.id}`, payload);
      else await api.post('/admin/badges', payload);
      toast.success('Rozet kaydedildi');
      setEditing(null);
      load();
    } catch (err) {
      toast.error('Kaydedilemedi', err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b) => {
    if (!window.confirm(`"${b.name}" rozeti ve ${b.earned_count} kullanıcı kaydı silinecek. Emin misiniz?`))
      return;
    try {
      await api.del(`/admin/badges/${b.id}`);
      toast.success('Rozet silindi');
      load();
    } catch (err) {
      toast.error('Silinemedi', err.message);
    }
  };

  const rule = editing ? RULES[editing.form.ruleType] : null;

  return (
    <div>
      <AdminHeader
        title="Rozetler"
        description="Kurallar veritabanında tutulur; yeni rozet eklemek için kod değişikliği gerekmez."
        action={
          <button type="button" className="btn-primary" onClick={() => setEditing({ id: null, form: empty })}>
            <Icon name="add" size={18} /> Yeni rozet
          </button>
        }
      />

      <ErrorBox message={error} onRetry={load} />

      {loading ? (
        <PageLoader />
      ) : (
        <DataTable columns={['Rozet', 'Kural', 'Kazanan', 'Durum', '']} empty="Henüz rozet yok.">
          {badges.length > 0 &&
            badges.map((b) => (
              <tr key={b.id} className="hover:bg-surface-container-low">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary">
                      <Icon name={b.icon} size={22} />
                    </span>
                    <div>
                      <div className="text-body-md text-on-surface">{b.name}</div>
                      <div className="text-caption text-secondary">{b.description}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-body-md text-secondary">{RULES[b.rule_type]?.label || b.rule_type}</div>
                  <code className="text-caption text-secondary">{JSON.stringify(b.rule_params)}</code>
                </td>
                <td className="px-4 py-3 text-body-md text-primary">{b.earned_count}</td>
                <td className="px-4 py-3">
                  <StatusPill active={b.is_active} />
                </td>
                <td className="px-4 py-3">
                  <RowActions
                    onEdit={() =>
                      setEditing({
                        id: b.id,
                        form: {
                          code: b.code,
                          name: b.name,
                          description: b.description,
                          icon: b.icon,
                          ruleType: b.rule_type,
                          ruleParams: b.rule_params || {},
                          sortOrder: b.sort_order,
                          isActive: b.is_active,
                        },
                      })
                    }
                    onDelete={() => remove(b)}
                  />
                </td>
              </tr>
            ))}
        </DataTable>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Rozeti düzenle' : 'Yeni rozet'}>
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Rozet adı">
                <input
                  className="input"
                  required
                  value={editing.form.name}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })}
                />
              </Field>
              <Field label="Kod" hint="Benzersiz, ör. ekg-uzmani">
                <input
                  className="input font-mono"
                  required
                  value={editing.form.code}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, code: e.target.value } })}
                />
              </Field>
            </div>
            <Field label="Açıklama">
              <input
                className="input"
                required
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

            <Field label="Kazanma kuralı">
              <select
                className="input"
                value={editing.form.ruleType}
                onChange={(e) =>
                  setEditing({ ...editing, form: { ...editing.form, ruleType: e.target.value, ruleParams: {} } })
                }
              >
                {Object.entries(RULES).map(([key, r]) => (
                  <option key={key} value={key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              {rule.fields.map((f) => (
                <Field key={f.key} label={f.label}>
                  {f.type === 'topic' ? (
                    <select
                      className="input"
                      required
                      value={editing.form.ruleParams[f.key] || ''}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          form: {
                            ...editing.form,
                            ruleParams: { ...editing.form.ruleParams, [f.key]: e.target.value },
                          },
                        })
                      }
                    >
                      <option value="">Seçin…</option>
                      {topics.map((t) => (
                        <option key={t.id} value={t.slug}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      className="input"
                      required
                      value={editing.form.ruleParams[f.key] ?? ''}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          form: {
                            ...editing.form,
                            ruleParams: { ...editing.form.ruleParams, [f.key]: e.target.value },
                          },
                        })
                      }
                    />
                  )}
                </Field>
              ))}
            </div>

            <Toggle
              checked={editing.form.isActive}
              onChange={(v) => setEditing({ ...editing, form: { ...editing.form, isActive: v } })}
              label="Aktif"
            />

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
