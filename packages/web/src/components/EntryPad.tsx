import { DARTS_PER_TURN } from '@dartix/core';
import type { Round } from '@dartix/core';
import { Button, Label } from './ui';

export interface EntryPadProps {
  round: Round;
  playerName: string;
  /** Partial sum for the doubles and trebles rounds. */
  draft: number;
  /** Which faces are behind that sum, so the pad can mark them. */
  hits?: readonly number[];
  onCommit: (value: number) => void;
  onAddFace: (face: number) => void;
  onClearDraft: () => void;
  onCommitDraft: () => void;
  onUndo: () => void;
  canUndo: boolean;
}

/**
 * The pad changes with the round, so the same keystroke always means the
 * obvious thing.
 *
 * The old app offered a 20px `<input type="number">` and shipped two abandoned
 * on-screen keypads it never wired up — simple-keyboard got a 300px flex slot
 * beside the grid and was never instantiated.
 */
export function EntryPad(props: EntryPadProps) {
  const { round, playerName, onUndo, canUndo } = props;

  return (
    <div className="flex grow flex-col gap-2.5 rounded-xl border border-line bg-surface p-3 sm:gap-3.5 sm:p-5">
      <div className="flex items-center gap-3">
        <Label>{round.name} · {playerName}</Label>
        <div className="h-px grow bg-line-soft" />
        <span className="hidden text-xs text-ink-3 sm:inline">Type a digit, or click</span>
        <Button variant="default" disabled={!canUndo} onClick={onUndo} className="px-3! py-1.5!">
          Undo
        </Button>
      </div>

      {round.kind === 'count' ? <CountPad {...props} /> : null}
      {round.kind === 'bull' ? <BullPad {...props} /> : null}
      {round.kind === 'binary' ? <BinaryPad {...props} /> : null}
      {round.kind === 'sum' ? <SumPad {...props} /> : null}
    </div>
  );
}

function Chip({
  value, points, onPick, wide = false,
}: { value: number; points: number; onPick: () => void; wide?: boolean }) {
  const blank = value === 0;
  return (
    <button
      onClick={onPick}
      className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg border transition-colors sm:h-18 ${
        blank
          ? 'border-danger/45 bg-danger/12 hover:bg-danger/20'
          : 'border-line bg-raised hover:border-ink-3'
      } ${wide ? 'col-span-2' : ''}`}
    >
      <span className={`dsp text-[22px] leading-none font-bold sm:text-[27px] ${blank ? 'text-danger' : ''}`}>
        {value}
      </span>
      <span className={`label num text-[10px]! tracking-normal! ${blank ? 'text-danger!' : ''}`}>
        {blank ? 'halve' : points}
      </span>
    </button>
  );
}

/** Number rounds: how many segments, counting a treble as three. */
function CountPad({ round, onCommit }: EntryPadProps) {
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
      {Array.from({ length: round.maxInput + 1 }, (_, value) => (
        <Chip key={value} value={value} points={value * round.multiplier} onPick={() => onCommit(value)} />
      ))}
    </div>
  );
}

/** Bull: units of 25, a bullseye counting two. */
function BullPad({ round, onCommit }: EntryPadProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {Array.from({ length: round.maxInput + 1 }, (_, value) => (
          <Chip key={value} value={value} points={value * round.multiplier} onPick={() => onCommit(value)} />
        ))}
      </div>
      <span className="hidden text-xs text-ink-3 sm:inline">
        Outer bull counts 1, bullseye counts 2. Three darts, so 6 is the ceiling.
      </span>
    </div>
  );
}

/**
 * The darts as an expression, falling back to the plain total.
 *
 * Three darts is the real ceiling, but nothing stops a mis-tap adding more, so
 * past four terms this groups repeats — "1 ×6 + 20" rather than a formula that
 * outgrows its box.
 */
function sum(hits: readonly number[] | undefined, draft: number): string {
  if (!hits || hits.length === 0) return String(draft);
  if (hits.length <= 4) return hits.join(' + ');

  const counts = new Map<number, number>();
  for (const face of hits) counts.set(face, (counts.get(face) ?? 0) + 1);
  return [...counts]
    .map(([face, n]) => (n > 1 ? `${face}\u00d7${n}` : String(face)))
    .join(' + ');
}

/**
 * The 41. All or nothing, so two buttons is the whole round.
 *
 * It gets blanked in 84% of real games, which is why the miss side carries the
 * consequence rather than being the quiet option.
 */
function BinaryPad({ onCommit }: EntryPadProps) {
  return (
    /*
     * `flex-1 basis-0` on both halves, not `grow`: with an auto basis the
     * longer label ("halves your total") made the miss button the wider of
     * the two, which read as a recommendation.
     *
     * And no vertical `grow` on the row — the pad stretches to the height of
     * the turn card beside it, which since the card grew a full-size
     * dartboard would blow these two up to 650px tall.
     */
    <div className="flex gap-3">
      <button
        onClick={() => onCommit(1)}
        className="flex flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-xl border border-good/45 bg-good/12 py-4 transition-colors hover:bg-good/20 sm:py-6"
      >
        <span className="dsp text-3xl leading-none font-bold text-good">HIT</span>
        <span className="label num text-good!">+41</span>
        <Label className="mt-1 hidden sm:block">Key 1 / Y</Label>
      </button>
      <button
        onClick={() => onCommit(0)}
        className="flex flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-xl border border-danger/45 bg-danger/12 py-4 transition-colors hover:bg-danger/20 sm:py-6"
      >
        <span className="dsp text-3xl leading-none font-bold text-danger">MISS</span>
        <span className="label text-danger!">halves your total</span>
        <Label className="mt-1 hidden sm:block">Key 0 / N</Label>
      </button>
    </div>
  );
}

/**
 * Doubles and trebles: tap the faces you hit and the pad does the arithmetic.
 *
 * The old app made you sum the base numbers in your head before typing, which
 * is the one part of its input model that was actually wrong rather than dated.
 */
function SumPad({
  round, draft, hits, onAddFace, onClearDraft, onCommitDraft, onCommit,
}: EntryPadProps) {
  /*
   * How many darts landed in each face. Two in D20 is ordinary, and the count
   * has to be visible somewhere or the pad looks like nothing happened on the
   * second tap — the button says "20 ×2" and the readout spells the sum out.
   */
  const taps = new Map<number, number>();
  for (const face of hits ?? []) taps.set(face, (taps.get(face) ?? 0) + 1);

  const thrown = hits?.length ?? 0;
  const spent = thrown >= DARTS_PER_TURN;

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <div className="grid grow grid-cols-5 gap-1.5 sm:grid-cols-10">
        {Array.from({ length: 20 }, (_, i) => i + 1).map((face) => (
          <button
            key={face}
            onClick={() => onAddFace(face)}
            disabled={spent || draft + face > round.maxInput}
            aria-pressed={(taps.get(face) ?? 0) > 0}
            aria-label={
              (taps.get(face) ?? 0) > 1 ? `${face}, hit ${taps.get(face)} times` : String(face)
            }
            /* A face you have hit keeps its full green even once it is
               disabled — it usually is, because a second dart in the same
               double often takes you past the round's ceiling, and "you hit
               this" outranks "you cannot add another". */
            className={`dsp flex h-9 items-center justify-center gap-0.5 rounded-md border
                        text-[15px] font-semibold transition-colors sm:h-10 sm:text-[17px] ${
              taps.has(face)
                ? 'border-good bg-good/20 text-good'
                : 'border-line bg-raised hover:border-ink-3 disabled:opacity-30 disabled:hover:border-line'
            }`}
          >
            {face}
            {(taps.get(face) ?? 0) > 1 ? (
              /* Smaller, so the face stays the thing you read first. */
              <span className="text-[11px] font-bold opacity-80 sm:text-[12px]">
                &times;{taps.get(face)}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 flex-col gap-2 lg:w-48">
        {/* Inline on a phone: stacked, this readout is the tallest element in
            the tallest pad, and the height comes straight off the standings. */}
        <div
          className="flex grow items-center justify-center gap-2 rounded-lg border border-line
                     bg-ground px-3 py-1.5 lg:flex-col lg:gap-0.5 lg:py-3"
        >
          <Label className={spent ? 'text-good!' : ''}>
            {round.key === 'D' ? 'Doubles' : 'Trebles'}
            {/* The pad goes inert on the third dart, so it has to say why. */}
            {thrown > 0 ? ` · ${thrown} of ${DARTS_PER_TURN}` : ''}
          </Label>
          {/* The darts, not their sum: "10 + 10" is checkable against what is
              still stuck in the board, where "20" has to be taken on trust.
              A typed total has no faces behind it, so it stays a total. */}
          <span className="dsp text-2xl leading-none font-bold lg:text-3xl">{sum(hits, draft)}</span>
          <span className="dsp num text-[15px] font-semibold text-accent">
            = {draft * round.multiplier} pts
          </span>
        </div>
        <div className="flex gap-2">
          {/* One button, two jobs — and when it is the one that halves you it
              wears the halving colour, like every other way of blanking. */}
          <Button
            variant={draft > 0 ? 'default' : 'danger'}
            onClick={draft > 0 ? onClearDraft : () => onCommit(0)}
            className="grow"
          >
            {draft > 0 ? 'Clear' : 'Blank it'}
          </Button>
          <Button variant="primary" onClick={onCommitDraft} className="grow-[2]">
            Enter
          </Button>
        </div>
      </div>
    </div>
  );
}
