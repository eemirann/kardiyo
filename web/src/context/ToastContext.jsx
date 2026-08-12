import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/ui';

const ToastContext = createContext(null);

const VARIANTS = {
  success: 'border-success/30 bg-success-container text-on-success-container',
  error: 'border-error/30 bg-error-container text-on-error-container',
  info: 'border-surface-variant bg-surface-container-lowest text-on-surface',
  points: 'border-primary/30 bg-primary text-on-primary',
  badge: 'border-primary/40 bg-surface-container-lowest text-on-surface',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = 'info', icon, duration = 4000 }) => {
      const id = nextId.current++;
      setToasts((list) => [...list, { id, title, description, variant, icon }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      toast,
      success: (title, description) => toast({ title, description, variant: 'success', icon: 'check_circle' }),
      error: (title, description) => toast({ title, description, variant: 'error', icon: 'error' }),
      points: (amount) =>
        toast({ title: `+${amount} puan`, variant: 'points', icon: 'stars', duration: 3000 }),
      /** Cevap sonrasi kazanilan rozetleri sirayla bildirir. */
      badges: (badges = []) =>
        badges.forEach((b, i) =>
          setTimeout(
            () =>
              toast({
                title: `Yeni rozet: ${b.name}`,
                description: b.description,
                variant: 'badge',
                icon: b.icon || 'military_tech',
                duration: 6000,
              }),
            i * 400
          )
        ),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-level2 ${
              VARIANTS[t.variant] || VARIANTS.info
            }`}
          >
            {t.icon && <Icon name={t.icon} size={22} className="mt-0.5 shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="text-body-md font-semibold">{t.title}</div>
              {t.description && <div className="mt-0.5 text-caption opacity-90">{t.description}</div>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 opacity-60 hover:opacity-100"
              aria-label="Kapat"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast ToastProvider icinde kullanilmali');
  return ctx;
}
