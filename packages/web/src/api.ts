import type {
  GameSummary, LeaderboardRow, PlayerProfile, Records, RoundKey, RoundKind,
} from '@dartix/core';

/**
 * The same shape, with dates as the strings JSON actually carries.
 *
 * Lets the client reuse the API's own types from `@dartix/core` rather than
 * redeclaring them, without pretending a `Date` survives serialisation.
 */
export type Wire<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Wire<U>[]
    : T extends object
      ? { [K in keyof T]: Wire<T[K]> }
      : T;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });

  if (response.status === 204) return undefined as T;

  // The API always answers JSON, but a proxy or a crash might not.
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    throw new ApiError(response.status, 'bad_response', 'The server sent something unreadable.');
  }

  if (!response.ok) {
    const err = body as { error?: string; message?: string } | undefined;
    throw new ApiError(
      response.status,
      err?.error ?? 'error',
      err?.message ?? `Request failed (${response.status}).`,
    );
  }
  return body as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

/* ------------------------------------------------------------------ */

export interface RulesResponse {
  rounds: {
    key: RoundKey;
    label: string;
    name: string;
    kind: RoundKind;
    multiplier: number;
    maxInput: number;
  }[];
  halving: string;
}

export interface PlayerSummary {
  id: string;
  name: string;
  games: number;
  average: number | null;
  lastPlayed: string | null;
}

export interface SavedGame {
  id: string;
  playedAt: string;
  results: {
    playerId: string;
    playerName: string;
    total: number;
    isWinner: boolean;
    isLoser: boolean;
  }[];
  warnings: { playerId: string; round?: RoundKey; message: string }[];
}

export interface GameDetail {
  id: string;
  playedAt: string;
  rounds: RoundKey[];
  results: { playerId: string; playerName: string; total: number; points: number[] }[];
}

export interface HeadToHeadResponse {
  a: { playerId: string; playerName: string; wins: number; average: number };
  b: { playerId: string; playerName: string; wins: number; average: number };
  games: number;
  draws: number;
  rounds: {
    key: RoundKey;
    aShare: number;
    bShare: number;
    level: number;
    aAverage: number;
    bAverage: number;
  }[];
}

export interface RoundMatrixResponse {
  rounds: RoundKey[];
  rows: {
    playerId: string;
    playerName: string;
    games: number;
    cells: { key: RoundKey; average: number; share: number }[];
  }[];
}

export interface DateRangeQuery {
  from?: string;
  to?: string;
  minGames?: number;
}

/**
 * Build a query string, dropping anything unset.
 *
 * Takes `object` rather than `Record<string, unknown>` so plain interfaces are
 * accepted — an interface has no index signature, so it never satisfies the
 * record type even though `Object.entries` handles it perfectly well.
 */
function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const api = {
  session: () => get<{ authenticated: boolean }>('/api/auth/session'),
  login: (passcode: string) => post<{ authenticated: boolean }>('/api/auth/login', { passcode }),
  logout: () => post<{ authenticated: boolean }>('/api/auth/logout'),

  rules: () => get<RulesResponse>('/api/rules'),
  health: () => get<{ ok: boolean; database: string }>('/api/health'),

  players: () => get<PlayerSummary[]>('/api/players'),
  addPlayer: (name: string) => post<PlayerSummary>('/api/players', { name }),
  deletePlayer: (id: string) => del<{ deleted: boolean }>(`/api/players/${id}`),

  games: (range: DateRangeQuery = {}) =>
    get<Wire<GameSummary>[]>(`/api/games${query(range)}`),
  game: (id: string) => get<GameDetail>(`/api/games/${id}`),
  saveGame: (players: { playerId: string; playerName: string; inputs: Partial<Record<RoundKey, number>> }[]) =>
    post<SavedGame>('/api/games', { players }),
  deleteGame: (id: string) => del<{ deleted: boolean }>(`/api/games/${id}`),

  leaderboard: (range: DateRangeQuery = {}) =>
    get<{ minGames: number; rows: Wire<LeaderboardRow>[] }>(`/api/stats/leaderboard${query(range)}`),
  roundMatrix: (range: DateRangeQuery = {}) =>
    get<RoundMatrixResponse>(`/api/stats/round-matrix${query(range)}`),
  records: (range: DateRangeQuery & { top?: number } = {}) =>
    get<Wire<Records>>(`/api/stats/records${query(range)}`),
  playerProfile: (id: string, range: DateRangeQuery = {}) =>
    get<Wire<PlayerProfile>>(`/api/stats/player/${id}${query(range)}`),
  headToHead: (a: string, b: string, range: DateRangeQuery = {}) =>
    get<HeadToHeadResponse>(`/api/stats/head-to-head${query({ ...range, ids: `${a},${b}` })}`),
};
