import { describe, expect, it } from 'vitest';

import { buildGameDocument } from './mongo.js';
import {
  flatten, gameHistory, headToHead, leaderboard, playerProfile, records, roundMatrix,
} from './stats.js';
import type { HalfItGameDoc, RoundInputs } from './types.js';

/* ------------------------------------------------------------------ *
 * A fixture small enough to verify by hand.
 *
 * Four input sets, each with a known total and a known number of blanks:
 * ------------------------------------------------------------------ */

/** No blanks at all. 472. */
const CLEAN: RoundInputs = { '13': 2, '14': 3, D: 20, '15': 2, '16': 1, T: 20, '17': 2, '18': 3, '41': 1, '19': 1, '20': 3, B: 2 };
/** Blanks the 15s at 89, so loses only 44. 353. */
const EARLY_BLANK: RoundInputs = { '13': 3, '14': 1, D: 18, '15': 0, '16': 2, T: 20, '17': 1, '18': 2, '41': 1, '19': 3, '20': 2, B: 1 };
/** Blanks the 41 at 346, losing 173. 276. */
const LATE_BLANK: RoundInputs = { '13': 3, '14': 3, D: 20, '15': 2, '16': 3, T: 20, '17': 3, '18': 2, '41': 0, '19': 2, '20': 2, B: 1 };
/** Clean until the bull, then blanks it at 422 — the worst possible timing. 211. */
const NO_BULL: RoundInputs = { ...CLEAN, B: 0 };

const KNUT = { id: 'k', name: 'Knut' };
const OYVIND = { id: 'o', name: 'Øyvind' };
const MARIT = { id: 'm', name: 'Marit' };

function game(
  id: string,
  iso: string,
  entries: readonly [{ id: string; name: string }, RoundInputs][],
): HalfItGameDoc {
  return buildGameDocument({
    id,
    timeStamp: new Date(iso),
    entries: entries.map(([p, inputs]) => ({ playerId: p.id, playerName: p.name, inputs })),
  });
}

const GAMES: HalfItGameDoc[] = [
  game('g1', '2026-01-10T19:00:00Z', [[KNUT, CLEAN], [OYVIND, EARLY_BLANK], [MARIT, LATE_BLANK]]),
  game('g2', '2026-02-10T19:00:00Z', [[KNUT, EARLY_BLANK], [OYVIND, LATE_BLANK], [MARIT, CLEAN]]),
  game('g3', '2026-03-10T19:00:00Z', [[KNUT, CLEAN], [MARIT, CLEAN]]),
  game('g4', '2026-04-10T19:00:00Z', [[KNUT, NO_BULL], [MARIT, EARLY_BLANK]]),
];

it('the fixture totals are what the rules say they are', () => {
  expect(GAMES[0]!.Results.map((r) => r.Sum)).toEqual([472, 353, 276]);
  expect(GAMES[3]!.Results.map((r) => r.Sum)).toEqual([211, 353]);
});

/* ------------------------------------------------------------------ *
 * flatten
 * ------------------------------------------------------------------ */

describe('flatten', () => {
  const views = flatten(GAMES);

  it('produces one row per player per game, oldest first', () => {
    expect(views).toHaveLength(10);
    expect(views.map((v) => v.gameId)).toEqual(
      ['g1', 'g1', 'g1', 'g2', 'g2', 'g2', 'g3', 'g3', 'g4', 'g4'],
    );
  });

  it('records which rounds blanked', () => {
    const late = views.find((v) => v.gameId === 'g1' && v.playerId === 'm')!;
    expect(late.blanks).toEqual(['41']);
    const clean = views.find((v) => v.gameId === 'g1' && v.playerId === 'k')!;
    expect(clean.blanks).toEqual([]);
  });

  it('derives winner and loser rather than trusting the stored flags', () => {
    // Historical documents have IsWinner/IsLoser false on every result,
    // because the 2011 client never set them.
    const g1 = views.filter((v) => v.gameId === 'g1');
    expect(g1.find((v) => v.isWinner)?.playerId).toBe('k');
    expect(g1.find((v) => v.isLoser)?.playerId).toBe('m');
  });

  it('gives both players a win on a tie, and neither a loss', () => {
    const g3 = views.filter((v) => v.gameId === 'g3');
    expect(g3.every((v) => v.isWinner)).toBe(true);
    expect(g3.every((v) => !v.isLoser)).toBe(true);
    expect(g3.every((v) => v.position === 1)).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * leaderboard
 * ------------------------------------------------------------------ */

describe('leaderboard', () => {
  const rows = leaderboard(GAMES);
  const row = (id: string) => rows.find((r) => r.playerId === id)!;

  it('averages without truncating', () => {
    // The old app cast the mean to (int), so 314.5 reported as 314.
    expect(row('o').average).toBe(314.5);
    expect(row('m').average).toBe(393.3); // 1573 / 4
    expect(row('k').average).toBe(377);   // 1508 / 4
  });

  it('orders by average, best first', () => {
    expect(rows.map((r) => r.playerId)).toEqual(['m', 'k', 'o']);
  });

  it('counts games, highs and lows', () => {
    expect(row('k')).toMatchObject({ games: 4, high: 472, low: 211 });
    expect(row('o')).toMatchObject({ games: 2, high: 353, low: 276 });
  });

  it('counts wins and losses, ties included', () => {
    expect(row('m')).toMatchObject({ wins: 3, losses: 1, winRate: 75 });
    expect(row('k')).toMatchObject({ wins: 2, losses: 1, winRate: 50 });
    expect(row('o')).toMatchObject({ wins: 0, losses: 1, winRate: 0 });
  });

  it('counts halvings per game', () => {
    expect(row('k').halvingsPerGame).toBe(0.5); // 2 blanks over 4 games
    expect(row('o').halvingsPerGame).toBe(1);   // 2 blanks over 2 games
  });

  it('reports the bull hit rate', () => {
    expect(row('k').bullHitRate).toBe(75);  // blanked it once, in g4
    expect(row('m').bullHitRate).toBe(100);
  });

  it('records when each player last played', () => {
    expect(row('k').lastPlayed.toISOString()).toBe('2026-04-10T19:00:00.000Z');
    expect(row('o').lastPlayed.toISOString()).toBe('2026-02-10T19:00:00.000Z');
  });

  it('hides players below the minimum game count', () => {
    // The real database has 17 players with fewer than five games; one lucky
    // night would otherwise top the table.
    expect(leaderboard(GAMES, { minGames: 3 }).map((r) => r.playerId)).toEqual(['m', 'k']);
    expect(leaderboard(GAMES, { minGames: 99 })).toEqual([]);
  });

  it('copes with no games at all', () => {
    expect(leaderboard([])).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * playerProfile
 * ------------------------------------------------------------------ */

describe('playerProfile', () => {
  const knut = playerProfile(GAMES, 'k')!;

  it('returns null for someone who has never played', () => {
    expect(playerProfile(GAMES, 'nobody')).toBeNull();
  });

  it('lists every game oldest first', () => {
    expect(knut.history.map((h) => h.total)).toEqual([472, 353, 472, 211]);
    expect(knut.history.map((h) => h.won)).toEqual([true, false, true, false]);
  });

  it('reports field size, so a two-player win reads differently from a five', () => {
    expect(knut.history.map((h) => h.fieldSize)).toEqual([3, 3, 2, 2]);
  });

  it('computes a trailing rolling average', () => {
    // Trailing means, window 5: 472, (472+353)/2, (472+353+472)/3, .../4
    expect(knut.rollingAverage).toEqual([472, 413, 432, 377]);
  });

  it('honours a different rolling window', () => {
    expect(playerProfile(GAMES, 'k', { rollingWindow: 2 })!.rollingAverage)
      .toEqual([472, 413, 413, 342]);
  });

  const roundOf = (key: string) => knut.rounds.find((r) => r.key === key)!;

  it('reports per-round figures in playing order, not key order', () => {
    // A keyed object would serialise as 13, 14, 15 ... 20, 41, D, T, B,
    // because JavaScript sorts integer-like keys ahead of string ones.
    expect(knut.rounds.map((r) => r.key)).toEqual(
      ['13', '14', 'D', '15', '16', 'T', '17', '18', '41', '19', '20', 'B'],
    );
  });

  it('averages points per round', () => {
    // Knut played CLEAN, EARLY_BLANK, CLEAN, NO_BULL.
    expect(roundOf('13').average).toBe(29.3); // 26, 39, 26, 26 -> 29.25
    expect(roundOf('B').average).toBe(31.3);  // 50, 25, 50, 0  -> 31.25
  });

  it('reports where a player bleeds, as a share of games', () => {
    expect(roundOf('B').blankRate).toBe(25);   // blanked once in four
    expect(roundOf('15').blankRate).toBe(25);  // the EARLY_BLANK game
    expect(roundOf('20').blankRate).toBe(0);
  });

  it('tracks win streaks', () => {
    const marit = playerProfile(GAMES, 'm')!;
    expect(marit.bestStreak).toBe(3);    // g2, g3, g4
    expect(marit.currentStreak).toBe(3);
    expect(knut.bestStreak).toBe(1);
    expect(knut.currentStreak).toBe(0);  // lost the most recent
  });
});

/* ------------------------------------------------------------------ *
 * roundMatrix
 * ------------------------------------------------------------------ */

describe('roundMatrix', () => {
  const matrix = roundMatrix(GAMES);

  it('has a row per player and twelve cells each', () => {
    expect(matrix.rows).toHaveLength(3);
    expect(matrix.rounds).toHaveLength(12);
    expect(matrix.rows.every((r) => r.cells.length === 12)).toBe(true);
  });

  it('shades by position within the round, not by raw points', () => {
    // Share is normalised per column, so the strongest in each round reaches 1
    // and the weakest 0 — a bright cell means best in the room at that target,
    // rather than simply a round that happens to be worth more points.
    const spread = matrix.rounds.filter((key) => {
      const averages = matrix.rows.map((r) => r.cells.find((c) => c.key === key)!.average);
      return Math.max(...averages) !== Math.min(...averages);
    });
    expect(spread.length).toBeGreaterThan(0);

    for (const key of spread) {
      const shares = matrix.rows.map((r) => r.cells.find((c) => c.key === key)!.share);
      expect(Math.max(...shares)).toBeCloseTo(1);
      expect(Math.min(...shares)).toBeCloseTo(0);
      expect(shares.every((s) => s >= 0 && s <= 1)).toBe(true);
    }
  });

  it('shades a round neutral when nobody is better at it than anybody else', () => {
    // Every fixture set hits T20, so the trebles column has no spread at all.
    // A mid-tone is the honest answer: there is nothing to see in that column.
    const trebles = matrix.rows.map((r) => r.cells.find((c) => c.key === 'T')!);
    expect(trebles.map((c) => c.average)).toEqual([60, 60, 60]);
    expect(trebles.every((c) => c.share === 0.5)).toBe(true);
  });

  it('puts a single player mid-scale rather than dividing by zero', () => {
    const solo = roundMatrix([GAMES[2]!].map((g) => ({ ...g, Results: [g.Results[0]!] })));
    expect(solo.rows).toHaveLength(1);
    expect(solo.rows[0]!.cells.every((c) => c.share === 0.5)).toBe(true);
  });

  it('respects the minimum game count', () => {
    expect(roundMatrix(GAMES, { minGames: 3 }).rows.map((r) => r.playerId)).toEqual(['k', 'm']);
  });
});

/* ------------------------------------------------------------------ *
 * headToHead
 * ------------------------------------------------------------------ */

describe('headToHead', () => {
  const h2h = headToHead(GAMES, 'k', 'm')!;

  it('counts only the games both players were in', () => {
    expect(h2h.games).toBe(4);
    expect(headToHead(GAMES, 'k', 'o')!.games).toBe(2);
  });

  it('returns null when they have never met', () => {
    expect(headToHead(GAMES, 'k', 'nobody')).toBeNull();
  });

  it('scores the record between them, drawn games separated out', () => {
    expect(h2h.a).toMatchObject({ playerName: 'Knut', wins: 1 });
    expect(h2h.b).toMatchObject({ playerName: 'Marit', wins: 2 });
    expect(h2h.draws).toBe(1); // g3, both on 472
    expect(h2h.a.wins + h2h.b.wins + h2h.draws).toBe(h2h.games);
  });

  it('averages only over the shared games', () => {
    expect(h2h.a.average).toBe(377);   // 472, 353, 472, 211
    expect(h2h.b.average).toBe(393.3); // 276, 472, 472, 353
  });

  it('breaks down who takes each round', () => {
    const bull = h2h.rounds.find((r) => r.key === 'B')!;
    // Bulls: Knut 50, 25, 50, 0 vs Marit 25, 50, 50, 25.
    // Knut ahead in g1; Marit ahead in g2 and g4; level in g3.
    expect(bull).toMatchObject({ aShare: 25, bShare: 50, level: 1 });
  });

  it('accounts for every shared game in each round', () => {
    for (const round of h2h.rounds) {
      const ahead = Math.round(((round.aShare + round.bShare) / 100) * h2h.games);
      expect(ahead + round.level).toBe(h2h.games);
    }
  });
});

/* ------------------------------------------------------------------ *
 * records
 * ------------------------------------------------------------------ */

describe('records', () => {
  const r = records(GAMES);

  it('lists the top games, highest first', () => {
    expect(r.topGames[0]!.total).toBe(472);
    expect(r.topGames.map((g) => g.total)).toEqual(
      [...r.topGames.map((g) => g.total)].sort((a, b) => b - a),
    );
  });

  it('honours the top-N limit', () => {
    expect(records(GAMES, { top: 3 }).topGames).toHaveLength(3);
  });

  const bestRound = (key: string) => r.bestRounds.find((b) => b.key === key)!;

  it('finds the best single-round score for every round', () => {
    expect(r.bestRounds).toHaveLength(12);
    expect(bestRound('T').points).toBe(60);
    expect(bestRound('B').points).toBe(50);
  });

  it('names every player sharing a record, not just one of them', () => {
    // Every fixture set hits T20, so all three hold the trebles record on 60.
    expect(bestRound('T').holders.map((h) => h.playerName).sort())
      .toEqual(['Knut', 'Marit', 'Øyvind']);

    // Only CLEAN throws a bullseye, and Knut and Marit both played it.
    // Øyvind never did, so he is not on this one.
    expect(bestRound('B').points).toBe(50);
    expect(bestRound('B').holders.map((h) => h.playerName).sort()).toEqual(['Knut', 'Marit']);
  });

  it('lists a holder once, dated to the first time they did it', () => {
    // The 13s record is 39. Marit scored it in g1 and again in g4, so she must
    // appear once, dated to g1 rather than twice.
    const thirteens = bestRound('13');
    expect(thirteens.points).toBe(39);

    const names = thirteens.holders.map((h) => h.playerName);
    expect(names).toHaveLength(new Set(names).size);

    const marit = thirteens.holders.find((h) => h.playerName === 'Marit')!;
    expect(marit.when.toISOString()).toBe('2026-01-10T19:00:00.000Z');
  });

  it('orders holders by who got there first', () => {
    // Marit and Øyvind set the 13s record in g1; Knut matched it in g2.
    const holders = bestRound('13').holders;
    const times = holders.map((h) => h.when.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(holders.map((h) => h.playerName)).toEqual(['Marit', 'Øyvind', 'Knut']);
  });

  it('dates the record to when it was first set', () => {
    expect(bestRound('T').when.toISOString()).toBe('2026-01-10T19:00:00.000Z');
  });

  it('flags the 41 as shared by definition, never ranked', () => {
    // It is worth exactly 41 or nothing, so everyone who has made it ties.
    const fortyOne = bestRound('41');
    expect(fortyOne.shared).toBe(true);
    expect(fortyOne.points).toBe(41);
    expect(fortyOne.holders.map((h) => h.playerName).sort()).toEqual(['Knut', 'Marit', 'Øyvind']);

    // Every other round is a real ranking.
    expect(r.bestRounds.filter((b) => b.shared).map((b) => b.key)).toEqual(['41']);
  });

  it('finds the costliest halving by replaying the rounds', () => {
    // Candidates: 44 (the 15s at 89), 173 (the 41 at 346), 211 (the bull at 422).
    expect(r.biggestHalving).toMatchObject({
      playerName: 'Knut', round: 'B', from: 422, to: 211, lost: 211,
    });
  });

  it('finds the longest winning streak', () => {
    expect(r.longestWinStreak).toMatchObject({ playerName: 'Marit', streak: 3 });
  });

  it('names the most halved and the bull king', () => {
    expect(r.mostHalved).toMatchObject({ playerName: 'Øyvind', perGame: 1 });
    expect(r.bullKing).toMatchObject({ playerName: 'Marit', hitRate: 100 });
  });

  it('finds a comeback from the standing after the 41', () => {
    expect(r.biggestComeback).not.toBeNull();
    expect(r.biggestComeback!.fromPosition - r.biggestComeback!.toPosition).toBe(1);
  });

  it('returns empty rather than throwing on no games', () => {
    const empty = records([]);
    expect(empty.topGames).toEqual([]);
    expect(empty.biggestHalving).toBeNull();
    expect(empty.bullKing).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * gameHistory
 * ------------------------------------------------------------------ */

describe('gameHistory', () => {
  const history = gameHistory(GAMES);

  it('is newest first', () => {
    expect(history.map((h) => h.gameId)).toEqual(['g4', 'g3', 'g2', 'g1']);
  });

  it('names the winner and orders the field', () => {
    const g1 = history.find((h) => h.gameId === 'g1')!;
    expect(g1.winner).toEqual({ playerName: 'Knut', total: 472 });
    expect(g1.players.map((p) => p.total)).toEqual([472, 353, 276]);
  });

  it('handles a tied game without inventing an order', () => {
    const g3 = history.find((h) => h.gameId === 'g3')!;
    expect(g3.players.every((p) => p.position === 1)).toBe(true);
    expect(g3.winner.total).toBe(472);
  });
});
