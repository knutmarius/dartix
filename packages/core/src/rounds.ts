import type { Round, RoundKey } from './types.js';

/**
 * The twelve rounds of Half-it, in the order they are always played.
 *
 * Lifted verbatim from the only place the legacy app defined them —
 * `dartix-original/DartiX/Scripts/GamePresenter.js:6-19`:
 *
 *   var rounds = ["13","14","D","15","16","T","17","18","41","19","20","B"];
 *
 * The order is not configurable and never has been. Changing it would
 * invalidate every stored game, because the half-it rule depends on the
 * sequence.
 */
export const ROUNDS: readonly Round[] = Object.freeze([
  { key: '13', label: '13', name: 'Thirteens',  kind: 'count',  multiplier: 13, maxInput: 9,  resultField: 'Result13' },
  { key: '14', label: '14', name: 'Fourteens',  kind: 'count',  multiplier: 14, maxInput: 9,  resultField: 'Result14' },
  { key: 'D',  label: 'D',  name: 'Doubles',    kind: 'sum',    multiplier: 2,  maxInput: 60, resultField: 'ResultD'  },
  { key: '15', label: '15', name: 'Fifteens',   kind: 'count',  multiplier: 15, maxInput: 9,  resultField: 'Result15' },
  { key: '16', label: '16', name: 'Sixteens',   kind: 'count',  multiplier: 16, maxInput: 9,  resultField: 'Result16' },
  { key: 'T',  label: 'T',  name: 'Trebles',    kind: 'sum',    multiplier: 3,  maxInput: 60, resultField: 'ResultT'  },
  { key: '17', label: '17', name: 'Seventeens', kind: 'count',  multiplier: 17, maxInput: 9,  resultField: 'Result17' },
  { key: '18', label: '18', name: 'Eighteens',  kind: 'count',  multiplier: 18, maxInput: 9,  resultField: 'Result18' },
  { key: '41', label: '41', name: 'The 41',     kind: 'binary', multiplier: 41, maxInput: 1,  resultField: 'Result41' },
  { key: '19', label: '19', name: 'Nineteens',  kind: 'count',  multiplier: 19, maxInput: 9,  resultField: 'Result19' },
  { key: '20', label: '20', name: 'Twenties',   kind: 'count',  multiplier: 20, maxInput: 9,  resultField: 'Result20' },
  { key: 'B',  label: 'B',  name: 'Bull',       kind: 'bull',   multiplier: 25, maxInput: 6,  resultField: 'ResultB'  },
] satisfies Round[]);

/**
 * Darts in a turn. Three, always.
 *
 * Every `maxInput` above is derived from it — 9 for a number round is three
 * trebles, 60 for the doubles is three 20s, 6 for the bull is three
 * bullseyes — but the count itself matters separately on the two rounds that
 * take a sum, where the entry is built one dart at a time and nothing else
 * would stop a fourth.
 */
export const DARTS_PER_TURN = 3;

/** The round keys in playing order. */
export const ROUND_KEYS: readonly RoundKey[] = Object.freeze(ROUNDS.map((r) => r.key));

export const ROUND_COUNT = ROUNDS.length;

const BY_KEY: ReadonlyMap<RoundKey, Round> = new Map(ROUNDS.map((r) => [r.key, r]));

/** Throws on an unknown key, which can only be a programming error. */
export function roundFor(key: RoundKey): Round {
  const round = BY_KEY.get(key);
  if (!round) throw new Error(`Unknown round key: ${String(key)}`);
  return round;
}

export function isRoundKey(value: unknown): value is RoundKey {
  return typeof value === 'string' && BY_KEY.has(value as RoundKey);
}

/** Where a round sits in the sequence, which is what the half-it rule walks. */
export function roundIndex(key: RoundKey): number {
  return ROUND_KEYS.indexOf(key);
}
