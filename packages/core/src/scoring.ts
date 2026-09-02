import { ROUNDS, ROUND_COUNT, roundFor } from './rounds.js';
import type {
  GameEntry, RoundCell, RoundInputs, RoundKey, RoundPoints, Standing, Walk,
} from './types.js';

/**
 * Points for one round: whatever was typed, times the round's multiplier.
 *
 * The legacy switch (`GamePresenter.js:138-155`) is exactly this table:
 *   D → ×2, T → ×3, 41 → ×41, B → ×25, anything else → × the round number.
 */
export function pointsFor(key: RoundKey, input: number): number {
  return input * roundFor(key).multiplier;
}

/**
 * Halve a total, **rounding up**.
 *
 * The original spelled this out longhand (`GamePresenter.js:240-244`):
 *
 *   function divide(numerator, denominator) {
 *     var remainder = numerator % denominator;
 *     var quotient = (numerator - remainder) / denominator;
 *     return quotient + remainder;
 *   }
 *
 * With denominator 2 that is `floor(n/2) + (n % 2)`, i.e. `ceil(n/2)`.
 * So 41 halves to 21, not 20. A decade of stored games depends on it.
 */
export function halve(total: number): number {
  return Math.ceil(total / 2);
}

/** What a blank would cost right now — the scoreboard's stakes preview. */
export function missOutcome(total: number): { to: number; delta: number } {
  const to = halve(total);
  return { to, delta: to - total };
}

/**
 * Walk the twelve rounds in order and accumulate the total.
 *
 * Score in a round and it adds; blank it and the whole running total halves.
 *
 * A round with no input **stops** the walk, matching the legacy `break`
 * (`GamePresenter.js:182`) so that a part-finished game shows an honest
 * partial rather than halving its way through the blanks. A round that has
 * input but sits after such a gap keeps its `input` for display but is
 * reported `played: false` and contributes nothing. Turn mode fills the
 * board contiguously, so a gap only arises if someone clears a middle cell.
 */
export function walk(inputs: RoundInputs): Walk {
  const cells: RoundCell[] = [];
  let total = 0;
  let played = 0;
  let stopped = false;

  for (const round of ROUNDS) {
    const input = inputs[round.key];
    const missing = input === undefined || input === null || Number.isNaN(input);

    if (stopped || missing) {
      stopped = true;
      cells.push({
        key: round.key,
        played: false,
        ...(missing ? {} : { input }),
        points: 0,
        before: total,
        after: total,
        halved: false,
        delta: 0,
      });
      continue;
    }

    const points = input * round.multiplier;
    const before = total;
    total = points > 0 ? total + points : halve(total);
    played += 1;

    cells.push({
      key: round.key,
      played: true,
      input,
      points,
      before,
      after: total,
      halved: points === 0,
      delta: total - before,
    });
  }

  return { cells, total, played, complete: played === ROUND_COUNT };
}

/** The total after every played round. Shorthand for `walk(inputs).total`. */
export function totalFor(inputs: RoundInputs): number {
  return walk(inputs).total;
}

/**
 * Whether a game may be saved: every round entered, for this player.
 * Mirrors `isGameFinished` (`GamePresenter.js:207-220`), which blocked the
 * save with an alert until every cell held an integer.
 */
export function isComplete(inputs: RoundInputs): boolean {
  return ROUNDS.every((r) => {
    const v = inputs[r.key];
    return typeof v === 'number' && Number.isInteger(v) && v >= 0;
  });
}

/** The points each played round scored — the form that gets persisted. */
export function pointsByRound(inputs: RoundInputs): RoundPoints {
  const out: RoundPoints = {};
  for (const cell of walk(inputs).cells) {
    if (cell.played) out[cell.key] = cell.points;
  }
  return out;
}

/**
 * Is this input plausible for three darts?
 *
 * Returns a human-readable complaint, or `null` when the value is fine.
 * Deliberately advisory: the legacy app enforced nothing at all, so `99` in
 * the 20s round scored 1980 and got saved. We warn rather than block, both
 * because the players know the rules better than the app does and because
 * historical data may already hold odd values.
 */
export function validateInput(key: RoundKey, input: number): string | null {
  const round = roundFor(key);

  if (!Number.isInteger(input)) return 'Whole numbers only.';
  if (input < 0) return 'Cannot be negative.';
  if (input <= round.maxInput) return null;

  switch (round.kind) {
    case 'count':
      return `Three darts can hit ${round.label} at most ${round.maxInput} times — a treble counts three.`;
    case 'sum':
      return `Three ${round.name.toLowerCase()} top out at ${round.maxInput} (three ×20).`;
    case 'binary':
      return 'The 41 is made or missed — 1 or 0.';
    case 'bull':
      return `Three darts give at most ${round.maxInput} bull units, counting a bullseye as two.`;
  }
}

/**
 * Rank players by total, highest first, with ties sharing a position.
 *
 * Competition ranking: totals of 400, 300, 300, 200 give positions 1, 2, 2, 4.
 *
 * This is a deliberate departure from the original, which computed the winner
 * as `Results.OrderByDescending(r => r.Sum).First()` (`HalfItGame.cs:17-25`) —
 * a stable sort, so a tie silently handed the win to whichever player happened
 * to sit first in the array. It also made a solo player simultaneously winner
 * and loser, which then counted as both a win and a loss in the leaderboard
 * (`HalfItController.cs:132-133`). Here a solo game has a winner and no loser.
 */
export function rankPlayers(
  entries: readonly { playerId: string; playerName: string; total: number }[],
): Standing[] {
  if (entries.length === 0) return [];

  const totals = entries.map((e) => e.total);
  const best = Math.max(...totals);
  const worst = Math.min(...totals);
  const solo = entries.length < 2;

  return entries
    .map((entry): Standing => {
      const ahead = totals.filter((t) => t > entry.total).length;
      const shared = totals.filter((t) => t === entry.total).length > 1;
      return {
        playerId: entry.playerId,
        playerName: entry.playerName,
        total: entry.total,
        position: ahead + 1,
        isWinner: entry.total === best,
        isLoser: !solo && entry.total === worst && worst !== best,
        tied: shared,
      };
    })
    .sort((a, b) => b.total - a.total || a.playerName.localeCompare(b.playerName));
}

/** Rank a whole game straight from its raw inputs. */
export function standingsFor(entries: readonly GameEntry[]): Standing[] {
  return rankPlayers(
    entries.map((e) => ({
      playerId: e.playerId,
      playerName: e.playerName,
      total: totalFor(e.inputs),
    })),
  );
}

/* ------------------------------------------------------------------ *
 * Turn order
 *
 * Play is row-major over the rounds: every player throws at 13, then every
 * player at 14, and so on. This matches `moveNextFocus`
 * (`GameView.js:109-120`), which walked across the players in a round before
 * dropping to the next round.
 * ------------------------------------------------------------------ */

export interface Cursor {
  roundIndex: number;
  playerIndex: number;
}

export function cursorFromOrdinal(ordinal: number, playerCount: number): Cursor {
  return {
    roundIndex: Math.floor(ordinal / playerCount),
    playerIndex: ordinal % playerCount,
  };
}

export function ordinalFromCursor(cursor: Cursor, playerCount: number): number {
  return cursor.roundIndex * playerCount + cursor.playerIndex;
}

export function turnCount(playerCount: number): number {
  return ROUND_COUNT * playerCount;
}
