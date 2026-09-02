/**
 * Statistics over stored games.
 *
 * Pure functions over `HalfItGameDoc[]` so they can be unit-tested without a
 * database, and so the API and the web app compute the same numbers.
 *
 * Two deliberate departures from the old app's arithmetic, both because the old
 * behaviour was wrong rather than merely different:
 *
 *   - Averages are not truncated. `HalfItController.PlayerStatsList` cast the
 *     mean to `(int)`, so an average of 341.8 reported as 341.
 *   - Winners and losers are derived with `rankPlayers`, which handles ties and
 *     does not make a solo player simultaneously winner and loser.
 *
 * `IsWinner` / `IsLoser` on stored documents are ignored entirely: the old
 * client never set them, so every historical result has them `false`.
 */

import { ROUNDS } from './rounds.js';
import { pointsFromResult } from './mongo.js';
import { rankPlayers } from './scoring.js';
import type { HalfItGameDoc, RoundKey, RoundPoints } from './types.js';

/** One player's result in one game, flattened and ranked. */
export interface ResultView {
  gameId: string;
  when: Date;
  playerId: string;
  playerName: string;
  /** The stored total. Verified to reproduce through the rules engine. */
  total: number;
  points: RoundPoints;
  /** Rounds that scored nothing, and therefore halved the total. */
  blanks: RoundKey[];
  position: number;
  isWinner: boolean;
  isLoser: boolean;
  /** How many players were in this game. */
  fieldSize: number;
}

/** Flatten games into ranked per-player rows, oldest first. */
export function flatten(games: readonly HalfItGameDoc[]): ResultView[] {
  const views: ResultView[] = [];

  for (const game of games) {
    const results = game.Results ?? [];
    if (results.length === 0) continue;

    const standings = rankPlayers(
      results.map((r) => ({ playerId: r.PlayerId, playerName: r.PlayerName, total: r.Sum })),
    );
    const byId = new Map(standings.map((s) => [s.playerId, s]));

    for (const result of results) {
      const standing = byId.get(result.PlayerId);
      const points = pointsFromResult(result);
      views.push({
        gameId: game._id,
        when: game.TimeStamp,
        playerId: result.PlayerId,
        playerName: result.PlayerName,
        total: result.Sum,
        points,
        blanks: ROUNDS.filter((r) => (points[r.key] ?? 0) === 0).map((r) => r.key),
        position: standing?.position ?? 1,
        isWinner: standing?.isWinner ?? false,
        isLoser: standing?.isLoser ?? false,
        fieldSize: results.length,
      });
    }
  }

  return views.sort((a, b) => a.when.getTime() - b.when.getTime());
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

/* ------------------------------------------------------------------ *
 * Leaderboard
 * ------------------------------------------------------------------ */

export interface LeaderboardRow {
  playerId: string;
  playerName: string;
  games: number;
  average: number;
  high: number;
  low: number;
  wins: number;
  losses: number;
  /** Percentage, 0–100. */
  winRate: number;
  halvingsPerGame: number;
  /** Percentage of games in which the bull round scored. */
  bullHitRate: number;
  lastPlayed: Date;
}

export interface LeaderboardOptions {
  /**
   * Hide players below this many games.
   *
   * Worth a default above 1: of 38 players in the real database, 17 have
   * played fewer than five games, and a single lucky night would otherwise
   * top the table.
   */
  minGames?: number;
}

export function leaderboard(
  games: readonly HalfItGameDoc[],
  options: LeaderboardOptions = {},
): LeaderboardRow[] {
  const minGames = options.minGames ?? 1;
  const byPlayer = groupBy(flatten(games), (v) => v.playerId);

  const rows: LeaderboardRow[] = [];
  for (const [playerId, views] of byPlayer) {
    if (views.length < minGames) continue;
    const totals = views.map((v) => v.total);
    const blanks = views.reduce((n, v) => n + v.blanks.length, 0);
    const bullHits = views.filter((v) => (v.points['B'] ?? 0) > 0).length;

    rows.push({
      playerId,
      playerName: latestName(views),
      games: views.length,
      average: round1(mean(totals)),
      high: Math.max(...totals),
      low: Math.min(...totals),
      wins: views.filter((v) => v.isWinner).length,
      losses: views.filter((v) => v.isLoser).length,
      winRate: round1((views.filter((v) => v.isWinner).length / views.length) * 100),
      halvingsPerGame: round1(blanks / views.length),
      bullHitRate: round1((bullHits / views.length) * 100),
      lastPlayed: views[views.length - 1]!.when,
    });
  }

  return rows.sort((a, b) => b.average - a.average || a.playerName.localeCompare(b.playerName));
}

/* ------------------------------------------------------------------ *
 * Player profile
 * ------------------------------------------------------------------ */

export interface ProfileGame {
  gameId: string;
  when: Date;
  total: number;
  position: number;
  fieldSize: number;
  won: boolean;
  blanks: RoundKey[];
}

export interface PlayerProfile {
  playerId: string;
  playerName: string;
  games: number;
  average: number;
  high: number;
  low: number;
  wins: number;
  winRate: number;
  halvingsPerGame: number;
  /** Every game, oldest first. */
  history: ProfileGame[];
  /** Trailing mean over the last `window` games, aligned with `history`. */
  rollingAverage: number[];
  /**
   * Per-round figures, **in playing order**.
   *
   * An array rather than a keyed object on purpose. JavaScript orders
   * integer-like object keys numerically ahead of string keys, so a
   * `Record<RoundKey, number>` serialises as 13, 14, 15 … 20, 41, D, T, B —
   * not the order the game is played in. A client mapping over
   * `Object.entries` would draw the heatmap with the rounds scrambled.
   */
  rounds: {
    key: RoundKey;
    /** Mean points scored in this round. */
    average: number;
    /** Percentage of games in which this round scored nothing. */
    blankRate: number;
  }[];
  /** Longest run of consecutive wins. */
  bestStreak: number;
  /** Current run of consecutive wins, zero if the last game was a loss. */
  currentStreak: number;
}

export function playerProfile(
  games: readonly HalfItGameDoc[],
  playerId: string,
  options: { rollingWindow?: number } = {},
): PlayerProfile | null {
  const window = options.rollingWindow ?? 5;
  const views = flatten(games).filter((v) => v.playerId === playerId);
  if (views.length === 0) return null;

  const totals = views.map((v) => v.total);
  const rounds = ROUNDS.map((round) => {
    const blanked = views.filter((v) => (v.points[round.key] ?? 0) === 0).length;
    return {
      key: round.key,
      average: round1(mean(views.map((v) => v.points[round.key] ?? 0))),
      blankRate: round1((blanked / views.length) * 100),
    };
  });

  const streaks = winStreaks(views.map((v) => v.isWinner));

  return {
    playerId,
    playerName: latestName(views),
    games: views.length,
    average: round1(mean(totals)),
    high: Math.max(...totals),
    low: Math.min(...totals),
    wins: views.filter((v) => v.isWinner).length,
    winRate: round1((views.filter((v) => v.isWinner).length / views.length) * 100),
    halvingsPerGame: round1(views.reduce((n, v) => n + v.blanks.length, 0) / views.length),
    history: views.map((v) => ({
      gameId: v.gameId,
      when: v.when,
      total: v.total,
      position: v.position,
      fieldSize: v.fieldSize,
      won: v.isWinner,
      blanks: v.blanks,
    })),
    rollingAverage: totals.map((_, i) =>
      Math.round(mean(totals.slice(Math.max(0, i - window + 1), i + 1))),
    ),
    rounds,
    bestStreak: streaks.best,
    currentStreak: streaks.current,
  };
}

function winStreaks(wins: readonly boolean[]): { best: number; current: number } {
  let best = 0;
  let run = 0;
  for (const won of wins) {
    run = won ? run + 1 : 0;
    if (run > best) best = run;
  }
  return { best, current: run };
}

/* ------------------------------------------------------------------ *
 * Round matrix — the heatmap
 * ------------------------------------------------------------------ */

export interface RoundMatrixRow {
  playerId: string;
  playerName: string;
  games: number;
  cells: {
    key: RoundKey;
    average: number;
    /**
     * Where this average sits between the weakest and strongest in the field
     * for this round, 0–1. What the heatmap shades by, so a bright cell means
     * best in the room at that target rather than simply a big number.
     */
    share: number;
  }[];
}

export function roundMatrix(
  games: readonly HalfItGameDoc[],
  options: LeaderboardOptions = {},
): { rounds: RoundKey[]; rows: RoundMatrixRow[] } {
  const minGames = options.minGames ?? 1;
  const byPlayer = [...groupBy(flatten(games), (v) => v.playerId)]
    .filter(([, views]) => views.length >= minGames);

  const averages = new Map<string, Record<RoundKey, number>>();
  for (const [playerId, views] of byPlayer) {
    const per = {} as Record<RoundKey, number>;
    for (const round of ROUNDS) per[round.key] = mean(views.map((v) => v.points[round.key] ?? 0));
    averages.set(playerId, per);
  }

  const bounds = {} as Record<RoundKey, { min: number; max: number }>;
  for (const round of ROUNDS) {
    const column = [...averages.values()].map((a) => a[round.key]);
    bounds[round.key] = { min: Math.min(...column), max: Math.max(...column) };
  }

  const rows = byPlayer.map(([playerId, views]): RoundMatrixRow => {
    const per = averages.get(playerId)!;
    return {
      playerId,
      playerName: latestName(views),
      games: views.length,
      cells: ROUNDS.map((round) => {
        const { min, max } = bounds[round.key];
        return {
          key: round.key,
          average: round1(per[round.key]),
          share: max === min ? 0.5 : (per[round.key] - min) / (max - min),
        };
      }),
    };
  });

  return {
    rounds: ROUNDS.map((r) => r.key),
    rows: rows.sort((a, b) => a.playerName.localeCompare(b.playerName)),
  };
}

/* ------------------------------------------------------------------ *
 * Head to head
 * ------------------------------------------------------------------ */

export interface HeadToHead {
  a: { playerId: string; playerName: string; wins: number; average: number };
  b: { playerId: string; playerName: string; wins: number; average: number };
  /** Games both players were in. */
  games: number;
  /** Games where neither finished ahead of the other. */
  draws: number;
  rounds: {
    key: RoundKey;
    /** Percentage of shared games where A outscored B in this round. */
    aShare: number;
    bShare: number;
    /** Games where both scored the same in this round. */
    level: number;
    aAverage: number;
    bAverage: number;
  }[];
}

export function headToHead(
  games: readonly HalfItGameDoc[],
  aId: string,
  bId: string,
): HeadToHead | null {
  const byGame = groupBy(flatten(games), (v) => v.gameId);

  const pairs: { a: ResultView; b: ResultView }[] = [];
  for (const views of byGame.values()) {
    const a = views.find((v) => v.playerId === aId);
    const b = views.find((v) => v.playerId === bId);
    if (a && b) pairs.push({ a, b });
  }
  if (pairs.length === 0) return null;

  return {
    a: {
      playerId: aId,
      playerName: latestName(pairs.map((p) => p.a)),
      wins: pairs.filter((p) => p.a.total > p.b.total).length,
      average: round1(mean(pairs.map((p) => p.a.total))),
    },
    b: {
      playerId: bId,
      playerName: latestName(pairs.map((p) => p.b)),
      wins: pairs.filter((p) => p.b.total > p.a.total).length,
      average: round1(mean(pairs.map((p) => p.b.total))),
    },
    games: pairs.length,
    draws: pairs.filter((p) => p.a.total === p.b.total).length,
    rounds: ROUNDS.map((round) => {
      const av = pairs.map((p) => p.a.points[round.key] ?? 0);
      const bv = pairs.map((p) => p.b.points[round.key] ?? 0);
      const aAhead = pairs.filter((_, i) => av[i]! > bv[i]!).length;
      const bAhead = pairs.filter((_, i) => bv[i]! > av[i]!).length;
      return {
        key: round.key,
        aShare: round1((aAhead / pairs.length) * 100),
        bShare: round1((bAhead / pairs.length) * 100),
        level: pairs.length - aAhead - bAhead,
        aAverage: round1(mean(av)),
        bAverage: round1(mean(bv)),
      };
    }),
  };
}

/* ------------------------------------------------------------------ *
 * Records — the hall of fame
 * ------------------------------------------------------------------ */

export interface RoundRecord {
  key: RoundKey;
  points: number;
  /**
   * Everyone who has scored it, earliest first — records are shared far more
   * often than you would guess. Five players share the doubles record on the
   * real board and seven share the bull, so picking one name silently hides
   * the rest.
   *
   * One entry per player, at the first game they did it in.
   */
  holders: { playerId: string; playerName: string; when: Date }[];
  /** When the record was first set. */
  when: Date;
  /**
   * True when the round's maximum is fixed, so every holder ties by
   * definition rather than by coincidence.
   *
   * Only the 41 behaves this way: it is made or missed, worth exactly 41 or
   * nothing, so "best" is not a ranking and the list is simply everyone who
   * has ever made it.
   */
  shared: boolean;
}

export interface Records {
  topGames: { gameId: string; when: Date; playerId: string; playerName: string; total: number }[];
  /** The best single-round score ever, per round, and everyone holding it. */
  bestRounds: RoundRecord[];
  /** The costliest halving ever recorded, reconstructed from the round scores. */
  biggestHalving: {
    playerName: string; when: Date; round: RoundKey; from: number; to: number; lost: number;
  } | null;
  longestWinStreak: { playerId: string; playerName: string; streak: number } | null;
  mostHalved: { playerId: string; playerName: string; perGame: number } | null;
  bullKing: { playerId: string; playerName: string; hitRate: number } | null;
  /** Biggest climb from the standing after the 41 to the final standing. */
  biggestComeback: {
    playerName: string; when: Date; fromPosition: number; toPosition: number; fieldSize: number;
  } | null;
}

export function records(
  games: readonly HalfItGameDoc[],
  options: { top?: number; minGames?: number } = {},
): Records {
  const top = options.top ?? 10;
  const minGames = options.minGames ?? 1;
  const views = flatten(games);

  if (views.length === 0) {
    return {
      topGames: [], bestRounds: [], biggestHalving: null,
      longestWinStreak: null, mostHalved: null, bullKing: null, biggestComeback: null,
    };
  }

  const board = leaderboard(games, { minGames });
  const byPlayer = groupBy(views, (v) => v.playerId);

  /* the costliest halving, replayed round by round */
  let biggest: Records['biggestHalving'] = null;
  for (const view of views) {
    let running = 0;
    for (const round of ROUNDS) {
      const points = view.points[round.key] ?? 0;
      if (points > 0) { running += points; continue; }
      const to = Math.ceil(running / 2);
      const lost = running - to;
      if (!biggest || lost > biggest.lost) {
        biggest = {
          playerName: view.playerName, when: view.when, round: round.key,
          from: running, to, lost,
        };
      }
      running = to;
    }
  }

  /* biggest climb over the closing rounds */
  let comeback: Records['biggestComeback'] = null;
  for (const [, gameViews] of groupBy(views, (v) => v.gameId)) {
    if (gameViews.length < 2) continue;
    const after41 = rankPlayers(
      gameViews.map((v) => ({
        playerId: v.playerId,
        playerName: v.playerName,
        total: partialTotal(v.points, 9),
      })),
    );
    for (const view of gameViews) {
      const from = after41.find((s) => s.playerId === view.playerId)?.position ?? view.position;
      const climb = from - view.position;
      if (climb > 0 && (!comeback || climb > comeback.fromPosition - comeback.toPosition)) {
        comeback = {
          playerName: view.playerName, when: view.when,
          fromPosition: from, toPosition: view.position, fieldSize: view.fieldSize,
        };
      }
    }
  }

  const streaks = [...byPlayer].map(([playerId, vs]) => ({
    playerId,
    playerName: latestName(vs),
    streak: winStreaks(vs.map((v) => v.isWinner)).best,
  })).sort((a, b) => b.streak - a.streak);

  const halved = board.slice().sort((a, b) => b.halvingsPerGame - a.halvingsPerGame);
  const bulls = board.slice().sort((a, b) => b.bullHitRate - a.bullHitRate);

  return {
    topGames: views
      .slice()
      .sort((a, b) => b.total - a.total)
      .slice(0, top)
      .map((v) => ({
        gameId: v.gameId, when: v.when, playerId: v.playerId,
        playerName: v.playerName, total: v.total,
      })),
    bestRounds: ROUNDS.map((round) => bestForRound(views, round.key)),
    biggestHalving: biggest,
    longestWinStreak: streaks[0] ?? null,
    mostHalved: halved[0]
      ? { playerId: halved[0].playerId, playerName: halved[0].playerName, perGame: halved[0].halvingsPerGame }
      : null,
    bullKing: bulls[0]
      ? { playerId: bulls[0].playerId, playerName: bulls[0].playerName, hitRate: bulls[0].bullHitRate }
      : null,
    biggestComeback: comeback,
  };
}

/**
 * The best score in one round, with every player who has matched it.
 *
 * Deduplicated per player at their earliest such game, so someone who has hit
 * the record five times appears once, dated to the first time.
 */
function bestForRound(views: readonly ResultView[], key: RoundKey): RoundRecord {
  const points = views.reduce((max, v) => Math.max(max, v.points[key] ?? 0), 0);

  const earliest = new Map<string, ResultView>();
  for (const view of views) {
    if ((view.points[key] ?? 0) !== points) continue;
    const held = earliest.get(view.playerId);
    if (!held || view.when.getTime() < held.when.getTime()) earliest.set(view.playerId, view);
  }

  const holders = [...earliest.values()]
    .sort((a, b) => a.when.getTime() - b.when.getTime() || a.playerName.localeCompare(b.playerName))
    .map((view) => ({ playerId: view.playerId, playerName: view.playerName, when: view.when }));

  const round = ROUNDS.find((r) => r.key === key)!;
  return {
    key,
    points,
    holders,
    when: holders[0]?.when ?? new Date(0),
    // A binary round can only ever be tied: its maximum is the multiplier.
    shared: round.kind === 'binary',
  };
}

/** The total after the first `count` rounds, halvings applied. */
function partialTotal(points: RoundPoints, count: number): number {
  let total = 0;
  for (const round of ROUNDS.slice(0, count)) {
    const p = points[round.key] ?? 0;
    total = p > 0 ? total + p : Math.ceil(total / 2);
  }
  return total;
}

/* ------------------------------------------------------------------ *
 * Game history
 * ------------------------------------------------------------------ */

export interface GameSummary {
  gameId: string;
  when: Date;
  players: { playerId: string; playerName: string; total: number; position: number }[];
  winner: { playerName: string; total: number };
}

export function gameHistory(games: readonly HalfItGameDoc[]): GameSummary[] {
  return [...groupBy(flatten(games), (v) => v.gameId)]
    .map(([gameId, views]): GameSummary => {
      const ranked = views.slice().sort((a, b) => a.position - b.position || b.total - a.total);
      const top = ranked[0]!;
      return {
        gameId,
        when: top.when,
        players: ranked.map((v) => ({
          playerId: v.playerId, playerName: v.playerName, total: v.total, position: v.position,
        })),
        winner: { playerName: top.playerName, total: top.total },
      };
    })
    .sort((a, b) => b.when.getTime() - a.when.getTime());
}

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}

/**
 * The most recently used spelling of a player's name.
 *
 * Names are denormalised into every result, so a rename leaves older results
 * carrying the old spelling. Prefer the newest.
 */
function latestName(views: readonly ResultView[]): string {
  return views.reduce((acc, v) => (v.when.getTime() >= acc.when.getTime() ? v : acc), views[0]!).playerName;
}
