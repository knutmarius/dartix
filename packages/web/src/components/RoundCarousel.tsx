import { ROUNDS } from '@dartix/core';
import { Dartboard } from './Dartboard';
import { Label } from './ui';

/**
 * The twelve rounds, one at a time, on a board.
 *
 * A static board with 13 through 20 lit showed the shape of the game but not
 * the shape of a *game*: the order is fixed and it is the whole reason the
 * halving hurts where it does. Cycling teaches the sequence to someone who has
 * never played, and it is the one place in the app with room to do it.
 *
 * Not paused under `prefers-reduced-motion` — there is no movement here, only
 * a change of state every three seconds, which is the same class of thing as
 * the pulse the segments already do (and that one does stop). The board
 * cross-dissolves between targets rather than cutting.
 *
 * The index is owned by the page, so the strip of rounds below moves with it.
 */
export function RoundCarousel({
  index, onPick,
}: { index: number; onPick: (next: number) => void }) {
  const round = ROUNDS[index]!;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="aspect-square w-full">
        <Dartboard round={round} />
      </div>

      <div className="flex w-full flex-col items-center gap-2">
        <div className="flex items-baseline gap-2">
          <span className="dsp text-2xl leading-none font-bold text-accent">{round.label}</span>
          <span className="dsp text-lg leading-none font-semibold text-ink-2">{round.name}</span>
        </div>
        <Label className="text-[10px]!">Round {index + 1} of 12</Label>

        {/* Twelve dots rather than twelve labels — the same progress cue the
            phone board uses, so the front page teaches its vocabulary. */}
        <div className="mt-0.5 flex gap-1.5">
          {ROUNDS.map((r, i) => (
            <button
              key={r.key}
              onClick={() => onPick(i)}
              title={r.name}
              aria-label={`Show ${r.name}`}
              className={`size-2 rounded-full transition-colors ${
                i === index ? 'bg-accent' : 'bg-ink-4 hover:bg-ink-3'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
