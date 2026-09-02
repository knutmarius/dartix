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
  /** Partial entry for the doubles and trebles rounds, which take a sum. */
  draft: number;
  muted: boolean;

  start: (players: GamePlayer[]) => void;
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
};

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

      commit: (value) => {
        const { players, cursor, inputs, past } = get();
        if (players.length === 0) return;
        const total = ROUND_COUNT * players.length;
        if (cursor >= total) return;

        const round = ROUNDS[Math.floor(cursor / players.length)]!;
        const player = players[cursor % players.length]!;

        set({
          inputs: {
            ...inputs,
            [player.id]: { ...inputs[player.id], [round.key]: value },
          },
          cursor: cursor + 1,
          draft: 0,
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

      addToDraft: (face) => set({ draft: get().draft + face }),
      clearDraft: () => set({ draft: 0 }),
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
          draft: 0,
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
        set({ inputs: { ...inputs, [player.id]: forPlayer }, cursor: index, draft: 0 });
      },

      moveBy: (delta) => {
        const { players, cursor } = get();
        const total = ROUND_COUNT * players.length;
        set({ cursor: Math.max(0, Math.min(total - 1, cursor + delta)), draft: 0 });
      },

      moveTo: (roundIndex, playerIndex) =>
        set({ cursor: roundIndex * get().players.length + playerIndex, draft: 0 }),

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
