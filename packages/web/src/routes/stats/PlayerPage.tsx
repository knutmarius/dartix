import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CartesianGrid, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, Radar, RadarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../../api';
import { CHART, SERIES } from '../../lib/palette';
import { useRange } from '../../lib/useRange';
import {
  Avatar, Card, ErrorNote, Label, Loading, formatDate, oneDp, pct,
} from '../../components/ui';

const WINDOWS = [
  { size: 25, label: 'Last 25' },
  { size: 50, label: 'Last 50' },
  { size: 0, label: 'Everything' },
] as const;

export function PlayerPage() {
  const { id = '' } = useParams();
  const range = useRange();
  const [windowSize, setWindowSize] = useState<number>(50);

  const profile = useQuery({
    queryKey: ['profile-page', id, ...range.cacheKey],
    queryFn: () => api.playerProfile(id, range.query),
  });
  const matrix = useQuery({
    queryKey: ['round-matrix', ...range.cacheKey],
    queryFn: () => api.roundMatrix(range.query),
  });

  if (profile.isPending) return <Loading what="Reading the record" />;
  if (profile.isError) return <ErrorNote error={profile.error} retry={() => void profile.refetch()} />;

  const p = profile.data;

  /*
   * Form: score per game with a trailing mean over it.
   *
   * Windowed to the recent games by default. The heaviest player here has 346,
   * and plotting all of them gives a spiky mass where only the rolling average
   * is legible. The x-axis is game order, not elapsed time — this board went
   * nearly silent through 2021 and 2022, so a full-range view puts games two
   * years apart side by side.
   */
  const from = windowSize === 0 ? 0 : Math.max(0, p.history.length - windowSize);
  const form = p.history.slice(from).map((game, index) => ({
    when: formatDate(game.when),
    score: game.total,
    trend: p.rollingAverage[from + index] ?? null,
  }));

  /*
   * Radar scaled against the best average in the field for each round.
   *
   * Scaling against the theoretical maximum would be useless: the 20s are worth
   * 180 to the 41's 41, so every spoke would collapse except one.
   */
  const fieldBest = new Map<string, number>();
  for (const row of matrix.data?.rows ?? []) {
    for (const cell of row.cells) {
      fieldBest.set(cell.key, Math.max(fieldBest.get(cell.key) ?? 0, cell.average));
    }
  }
  const shape = p.rounds.map((round) => {
    const best = fieldBest.get(round.key) ?? round.average;
    return {
      round: round.key,
      you: best > 0 ? Math.round((round.average / best) * 100) : 0,
      average: round.average,
    };
  });

  const worst = [...p.rounds].sort((a, b) => b.blankRate - a.blankRate).slice(0, 3);

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-wrap items-center gap-6">
        <Avatar name={p.playerName} tone="series1" size="lg" />
        <div className="flex flex-col gap-0.5">
          <span className="dsp text-4xl leading-none font-bold">{p.playerName}</span>
          <span className="text-[13px] text-ink-3">
            {p.games} games{p.history[0] ? ` since ${formatDate(p.history[0].when)}` : ''}
          </span>
        </div>
        <div className="grow" />
        <div className="flex flex-wrap gap-8">
          {[
            ['Average', oneDp(p.average), 'accent'],
            ['Highest', p.high, 'default'],
            ['Lowest', p.low, 'default'],
            ['Win rate', pct(p.winRate), 'default'],
            ['Halvings / game', oneDp(p.halvingsPerGame), 'danger'],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className="flex flex-col gap-0.5">
              <Label>{String(label)}</Label>
              <span
                className={`hero text-4xl leading-none font-bold ${
                  tone === 'accent' ? 'text-accent' : tone === 'danger' ? 'text-danger' : ''
                }`}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-5 xl:flex-row">
        <Card className="flex grow flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-0.5">
              <Label>Form</Label>
              <span className="dsp text-xl font-semibold">
                {windowSize === 0
                  ? `All ${p.history.length} games, in order played`
                  : `Last ${Math.min(windowSize, p.history.length)} games`}
              </span>
            </div>
            <div className="grow" />
            <div className="flex gap-0.5 rounded-lg border border-line bg-ground p-0.5">
              {WINDOWS.map((option) => (
                <button
                  key={option.size}
                  onClick={() => setWindowSize(option.size)}
                  className={`label rounded-md px-3 py-1.5 transition-colors ${
                    windowSize === option.size ? 'bg-raised text-ink' : 'hover:text-ink-2'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-ink-3">
            Ordered by game, not by date — play here goes in bursts.
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={form} margin={{ top: 8, right: 12, bottom: 4, left: -14 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="when" tick={{ fill: CHART.axis, fontSize: 11 }} stroke={CHART.grid} tickLine={false} minTickGap={40} />
                <YAxis domain={[0, 'auto']} tick={{ fill: CHART.axis, fontSize: 11 }} stroke={CHART.grid} tickLine={false} width={44} />
                <Tooltip
                  contentStyle={{ background: CHART.surface, border: `1px solid ${CHART.line}`, borderRadius: 8 }}
                  labelStyle={{ color: 'var(--color-ink)', fontWeight: 600 }}
                />
                <Legend verticalAlign="top" align="right" iconType="plainline" iconSize={14}
                  wrapperStyle={{ paddingBottom: 10, fontSize: 13, color: 'var(--color-ink-2)' }} />
                <Line name="Game score" type="linear" dataKey="score" stroke={SERIES[0]} strokeWidth={2}
                  dot={form.length <= 60 ? { r: 3, strokeWidth: 2, stroke: CHART.surface, fill: SERIES[0] } : false}
                  isAnimationActive={false} />
                <Line name="5-game average" type="monotone" dataKey="trend" stroke={CHART.muted} strokeWidth={2}
                  dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex w-full shrink-0 flex-col gap-4 xl:w-[340px]">
          <Label>Recent results</Label>
          <div className="flex items-baseline gap-2.5">
            <span className="hero text-4xl leading-none font-bold">
              {p.history.slice(-10).filter((g) => g.won).length}
            </span>
            <span className="text-sm text-ink-2">
              wins in the last {Math.min(10, p.history.length)}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {p.history.slice(-10).map((game) => (
              <div
                key={game.gameId}
                title={`${formatDate(game.when)} — ${game.total}, ${game.position} of ${game.fieldSize}`}
                className={`dsp grid size-7 place-items-center rounded-md text-[13px] font-bold ${
                  game.won ? 'bg-good/18 text-good' : 'bg-raised text-ink-3'
                }`}
              >
                {game.won ? 'W' : 'L'}
              </div>
            ))}
          </div>
          <div className="h-px bg-line-soft" />
          <div className="flex flex-col gap-3">
            {[
              ['Best streak', p.bestStreak],
              ['Current streak', p.currentStreak],
              ['Games in range', p.games],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-baseline">
                <span className="text-[13px] text-ink-2">{label}</span>
                <div className="grow" />
                <span className="dsp num text-xl font-bold">{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-5 xl:flex-row">
        <Card className="flex w-full shrink-0 flex-col gap-4 xl:w-[560px]">
          <div className="flex flex-col gap-0.5">
            <Label>Round shape</Label>
            <span className="dsp text-xl font-semibold">Share of the field&rsquo;s best</span>
          </div>
          <p className="text-xs leading-relaxed text-ink-3">
            Each spoke is one round, scaled so the best average in the group reaches
            the outer ring. Against the theoretical maximum every spoke would
            collapse — the 20s are worth 180 a round, the 41 exactly 41.
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={shape} outerRadius="76%">
                <PolarGrid stroke={CHART.grid} />
                <PolarAngleAxis dataKey="round" tick={{ fill: CHART.axis, fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: CHART.surface, border: `1px solid ${CHART.line}`, borderRadius: 8 }}
                  formatter={(value: number, _name, item) =>
                    [`${value}% of best · ${(item.payload as { average: number }).average} avg`, 'This round']}
                />
                <Radar name={p.playerName} dataKey="you" stroke={SERIES[0]} strokeWidth={2}
                  fill={SERIES[0]} fillOpacity={0.18} isAnimationActive={false} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          {/* The table twin: every value readable without colour. */}
          <div className="grid grid-cols-4 gap-x-3 gap-y-2 sm:grid-cols-6">
            {p.rounds.map((round) => (
              <div key={round.key} className="flex items-baseline gap-1.5">
                <span className="dsp w-5 text-[13px] font-bold text-ink-3">{round.key}</span>
                <span className="dsp num text-sm font-semibold text-ink-2">{round.average}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex grow flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-0.5">
              <Label>Where you bleed</Label>
              <span className="dsp text-xl font-semibold">How often each round blanks</span>
            </div>
            <div className="grow" />
            <span className="text-xs text-ink-3">Share of games scoring zero</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {p.rounds.map((round) => {
              const hot = round.blankRate >= 50;
              return (
                <div key={round.key} className="flex items-center gap-3">
                  <span className={`dsp w-6 shrink-0 text-base font-bold ${hot ? 'text-danger' : 'text-ink-2'}`}>
                    {round.key}
                  </span>
                  <div className="h-3.5 grow overflow-hidden rounded bg-raised">
                    <div
                      className={`h-full rounded ${hot ? 'bg-danger' : 'bg-ink-3'}`}
                      style={{ width: `${round.blankRate}%` }}
                    />
                  </div>
                  <span className={`dsp num w-11 shrink-0 text-right text-base font-semibold ${hot ? 'text-danger' : 'text-ink-2'}`}>
                    {round.blankRate}%
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-danger/32 bg-danger/8 p-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" className="mt-0.5 size-4 shrink-0 text-danger">
              <path d="M12 9v4" /><path d="M12 17h.01" />
              <path d="M10.3 3.9 2.4 18a1.8 1.8 0 0 0 1.6 2.7h16a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0z" />
            </svg>
            <p className="text-[13px] leading-relaxed text-ink">
              Your worst three are {worst.map((r) => r.key).join(', ')} — blanked{' '}
              {worst.map((r) => `${r.blankRate}%`).join(', ')} of the time. A blank late
              in the order costs far more than the same blank early, so this is where
              the average goes.
            </p>
          </div>
        </Card>
      </div>

      <Link to="/stats" className="label text-accent! transition-opacity hover:opacity-80">
        Back to the leaderboard
      </Link>
    </div>
  );
}
