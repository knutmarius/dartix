import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ROUNDS } from '@dartix/core';
import type { RoundInputs } from '@dartix/core';
import { walk } from '@dartix/core';
import { CHART, seriesColour } from '../lib/palette';
import type { GamePlayer } from '../store/game';

/**
 * Running total after each round.
 *
 * The y-axis is derived from the data, never fixed. Real games have a median
 * total of 42 and a record of 566, so any hardcoded ceiling would squash almost
 * every game into the bottom of the plot.
 */
export function RunChart({
  players, inputs, height = 320,
}: { players: GamePlayer[]; inputs: Record<string, RoundInputs>; height?: number }) {
  const walks = new Map(players.map((p) => [p.id, walk(inputs[p.id] ?? {})]));

  const data = ROUNDS.map((round, index) => {
    const point: Record<string, number | string> = { round: round.label };
    for (const player of players) {
      const cell = walks.get(player.id)!.cells[index];
      if (cell?.played) point[player.name] = cell.after;
    }
    return point;
  });

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -12 }}>
          {/* Solid hairlines. Dashing reads as "projection" when it is just a grid. */}
          <CartesianGrid stroke={CHART.grid} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="round"
            tick={{ fill: CHART.axis, fontSize: 12 }}
            stroke={CHART.grid}
            tickLine={false}
          />
          <YAxis
            domain={[0, 'auto']}
            tick={{ fill: CHART.axis, fontSize: 11 }}
            stroke={CHART.grid}
            tickLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={{ background: CHART.surface, border: `1px solid ${CHART.line}`, borderRadius: 8 }}
            labelStyle={{ color: 'var(--color-ink)', fontWeight: 600 }}
            itemSorter={(item) => -(item.value as number)}
          />
          {/* A legend is always present for two or more series, so identity is
              never carried by colour alone. */}
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={9}
            wrapperStyle={{ paddingBottom: 12, fontSize: 13, color: 'var(--color-ink-2)' }}
          />
          {players.map((player, index) => (
            <Line
              key={player.id}
              type="linear"
              dataKey={player.name}
              stroke={seriesColour(index)}
              strokeWidth={2}
              dot={{ r: 3.5, strokeWidth: 2, stroke: CHART.surface, fill: seriesColour(index) }}
              activeDot={{ r: 5.5, strokeWidth: 2, stroke: CHART.surface }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
