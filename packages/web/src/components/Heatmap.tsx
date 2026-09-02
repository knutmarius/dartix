import { Link } from 'react-router-dom';
import type { RoundMatrixResponse } from '../api';
import { SEQUENTIAL, SEQUENTIAL_INK, rampIndex } from '../lib/palette';
import { Label } from './ui';

/**
 * Players down, the twelve rounds across, shaded by average points.
 *
 * Shaded *within each round*, so a bright cell means best in the room at that
 * target rather than simply a round worth more points — the 20s are worth six
 * times the bull per dart, and a raw scale would say nothing else.
 *
 * One hue, low to high, five steps. Every cell also carries its number, so the
 * encoding is never colour alone.
 */
export function Heatmap({ matrix }: { matrix: RoundMatrixResponse }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-0.5">
          <Label>Round heatmap</Label>
          <span className="dsp text-xl font-semibold">Who owns which round</span>
        </div>
        <p className="max-w-md text-xs leading-relaxed text-ink-3">
          Average points, shaded within each round — so a bright cell means best
          in the room at that target, not simply a big number.
        </p>
        <div className="grow" />
        <div className="flex items-center gap-2.5 pb-0.5">
          <Label className="text-[10px]!">Weakest</Label>
          <div className="flex gap-0.5">
            {SEQUENTIAL.map((step) => (
              <div key={step} className="h-3 w-7 rounded-sm" style={{ background: step }} />
            ))}
          </div>
          <Label className="text-[10px]!">Strongest</Label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="flex items-center gap-2.5">
            <div className="w-28 shrink-0" />
            <div className="grid grow grid-cols-12 gap-0.5">
              {matrix.rounds.map((key) => (
                <Label
                  key={key}
                  className={`dsp text-center ${
                    key === '41' ? 'text-danger!' : /^\d+$/.test(key) ? '' : 'text-accent!'
                  }`}
                >
                  {key}
                </Label>
              ))}
            </div>
          </div>

          <div className="mt-1.5 flex flex-col gap-0.5">
            {matrix.rows.map((row) => (
              <div key={row.playerId} className="flex items-center gap-2.5">
                <Link
                  to={`/stats/player/${row.playerId}`}
                  className="dsp w-28 shrink-0 truncate text-[17px] font-semibold text-ink/85 hover:text-accent"
                  title={`${row.playerName} — ${row.games} games`}
                >
                  {row.playerName}
                </Link>
                <div className="grid grow grid-cols-12 gap-0.5">
                  {row.cells.map((cell) => {
                    const step = rampIndex(cell.share);
                    return (
                      <div
                        key={cell.key}
                        title={`${row.playerName} · ${cell.key}: ${cell.average} average`}
                        className="grid h-10 place-items-center rounded-sm"
                        style={{ background: SEQUENTIAL[step], color: SEQUENTIAL_INK[step] }}
                      >
                        <span className="dsp num text-[15px] font-semibold">{cell.average}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
