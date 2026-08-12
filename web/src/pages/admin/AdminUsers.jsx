import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { AdminHeader, DataTable, Field, Modal, StatusPill } from '../../components/admin';
import { ErrorBox, Icon, PageLoader, Spinner, formatDate } from '../../components/ui';

const PAGE_SIZE = 25;

export default function AdminUsers() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [data, setData] = useState({ users: [], total: 0 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    if (search) params.set('search', search);
    api
      .get(`/admin/users?${params}`)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(load, [load]);

  const patch = async (id, body, successMsg) => {
    try {
      await api.patch(`/admin/users/${id}`, body);
      toast.success(successMsg);
      load();
    } catch (err) {
      toast.error('Güncellenemedi', err.message);
    }
  };

  const savePremium = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/admin/users/${editing.id}`, {
        isPremium: editing.isPremium,
        premiumUntil: editing.premiumUntil ? new Date(editing.premiumUntil).toISOString() : null,
      });
      toast.success('Üyelik güncellendi');
      setEditing(null);
      load();
    } catch (err) {
      toast.error('Güncellenemedi', err.message);
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(data.total / PAGE_SIZE);

  return (
    <div>
      <AdminHeader title="Kullanıcılar" description={`Toplam ${data.total} kayıtlı kullanıcı.`} />

      <input
        className="input mb-4 max-w-sm"
        placeholder="Ad veya e-posta ara…"
        value={search}
        onChange={(e) => {
          setPage(0);
          setSearch(e.target.value);
        }}
      />

      <ErrorBox message={error} onRetry={load} />

      {loading ? (
        <PageLoader />
      ) : (
        <>
          <DataTable
            columns={['Kullanıcı', 'Rol', 'Üyelik', 'Puan', 'Kayıt', 'Son giriş', 'İşlem']}
            empty="Kullanıcı bulunamadı."
          >
            {data.users.length > 0 &&
              data.users.map((u) => (
                <tr key={u.id} className="hover:bg-surface-container-low">
                  <td className="px-4 py-3">
                    <div className="text-body-md text-on-surface">{u.full_name}</div>
                    <div className="text-caption text-secondary">{u.email}</div>
                    {u.is_blocked && <span className="text-caption text-error">Engellendi</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`chip ${u.role === 'admin' ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary'}`}>
                      {u.role === 'admin' ? 'Yönetici' : 'Üye'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill active={u.is_premium} activeLabel="Premium" passiveLabel="Ücretsiz" />
                    {u.premium_until && (
                      <div className="mt-1 text-caption text-secondary">{formatDate(u.premium_until)}'e kadar</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-body-md text-primary">{u.total_points}</td>
                  <td className="px-4 py-3 text-caption text-secondary">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-caption text-secondary">{formatDate(u.last_login_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1.5"
                        title="Premium ayarla"
                        onClick={() =>
                          setEditing({
                            id: u.id,
                            name: u.full_name,
                            isPremium: u.is_premium,
                            premiumUntil: u.premium_until ? u.premium_until.slice(0, 10) : '',
                          })
                        }
                      >
                        <Icon name="workspace_premium" size={18} />
                      </button>
                      {u.id !== me.id && (
                        <>
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1.5"
                            title={u.role === 'admin' ? 'Yöneticiliği kaldır' : 'Yönetici yap'}
                            onClick={() =>
                              patch(
                                u.id,
                                { role: u.role === 'admin' ? 'user' : 'admin' },
                                'Rol güncellendi'
                              )
                            }
                          >
                            <Icon name="admin_panel_settings" size={18} />
                          </button>
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1.5 text-error hover:bg-error-container"
                            title={u.is_blocked ? 'Engeli kaldır' : 'Engelle'}
                            onClick={() =>
                              patch(
                                u.id,
                                { isBlocked: !u.is_blocked },
                                u.is_blocked ? 'Engel kaldırıldı' : 'Kullanıcı engellendi'
                              )
                            }
                          >
                            <Icon name={u.is_blocked ? 'lock_open' : 'block'} size={18} />
                          </button>
                        </>
                      )}
                    </div>
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

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Premium üyelik">
        {editing && (
          <form onSubmit={savePremium} className="space-y-4">
            <p className="text-body-md text-secondary">
              <strong className="text-on-surface">{editing.name}</strong> için üyelik ayarı.
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-body-md">
              <input
                type="checkbox"
                className="rounded border-outline text-primary focus:ring-primary"
                checked={editing.isPremium}
                onChange={(e) => setEditing({ ...editing, isPremium: e.target.checked })}
              />
              Premium üye
            </label>
            <Field label="Bitiş tarihi" hint="Boş bırakılırsa süresiz premium olur.">
              <input
                type="date"
                className="input"
                value={editing.premiumUntil}
                onChange={(e) => setEditing({ ...editing, premiumUntil: e.target.value })}
              />
            </Field>
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
