import { describe, expect, it } from 'vitest';

import {
  buildGameDocument, findSumMismatches, inputsFromResult, legacyDateString,
  pointsFromResult, recomputeSum, resultFieldsFromPoints, roundKeyForField,
  validateSubmission,
} from './mongo.js';
import { ROUND_KEYS } from './rounds.js';
import { pointsByRound } from './scoring.js';
import type { HalfItGameDoc, PlayerResultDoc, RoundInputs } from './types.js';

const KNUT: RoundInputs = { '13': 2, '14': 3, D: 20, '15': 2, '16': 1, T: 20, '17': 2, '18': 3, '41': 1, '19': 1, '20': 3, B: 2 };
const MARIT: RoundInputs = { '13': 3, '14': 3, D: 20, '15': 2, '16': 3, T: 20, '17': 3, '18': 2, '41': 0, '19': 2, '20': 2, B: 1 };

const entries = [
  { playerId: 'k', playerName: 'Knut', inputs: KNUT },
  { playerId: 'm', playerName: 'Marit', inputs: MARIT },
];

/* ------------------------------------------------------------------ *
 * Document shape — the compatibility contract
 * ------------------------------------------------------------------ */

describe('buildGameDocument', () => {
  const doc = buildGameDocument({
    entries,
    timeStamp: new Date('2026-09-01T19:38:00Z'),
    id: '0f7c1a2b-4d3e-9a01-bb22-c3d4e5f60718',
  });

  it('writes exactly the three fields the old game model declares', () => {
    // HalfItGame.cs has [BsonId] Id, TimeStamp and Results — and no
    // [BsonIgnoreExtraElements], so an extra field makes the C# driver throw.
    expect(Object.keys(doc).sort()).toEqual(['Results', 'TimeStamp', '_id']);
  });

  it('writes exactly the eighteen fields the old result model declares', () => {
    // PlayerResult.cs:6-26
    expect(Object.keys(doc.Results[0]!).sort()).toEqual([
      'Date', 'IsLoser', 'IsWinner', 'PlayerId', 'PlayerName',
      'Result13', 'Result14', 'Result15', 'Result16', 'Result17', 'Result18',
      'Result19', 'Result20', 'Result41', 'ResultB', 'ResultD', 'ResultT',
      'Sum',
    ]);
  });

  it('keeps the id a plain GUID string, never an ObjectId', () => {
    expect(typeof doc._id).toBe('string');
    expect(doc._id).toBe('0f7c1a2b-4d3e-9a01-bb22-c3d4e5f60718');
  });

  it('mints a UUID when none is given', () => {
    const fresh = buildGameDocument({ entries });
    expect(fresh._id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('stores the timestamp as the UTC instant it was given', () => {
    expect(doc.TimeStamp.toISOString()).toBe('2026-09-01T19:38:00.000Z');
  });

  it('computes every Sum itself rather than trusting the caller', () => {
    // The old endpoint stored a string scraped out of a DOM element, unchecked.
    expect(doc.Results.find((r) => r.PlayerId === 'k')?.Sum).toBe(472);
    expect(doc.Results.find((r) => r.PlayerId === 'm')?.Sum).toBe(276);
  });

  it('stores computed points per round, not the raw input', () => {
    const marit = doc.Results.find((r) => r.PlayerId === 'm')!;
    expect(marit.Result13).toBe(39); // typed 3
    expect(marit.ResultD).toBe(40);  // typed 20
    expect(marit.Result41).toBe(0);  // blanked
    expect(marit.ResultB).toBe(25);  // typed 1
  });

  it('populates IsWinner and IsLoser, which the old client never did', () => {
    expect(doc.Results.find((r) => r.PlayerId === 'k')).toMatchObject({ IsWinner: true, IsLoser: false });
    expect(doc.Results.find((r) => r.PlayerId === 'm')).toMatchObject({ IsWinner: false, IsLoser: true });
  });

  it('keeps the results in the order the players were given', () => {
    expect(doc.Results.map((r) => r.PlayerId)).toEqual(['k', 'm']);
  });

  it('refuses a game with no players', () => {
    expect(() => buildGameDocument({ entries: [] })).toThrow(/at least one player/);
  });
});

/* ------------------------------------------------------------------ *
 * The legacy date string
 * ------------------------------------------------------------------ */

describe('legacyDateString', () => {
  it('is month-first, unpadded, two-digit year', () => {
    // GamePresenter.js:90-94
    expect(legacyDateString(new Date('2026-09-01T19:38:00Z'))).toBe('9.1.26');
    expect(legacyDateString(new Date('2020-10-07T18:22:31Z'))).toBe('10.7.20');
  });

  it('formats in Oslo, as the old browser would have', () => {
    // 23:30 UTC is already the next day in Oslo.
    expect(legacyDateString(new Date('2026-09-01T23:30:00Z'))).toBe('9.2.26');
    expect(legacyDateString(new Date('2026-09-01T23:30:00Z'), 'UTC')).toBe('9.1.26');
  });
});

/* ------------------------------------------------------------------ *
 * Mapping between the keyed and wide forms
 * ------------------------------------------------------------------ */

describe('field mapping', () => {
  it('round-trips points through the wide form', () => {
    const points = pointsByRound(KNUT);
    const fields = resultFieldsFromPoints(points);
    const back = pointsFromResult(fields as PlayerResultDoc);
    for (const key of ROUND_KEYS) expect(back[key]).toBe(points[key]);
  });

  it('fills unplayed rounds with zero', () => {
    const fields = resultFieldsFromPoints({ '13': 26 });
    expect(fields.Result13).toBe(26);
    expect(fields.ResultB).toBe(0);
    expect(Object.keys(fields)).toHaveLength(12);
  });

  it('recovers what the player typed by dividing the multiplier back out', () => {
    const fields = resultFieldsFromPoints(pointsByRound(MARIT)) as PlayerResultDoc;
    const recovered = inputsFromResult(fields);
    for (const key of ROUND_KEYS) expect(recovered[key]).toBe(MARIT[key]);
  });

  it('maps field names back to round keys', () => {
    expect(roundKeyForField('ResultD')).toBe('D');
    expect(roundKeyForField('Result41')).toBe('41');
    expect(roundKeyForField('ResultB')).toBe('B');
  });
});

/* ------------------------------------------------------------------ *
 * The integrity check behind the golden test
 * ------------------------------------------------------------------ */

describe('recomputeSum', () => {
  const result = (inputs: RoundInputs, Sum: number): PlayerResultDoc => ({
    PlayerId: 'p', PlayerName: 'P', Sum, IsWinner: false, IsLoser: false, Date: '9.1.26',
    ...resultFieldsFromPoints(pointsByRound(inputs)),
  });

  it('reproduces a stored total from the round fields alone', () => {
    expect(recomputeSum(result(KNUT, 472))).toBe(472);
    expect(recomputeSum(result(MARIT, 276))).toBe(276);
  });

  it('finds nothing wrong with self-consistent history', () => {
    const games: HalfItGameDoc[] = [
      { _id: 'g1', TimeStamp: new Date(), Results: [result(KNUT, 472), result(MARIT, 276)] },
    ];
    expect(findSumMismatches(games)).toEqual([]);
  });

  it('flags a total that the current rules do not reproduce', () => {
    // Exactly what a wrong multiplier or a floor-instead-of-ceil halving looks like.
    const games: HalfItGameDoc[] = [
      { _id: 'g2', TimeStamp: new Date(), Results: [result(MARIT, 275)] },
    ];
    expect(findSumMismatches(games)).toEqual([
      { gameId: 'g2', playerId: 'p', playerName: 'P', stored: 275, recomputed: 276 },
    ]);
  });

  it('survives a game with no results array', () => {
    const games = [{ _id: 'g3', TimeStamp: new Date() } as HalfItGameDoc];
    expect(findSumMismatches(games)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * Submission validation
 * ------------------------------------------------------------------ */

describe('validateSubmission', () => {
  it('accepts a finished game', () => {
    const { errors, warnings } = validateSubmission(entries);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('rejects a part-played game', () => {
    const partial = { playerId: 'k', playerName: 'Knut', inputs: { '13': 2 } };
    expect(validateSubmission([partial]).errors).toEqual([
      { playerId: 'k', message: 'All twelve rounds must be entered.' },
    ]);
  });

  it('rejects an empty game', () => {
    expect(validateSubmission([]).errors).toHaveLength(1);
  });

  it('rejects the same player twice', () => {
    const twice = [entries[0]!, entries[0]!];
    expect(validateSubmission(twice).errors.some((e) => /twice/.test(e.message))).toBe(true);
  });

  it('warns on an implausible score without rejecting the game', () => {
    const wild = [{ playerId: 'k', playerName: 'Knut', inputs: { ...KNUT, '20': 99 } }];
    const { errors, warnings } = validateSubmission(wild);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([
      { playerId: 'k', round: '20', message: expect.stringMatching(/at most 9/) },
    ]);
  });
});
