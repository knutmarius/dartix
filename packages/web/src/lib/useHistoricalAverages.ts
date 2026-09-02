import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { RoundKey } from '@dartix/core';
import { api } from '../api';
import type { GamePlayer } from '../store/game';

/**
 * Each player's mean points per round, for the trend caret on the board.
 *
 * Returns an empty map until the requests land, and simply omits anyone with no
 * history. The old app fetched the same thing but dereferenced the response
 * before checking it (`GamePresenter.js:160`), so typing before it arrived threw
 * *above* the line that set the score — the keystroke, the total and the focus
 * advance all vanished. And a brand-new player got `{}`, making every caret
 * point up.
 */
export function useHistoricalAverages(players: GamePlayer[]) {
  const results = useQueries({
    queries: players.map((player) => ({
      queryKey: ['profile', player.id],
      queryFn: () => api.playerProfile(player.id),
      staleTime: Infinity,
      retry: false,
    })),
  });

  const ready = results.every((result) => !result.isPending);

  return useMemo(() => {
    const byPlayer = new Map<string, Map<RoundKey, number>>();
    results.forEach((result, index) => {
      const player = players[index];
      if (!player || !result.data) return;
      byPlayer.set(
        player.id,
        new Map(result.data.rounds.map((round) => [round.key, round.average])),
      );
    });
    return byPlayer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, players.map((p) => p.id).join(',')]);
}
