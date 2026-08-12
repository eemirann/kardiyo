import { useEffect } from 'react';
import { Icon } from './ui';

/** Admin sayfalari icin ortak baslik. */
export function AdminHeader({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-headline-lg text-on-surface">{title}</h1>
        {description && <p className="mt-1 text-body-md text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Kaydirilabilir tablo kabugu (dar ekranda yatay kayar). */
export function DataTable({ columns, children, empty }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-surface-variant bg-surface-container">
            {columns.map((c) => (
              <th
                key={c}
                className="px-4 py-3 text-left text-label-sm uppercase tracking-wider text-secondary"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-variant">
          {children ?? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-secondary">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Ortalanmis modal. Escape ile kapanir. */
export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div
        className={`my-8 w-full rounded-xl bg-surface-container-lowest shadow-level2 ${
          wide ? 'max-w-3xl' : 'max-w-lg'
        }`}
      >
        <div className="flex items-center justify-between border-b border-surface-variant px-6 py-4">
          <h2 className="text-headline-md text-on-surface">{title}</h2>
          <button type="button" onClick={onClose} className="text-secondary hover:text-primary" aria-label="Kapat">
            <Icon name="close" size={22} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      {hint && <p className="mt-1 text-caption text-secondary">{hint}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-body-md text-on-surface">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-outline text-primary focus:ring-primary"
      />
      {label}
    </label>
  );
}

export function StatusPill({ active, activeLabel = 'Aktif', passiveLabel = 'Pasif' }) {
  return (
    <span
      className={`chip ${
        active ? 'bg-success-container text-on-success-container' : 'bg-surface-container text-secondary'
      }`}
    >
      {active ? activeLabel : passiveLabel}
    </span>
  );
}

export function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex justify-end gap-1">
      {onEdit && (
        <button type="button" onClick={onEdit} className="btn-ghost px-2 py-1.5" title="Düzenle">
          <Icon name="edit" size={18} />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="btn-ghost px-2 py-1.5 text-error hover:bg-error-container"
          title="Sil"
        >
          <Icon name="delete" size={18} />
        </button>
      )}
    </div>
  );
}
