import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { Heatmap } from '../../components/Heatmap';
import { Avatar, Card, Empty, ErrorNote, Label, Loading, Stat, oneDp, pct } from '../../components/ui';
import { useRange } from '../../lib/useRange';

const COLUMNS = [
  { key: 'games', label: 'Games' },
  { key: 'average', label: 'Avg' },
  { key: 'range', label: 'High / Low' },
  { key: 'wins', label: 'Wins' },
  { key: 'winRate', label: 'Win %' },
  { key: 'halvingsPerGame', label: 'Halv / g' },
] as const;

export function Leaderboard() {
  const range = useRange();
  const board = useQuery({
    queryKey: ['leaderboard', ...range.cacheKey],
    queryFn: () => api.leaderboard(range.query),
  });
  const matrix = useQuery({
    queryKey: ['round-matrix', ...range.cacheKey],
    queryFn: () => api.roundMatrix(range.query),
  });

  if (board.isPending) return <Loading what="Adding it all up" />;
  if (board.isError) return <ErrorNote error={board.error} retry={() => void board.refetch()} />;

  const rows = board.data.rows;
  if (rows.length === 0) {
    return <Empty>No games in this range. Try widening it, or showing everyone.</Empty>;
  }

  const games = rows.reduce((n, r) => n + r.games, 0);
  const halvings = rows.reduce((n, r) => n + r.halvingsPerGame * r.games, 0) / Math.max(1, games);
  const best = rows.reduce((acc, r) => (r.high > acc.high ? r : acc), rows[0]!);
  const meanTotal = rows.reduce((n, r) => n + r.average * r.games, 0) / Math.max(1, games);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Player results" value={games} note={`${rows.length} players`} />
        <Stat label="Average total" value={Math.round(meanTotal)} note="across every player" />
        <Stat label="Highest game" value={best.high} note={best.playerName} tone="accent" />
        <Stat
          label="Halvings per game"
          value={oneDp(halvings)}
          note="of twelve rounds"
          tone="danger"
        />
      </div>

      <Card>
        <div className="mb-1 flex items-center">
          <Label>Leaderboard</Label>
          <div className="grow" />
          <span className="text-xs text-ink-3">Sorted by average</span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="flex h-9 items-center border-b border-line">
              <Label className="w-56 shrink-0">Player</Label>
              <div className="grid grow grid-cols-6">
                {COLUMNS.map((column) => (
                  <Label
                    key={column.key}
                    className={`text-right ${column.key === 'average' ? 'text-accent!' : ''}`}
                  >
                    {column.label}
                  </Label>
                ))}
              </div>
            </div>

            {rows.map((row, index) => (
              <Link
                key={row.playerId}
                to={`/stats/player/${row.playerId}`}
                className="flex h-15 items-center border-b border-line-soft transition-colors last:border-0 hover:bg-white/3"
              >
                <div className="flex w-56 shrink-0 items-center gap-3">
                  <span className={`dsp w-4 text-[15px] font-bold ${index === 0 ? 'text-accent' : 'text-ink-3'}`}>
                    {index + 1}
                  </span>
                  <Avatar
                    name={row.playerName}
                    size="sm"
                    tone={(['series1', 'series2', 'series3'] as const)[index] ?? 'muted'}
                  />
                  <span className="dsp truncate text-xl font-semibold">{row.playerName}</span>
                </div>
                <div className="grid grow grid-cols-6 items-center">
                  <Cell value={row.games} muted />
                  <Cell value={oneDp(row.average)} big accent={index === 0} />
                  <HighLow high={row.high} low={row.low} />
                  <Cell value={row.wins} />
                  <Cell value={pct(row.winRate)} muted />
                  <Cell value={oneDp(row.halvingsPerGame)} danger={row.halvingsPerGame >= 7} muted />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        {matrix.isPending ? <Loading what="Building the heatmap" /> : null}
        {matrix.isError ? <ErrorNote error={matrix.error} retry={() => void matrix.refetch()} /> : null}
        {matrix.data ? <Heatmap matrix={matrix.data} /> : null}
      </Card>
    </div>
  );
}

/**
 * A player's best and worst in one column.
 *
 * Two columns for one idea — the spread of what someone is capable of — and
 * they were always read together. The high keeps the weight; the low is the
 * footnote to it.
 */
function HighLow({ high, low }: { high: number; low: number }) {
  return (
    <div className="flex items-baseline justify-end gap-1">
      <span className="dsp num text-lg font-semibold">{high}</span>
      <span className="dsp num text-sm text-ink-4">/</span>
      <span className="dsp num text-lg font-semibold text-ink-2">{low}</span>
    </div>
  );
}

function Cell({
  value, big = false, muted = false, accent = false, danger = false,
}: { value: string | number; big?: boolean; muted?: boolean; accent?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-end">
      <span
        className={`dsp num font-semibold ${big ? 'text-2xl font-bold' : 'text-lg'} ${
          danger ? 'text-danger' : accent ? 'text-accent' : muted ? 'text-ink-2' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}
