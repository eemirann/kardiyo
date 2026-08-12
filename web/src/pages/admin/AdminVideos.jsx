import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import FileUpload from '../../components/FileUpload';
import { AdminHeader, DataTable, Field, Modal, RowActions, StatusPill, Toggle } from '../../components/admin';
import { ErrorBox, Icon, PageLoader, Spinner, formatDuration } from '../../components/ui';

const empty = {
  topicId: '',
  title: '',
  description: '',
  source: 'youtube',
  url: '',
  storageKey: '',
  durationSeconds: '',
  thumbnailUrl: '',
  isPremium: false,
  isActive: true,
  sortOrder: 0,
};

export default function AdminVideos() {
  const toast = useToast();
  const [videos, setVideos] = useState([]);
  const [topics, setTopics] = useState([]);
  const [uploadEnabled, setUploadEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get('/admin/videos')
      .then((d) => {
        setVideos(d.videos);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get('/admin/topics').then((d) => setTopics(d.topics)).catch(() => {});
    api.get('/admin/uploads/status').then((d) => setUploadEnabled(d.enabled)).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const f = editing.form;
    if (f.source === 'upload' && !f.storageKey) {
      toast.error('Önce video dosyasını yükleyin');
      return;
    }
    if (f.source !== 'upload' && !f.url) {
      toast.error('Video linki gerekli');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...f,
        topicId: f.topicId ? Number(f.topicId) : null,
        durationSeconds: f.durationSeconds ? Number(f.durationSeconds) : null,
        url: f.source === 'upload' ? null : f.url,
        storageKey: f.source === 'upload' ? f.storageKey : null,
        thumbnailUrl: f.thumbnailUrl || null,
        sortOrder: Number(f.sortOrder) || 0,
      };
      if (editing.id) await api.put(`/admin/videos/${editing.id}`, payload);
      else await api.post('/admin/videos', payload);
      toast.success(editing.id ? 'Video güncellendi' : 'Video eklendi');
      setEditing(null);
      load();
    } catch (err) {
      toast.error('Kaydedilemedi', err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (v) => {
    if (!window.confirm(`"${v.title}" silinsin mi?`)) return;
    try {
      await api.del(`/admin/videos/${v.id}`);
      toast.success('Video silindi');
      load();
    } catch (err) {
      toast.error('Silinemedi', err.message);
    }
  };

  const setForm = (patch) => setEditing((prev) => ({ ...prev, form: { ...prev.form, ...patch } }));

  return (
    <div>
      <AdminHeader
        title="Videolar"
        description="YouTube/Vimeo linki ekleyin veya kendi videonuzu yükleyin."
        action={
          <button type="button" className="btn-primary" onClick={() => setEditing({ id: null, form: empty })}>
            <Icon name="video_call" size={18} /> Yeni video
          </button>
        }
      />

      {!uploadEnabled && (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning-container px-4 py-3 text-on-warning-container">
          <Icon name="info" size={18} /> Dosya yükleme kapalı (R2 ayarları eksik). YouTube/Vimeo
          linkiyle video eklemeye devam edebilirsiniz.
        </div>
      )}

      <ErrorBox message={error} onRetry={load} />

      {loading ? (
        <PageLoader />
      ) : (
        <DataTable columns={['Video', 'Konu', 'Kaynak', 'Süre', 'İzleyen', 'Durum', '']} empty="Henüz video yok.">
          {videos.length > 0 &&
            videos.map((v) => (
              <tr key={v.id} className="hover:bg-surface-container-low">
                <td className="px-4 py-3">
                  <div className="text-body-md text-on-surface">{v.title}</div>
                  {v.is_premium && <span className="text-caption text-primary">Premium</span>}
                </td>
                <td className="px-4 py-3 text-body-md text-secondary">{v.topic_name || '—'}</td>
                <td className="px-4 py-3 text-body-md text-secondary">
                  {v.source === 'upload' ? 'Yüklenen dosya' : v.source}
                </td>
                <td className="px-4 py-3 text-body-md text-secondary">
                  {v.duration_seconds ? formatDuration(v.duration_seconds) : '—'}
                </td>
                <td className="px-4 py-3 text-body-md text-secondary">{v.viewer_count}</td>
                <td className="px-4 py-3">
                  <StatusPill active={v.is_active} />
                </td>
                <td className="px-4 py-3">
                  <RowActions
                    onEdit={() =>
                      setEditing({
                        id: v.id,
                        form: {
                          topicId: v.topic_id || '',
                          title: v.title,
                          description: v.description || '',
                          source: v.source,
                          url: v.url || '',
                          storageKey: v.storage_key || '',
                          durationSeconds: v.duration_seconds || '',
                          thumbnailUrl: v.thumbnail_url || '',
                          isPremium: v.is_premium,
                          isActive: v.is_active,
                          sortOrder: v.sort_order,
                        },
                      })
                    }
                    onDelete={() => remove(v)}
                  />
                </td>
              </tr>
            ))}
        </DataTable>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Videoyu düzenle' : 'Yeni video'} wide>
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <Field label="Başlık">
              <input
                className="input"
                required
                minLength={3}
                value={editing.form.title}
                onChange={(e) => setForm({ title: e.target.value })}
              />
            </Field>
            <Field label="Açıklama">
              <textarea
                className="input"
                rows={3}
                value={editing.form.description}
                onChange={(e) => setForm({ description: e.target.value })}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Konu">
                <select className="input" value={editing.form.topicId} onChange={(e) => setForm({ topicId: e.target.value })}>
                  <option value="">Konusuz</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Kaynak">
                <select className="input" value={editing.form.source} onChange={(e) => setForm({ source: e.target.value })}>
                  <option value="youtube">YouTube linki</option>
                  <option value="vimeo">Vimeo linki</option>
                  <option value="upload" disabled={!uploadEnabled}>
                    Dosya yükle {uploadEnabled ? '' : '(kapalı)'}
                  </option>
                </select>
              </Field>
            </div>

            {editing.form.source === 'upload' ? (
              <Field label="Video dosyası" hint="mp4 veya webm, en fazla 2 GB.">
                <FileUpload
                  kind="video"
                  label={editing.form.storageKey ? 'Farklı dosya yükle' : 'Video dosyası seç'}
                  onUploaded={({ key }) => {
                    setForm({ storageKey: key });
                    toast.success('Video yüklendi');
                  }}
                />
                {editing.form.storageKey && (
                  <p className="mt-2 break-all font-mono text-caption text-secondary">
                    {editing.form.storageKey}
                  </p>
                )}
              </Field>
            ) : (
              <Field label="Video linki" hint="Örn. https://www.youtube.com/watch?v=XXXXXXXXXXX">
                <input
                  type="url"
                  className="input"
                  value={editing.form.url}
                  onChange={(e) => setForm({ url: e.target.value })}
                />
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Süre (saniye)" hint="%90'ı izlenince tamamlandı sayılır.">
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={editing.form.durationSeconds}
                  onChange={(e) => setForm({ durationSeconds: e.target.value })}
                />
              </Field>
              <Field label="Kapak görseli (URL)">
                <input
                  type="url"
                  className="input"
                  value={editing.form.thumbnailUrl}
                  onChange={(e) => setForm({ thumbnailUrl: e.target.value })}
                />
                {uploadEnabled && (
                  <div className="mt-2">
                    <FileUpload
                      kind="image"
                      label="Görsel yükle"
                      onUploaded={({ publicUrl }) => setForm({ thumbnailUrl: publicUrl })}
                    />
                  </div>
                )}
              </Field>
              <Field label="Sıra">
                <input
                  type="number"
                  className="input"
                  value={editing.form.sortOrder}
                  onChange={(e) => setForm({ sortOrder: e.target.value })}
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-6">
              <Toggle checked={editing.form.isPremium} onChange={(v) => setForm({ isPremium: v })} label="Premium içerik" />
              <Toggle checked={editing.form.isActive} onChange={(v) => setForm({ isActive: v })} label="Yayında" />
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
