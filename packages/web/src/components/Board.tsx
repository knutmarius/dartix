import { AnimatePresence, motion } from 'framer-motion';
import { ROUNDS, rankPlayers, walk } from '@dartix/core';
import type { RoundInputs } from '@dartix/core';
import type { GamePlayer } from '../store/game';
import { Avatar, Label } from './ui';

export interface BoardProps {
  players: GamePlayer[];
  inputs: Record<string, RoundInputs>;
  activeRoundIndex: number;
  activePlayerIndex: number;
  onPick: (roundIndex: number, playerIndex: number) => void;
}

/**
 * Players as rows, the twelve rounds across, running total on the right.
 *
 * The chosen layout of the two on the design canvas. The old app put rounds on
 * rows and players in fixed 65px columns, which overflowed past five or six
 * players — and real games here run to seven.
 */
export function Board({
  players, inputs, activeRoundIndex, activePlayerIndex, onPick,
}: BoardProps) {
  const walks = new Map(players.map((p) => [p.id, walk(inputs[p.id] ?? {})]));

  /*
   * The best score in each round so far, among the people actually playing.
   *
   * This replaces a caret comparing each entry against that player's own
   * historical average. That answered a question nobody asks mid-game — and
   * it cost a profile request per player on entering a game. Who is winning
   * the round in front of you is the question, and it needs no history.
   *
   * Zero is not a high score, so a round everybody blanked gets no dot.
   */
  const bestInRound = ROUNDS.map((_round, index) => {
    let best = 0;
    for (const player of players) {
      const cell = walks.get(player.id)!.cells[index]!;
      if (cell.played && cell.points > best) best = cell.points;
    }
    return best;
  });
  const standings = rankPlayers(
    players.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      total: walks.get(p.id)!.total,
    })),
  );
  const positions = new Map(standings.map((s) => [s.playerId, s]));
  const leader = standings[0]?.total ?? 0;

  return (
    <div className="px-6 pt-6 md:px-8">
      {/*
        * The only round indicator.
        *
        * It sits directly above the cells it labels and names the round large
        * enough to read across a room, so there is no separate strip competing
        * with it. Not clickable — to go back and fix something you click the
        * cell itself, which is unambiguous about which entry you are editing.
        */}
      <div className="flex items-end gap-1 pb-2.5">
        <div className="flex w-56 shrink-0 flex-col gap-1 md:w-64">
          <Label>Round {activeRoundIndex + 1} of 12</Label>
          {/* The target leads; the name is a gloss. Glancing up mid-throw, the
              question is "which number", not "what is this round called". */}
          <div className="flex items-baseline gap-2.5">
            <span className="dsp text-4xl leading-none font-bold text-accent">
              {ROUNDS[activeRoundIndex]?.label}
            </span>
            <span className="dsp truncate text-lg font-semibold text-ink-2">
              {ROUNDS[activeRoundIndex]?.name}
            </span>
          </div>
        </div>
        <div className="grid grow grid-cols-12 items-end gap-1">
          {ROUNDS.map((round, index) => {
            const now = index === activeRoundIndex;
            const past = index < activeRoundIndex;
            return (
              <div
                key={round.key}
                title={`${round.name} — ×${round.multiplier}`}
                className={`py-1 text-center ${now ? 'rounded-md bg-accent' : ''}`}
              >
                <span
                  className={`dsp text-2xl font-bold ${
                    now ? 'text-ground' : past ? 'text-ink-2' : 'text-ink-4'
                  }`}
                >
                  {round.label}
                </span>
              </div>
            );
          })}
        </div>
        <Label className="w-28 shrink-0 text-right md:w-36">Total</Label>
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        {players.map((player, playerIndex) => {
          const state = walks.get(player.id)!;
          const standing = positions.get(player.id)!;
          const isLeader = standing.position === 1;
          const isThrowing = playerIndex === activePlayerIndex;
          const behind = leader - state.total;

          return (
            <div
              key={player.id}
              className={`flex min-h-16 items-stretch rounded-lg ${
                isLeader ? 'bg-accent/7 shadow-[inset_2px_0_0_var(--color-accent)]' : 'bg-surface'
              }`}
            >
              {/* identity */}
              <div className="flex w-56 shrink-0 items-center gap-3 pl-3.5 md:w-64">
                <span className={`dsp w-4 text-[15px] font-bold ${isLeader ? 'text-accent' : 'text-ink-3'}`}>
                  {standing.position}
                </span>
                <Avatar name={player.name} tone={isThrowing ? 'active' : 'muted'} />
                <div className="flex min-w-0 flex-col">
                  <span className={`dsp truncate text-xl leading-tight font-semibold ${isThrowing ? '' : 'text-ink/85'}`}>
                    {player.name}
                  </span>
                  {isThrowing ? <Label className="text-accent! tracking-[0.11em]">Throwing</Label> : null}
                </div>
              </div>

              {/* the twelve cells */}
              <div className="grid grow grid-cols-12">
                {state.cells.map((cell, roundIndex) => {
                  const isActive = roundIndex === activeRoundIndex && playerIndex === activePlayerIndex;
                  // Ties all get a dot: sharing the best is still holding it.
                  const leadsRound =
                    cell.played && cell.points > 0 && cell.points === bestInRound[roundIndex];

                  return (
                    <button
                      key={cell.key}
                      onClick={() => onPick(roundIndex, playerIndex)}
                      title={leadsRound ? `Best ${ROUNDS[roundIndex]!.name} so far` : undefined}
                      /* A translucent line, not `line-soft`: that is an
                         opaque grey of much the same lightness as the tint on
                         the leader's row, so on that one row the separators
                         disappeared. Ink at 10% always darkens whatever is
                         behind it, and inverts with the theme. */
                      className={`relative flex flex-col items-center justify-center border-l border-ink/10 transition-colors ${
                        isActive
                          ? 'rounded-md border-l-transparent bg-accent/14 shadow-[inset_0_0_0_2px_var(--color-accent)]'
                          : 'hover:bg-ink/5'
                      }`}
                    >
                      {isActive ? (
                        <span className="dsp text-2xl font-bold text-accent">–</span>
                      ) : !cell.played ? (
                        <span className="dsp text-lg font-semibold text-ink-4">·</span>
                      ) : (
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span
                            key={cell.points}
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.14 }}
                            className={`dsp text-2xl font-semibold ${cell.halved ? 'text-danger font-bold' : ''}`}
                          >
                            {cell.points}
                          </motion.span>
                        </AnimatePresence>
                      )}

                      {leadsRound ? (
                        <span
                          aria-label="best in this round"
                          className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-good"
                        />
                      ) : null}
                      {cell.halved ? (
                        <span className="num text-[10px] leading-none font-semibold text-danger">
                          {cell.delta}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* total */}
              <div className="flex w-28 shrink-0 flex-col items-end justify-center pr-4 md:w-36">
                <motion.span
                  key={state.total}
                  initial={{ scale: 1.14 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                  className={`dsp text-4xl leading-none font-bold ${isLeader ? 'text-accent' : ''}`}
                >
                  {state.total}
                </motion.span>
                <Label className={`mt-0.5 ${isLeader ? 'text-accent!' : ''}`}>
                  {isLeader ? (standing.tied ? 'Tied' : 'Leading') : `–${behind}`}
                </Label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
