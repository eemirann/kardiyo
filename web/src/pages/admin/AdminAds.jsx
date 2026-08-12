import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import FileUpload from '../../components/FileUpload';
import { AdminHeader, DataTable, Field, Modal, RowActions, StatusPill, Toggle } from '../../components/admin';
import { ErrorBox, Icon, PageLoader, Spinner, formatDate } from '../../components/ui';

const emptyAd = {
  slotId: '',
  title: '',
  imageUrl: '',
  targetUrl: '',
  startsAt: '',
  endsAt: '',
  weight: 1,
  isActive: true,
};

export default function AdminAds() {
  const toast = useToast();
  const [tab, setTab] = useState('ads');
  const [ads, setAds] = useState([]);
  const [slots, setSlots] = useState([]);
  const [uploadEnabled, setUploadEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingAd, setEditingAd] = useState(null);
  const [editingSlot, setEditingSlot] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/admin/ads'), api.get('/admin/ad-slots')])
      .then(([a, s]) => {
        setAds(a.ads);
        setSlots(s.slots);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get('/admin/uploads/status').then((d) => setUploadEnabled(d.enabled)).catch(() => {});
  }, []);

  const saveAd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const f = editingAd.form;
      const payload = {
        ...f,
        slotId: Number(f.slotId),
        weight: Number(f.weight) || 1,
        startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
        endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
      };
      if (editingAd.id) await api.put(`/admin/ads/${editingAd.id}`, payload);
      else await api.post('/admin/ads', payload);
      toast.success(editingAd.id ? 'Reklam güncellendi' : 'Reklam eklendi');
      setEditingAd(null);
      load();
    } catch (err) {
      toast.error('Kaydedilemedi', err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeAd = async (ad) => {
    if (!window.confirm(`"${ad.title}" reklamı ve istatistikleri silinecek. Emin misiniz?`)) return;
    try {
      await api.del(`/admin/ads/${ad.id}`);
      toast.success('Reklam silindi');
      load();
    } catch (err) {
      toast.error('Silinemedi', err.message);
    }
  };

  const saveSlot = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const f = editingSlot.form;
      if (editingSlot.id) await api.put(`/admin/ad-slots/${editingSlot.id}`, f);
      else await api.post('/admin/ad-slots', f);
      toast.success('Reklam alanı kaydedildi');
      setEditingSlot(null);
      load();
    } catch (err) {
      toast.error('Kaydedilemedi', err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <AdminHeader
        title="Reklamlar"
        description="Kendi banner'larınızı yönetin veya alanı Google AdSense'e devredin. Premium üyelere reklam gösterilmez."
        action={
          tab === 'ads' ? (
            <button
              type="button"
              className="btn-primary"
              disabled={slots.length === 0}
              onClick={() => setEditingAd({ id: null, form: { ...emptyAd, slotId: slots[0]?.id || '' } })}
            >
              <Icon name="add" size={18} /> Yeni reklam
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                setEditingSlot({
                  id: null,
                  form: { code: '', name: '', provider: 'custom', adsenseSnippet: '', isActive: true },
                })
              }
            >
              <Icon name="add" size={18} /> Yeni alan
            </button>
          )
        }
      />

      <div className="mb-4 flex gap-1 border-b border-surface-variant">
        {[
          { id: 'ads', label: 'Reklamlar' },
          { id: 'slots', label: 'Reklam alanları' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-label-sm ${
              tab === t.id ? 'border-b-2 border-primary font-bold text-primary' : 'text-secondary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ErrorBox message={error} onRetry={load} />

      {tab === 'ads' ? (
        <DataTable columns={['Reklam', 'Alan', 'Tarih', 'Gösterim', 'Tıklama', 'CTR', 'Durum', '']} empty="Henüz reklam yok.">
          {ads.length > 0 &&
            ads.map((a) => (
              <tr key={a.id} className="hover:bg-surface-container-low">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img src={a.image_url} alt="" className="h-10 w-20 rounded object-cover" />
                    <div>
                      <div className="text-body-md text-on-surface">{a.title}</div>
                      <a
                        href={a.target_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-caption text-secondary hover:text-primary"
                      >
                        {a.target_url}
                      </a>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-body-md text-secondary">{a.slot_name}</td>
                <td className="px-4 py-3 text-caption text-secondary">
                  {a.starts_at ? formatDate(a.starts_at) : 'Hemen'} →{' '}
                  {a.ends_at ? formatDate(a.ends_at) : 'Süresiz'}
                </td>
                <td className="px-4 py-3 text-body-md text-secondary">{a.impressions}</td>
                <td className="px-4 py-3 text-body-md text-secondary">{a.clicks}</td>
                <td className="px-4 py-3 text-body-md text-primary">%{a.ctr}</td>
                <td className="px-4 py-3">
                  <StatusPill active={a.is_active} />
                </td>
                <td className="px-4 py-3">
                  <RowActions
                    onEdit={() =>
                      setEditingAd({
                        id: a.id,
                        form: {
                          slotId: a.slot_id,
                          title: a.title,
                          imageUrl: a.image_url,
                          targetUrl: a.target_url,
                          startsAt: a.starts_at ? a.starts_at.slice(0, 10) : '',
                          endsAt: a.ends_at ? a.ends_at.slice(0, 10) : '',
                          weight: a.weight,
                          isActive: a.is_active,
                        },
                      })
                    }
                    onDelete={() => removeAd(a)}
                  />
                </td>
              </tr>
            ))}
        </DataTable>
      ) : (
        <DataTable columns={['Alan', 'Kod', 'Sağlayıcı', 'Aktif reklam', 'Durum', '']} empty="Reklam alanı yok.">
          {slots.length > 0 &&
            slots.map((s) => (
              <tr key={s.id} className="hover:bg-surface-container-low">
                <td className="px-4 py-3 text-body-md text-on-surface">{s.name}</td>
                <td className="px-4 py-3 font-mono text-caption text-secondary">{s.code}</td>
                <td className="px-4 py-3 text-body-md text-secondary">
                  {s.provider === 'adsense' ? 'Google AdSense' : 'Kendi reklamlarım'}
                </td>
                <td className="px-4 py-3 text-body-md text-secondary">{s.active_ads}</td>
                <td className="px-4 py-3">
                  <StatusPill active={s.is_active} />
                </td>
                <td className="px-4 py-3">
                  <RowActions
                    onEdit={() =>
                      setEditingSlot({
                        id: s.id,
                        form: {
                          code: s.code,
                          name: s.name,
                          provider: s.provider,
                          adsenseSnippet: s.adsense_snippet || '',
                          isActive: s.is_active,
                        },
                      })
                    }
                  />
                </td>
              </tr>
            ))}
        </DataTable>
      )}

      {/* Reklam formu */}
      <Modal open={Boolean(editingAd)} onClose={() => setEditingAd(null)} title={editingAd?.id ? 'Reklamı düzenle' : 'Yeni reklam'}>
        {editingAd && (
          <form onSubmit={saveAd} className="space-y-4">
            <Field label="Başlık (görsel açıklaması)">
              <input
                className="input"
                required
                value={editingAd.form.title}
                onChange={(e) => setEditingAd({ ...editingAd, form: { ...editingAd.form, title: e.target.value } })}
              />
            </Field>
            <Field label="Reklam alanı">
              <select
                className="input"
                required
                value={editingAd.form.slotId}
                onChange={(e) => setEditingAd({ ...editingAd, form: { ...editingAd.form, slotId: e.target.value } })}
              >
                {slots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Banner görseli (URL)">
              <input
                type="url"
                className="input"
                required
                value={editingAd.form.imageUrl}
                onChange={(e) => setEditingAd({ ...editingAd, form: { ...editingAd.form, imageUrl: e.target.value } })}
              />
              {uploadEnabled && (
                <div className="mt-2">
                  <FileUpload
                    kind="image"
                    label="Görsel yükle"
                    onUploaded={({ publicUrl }) =>
                      setEditingAd((prev) => ({ ...prev, form: { ...prev.form, imageUrl: publicUrl } }))
                    }
                  />
                </div>
              )}
              {editingAd.form.imageUrl && (
                <img src={editingAd.form.imageUrl} alt="" className="mt-2 max-h-32 rounded border border-surface-variant" />
              )}
            </Field>
            <Field label="Hedef adres">
              <input
                type="url"
                className="input"
                required
                value={editingAd.form.targetUrl}
                onChange={(e) => setEditingAd({ ...editingAd, form: { ...editingAd.form, targetUrl: e.target.value } })}
                placeholder="https://…"
              />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Başlangıç">
                <input
                  type="date"
                  className="input"
                  value={editingAd.form.startsAt}
                  onChange={(e) => setEditingAd({ ...editingAd, form: { ...editingAd.form, startsAt: e.target.value } })}
                />
              </Field>
              <Field label="Bitiş">
                <input
                  type="date"
                  className="input"
                  value={editingAd.form.endsAt}
                  onChange={(e) => setEditingAd({ ...editingAd, form: { ...editingAd.form, endsAt: e.target.value } })}
                />
              </Field>
              <Field label="Ağırlık" hint="Aynı alanda gösterilme oranı">
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="input"
                  value={editingAd.form.weight}
                  onChange={(e) => setEditingAd({ ...editingAd, form: { ...editingAd.form, weight: e.target.value } })}
                />
              </Field>
            </div>
            <Toggle
              checked={editingAd.form.isActive}
              onChange={(v) => setEditingAd({ ...editingAd, form: { ...editingAd.form, isActive: v } })}
              label="Yayında"
            />
            <div className="flex justify-end gap-3 border-t border-surface-variant pt-4">
              <button type="button" className="btn-outline" onClick={() => setEditingAd(null)}>
                Vazgeç
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Spinner /> : <Icon name="save" size={18} />} Kaydet
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Alan formu */}
      <Modal open={Boolean(editingSlot)} onClose={() => setEditingSlot(null)} title="Reklam alanı" wide>
        {editingSlot && (
          <form onSubmit={saveSlot} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Ad">
                <input
                  className="input"
                  required
                  value={editingSlot.form.name}
                  onChange={(e) => setEditingSlot({ ...editingSlot, form: { ...editingSlot.form, name: e.target.value } })}
                />
              </Field>
              <Field label="Kod" hint="Sitedeki yerleşim kodu. Mevcutlar: header, sidebar, question_bottom, video_below">
                <input
                  className="input font-mono"
                  required
                  value={editingSlot.form.code}
                  onChange={(e) => setEditingSlot({ ...editingSlot, form: { ...editingSlot.form, code: e.target.value } })}
                />
              </Field>
            </div>
            <Field label="Sağlayıcı">
              <select
                className="input"
                value={editingSlot.form.provider}
                onChange={(e) => setEditingSlot({ ...editingSlot, form: { ...editingSlot.form, provider: e.target.value } })}
              >
                <option value="custom">Kendi reklamlarım</option>
                <option value="adsense">Google AdSense</option>
              </select>
            </Field>
            {editingSlot.form.provider === 'adsense' && (
              <Field label="AdSense kodu" hint="AdSense panelinden aldığınız <ins> bloğunu buraya yapıştırın.">
                <textarea
                  className="input min-h-[140px] font-mono text-sm"
                  value={editingSlot.form.adsenseSnippet}
                  onChange={(e) =>
                    setEditingSlot({ ...editingSlot, form: { ...editingSlot.form, adsenseSnippet: e.target.value } })
                  }
                />
              </Field>
            )}
            <Toggle
              checked={editingSlot.form.isActive}
              onChange={(v) => setEditingSlot({ ...editingSlot, form: { ...editingSlot.form, isActive: v } })}
              label="Aktif"
            />
            <div className="flex justify-end gap-3 border-t border-surface-variant pt-4">
              <button type="button" className="btn-outline" onClick={() => setEditingSlot(null)}>
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
