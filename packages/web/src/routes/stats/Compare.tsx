import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip,
} from 'recharts';
import { api } from '../../api';
import type { HeadToHeadResponse } from '../../api';
import { CHART, SERIES } from '../../lib/palette';
import { useRange } from '../../lib/useRange';
import { Avatar, Card, Empty, ErrorNote, Label, Loading } from '../../components/ui';

export function Compare() {
  const range = useRange();
  const board = useQuery({
    queryKey: ['leaderboard', ...range.cacheKey],
    queryFn: () => api.leaderboard(range.query),
  });

  const rows = board.data?.rows ?? [];
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);

  const left = a ?? rows[0]?.playerId ?? null;
  const right = b ?? rows[1]?.playerId ?? null;

  const h2h = useQuery({
    queryKey: ['h2h', left, right, ...range.cacheKey],
    queryFn: () => api.headToHead(left!, right!, range.query),
    enabled: Boolean(left && right && left !== right),
  });

  if (board.isPending) return <Loading what="Reading the field" />;
  if (board.isError) return <ErrorNote error={board.error} retry={() => void board.refetch()} />;
  if (rows.length < 2) return <Empty>Two players with enough games are needed to compare.</Empty>;

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-wrap items-end gap-6">
        <Picker label="Player" value={left} rows={rows} onChange={setA} tone="series1" />
        <span className="dsp pb-2 text-2xl font-semibold text-ink-3">vs</span>
        <Picker label="Against" value={right} rows={rows} onChange={setB} tone="series3" />
      </Card>

      {left === right ? <Empty>Pick two different players.</Empty> : null}
      {h2h.isPending && left !== right ? <Loading what="Counting the meetings" /> : null}
      {h2h.isError ? <ErrorNote error={h2h.error} retry={() => void h2h.refetch()} /> : null}

      {h2h.data ? <Matchup data={h2h.data} /> : null}
    </div>
  );
}

function Picker({
  label, value, rows, onChange, tone,
}: {
  label: string;
  value: string | null;
  rows: { playerId: string; playerName: string; games: number }[];
  onChange: (id: string) => void;
  tone: 'series1' | 'series3';
}) {
  const current = rows.find((r) => r.playerId === value);
  return (
    <div className="flex items-center gap-3">
      <Avatar name={current?.playerName ?? '?'} tone={tone} size="lg" />
      <div className="flex flex-col gap-1">
        <Label>{label}</Label>
        <select
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          className="dsp rounded-lg border border-line bg-surface px-3 py-2 text-2xl font-bold
                     text-ink outline-none focus:border-accent"
        >
          {rows.map((row) => (
            <option key={row.playerId} value={row.playerId}>
              {row.playerName} ({row.games})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Matchup({ data }: { data: HeadToHeadResponse }) {
  const total = data.games;
  const shape = data.rounds.map((round) => {
    const best = Math.max(round.aAverage, round.bAverage) || 1;
    return {
      round: round.key,
      [data.a.playerName]: Math.round((round.aAverage / best) * 100),
      [data.b.playerName]: Math.round((round.bAverage / best) * 100),
    };
  });

  return (
    <>
      <Card className="flex flex-col items-center gap-3">
        <Label>{total} games together</Label>
        <div className="flex items-baseline gap-5">
          <span className="hero text-5xl leading-none font-bold" style={{ color: SERIES[0] }}>
            {data.a.wins}
          </span>
          <span className="dsp text-2xl font-semibold text-ink-3">—</span>
          <span className="hero text-5xl leading-none font-bold" style={{ color: SERIES[1] }}>
            {data.b.wins}
          </span>
        </div>
        {/* A 2px surface gap rather than a border between the two fills. */}
        <div className="flex h-2 w-full max-w-sm gap-0.5">
          <div className="rounded-l" style={{ width: `${(data.a.wins / total) * 100}%`, background: SERIES[0] }} />
          {data.draws > 0 ? (
            <div style={{ width: `${(data.draws / total) * 100}%`, background: CHART.muted }} />
          ) : null}
          <div className="rounded-r" style={{ width: `${(data.b.wins / total) * 100}%`, background: SERIES[1] }} />
        </div>
        <div className="flex gap-6 text-[13px] text-ink-2">
          <span>{data.a.playerName} avg {data.a.average}</span>
          {data.draws > 0 ? <span className="text-ink-3">{data.draws} drawn</span> : null}
          <span>{data.b.playerName} avg {data.b.average}</span>
        </div>
      </Card>

      <div className="flex flex-col gap-5 xl:flex-row">
        <Card className="flex w-full shrink-0 flex-col gap-3 xl:w-[560px]">
          <div className="flex flex-col gap-0.5">
            <Label>Round shape</Label>
            <span className="dsp text-xl font-semibold">Same twelve spokes</span>
          </div>
          <p className="text-xs leading-relaxed text-ink-3">
            Each spoke is scaled so the better of the two reaches the outer ring,
            so the gaps read directly.
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={shape} outerRadius="76%">
                <PolarGrid stroke={CHART.grid} />
                <PolarAngleAxis dataKey="round" tick={{ fill: CHART.axis, fontSize: 12 }} />
                <Tooltip contentStyle={{ background: CHART.surface, border: `1px solid ${CHART.line}`, borderRadius: 8 }} />
                <Radar name={data.a.playerName} dataKey={data.a.playerName} stroke={SERIES[0]}
                  strokeWidth={2} fill={SERIES[0]} fillOpacity={0.16} isAnimationActive={false} />
                <Radar name={data.b.playerName} dataKey={data.b.playerName} stroke={SERIES[1]}
                  strokeWidth={2} fill={SERIES[1]} fillOpacity={0.16} isAnimationActive={false} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-5">
            {[[data.a.playerName, SERIES[0]], [data.b.playerName, SERIES[1]]].map(([name, colour]) => (
              <div key={name} className="flex items-center gap-2">
                <span className="h-0.5 w-3.5" style={{ background: colour }} />
                <span className="text-[13px] text-ink-2">{name}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex grow flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-0.5">
              <Label>Round by round</Label>
              <span className="dsp text-xl font-semibold">Who takes it more often</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {data.rounds.map((round) => (
              <div key={round.key} className="flex items-center gap-3">
                <span
                  className="dsp w-6 shrink-0 text-base font-bold"
                  style={{ color: round.aShare >= round.bShare ? SERIES[0] : SERIES[1] }}
                >
                  {round.key}
                </span>
                <span className="dsp num w-10 shrink-0 text-right text-[15px] font-semibold text-ink-2">
                  {round.aShare}%
                </span>
                <div className="flex h-4 grow gap-0.5">
                  <div className="rounded-l" style={{ width: `${round.aShare}%`, background: SERIES[0] }} />
                  {round.level > 0 ? (
                    <div style={{ width: `${(round.level / data.games) * 100}%`, background: CHART.grid }} />
                  ) : null}
                  <div className="rounded-r" style={{ width: `${round.bShare}%`, background: SERIES[1] }} />
                </div>
                <span className="dsp num w-10 shrink-0 text-[15px] font-semibold text-ink-2">
                  {round.bShare}%
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-3">
            The gap in the middle of a bar is games where they scored the same in
            that round.
          </p>
        </Card>
      </div>
    </>
  );
}
