/**
 * Types for Half-it.
 *
 * Two vocabularies live here and they must not be confused:
 *
 *   - The *keyed* form (`RoundInputs`, `RoundPoints`) is what the app works in.
 *   - The *wide* form (`PlayerResultDoc` with its twelve `Result*` fields) is
 *     the shape the 2011 ASP.NET app persists, and the only shape MongoDB ever
 *     sees. Translate at the database boundary and nowhere else — see `mongo.ts`.
 */

/** The twelve rounds, keyed. `D` doubles, `T` trebles, `B` bull. */
export type RoundKey =
  | '13' | '14' | 'D' | '15' | '16' | 'T'
  | '17' | '18' | '41' | '19' | '20' | 'B';

/**
 * How a round reads the number a player types, which decides both the pad the
 * UI shows and the plausible maximum.
 *
 *   - `count`  the number of segments hit; a treble counts three, a double two
 *   - `sum`    the sum of the face values hit as doubles (`D`) or trebles (`T`)
 *   - `binary` made it or didn't (the 41)
 *   - `bull`   the number of 25-point bull units; a bullseye counts two
 */
export type RoundKind = 'count' | 'sum' | 'binary' | 'bull';

export interface Round {
  readonly key: RoundKey;
  /** What goes on the scoreboard column header. */
  readonly label: string;
  /** What goes in prose and on the turn card. */
  readonly name: string;
  readonly kind: RoundKind;
  /** Points scored per unit of input. */
  readonly multiplier: number;
  /** Highest input three darts can plausibly produce. Not enforced — warned on. */
  readonly maxInput: number;
  /** The matching field name in the Mongo `PlayerResult` subdocument. */
  readonly resultField: ResultField;
}

export type ResultField =
  | 'Result13' | 'Result14' | 'ResultD' | 'Result15' | 'Result16' | 'ResultT'
  | 'Result17' | 'Result18' | 'Result41' | 'Result19' | 'Result20' | 'ResultB';

/** What a player typed, per round. Absent means the round has not been played. */
export type RoundInputs = Partial<Record<RoundKey, number>>;

/** Points scored, per round. This is what gets persisted, not the raw input. */
export type RoundPoints = Partial<Record<RoundKey, number>>;

/** One round's contribution to a player's total, as the scoreboard shows it. */
export interface RoundCell {
  readonly key: RoundKey;
  readonly played: boolean;
  /** The raw number typed. Undefined when the round has not been played. */
  readonly input?: number;
  /** Points for this round: `input × multiplier`. */
  readonly points: number;
  /** The running total going into this round. */
  readonly before: number;
  /** The running total coming out of it. */
  readonly after: number;
  /** True when the round scored nothing and therefore halved the total. */
  readonly halved: boolean;
  /** `after - before`. Negative exactly when `halved`. */
  readonly delta: number;
}

export interface Walk {
  readonly cells: readonly RoundCell[];
  /** The total after the last *played* round. */
  readonly total: number;
  /** How many of the twelve rounds have been played. */
  readonly played: number;
  readonly complete: boolean;
}

/* ------------------------------------------------------------------ *
 * Mongo document shapes.
 *
 * These mirror the C# models in dartix-original exactly. The old models
 * carry no [BsonIgnoreExtraElements], and the MongoDB C# driver throws on
 * unknown elements by default, so DO NOT add fields to these while the old
 * app is still running — put new data in a new collection instead.
 * ------------------------------------------------------------------ */

/** Collection `Player`. `_id` is a GUID *string*, never an ObjectId. */
export interface PlayerDoc {
  _id: string;
  Name: string;
  /** Stored by the old app and never read by anything. Kept for compatibility. */
  Gender?: string | null;
}

/** A subdocument of `HalfItGame.Results`. Holds computed points, not raw input. */
export interface PlayerResultDoc extends Record<ResultField, number> {
  PlayerId: string;
  /** Denormalised at save time, so renaming a player does not rewrite history. */
  PlayerName: string;
  Sum: number;
  IsWinner: boolean;
  IsLoser: boolean;
  /**
   * A `M.D.YY` string the 2011 browser formatted locally — US order, ambiguous
   * and unsortable. Keep writing it for backward compatibility; never read it.
   * The reliable timestamp is the parent game's `TimeStamp`.
   */
  Date: string;
}

/** Collection `HalfItGame`. `TimeStamp` is UTC. */
export interface HalfItGameDoc {
  _id: string;
  TimeStamp: Date;
  Results: PlayerResultDoc[];
}

/** A finished game as the app talks about it, before it becomes a document. */
export interface GameEntry {
  playerId: string;
  playerName: string;
  inputs: RoundInputs;
}

/** One player's standing, with ties sharing a position. */
export interface Standing {
  playerId: string;
  playerName: string;
  total: number;
  /** Competition ranking: a tie for 2nd gives 1, 2, 2, 4. */
  position: number;
  isWinner: boolean;
  isLoser: boolean;
  /** True when at least one other player shares this total. */
  tied: boolean;
}
