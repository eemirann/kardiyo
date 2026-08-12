import { Link } from 'react-router-dom';

/** Material Symbols ikonu. */
export function Icon({ name, className = '', size = 20, filled = false }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontSize: `${size}px`,
        lineHeight: 1,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

export function Spinner({ className = '' }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      role="status"
      aria-label="Yükleniyor"
    />
  );
}

export function PageLoader({ label = 'Yükleniyor…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-secondary">
      <Spinner />
      <span className="text-body-md">{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-error/30 bg-error-container px-4 py-3 text-on-error-container">
      <div className="flex items-start gap-2">
        <Icon name="error" size={20} />
        <div className="flex-1 text-body-md">{message}</div>
        {onRetry && (
          <button type="button" onClick={onRetry} className="text-label-sm underline">
            Tekrar dene
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, description, action }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-secondary">
        <Icon name={icon} size={28} />
      </span>
      <h3 className="text-headline-md text-on-surface">{title}</h3>
      {description && <p className="max-w-md text-body-md text-secondary">{description}</p>}
      {action}
    </div>
  );
}

const DIFFICULTY = {
  easy: { label: 'Kolay', className: 'bg-success-container text-on-success-container', points: 5 },
  medium: { label: 'Orta', className: 'bg-warning-container text-on-warning-container', points: 10 },
  hard: { label: 'Zor', className: 'bg-primary/10 text-primary', points: 20 },
};

export function DifficultyChip({ difficulty, showPoints = false }) {
  const d = DIFFICULTY[difficulty] || DIFFICULTY.medium;
  return (
    <span className={`chip ${d.className}`}>
      {d.label}
      {showPoints && ` · ${d.points} puan`}
    </span>
  );
}

export const difficultyPoints = (d) => (DIFFICULTY[d] || DIFFICULTY.medium).points;

export function PremiumChip({ className = '' }) {
  return (
    <span className={`chip bg-primary text-on-primary ${className}`}>
      <Icon name="workspace_premium" size={14} />
      Premium
    </span>
  );
}

/** Konu/istatistik ilerleme cubugu (DESIGN.md: lineer, medical red). */
export function ProgressBar({ value, max = 100, className = '' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-surface-container-high ${className}`}>
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StatCard({ icon, label, value, hint, to }) {
  const content = (
    <div className="card flex items-center gap-4 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-container text-primary">
        <Icon name={icon} size={22} />
      </span>
      <div className="min-w-0">
        <div className="text-label-sm uppercase tracking-wider text-secondary">{label}</div>
        <div className="text-headline-md text-on-surface">{value}</div>
        {hint && <div className="text-caption text-secondary">{hint}</div>}
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="block transition-transform hover:-translate-y-0.5">
      {content}
    </Link>
  ) : (
    content
  );
}

/** Admin tarafindan girilen HTML sunucuda sanitize edilir. */
export function RichText({ html, className = '' }) {
  return (
    <div className={`prose-clinical ${className}`} dangerouslySetInnerHTML={{ __html: html || '' }} />
  );
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
