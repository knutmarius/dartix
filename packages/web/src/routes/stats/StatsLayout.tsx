import { Outlet } from 'react-router-dom';
import { Label, Segmented } from '../../components/ui';
import { useRange } from '../../lib/useRange';
import type { RangeKey } from '../../lib/useRange';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'year', label: 'This year' },
  { key: 'month', label: 'This month' },
  { key: 'week', label: 'This week' },
];

export function StatsLayout() {
  const range = useRange();

  return (
    <div className="flex flex-col gap-5 p-6 md:p-8">
      {/* One filter row, above everything it scopes. */}
      <div className="flex flex-wrap items-center gap-4">
        <Segmented
          items={[
            { to: '/stats', label: 'Leaderboard', end: true },
            { to: '/stats/compare', label: 'Compare' },
            { to: '/stats/records', label: 'Records' },
            { to: '/stats/history', label: 'History' },
          ]}
        />
        <div className="grow" />
        <div className="flex gap-0.5 rounded-lg border border-line bg-surface p-0.5">
          {RANGES.map((item) => (
            <button
              key={item.key}
              onClick={() => range.setRange(item.key)}
              className={`label rounded-md px-3.5 py-2 transition-colors ${
                range.key === item.key ? 'bg-raised text-ink' : 'hover:text-ink-2'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <Outlet />

      <div className="flex items-center gap-2">
        <Label>
          Aggregate views hide players below {range.minGames ?? 10} games
        </Label>
        <button
          onClick={() => range.setMinGames(range.minGames === 1 ? undefined : 1)}
          className="label text-accent! transition-opacity hover:opacity-80"
        >
          {range.minGames === 1 ? 'apply the floor' : 'show everyone'}
        </button>
      </div>
    </div>
  );
}
