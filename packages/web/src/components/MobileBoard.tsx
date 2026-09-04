import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ROUNDS, missOutcome, rankPlayers, walk } from '@dartix/core';
import type { RoundInputs } from '@dartix/core';
import type { GamePlayer } from '../store/game';
import { Dartboard } from './Dartboard';
import { Avatar, Label } from './ui';

/** How many rounds of the grid survive on a phone. */
const WINDOW = 3;

/**
 * Below this much slack the dartboard is not worth drawing.
 *
 * The space left under the standings swings from ~250px (three players, a
 * one-row pad) to nothing (seven players on the doubles pad), and a 30px
 * dartboard is a smudge, not a diagram.
 */
const MIN_BOARD = 108;

export interface MobileBoardProps {
  players: GamePlayer[];
  inputs: Record<string, RoundInputs>;
  activeRoundIndex: number;
  activePlayerIndex: number;
  /** Faces tapped so far this turn, on the doubles and trebles rounds. */
  hits?: readonly number[];
  onPick: (roundIndex: number, playerIndex: number) => void;
  onRoster: () => void;
}

/**
 * The board, for a phone.
 *
 * The desktop layout puts all twelve rounds across the screen, which at 390px
 * collapses each column to a single pixel — the scores render as a smear of
 * overlapping digits. So on a phone the grid narrows to a three-round window:
 * the two rounds just played plus the one being thrown.
 *
 * That keeps the two things worth seeing mid-game — every player's total, and
 * enough recent history to spot a mistyped entry or the halving that just
 * landed — without a horizontal scroll competing with the page's vertical one.
 * The full twelve rounds are one tap away per player.
 */
export function MobileBoard({
  players, inputs, activeRoundIndex, activePlayerIndex, hits, onPick, onRoster,
}: MobileBoardProps) {
  const [sheetFor, setSheetFor] = useState<number | null>(null);

  /* The slot's height comes from flex, never from its content, so measuring it
     and then filling it cannot feed back into the measurement. */
  const slot = useRef<HTMLDivElement>(null);
  const [slack, setSlack] = useState(0);
  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setSlack(entry!.contentRect.height));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /*
   * Which three rounds are on screen.
   *
   * `null` follows the game. A number pins the window while you look back at
   * something, and any entry unpins it — the cursor rule sends you to the
   * first unfilled cell, the active round changes, and the window comes with
   * you. So stepping back is always a temporary detour.
   */
  const [pinned, setPinned] = useState<number | null>(null);
  useEffect(() => { setPinned(null); }, [activeRoundIndex]);

  const walks = new Map(players.map((p) => [p.id, walk(inputs[p.id] ?? {})]));
  const standings = rankPlayers(
    players.map((p) => ({ playerId: p.id, playerName: p.name, total: walks.get(p.id)!.total })),
  );
  const positions = new Map(standings.map((s) => [s.playerId, s]));
  const leader = standings[0]?.total ?? 0;

  // Following the game puts the active round in the last column, except near
  // the start where that would run off the front.
  const live = Math.max(0, Math.min(activeRoundIndex - (WINDOW - 1), ROUNDS.length - WINDOW));
  // Never past the game: forwards only ever means "back towards now".
  const start = pinned === null ? live : Math.max(0, Math.min(pinned, live));
  const columns = Array.from({ length: WINDOW }, (_, i) => start + i);

  const active = players[activePlayerIndex];
  const activeTotal = active ? walks.get(active.id)!.total : 0;
  const miss = missOutcome(activeTotal);
  const round = ROUNDS[activeRoundIndex]!;

  return (
    <div className="flex min-h-0 grow flex-col">
      {/* Round, and how far through the game we are. Dots rather than twelve
          labels, which do not fit and are not the question being asked. */}
      <div className="flex shrink-0 items-center gap-3 border-b border-line-soft bg-raised px-4 py-2">
        {/* The target itself is what a glance is looking for — "14", not
            "Fourteens" — so the number gets the accent block and the name
            drops to a gloss beneath the round counter. */}
        <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent">
          <span className="dsp text-[28px] leading-none font-bold text-ground">{round.label}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <Label className="text-[10px]!">Round {activeRoundIndex + 1} of 12</Label>
          <span className="dsp truncate text-lg leading-none font-semibold text-ink-2">
            {round.name}
          </span>
        </div>
        <div className="grow" />

        {/*
          * Stepping the three-round window.
          *
          * Three of twelve fit on a phone, so without this the earlier rounds
          * are unreachable — you can neither check nor correct them. It lives
          * up here because the round block already sets this row's height, so
          * controls this size are free; in the standings header they made that
          * row taller and cost a player row at seven players.
          */}
        <div className="flex shrink-0 items-center gap-1">
          {start !== live ? (
            <button
              onClick={() => setPinned(null)}
              className="label mr-0.5 rounded border border-accent/50 px-1.5 py-1 text-[9px]! text-accent!"
            >
              Now
            </button>
          ) : null}
          {/* Functional updates, not `start - 1`: `start` is this render's
              value, so three quick taps would all compute the same step and
              the window would move once. */}
          <Step
            back
            onClick={() => setPinned((at) => Math.max(0, (at ?? live) - 1))}
            disabled={start === 0}
          />
          <Step
            onClick={() => setPinned((at) => Math.min(live, (at ?? live) + 1))}
            disabled={start >= live}
          />
        </div>

        {/* Dots kept, a size down, and dropped altogether on a narrow phone:
            they say the same thing as the counter above, so they are what
            yields when the round name would otherwise clip. */}
        <div className="hidden shrink-0 gap-[3px] min-[380px]:flex">
          {ROUNDS.map((r, i) => (
            <span
              key={r.key}
              title={r.name}
              className={`size-1.5 rounded-full ${
                i === activeRoundIndex ? 'bg-accent' : i < activeRoundIndex ? 'bg-ink-3' : 'bg-ink-4/60'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Whose turn, and what a blank would cost — the whole drama of the game. */}
      {active ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-line-soft px-4 py-2.5">
          <Avatar name={active.name} tone="active" />
          <div className="flex min-w-0 flex-col">
            <Label className="text-accent! text-[10px]!">Now throwing</Label>
            <span className="dsp truncate text-xl leading-none font-bold">{active.name}</span>
          </div>
          <div className="grow" />

          {/* Was a grey caption above the names, which nobody found. Here it
              is a control, in the gap the turn strip already had going spare. */}
          <button
            onClick={onRoster}
            aria-label="Add or remove players"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-accent/45
                       bg-accent/12 px-2.5 py-2 active:bg-accent/20"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" className="size-4 text-accent" aria-hidden>
              <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
              <circle cx="10" cy="8" r="3.2" />
              <path d="M19 8.5v5M21.5 11h-5" />
            </svg>
            <span className="dsp text-[15px] leading-none font-bold text-accent">{players.length}</span>
          </button>

          <div className="flex flex-col items-end">
            <span className="dsp num text-2xl leading-none font-bold">{activeTotal}</span>
            <span className="num text-[11px] font-semibold text-danger">
              miss &rarr; {miss.to} ({miss.delta})
            </span>
          </div>
        </div>
      ) : null}

      {/* Standings, with the three-round window. */}
      <div className="flex min-h-0 grow flex-col px-3 pt-1.5">
        <div className="flex shrink-0 items-end pb-1.5">
          <div className="w-[38%] shrink-0" />
          <div className="flex grow">
            {columns.map((i) => (
              <div key={ROUNDS[i]!.key} className="flex-1 text-center">
                <Label
                  className={`dsp text-[11px]! ${i === activeRoundIndex ? 'text-accent!' : ''}`}
                >
                  {ROUNDS[i]!.label}
                </Label>
              </div>
            ))}
          </div>
          <Label className="w-14 shrink-0 text-right text-[10px]!">Total</Label>
        </div>

        {/*
          * No `grow` here on purpose: the rows take the height they need and
          * the board below absorbs the rest. Past five or six players the free
          * space runs out, the board collapses to nothing, and this list goes
          * back to scrolling — which is the right priority order.
          */}
        <div className="-mr-1 flex min-h-0 flex-col gap-1 overflow-y-auto pr-1 pb-1">
          {players.map((player, playerIndex) => {
            const state = walks.get(player.id)!;
            const standing = positions.get(player.id)!;
            const isLeader = standing.position === 1;
            const isThrowing = playerIndex === activePlayerIndex;

            return (
              <div
                key={player.id}
                className={`flex items-center rounded-lg py-1 ${
                  isLeader ? 'bg-accent/8 shadow-[inset_2px_0_0_var(--color-accent)]' : 'bg-surface'
                }`}
              >
                {/* Tapping the name opens the full twelve rounds for this player. */}
                <button
                  onClick={() => setSheetFor(playerIndex)}
                  className="flex w-[38%] shrink-0 items-center gap-2 pl-2 text-left"
                >
                  <span className={`dsp w-3 text-xs font-bold ${isLeader ? 'text-accent' : 'text-ink-3'}`}>
                    {standing.position}
                  </span>
                  <Avatar name={player.name} tone={isThrowing ? 'active' : 'muted'} size="sm" />
                  <span className="dsp truncate text-base leading-tight font-semibold">
                    {player.name}
                  </span>
                </button>

                <div className="flex grow">
                  {columns.map((roundIndex) => {
                    const cell = state.cells[roundIndex]!;
                    const isActive = roundIndex === activeRoundIndex && playerIndex === activePlayerIndex;
                    return (
                      <button
                        key={cell.key}
                        onClick={() => onPick(roundIndex, playerIndex)}
                        className={`min-h-8 flex-1 rounded-md ${
                          isActive ? 'bg-accent/16 shadow-[inset_0_0_0_2px_var(--color-accent)]' : ''
                        }`}
                      >
                        {isActive ? (
                          <span className="dsp text-lg font-bold text-accent">–</span>
                        ) : !cell.played ? (
                          <span className="dsp text-sm font-semibold text-ink-4">·</span>
                        ) : (
                          <span
                            className={`dsp text-lg font-semibold ${cell.halved ? 'font-bold text-danger' : ''}`}
                          >
                            {cell.points}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex w-14 shrink-0 flex-col items-end pr-2">
                  <motion.span
                    key={state.total}
                    initial={{ scale: 1.16 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                    className={`dsp num text-xl leading-none font-bold ${isLeader ? 'text-accent' : ''}`}
                  >
                    {state.total}
                  </motion.span>
                  <span className={`num text-[10px] font-semibold ${isLeader ? 'text-accent' : 'text-ink-3'}`}>
                    {isLeader ? (standing.tied ? 'tied' : 'lead') : `–${leader - state.total}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Where to throw. Fills the slack under the standings and disappears
            when there is none, so it never costs a player row. */}
        <div
          ref={slot}
          className="flex min-h-0 grow basis-0 items-center justify-center overflow-hidden py-1.5"
        >
          {slack >= MIN_BOARD ? (
            <Dartboard
              round={round}
              hits={hits}
              labels={slack >= 170 ? 'all' : 'active'}
              className="max-w-[300px]"
            />
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {sheetFor !== null && players[sheetFor] ? (
          <PlayerSheet
            player={players[sheetFor]}
            playerIndex={sheetFor}
            inputs={inputs[players[sheetFor].id] ?? {}}
            activeRoundIndex={activeRoundIndex}
            onJump={(roundIndex) => {
              onPick(roundIndex, sheetFor);
              setSheetFor(null);
            }}
            onClose={() => setSheetFor(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** One round back or forward through the visible window. */
function Step({
  onClick, disabled, back = false,
}: { onClick: () => void; disabled: boolean; back?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={back ? 'Earlier rounds' : 'Later rounds'}
      className="grid size-8 shrink-0 place-items-center rounded-md border border-line
                 text-ink-2 active:bg-raised disabled:border-line-soft disabled:text-ink-4"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
        strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden>
        <path d={back ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
      </svg>
    </button>
  );
}

/** All twelve rounds for one player, as a tappable sheet. */
function PlayerSheet({
  player, playerIndex, inputs, activeRoundIndex, onJump, onClose,
}: {
  player: GamePlayer;
  playerIndex: number;
  inputs: RoundInputs;
  activeRoundIndex: number;
  onJump: (roundIndex: number) => void;
  onClose: () => void;
}) {
  const state = walk(inputs);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-end bg-ground/80 md:hidden"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        onClick={(event) => event.stopPropagation()}
        className="w-full rounded-t-2xl border-t border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="mb-3 flex items-center gap-3">
          <Avatar name={player.name} />
          <div className="flex flex-col">
            <span className="dsp text-xl leading-none font-bold">{player.name}</span>
            <Label className="text-[10px]!">Tap a round to correct it</Label>
          </div>
          <div className="grow" />
          <span className="dsp num text-3xl leading-none font-bold text-accent">{state.total}</span>
        </div>

        <div className="grid grid-cols-6 gap-1.5">
          {state.cells.map((cell, roundIndex) => {
            const isActive = roundIndex === activeRoundIndex;
            return (
              <button
                key={cell.key}
                onClick={() => onJump(roundIndex)}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border ${
                  isActive
                    ? 'border-accent bg-accent/14'
                    : cell.halved
                      ? 'border-danger/40 bg-danger/10'
                      : 'border-line bg-raised'
                }`}
              >
                <Label className={`text-[9px]! ${isActive ? 'text-accent!' : ''}`}>{cell.key}</Label>
                <span
                  className={`dsp text-lg leading-none font-bold ${
                    cell.halved ? 'text-danger' : cell.played ? '' : 'text-ink-4'
                  }`}
                >
                  {cell.played ? cell.points : '·'}
                </span>
              </button>
            );
          })}
        </div>

        {/* The running total after each round, so a halving is traceable. */}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {state.cells.filter((c) => c.halved).length > 0 ? (
            state.cells
              .filter((c) => c.halved)
              .map((c) => (
                <span key={c.key} className="text-[11px] text-danger">
                  {c.key}: {c.before} &rarr; {c.after} ({c.delta})
                </span>
              ))
          ) : (
            <span className="text-[11px] text-good">No blanks yet — nothing halved.</span>
          )}
        </div>

        <button
          onClick={onClose}
          className="label mt-4 w-full rounded-lg border border-line py-3 text-ink-2"
        >
          Close
        </button>
        <span className="sr-only">Player {playerIndex + 1}</span>
      </motion.div>
    </motion.div>
  );
}
