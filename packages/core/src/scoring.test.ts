import { describe, expect, it } from 'vitest';

import { ROUNDS, ROUND_KEYS, roundFor, roundIndex } from './rounds.js';
import {
  cursorFromOrdinal, halve, isComplete, missOutcome, ordinalFromCursor,
  pointsByRound, pointsFor, rankPlayers, standingsFor, totalFor, validateInput, walk,
} from './scoring.js';
import type { RoundInputs } from './types.js';

/* ------------------------------------------------------------------ *
 * The round table
 * ------------------------------------------------------------------ */

describe('the round table', () => {
  it('is the legacy array, in order', () => {
    // dartix-original/DartiX/Scripts/GamePresenter.js:6-19
    expect(ROUND_KEYS).toEqual(
      ['13', '14', 'D', '15', '16', 'T', '17', '18', '41', '19', '20', 'B'],
    );
  });

  it('names the C# result fields exactly', () => {
    // dartix-original/DartiX/Models/PlayerResult.cs:14-25 — a typo here writes
    // a field the old app cannot deserialise.
    expect(ROUNDS.map((r) => r.resultField)).toEqual([
      'Result13', 'Result14', 'ResultD', 'Result15', 'Result16', 'ResultT',
      'Result17', 'Result18', 'Result41', 'Result19', 'Result20', 'ResultB',
    ]);
  });

  it('puts the 41 ninth, where a blank does the most damage', () => {
    expect(roundIndex('41')).toBe(8);
  });
});

/* ------------------------------------------------------------------ *
 * Points per round
 * ------------------------------------------------------------------ */

describe('pointsFor', () => {
  it('multiplies count rounds by the number itself', () => {
    expect(pointsFor('13', 2)).toBe(26);
    expect(pointsFor('20', 3)).toBe(60);
    expect(pointsFor('19', 1)).toBe(19);
    expect(pointsFor('20', 9)).toBe(180); // three trebles, the ceiling
  });

  it('doubles the doubles round and trebles the trebles round', () => {
    expect(pointsFor('D', 25)).toBe(50); // D20 + D5 → typed 25
    expect(pointsFor('T', 20)).toBe(60); // T20 → typed 20
    expect(pointsFor('D', 60)).toBe(120);
    expect(pointsFor('T', 60)).toBe(180);
  });

  it('makes the 41 all or nothing', () => {
    expect(pointsFor('41', 1)).toBe(41);
    expect(pointsFor('41', 0)).toBe(0);
  });

  it('counts bull units at 25', () => {
    expect(pointsFor('B', 1)).toBe(25);
    expect(pointsFor('B', 2)).toBe(50); // a bullseye
    expect(pointsFor('B', 6)).toBe(150);
  });

  it('scores zero for a blank in every round', () => {
    for (const round of ROUNDS) expect(pointsFor(round.key, 0)).toBe(0);
  });
});

/* ------------------------------------------------------------------ *
 * The halving — the rule most likely to be got wrong
 * ------------------------------------------------------------------ */

describe('halve', () => {
  it('rounds UP, not down', () => {
    // The legacy divide() returns floor(n/2) + (n % 2).
    expect(halve(41)).toBe(21);
    expect(halve(45)).toBe(23);
    expect(halve(1)).toBe(1);
    expect(halve(113)).toBe(57);
  });

  it('is exact on even totals', () => {
    expect(halve(40)).toBe(20);
    expect(halve(346)).toBe(173);
    expect(halve(190)).toBe(95);
    expect(halve(0)).toBe(0);
  });

  it('agrees with the legacy implementation across the whole plausible range', () => {
    const legacyDivide = (numerator: number, denominator: number) => {
      const remainder = numerator % denominator;
      const quotient = (numerator - remainder) / denominator;
      return quotient + remainder;
    };
    for (let n = 0; n <= 2000; n++) expect(halve(n)).toBe(legacyDivide(n, 2));
  });
});

describe('missOutcome', () => {
  it('reports where a blank would leave you, and the damage', () => {
    expect(missOutcome(190)).toEqual({ to: 95, delta: -95 });
    expect(missOutcome(346)).toEqual({ to: 173, delta: -173 });
    expect(missOutcome(0)).toEqual({ to: 0, delta: 0 });
  });
});

/* ------------------------------------------------------------------ *
 * Walking the twelve rounds
 * ------------------------------------------------------------------ */

describe('walk', () => {
  it('starts at zero with nothing played', () => {
    const w = walk({});
    expect(w.total).toBe(0);
    expect(w.played).toBe(0);
    expect(w.complete).toBe(false);
    expect(w.cells).toHaveLength(12);
    expect(w.cells.every((c) => !c.played)).toBe(true);
  });

  it('adds points when a round scores', () => {
    expect(walk({ '13': 2 }).total).toBe(26);
    expect(walk({ '13': 2, '14': 3 }).total).toBe(68);
  });

  it('halves the running total when a round blanks', () => {
    // 13:39 → 39, 14:14 → 53, D:18 → 89, then a blank on the 15s.
    const w = walk({ '13': 3, '14': 1, D: 18, '15': 0 });
    expect(w.total).toBe(45); // ceil(89 / 2)
    const blank = w.cells.find((c) => c.key === '15');
    expect(blank).toMatchObject({ played: true, points: 0, halved: true, before: 89, after: 45, delta: -44 });
  });

  it('halves only on exactly zero, never on a small score', () => {
    const scored = walk({ '13': 3, '14': 1, D: 18, '15': 1 });
    expect(scored.total).toBe(104); // 89 + 15
    expect(scored.cells.find((c) => c.key === '15')?.halved).toBe(false);
  });

  it('stops at the first unplayed round rather than halving through blanks', () => {
    // The 41 is entered but sits behind a gap at the 16s, so it must not count.
    const w = walk({ '13': 3, '14': 1, D: 18, '15': 0, '41': 1 });
    expect(w.total).toBe(45);
    expect(w.played).toBe(4);
    const fortyOne = w.cells.find((c) => c.key === '41');
    expect(fortyOne?.played).toBe(false);
    expect(fortyOne?.input).toBe(1); // kept for display
    expect(fortyOne?.points).toBe(0); // but contributes nothing
  });

  it('re-applies every later halving when an earlier round is edited', () => {
    const before = walk({ '13': 3, '14': 1, D: 18, '15': 0, '16': 2 });
    expect(before.total).toBe(77); // 89 → halved to 45 → +32

    // Bump the 13s from 3 hits to 4. The halving now bites a bigger total.
    const after = walk({ '13': 4, '14': 1, D: 18, '15': 0, '16': 2 });
    expect(after.total).toBe(83); // 52+14+36 = 102 → halved to 51 → +32
  });

  it('cannot go negative', () => {
    const w = walk({ '13': 0, '14': 0, D: 0, '15': 0 });
    expect(w.total).toBe(0);
  });

  it('reports complete only when all twelve rounds are in', () => {
    const eleven: RoundInputs = {};
    for (const key of ROUND_KEYS.slice(0, 11)) eleven[key] = 1;
    expect(walk(eleven).complete).toBe(false);

    const twelve: RoundInputs = { ...eleven, B: 1 };
    expect(walk(twelve).complete).toBe(true);
    expect(walk(twelve).played).toBe(12);
  });
});

/* ------------------------------------------------------------------ *
 * Golden games — hand-verified against the legacy algorithm
 * ------------------------------------------------------------------ */

describe('golden games', () => {
  const knut: RoundInputs = { '13': 2, '14': 3, D: 20, '15': 2, '16': 1, T: 20, '17': 2, '18': 3, '41': 1, '19': 1, '20': 3, B: 2 };
  const oyvind: RoundInputs = { '13': 3, '14': 1, D: 18, '15': 0, '16': 2, T: 20, '17': 1, '18': 2, '41': 1, '19': 3, '20': 2, B: 1 };
  const marit: RoundInputs = { '13': 3, '14': 3, D: 20, '15': 2, '16': 3, T: 20, '17': 3, '18': 2, '41': 0, '19': 2, '20': 2, B: 1 };

  it('scores a clean sheet', () => {
    expect(totalFor(knut)).toBe(472);
    expect(walk(knut).cells.some((c) => c.halved)).toBe(false);
  });

  it('scores an early halving', () => {
    // Blanks the 15s at 89, so loses only 44.
    expect(totalFor(oyvind)).toBe(353);
    expect(walk(oyvind).cells.find((c) => c.key === '15')?.delta).toBe(-44);
  });

  it('scores a late halving, which is far more expensive', () => {
    // Blanks the 41 at 346, so loses 173 — the same mistake, four times the cost.
    expect(totalFor(marit)).toBe(276);
    expect(walk(marit).cells.find((c) => c.key === '41')?.delta).toBe(-173);
  });

  it('tracks the running total round by round', () => {
    const running = walk(knut).cells.map((c) => c.after);
    expect(running).toEqual([26, 68, 108, 138, 154, 214, 248, 302, 343, 362, 422, 472]);
  });

  it('shows the lead changing hands on the 41', () => {
    const upTo41 = (inputs: RoundInputs) => {
      const trimmed: RoundInputs = {};
      for (const key of ROUND_KEYS.slice(0, 8)) trimmed[key] = inputs[key];
      return totalFor(trimmed);
    };
    // Going into the 41 Marit leads by three points; she then blanks it.
    expect(upTo41(marit)).toBe(346);
    expect(upTo41(knut)).toBe(302);
    expect(upTo41(oyvind)).toBe(190);

    expect(standingsFor([
      { playerId: 'k', playerName: 'Knut', inputs: knut },
      { playerId: 'o', playerName: 'Øyvind', inputs: oyvind },
      { playerId: 'm', playerName: 'Marit', inputs: marit },
    ]).map((s) => [s.playerName, s.total])).toEqual([
      ['Knut', 472], ['Øyvind', 353], ['Marit', 276],
    ]);
  });

  it('derives the points that get persisted', () => {
    expect(pointsByRound(marit)).toEqual({
      '13': 39, '14': 42, D: 40, '15': 30, '16': 48, T: 60,
      '17': 51, '18': 36, '41': 0, '19': 38, '20': 40, B: 25,
    });
  });
});

/* ------------------------------------------------------------------ *
 * Completeness and validation
 * ------------------------------------------------------------------ */

describe('isComplete', () => {
  const full: RoundInputs = {};
  for (const key of ROUND_KEYS) full[key] = 1;

  it('accepts a full board, zeros included', () => {
    expect(isComplete(full)).toBe(true);
    expect(isComplete({ ...full, '41': 0 })).toBe(true);
  });

  it('rejects a missing round', () => {
    const gap = { ...full };
    delete gap['17'];
    expect(isComplete(gap)).toBe(false);
  });

  it('rejects rubbish', () => {
    expect(isComplete({ ...full, '17': 1.5 })).toBe(false);
    expect(isComplete({ ...full, '17': -1 })).toBe(false);
    expect(isComplete({ ...full, '17': Number.NaN })).toBe(false);
  });
});

describe('validateInput', () => {
  it('passes anything three darts can actually do', () => {
    expect(validateInput('20', 9)).toBeNull();
    expect(validateInput('20', 0)).toBeNull();
    expect(validateInput('D', 60)).toBeNull();
    expect(validateInput('T', 60)).toBeNull();
    expect(validateInput('41', 1)).toBeNull();
    expect(validateInput('B', 6)).toBeNull();
  });

  it('warns past the plausible maximum', () => {
    // The legacy app enforced nothing: 99 in the 20s round scored 1980.
    expect(validateInput('20', 10)).toMatch(/at most 9/);
    expect(validateInput('20', 99)).not.toBeNull();
    expect(validateInput('D', 61)).not.toBeNull();
    expect(validateInput('41', 2)).toMatch(/1 or 0/);
    expect(validateInput('B', 7)).toMatch(/bull units/);
  });

  it('rejects non-integers and negatives', () => {
    expect(validateInput('13', 2.5)).toMatch(/Whole numbers/);
    expect(validateInput('13', -1)).toMatch(/negative/);
  });

  it('warns rather than throws, so an odd value can still be saved', () => {
    expect(() => validateInput('20', 99)).not.toThrow();
  });
});

/* ------------------------------------------------------------------ *
 * Standings, including the ties the old app fumbled
 * ------------------------------------------------------------------ */

describe('rankPlayers', () => {
  const p = (id: string, name: string, total: number) => ({ playerId: id, playerName: name, total });

  it('orders by total, highest first', () => {
    const s = rankPlayers([p('a', 'Ann', 300), p('b', 'Bo', 450), p('c', 'Cal', 380)]);
    expect(s.map((x) => x.playerName)).toEqual(['Bo', 'Cal', 'Ann']);
    expect(s.map((x) => x.position)).toEqual([1, 2, 3]);
  });

  it('shares a position on a tie, and skips the one after', () => {
    const s = rankPlayers([p('a', 'Ann', 400), p('b', 'Bo', 300), p('c', 'Cal', 300), p('d', 'Dee', 200)]);
    expect(s.map((x) => x.position)).toEqual([1, 2, 2, 4]);
    expect(s.filter((x) => x.tied).map((x) => x.playerName)).toEqual(['Bo', 'Cal']);
  });

  it('calls both players winners when the top is tied', () => {
    // The old app picked whoever happened to sit first in the array.
    const s = rankPlayers([p('a', 'Ann', 400), p('b', 'Bo', 400)]);
    expect(s.filter((x) => x.isWinner)).toHaveLength(2);
    expect(s.every((x) => !x.isLoser)).toBe(true);
  });

  it('gives a solo game a winner and no loser', () => {
    // The old app counted a solo player as both, so the leaderboard recorded
    // a win and a loss for the same game.
    const s = rankPlayers([p('a', 'Ann', 300)]);
    expect(s[0]?.isWinner).toBe(true);
    expect(s[0]?.isLoser).toBe(false);
  });

  it('marks the bottom as loser only when someone is actually ahead', () => {
    const s = rankPlayers([p('a', 'Ann', 400), p('b', 'Bo', 200)]);
    expect(s.find((x) => x.playerName === 'Bo')?.isLoser).toBe(true);

    const allSquare = rankPlayers([p('a', 'Ann', 300), p('b', 'Bo', 300), p('c', 'Cal', 300)]);
    expect(allSquare.every((x) => !x.isLoser)).toBe(true);
  });

  it('returns nothing for no players', () => {
    expect(rankPlayers([])).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * Turn order
 * ------------------------------------------------------------------ */

describe('turn order', () => {
  it('is row-major: everyone throws at 13, then everyone at 14', () => {
    // Matches moveNextFocus (GameView.js:109-120).
    expect(cursorFromOrdinal(0, 3)).toEqual({ roundIndex: 0, playerIndex: 0 });
    expect(cursorFromOrdinal(2, 3)).toEqual({ roundIndex: 0, playerIndex: 2 });
    expect(cursorFromOrdinal(3, 3)).toEqual({ roundIndex: 1, playerIndex: 0 });
  });

  it('lands the ninth round on the 41', () => {
    const cursor = cursorFromOrdinal(25, 3);
    expect(cursor).toEqual({ roundIndex: 8, playerIndex: 1 });
    expect(roundFor(ROUND_KEYS[cursor.roundIndex]!).key).toBe('41');
  });

  it('round-trips', () => {
    for (let ordinal = 0; ordinal < 36; ordinal++) {
      expect(ordinalFromCursor(cursorFromOrdinal(ordinal, 3), 3)).toBe(ordinal);
    }
  });
});
