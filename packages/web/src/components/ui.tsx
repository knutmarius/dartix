import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export function Card({
  children, className = '', accent = false,
}: { children: ReactNode; className?: string; accent?: boolean }) {
  return (
    <div
      className={
        `rounded-xl p-5 ${accent
          ? 'bg-accent/8 border border-accent/45'
          : 'bg-surface border border-line'} ${className}`
      }
    >
      {children}
    </div>
  );
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`label ${className}`}>{children}</span>;
}

/**
 * A stat tile. The number is the chart — a one-bar bar chart would say less.
 * Proportional figures, because a lone display-size number with equal-width
 * digits reads loose.
 */
export function Stat({
  label, value, note, tone = 'default',
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: 'default' | 'accent' | 'danger' | 'good';
}) {
  const colour = {
    default: 'text-ink', accent: 'text-accent', danger: 'text-danger', good: 'text-good',
  }[tone];
  return (
    <Card className="flex flex-col gap-1">
      <Label>{label}</Label>
      <span className={`hero text-[42px] font-bold leading-none ${colour}`}>{value}</span>
      {note ? <span className="text-xs text-ink-3">{note}</span> : null}
    </Card>
  );
}

export function Button({
  children, onClick, variant = 'default', className = '', disabled, type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const styles = {
    primary: 'bg-accent text-ground hover:bg-accent/90',
    default: 'border border-line text-ink-2 hover:border-ink-3 hover:text-ink',
    ghost: 'text-ink-3 hover:text-ink',
    danger: 'border border-danger/45 text-danger hover:bg-danger/10',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`label rounded-md px-4 py-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Segmented({ items }: { items: { to: string; label: string; end?: boolean }[] }) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-line bg-surface p-0.5">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `label rounded-md px-4 py-2 transition-colors ${
              isActive ? 'bg-accent text-ground' : 'hover:text-ink-2'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

export function Loading({ what = 'Loading' }: { what?: string }) {
  return (
    <div className="flex items-center gap-3 py-16 text-ink-3">
      <span className="size-2 animate-pulse rounded-full bg-accent" />
      <Label>{what}</Label>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center text-sm text-ink-3">
      {children}
    </div>
  );
}

export function ErrorNote({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div className="flex items-start gap-3 rounded-xl border border-danger/35 bg-danger/8 p-4">
      <Warning />
      <div className="flex flex-col gap-2">
        <span className="text-sm text-ink">{message}</span>
        {retry ? <Button variant="ghost" onClick={retry} className="self-start px-0">Try again</Button> : null}
      </div>
    </div>
  );
}

export function Warning({ className = 'text-danger' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" className={`size-4 shrink-0 ${className}`} aria-hidden>
      <path d="M12 9v4" /><path d="M12 17h.01" />
      <path d="M10.3 3.9 2.4 18a1.8 1.8 0 0 0 1.6 2.7h16a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0z" />
    </svg>
  );
}

export function Arrow({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round" className={`size-4 ${className}`} aria-hidden>
      <path d="M5 12h13" /><path d="M12 5l7 7-7 7" />
    </svg>
  );
}

export function Avatar({
  name, tone = 'muted', size = 'md',
}: { name: string; tone?: 'muted' | 'active' | 'series1' | 'series2' | 'series3'; size?: 'sm' | 'md' | 'lg' }) {
  const box = { sm: 'size-8 text-sm', md: 'size-9 text-base', lg: 'size-14 text-2xl' }[size];
  const colour = {
    muted: 'bg-raised text-ink-2',
    active: 'bg-accent text-ground',
    series1: 'bg-series-1/20 text-series-1',
    series2: 'bg-series-2/20 text-series-2',
    series3: 'bg-series-3/20 text-series-3',
  }[tone];
  return (
    <div className={`dsp flex shrink-0 items-center justify-center rounded-lg font-bold ${box} ${colour}`}>
      {[...name][0]?.toUpperCase() ?? '?'}
    </div>
  );
}

/**
 * One decimal place, always.
 *
 * The API rounds to one place, so an average of exactly 3 arrives as `3` and
 * sits in a column of `3.4` and `5.7` looking like a different kind of number.
 */
export function oneDp(value: number): string {
  return value.toFixed(1);
}

/** Percentages are shown whole — the extra digit is noise at this precision. */
export function pct(value: number): string {
  return `${Math.round(value)}%`;
}

/** Formats a date the way a person in Oslo reads one. */
export function formatDate(iso: string | Date, style: 'short' | 'long' = 'short'): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: style === 'short' ? 'medium' : 'full',
    timeZone: 'Europe/Oslo',
  }).format(date);
}

export function formatTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo',
  }).format(date);
}

/**
 * A round's name with a definite article, without doubling one it already has.
 *
 * `ROUNDS` names the ninth round "The 41", so the obvious `on the {name}`
 * renders "on the The 41".
 */
export function theRound(name: string): string {
  return name.startsWith('The ') ? `the ${name.slice(4)}` : `the ${name}`;
}
