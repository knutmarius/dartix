import { useSearchParams } from 'react-router-dom';
import type { DateRangeQuery } from '../api';

export type RangeKey = 'all' | 'year' | 'month' | 'week';

function startOf(key: RangeKey): string | undefined {
  const now = new Date();
  switch (key) {
    case 'week': {
      const d = new Date(now);
      // Monday, the way a week runs here.
      const shift = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - shift);
      return d.toISOString().slice(0, 10);
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    case 'year':
      return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    default:
      return undefined;
  }
}

/**
 * One range, read from the URL and shared by every chart on the page.
 *
 * Filters belong in a single row above everything they scope, not inside each
 * card — and living in the URL means a filtered view is a link you can send.
 */
export function useRange() {
  const [params, setParams] = useSearchParams();
  const key = (params.get('range') as RangeKey | null) ?? 'all';
  const minGames = params.get('minGames');

  const query: DateRangeQuery = {
    ...(startOf(key) ? { from: startOf(key)! } : {}),
    ...(minGames ? { minGames: Number(minGames) } : {}),
  };

  return {
    key,
    minGames: minGames ? Number(minGames) : undefined,
    query,
    /** A stable react-query key for the current slice. */
    cacheKey: [key, minGames ?? 'default'] as const,
    setRange(next: RangeKey) {
      const updated = new URLSearchParams(params);
      if (next === 'all') updated.delete('range');
      else updated.set('range', next);
      setParams(updated, { replace: true });
    },
    setMinGames(next: number | undefined) {
      const updated = new URLSearchParams(params);
      if (next === undefined) updated.delete('minGames');
      else updated.set('minGames', String(next));
      setParams(updated, { replace: true });
    },
  };
}
