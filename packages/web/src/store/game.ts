import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ROUNDS, ROUND_COUNT, roundFor } from '@dartix/core';
import type { RoundInputs, RoundKey } from '@dartix/core';

export interface GamePlayer {
  id: string;
  name: string;
}

interface Entry {
  ordinal: number;
  playerId: string;
  round: RoundKey;
  /** What the cell held before, so undo restores rather than clears. */
  previous: number | undefined;
}

export interface GameState {
  players: GamePlayer[];
  /** Keyed by player id. */
  inputs: Record<string, RoundInputs>;
  /**
   * Whose turn it is, as a flat index over rounds × players.
   *
   * Row-major: everyone throws at 13, then everyone at 14. Matches the legacy
   * focus order in `GameView.moveNextFocus`.
   */
  cursor: number;
  /** Undo stack. The old app had no undo at all. */
  past: Entry[];
  startedAt: number | null;
  /**
   * Set while someone has come back from the summary to fix an entry.
   *
   * `isFinished` is true the moment the cursor passes the last cell, and the
   * board bounces a finished game straight to the summary — which would make
   * "back to the board" a round trip to nowhere. This suspends that bounce
   * until they say they are done.
   */
  reviewing: boolean;
  /** Partial entry for the doubles and trebles rounds, which take a sum. */
  draft: number;
  /**
   * The individual faces behind `draft`, so the dartboard can mark them.
   *
   * `draft` alone is the sum the round actually stores; this is only ever
   * populated by tapping the pad. Typing a total on the keyboard leaves it
   * empty, which is correct — we genuinely do not know which faces those were.
   */
  draftFaces: number[];
  muted: boolean;

  start: (players: GamePlayer[]) => void;
  /** Reopen a finished board for corrections, sitting on the last entry. */
  review: () => void;
  /** Close it again, which sends the board back to the summary. */
  endReview: () => void;
  /**
   * Bring someone in mid-game.
   *
   * Their missed rounds are left empty rather than blanked, so the cursor
   * rule hands them straight back — they throw 13 upwards until they have
   * caught the field up, and then play rejoins the normal rotation.
   */
  addPlayer: (player: GamePlayer) => void;
  /** Take someone out, and their scores with them. */
  removePlayer: (playerId: string) => void;
  commit: (value: number) => void;
  addToDraft: (face: number) => void;
  clearDraft: () => void;
  commitDraft: () => void;
  undo: () => void;
  clearCell: () => void;
  moveBy: (delta: number) => void;
  moveTo: (roundIndex: number, playerIndex: number) => void;
  toggleMute: () => void;
  reset: () => void;
}

const empty = {
  players: [] as GamePlayer[],
  inputs: {} as Record<string, RoundInputs>,
  cursor: 0,
  past: [] as Entry[],
  startedAt: null as number | null,
  draft: 0,
  draftFaces: [] as number[],
  reviewing: false,
};

/**
 * The first cell nobody has filled yet, in row-major order.
 *
 * This is where the cursor lands after every entry, rather than simply the
 * next cell along. Three things fall out of it:
 *
 *   - Normal play is unchanged: the next cell along *is* the first empty one.
 *   - Correcting something in the history returns you to where the game
 *     actually is, instead of leaving you walking forward through cells that
 *     are already filled.
 *   - Someone who joins late gets handed every round they missed, in order,
 *     before play rejoins the normal rotation.
 *
 * Returns the end ordinal when nothing is left, which is what `isFinished`
 * reads — so the game is over exactly when every cell is filled.
 */
function nextOpen(
  players: readonly GamePlayer[],
  inputs: Record<string, RoundInputs>,
): number {
  const n = players.length;
  const total = ROUND_COUNT * n;
  for (let ordinal = 0; ordinal < total; ordinal++) {
    const round = ROUNDS[Math.floor(ordinal / n)]!;
    const player = players[ordinal % n]!;
    if (inputs[player.id]?.[round.key] === undefined) return ordinal;
  }
  return total;
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...empty,
      muted: false,

      start: (players) =>
        set({
          ...empty,
          players,
          inputs: Object.fromEntries(players.map((p) => [p.id, {}])),
          startedAt: Date.now(),
        }),

      review: () => {
        const { players } = get();
        if (players.length === 0) return;
        // Onto the last cell rather than past it, so the pad and the keyboard
        // both work — `commit` is a no-op once the cursor is off the end.
        set({
          reviewing: true,
          cursor: ROUND_COUNT * players.length - 1,
          draft: 0, draftFaces: [],
        });
      },

      endReview: () => {
        const { players } = get();
        set({ reviewing: false, cursor: ROUND_COUNT * players.length, draft: 0, draftFaces: [] });
      },

      addPlayer: (player) => {
        const { players, inputs } = get();
        if (players.length === 0 || players.some((p) => p.id === player.id)) return;

        const roster = [...players, player];
        const next = { ...inputs, [player.id]: {} };

        set({
          players: roster,
          inputs: next,
          // Straight to their first missed round — the same rule as after any
          // entry, which is what makes catching up automatic.
          cursor: nextOpen(roster, next),
          // Undo steps are flat ordinals over rounds × players, so every one
          // of them means something different now. Clearing beats replaying
          // them against the wrong grid.
          past: [],
          draft: 0, draftFaces: [], reviewing: false,
        });
      },

      removePlayer: (playerId) => {
        const { players, inputs } = get();
        if (!players.some((p) => p.id === playerId)) return;
        if (players.length === 1) return get().reset();

        const remaining = players.filter((p) => p.id !== playerId);
        const { [playerId]: _removed, ...rest } = inputs;

        set({
          players: remaining,
          inputs: rest,
          // The same rule as everywhere else, which is what makes the seat
          // arithmetic unnecessary: the earliest gap *is* where the game is.
          // It also covers the case where their leaving completes the board —
          // no gap left, so the cursor runs off the end and the game is over.
          cursor: nextOpen(remaining, rest),
          past: [],
          draft: 0, draftFaces: [], reviewing: false,
        });
      },

      commit: (value) => {
        const { players, cursor, inputs, past } = get();
        if (players.length === 0) return;
        const total = ROUND_COUNT * players.length;
        if (cursor >= total) return;

        const round = ROUNDS[Math.floor(cursor / players.length)]!;
        const player = players[cursor % players.length]!;

        const next = {
          ...inputs,
          [player.id]: { ...inputs[player.id], [round.key]: value },
        };

        set({
          inputs: next,
          cursor: nextOpen(players, next),
          draft: 0, draftFaces: [],
          past: [
            ...past,
            {
              ordinal: cursor,
              playerId: player.id,
              round: round.key,
              previous: inputs[player.id]?.[round.key],
            },
          ],
        });
      },

      addToDraft: (face) => set({ draft: get().draft + face, draftFaces: [...get().draftFaces, face] }),
      clearDraft: () => set({ draft: 0, draftFaces: [] }),
      commitDraft: () => get().commit(get().draft),

      undo: () => {
        const { past, inputs } = get();
        const last = past[past.length - 1];
        if (!last) return;

        const forPlayer = { ...inputs[last.playerId] };
        if (last.previous === undefined) delete forPlayer[last.round];
        else forPlayer[last.round] = last.previous;

        set({
          inputs: { ...inputs, [last.playerId]: forPlayer },
          cursor: last.ordinal,
          draft: 0, draftFaces: [],
          past: past.slice(0, -1),
        });
      },

      /**
       * Empty the active cell.
       *
       * The legacy app could not do this: its handler only fired when the input
       * held a value, so clearing a field left the computed score and the total
       * showing the old number.
       */
      clearCell: () => {
        const { players, cursor, inputs } = get();
        if (players.length === 0) return;
        const index = Math.min(cursor, ROUND_COUNT * players.length - 1);
        const round = ROUNDS[Math.floor(index / players.length)]!;
        const player = players[index % players.length]!;
        const forPlayer = { ...inputs[player.id] };
        delete forPlayer[round.key];
        set({ inputs: { ...inputs, [player.id]: forPlayer }, cursor: index, draft: 0, draftFaces: [] });
      },

      moveBy: (delta) => {
        const { players, cursor } = get();
        const total = ROUND_COUNT * players.length;
        set({ cursor: Math.max(0, Math.min(total - 1, cursor + delta)), draft: 0, draftFaces: [] });
      },

      moveTo: (roundIndex, playerIndex) =>
        set({ cursor: roundIndex * get().players.length + playerIndex, draft: 0, draftFaces: [] }),

      toggleMute: () => set({ muted: !get().muted }),
      reset: () => set({ ...empty }),
    }),
    {
      name: 'dartix.game',
      // Mirrored on every change, so a reload or a crash resumes where it left
      // off. The old app could only warn you not to close the tab.
      partialize: (state) => ({
        players: state.players,
        inputs: state.inputs,
        cursor: state.cursor,
        past: state.past,
        startedAt: state.startedAt,
        muted: state.muted,
        reviewing: state.reviewing,
      }),
    },
  ),
);

/* ------------------------------------------------------------------ *
 * Selectors
 * ------------------------------------------------------------------ */

export function activeRound(state: GameState) {
  const n = state.players.length;
  if (n === 0) return null;
  const index = Math.min(Math.floor(state.cursor / n), ROUND_COUNT - 1);
  return { index, round: ROUNDS[index]! };
}

export function activePlayer(state: GameState): GamePlayer | null {
  const n = state.players.length;
  if (n === 0) return null;
  if (state.cursor >= ROUND_COUNT * n) return state.players[n - 1]!;
  return state.players[state.cursor % n]!;
}

export function isFinished(state: GameState): boolean {
  return state.players.length > 0 && state.cursor >= ROUND_COUNT * state.players.length;
}

export function hasGameInProgress(state: GameState): boolean {
  return state.players.length > 0 && state.startedAt !== null;
}

export { roundFor };
