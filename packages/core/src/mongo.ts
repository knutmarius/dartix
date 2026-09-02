/**
 * The database boundary.
 *
 * Everything above this file talks in keyed rounds. Everything below it talks
 * in the twelve `Result*` fields the 2011 ASP.NET app persists. Translation
 * happens here and nowhere else.
 *
 * Compatibility rule: the old C# models carry no `[BsonIgnoreExtraElements]`,
 * and the MongoDB C# driver throws on unknown document elements by default.
 * While the old app is still running, documents written here must contain
 * *exactly* the fields it expects — no more. New data goes in a new collection.
 */

import { ROUNDS, roundFor } from './rounds.js';
import { isComplete, pointsByRound, rankPlayers, totalFor, validateInput } from './scoring.js';
import type {
  GameEntry, HalfItGameDoc, PlayerDoc, PlayerResultDoc, ResultField,
  RoundInputs, RoundKey, RoundPoints,
} from './types.js';

/** Points per round, read out of a stored result. */
export function pointsFromResult(result: PlayerResultDoc): RoundPoints {
  const out: RoundPoints = {};
  for (const round of ROUNDS) out[round.key] = result[round.resultField] ?? 0;
  return out;
}

/**
 * Recover what the player typed from a stored result.
 *
 * The database holds computed points, so this divides back out by the round's
 * multiplier. Exact for every round, since points are always a whole multiple.
 * Used to replay historical games through the current rules engine.
 */
export function inputsFromResult(result: PlayerResultDoc): RoundInputs {
  const out: RoundInputs = {};
  for (const round of ROUNDS) {
    out[round.key] = (result[round.resultField] ?? 0) / round.multiplier;
  }
  return out;
}

/** The twelve wide fields, from keyed points. Missing rounds become 0. */
export function resultFieldsFromPoints(points: RoundPoints): Record<ResultField, number> {
  const fields = {} as Record<ResultField, number>;
  for (const round of ROUNDS) fields[round.resultField] = points[round.key] ?? 0;
  return fields;
}

/**
 * The `M.D.YY` string the old client wrote into every result.
 *
 * From `GamePresenter.js:90-94` — month-first, unpadded, two-digit year, built
 * from the *browser's* local date. Formatted in Europe/Oslo here so it matches
 * what the old app would have produced. Written for backward compatibility and
 * never read: the reliable timestamp is the game's `TimeStamp`.
 */
export function legacyDateString(when: Date, timeZone = 'Europe/Oslo'): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: '2-digit', month: 'numeric', day: 'numeric',
  }).formatToParts(when);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('month')}.${get('day')}.${get('year')}`;
}

/**
 * A new player document.
 *
 * `Gender` is written as null rather than omitted so the document keeps the
 * exact three-field shape the old `Player` model declares. The old app stored
 * "Male" / "Female" here and never read it back for anything — no stat, no
 * filter, no display — so the new player flow does not ask.
 */
export function buildPlayerDocument(name: string, id?: string): PlayerDoc {
  return { _id: id ?? newId(), Name: name, Gender: null };
}

export interface BuildGameOptions {
  entries: readonly GameEntry[];
  /** Defaults to now. Stored as UTC. */
  timeStamp?: Date;
  /** Defaults to a fresh UUID. The old client generated these itself, weakly. */
  id?: string;
  timeZone?: string;
}

/**
 * A real RFC 4122 UUID, from whichever runtime we are in.
 *
 * Reached through `globalThis` rather than the `crypto` global so this package
 * needs neither `@types/node` nor the DOM lib — it has to typecheck for both
 * the API and the browser. Present in Node 19+ and every current browser on a
 * secure origin; when it is missing we throw rather than fall back, because the
 * old app's hand-rolled `GuidGenerator.js` produced weak, non-RFC ids and
 * collisions there mean a 500 on insert.
 */
function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  throw new Error('crypto.randomUUID is unavailable here — pass `id` explicitly.');
}

/**
 * Assemble a game document from raw inputs.
 *
 * Every `Sum` is recomputed here rather than trusted from the client. The old
 * endpoint deserialised whatever the browser posted and inserted it unchecked
 * (`HalfItController.cs:21-27`), and the browser's `Sum` was a string scraped
 * out of a DOM element, so a client could store any total it liked.
 *
 * `IsWinner` / `IsLoser` are populated, which the old client never did — every
 * historical document has them `false`. They are existing fields, so filling
 * them in stays compatible with the old reader.
 */
export function buildGameDocument(options: BuildGameOptions): HalfItGameDoc {
  const { entries, timeStamp = new Date(), id = newId(), timeZone } = options;

  if (entries.length === 0) throw new Error('A game needs at least one player.');

  const standings = rankPlayers(
    entries.map((e) => ({ playerId: e.playerId, playerName: e.playerName, total: totalFor(e.inputs) })),
  );
  const byId = new Map(standings.map((s) => [s.playerId, s]));
  const dateString = legacyDateString(timeStamp, timeZone);

  const Results: PlayerResultDoc[] = entries.map((entry) => {
    const standing = byId.get(entry.playerId);
    if (!standing) throw new Error(`No standing computed for player ${entry.playerId}`);
    return {
      PlayerId: entry.playerId,
      PlayerName: entry.playerName,
      Sum: standing.total,
      IsWinner: standing.isWinner,
      IsLoser: standing.isLoser,
      Date: dateString,
      ...resultFieldsFromPoints(pointsByRound(entry.inputs)),
    };
  });

  return { _id: id, TimeStamp: timeStamp, Results };
}

export interface SubmissionProblem {
  playerId: string;
  round?: RoundKey;
  message: string;
}

/**
 * Check a submitted game before it is written.
 *
 * Incompleteness is an error — the game cannot be saved part-played, which is
 * what the old app's save-time alert enforced. Implausible values are *not*
 * errors; they come back as warnings so the caller can store the game and still
 * flag it.
 */
export function validateSubmission(entries: readonly GameEntry[]): {
  errors: SubmissionProblem[];
  warnings: SubmissionProblem[];
} {
  const errors: SubmissionProblem[] = [];
  const warnings: SubmissionProblem[] = [];

  if (entries.length === 0) {
    errors.push({ playerId: '', message: 'A game needs at least one player.' });
    return { errors, warnings };
  }

  const seen = new Set<string>();
  for (const entry of entries) {
    if (!entry.playerId) {
      errors.push({ playerId: '', message: 'Every result needs a player id.' });
      continue;
    }
    if (seen.has(entry.playerId)) {
      errors.push({ playerId: entry.playerId, message: 'The same player appears twice.' });
    }
    seen.add(entry.playerId);

    if (!isComplete(entry.inputs)) {
      errors.push({ playerId: entry.playerId, message: 'All twelve rounds must be entered.' });
    }

    for (const round of ROUNDS) {
      const value = entry.inputs[round.key];
      if (value === undefined) continue;
      const complaint = validateInput(round.key, value);
      if (complaint) warnings.push({ playerId: entry.playerId, round: round.key, message: complaint });
    }
  }

  return { errors, warnings };
}

/**
 * Recompute a stored result's `Sum` from its round fields.
 *
 * The integrity check behind the golden test: replay real history through the
 * current rules and confirm the total we derive is the total that was stored.
 * A mismatch means a multiplier or the halving is wrong.
 */
export function recomputeSum(result: PlayerResultDoc): number {
  return totalFor(inputsFromResult(result));
}

export interface SumMismatch {
  gameId: string;
  playerId: string;
  playerName: string;
  stored: number;
  recomputed: number;
}

/** Every stored total that the current rules do not reproduce. */
export function findSumMismatches(games: readonly HalfItGameDoc[]): SumMismatch[] {
  const out: SumMismatch[] = [];
  for (const game of games) {
    for (const result of game.Results ?? []) {
      const recomputed = recomputeSum(result);
      if (recomputed !== result.Sum) {
        out.push({
          gameId: game._id,
          playerId: result.PlayerId,
          playerName: result.PlayerName,
          stored: result.Sum,
          recomputed,
        });
      }
    }
  }
  return out;
}

/** Round key for a wide field name, for the rare reverse lookup. */
export function roundKeyForField(field: ResultField): RoundKey {
  const round = ROUNDS.find((r) => r.resultField === field);
  if (!round) throw new Error(`Unknown result field: ${field}`);
  return round.key;
}

export { roundFor };
