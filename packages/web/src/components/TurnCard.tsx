import { missOutcome } from '@dartix/core';
import type { Round } from '@dartix/core';
import { Dartboard } from './Dartboard';
import { Avatar, Label } from './ui';

/**
 * Whose turn it is, and what a blank would cost.
 *
 * The stakes line is the point. Real games average 5.9 blanks out of twelve
 * rounds, so the halving is not an occasional drama — it is the game, and it is
 * worth seeing before the darts leave your hand.
 */
export function TurnCard({
  playerName, round, total, hits,
}: { playerName: string; round: Round; total: number; hits?: readonly number[] }) {
  const miss = missOutcome(total);

  return (
    <div className="flex w-full shrink-0 flex-col gap-3.5 rounded-xl border border-line bg-surface p-5 lg:w-[340px] xl:w-[390px]">
      <div className="flex items-center gap-3">
        <Avatar name={playerName} tone="active" />
        <div className="flex min-w-0 flex-col">
          <Label className="text-accent!">Now throwing</Label>
          <span className="dsp truncate text-2xl leading-none font-bold">{playerName}</span>
        </div>
      </div>

      <div className="h-px bg-line-soft" />

      {/*
        * Where to throw, at the full width of the card.
        *
        * It started beside the instruction at 124px, which is small enough
        * that the treble band is two pixels and the number ring is mud. The
        * text moves underneath and shortens instead — the picture answers
        * "where" faster than the sentence does, and the sentence is only
        * really needed on the two rounds that take a sum.
        */}
      <div className="mx-auto aspect-square w-full max-w-[330px]">
        <Dartboard round={round} hits={hits} />
      </div>

      <div className="flex flex-col gap-1">
        <Label>{round.name}</Label>
        <p className="text-[13px] leading-snug text-ink-2">{instructionFor(round)}</p>
      </div>

      <div className="grow" />

      <div className="overflow-hidden rounded-lg border border-line bg-ground">
        <div className="flex items-baseline justify-between px-3.5 pt-3 pb-2">
          <Label>On the board</Label>
          <span className="dsp num text-[26px] leading-none font-bold">{total}</span>
        </div>
        <div className="flex items-center justify-between border-t border-danger/25 bg-danger/12 px-3.5 py-2.5">
          <Label className="text-danger!">Miss &rarr; halved</Label>
          <div className="flex items-baseline gap-2">
            <span className="dsp num text-[22px] leading-none font-bold text-danger">{miss.to}</span>
            <span className="dsp num text-[13px] font-semibold text-danger">({miss.delta})</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function instructionFor(round: Round): string {
  switch (round.kind) {
    case 'sum':
      return `Tap each number you hit as a ${round.key === 'D' ? 'double' : 'treble'} — the pad sums them.`;
    case 'binary':
      return 'Exactly 41 with three darts. All or nothing.';
    case 'bull':
      return 'Outer bull counts one, bullseye two.';
    default:
      return `How many ${round.label}s? A treble counts three, a double two.`;
  }
}
