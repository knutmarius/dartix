import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ROUNDS, halve, walk } from '@dartix/core';
import {
  activePlayer, activeRound, hasGameInProgress, isFinished, useGame,
} from '../store/game';
import { useHistoricalAverages } from '../lib/useHistoricalAverages';
import { useFailSound } from '../lib/useSound';
import { Board } from '../components/Board';
import { EntryPad } from '../components/EntryPad';
import { TurnCard } from '../components/TurnCard';
import { Button, Label } from '../components/ui';

/** A halving worth more than this plays the trombone, as it always has. */
const TROMBONE_THRESHOLD = 150;

export function Play() {
  const navigate = useNavigate();
  const game = useGame();
  const {
    players, inputs, draft, muted,
    commit, undo, clearCell, moveBy, moveTo, addToDraft, clearDraft, toggleMute,
  } = game;

  const [typed, setTyped] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const averages = useHistoricalAverages(players);
  const playTrombone = useFailSound(muted);

  const round = activeRound(game);
  const player = activePlayer(game);
  const finished = isFinished(game);

  const total = player ? walk(inputs[player.id] ?? {}).total : 0;

  /** Commit, sounding the trombone first if this blank is an expensive one. */
  const enter = useCallback(
    (value: number) => {
      if (!round) return;
      if (value === 0 && total - halve(total) > TROMBONE_THRESHOLD) playTrombone();
      setTyped(null);
      commit(value);
    },
    [round, total, playTrombone, commit],
  );

  useEffect(() => {
    if (finished) navigate('/play/summary', { replace: true });
  }, [finished, navigate]);

  /* ---- keyboard ----
   *
   * Keyed off `event.key`, not `which`. The old handler ran
   * `String.fromCharCode(e.which)` on keyup, so the numeric keypad (96–105)
   * decoded to "a".."j" and was silently ignored — along with Enter, Tab and
   * every arrow key.
   */
  useEffect(() => {
    if (!round || finished) return;
    // Narrow once out here; the listener closes over the values, not the union.
    const { maxInput, kind } = round.round;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (event.metaKey || event.ctrlKey) {
        if (event.key.toLowerCase() === 'z') {
          event.preventDefault();
          setTyped(null);
          undo();
        }
        return;
      }

      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        const candidate = Number((typed ?? '') + event.key);
        const value = candidate > maxInput ? Number(event.key) : candidate;
        if (value > maxInput) return;

        // Commit as soon as the value cannot be extended into something still
        // legal. Same instinct as the legacy `value < 9` guard on the doubles
        // and trebles rounds, but derived from the round's own ceiling.
        if (value === 0 || value * 10 > maxInput) {
          enter(value);
        } else {
          setTyped(String(value));
        }
        return;
      }

      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          enter(typed !== null ? Number(typed) : draft);
          break;
        case 'Backspace':
          event.preventDefault();
          if (typed !== null) setTyped(typed.length > 1 ? typed.slice(0, -1) : null);
          else if (draft > 0) clearDraft();
          else clearCell();
          break;
        case 'ArrowRight':
        case 'Tab':
          event.preventDefault();
          setTyped(null);
          moveBy(event.shiftKey ? -1 : 1);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          setTyped(null);
          moveBy(-1);
          break;
        case 'ArrowDown':
          event.preventDefault();
          setTyped(null);
          moveBy(players.length);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setTyped(null);
          moveBy(-players.length);
          break;
        case 'y':
        case 'Y':
          if (kind === 'binary') { event.preventDefault(); enter(1); }
          break;
        case 'n':
        case 'N':
          if (kind === 'binary') { event.preventDefault(); enter(0); }
          break;
        case '?':
          setShowHelp((open) => !open);
          break;
        case 'Escape':
          if (showHelp) setShowHelp(false);
          else navigate('/');
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    round, finished, typed, draft, players.length, showHelp,
    enter, undo, clearCell, clearDraft, moveBy, navigate,
  ]);

  if (!hasGameInProgress(game)) return <Navigate to="/play/setup" replace />;
  if (!round || !player) return <Navigate to="/play/setup" replace />;

  const playerIndex = players.findIndex((p) => p.id === player.id);
  const shownDraft = typed !== null ? Number(typed) : draft;

  return (
    <div className="flex min-h-[calc(100dvh-3.75rem)] flex-col">
      <Board
        players={players}
        inputs={inputs}
        activeRoundIndex={round.index}
        activePlayerIndex={playerIndex}
        averages={averages}
        showTrend
        onPick={(r, p) => { setTyped(null); moveTo(r, p); }}
      />

      <div className="flex flex-col gap-4 px-6 pt-6 lg:flex-row md:px-8">
        <TurnCard playerName={player.name} round={round.round} total={total} />
        <EntryPad
          round={round.round}
          playerName={player.name}
          draft={shownDraft}
          onCommit={enter}
          onAddFace={addToDraft}
          onClearDraft={() => { setTyped(null); clearDraft(); }}
          onCommitDraft={() => enter(shownDraft)}
          onUndo={() => { setTyped(null); undo(); }}
          canUndo={game.past.length > 0}
        />
      </div>

      <div className="flex flex-wrap items-center gap-5 px-6 py-6 md:px-8">
        {[
          ['0-9', 'enter and advance'],
          ['↵', 'commit'],
          ['⌫', 'clear'],
          ['← →', 'move'],
          ['↑ ↓', 'change round'],
          ['⌘Z', 'undo'],
          ['esc', 'pause'],
        ].map(([key, what]) => (
          <div key={key} className="flex items-center gap-2">
            <kbd className="dsp min-w-7 rounded border border-line border-b-2 px-1.5 py-0.5 text-center text-xs font-semibold text-ink-2">
              {key}
            </kbd>
            <span className="text-xs text-ink-3">{what}</span>
          </div>
        ))}
        <div className="grow" />
        <Button variant="ghost" onClick={toggleMute}>{muted ? 'Sound off' : 'Sound on'}</Button>
        <Button variant="ghost" onClick={() => navigate('/')}>Pause</Button>
      </div>

      {showHelp ? (
        <div
          onClick={() => setShowHelp(false)}
          className="fixed inset-0 z-50 grid place-items-center bg-ground/85 p-6"
        >
          <div className="flex max-w-md flex-col gap-4 rounded-xl border border-line bg-surface p-6">
            <Label>Keyboard</Label>
            <p className="text-sm leading-relaxed text-ink-2">
              Type a digit and it commits and advances. On the doubles and trebles
              rounds a single digit that could still grow — 1 through 6 — waits for
              a second one, so 25 means twenty-five, not two then five.
            </p>
            <p className="text-sm leading-relaxed text-ink-2">
              The numeric keypad works. It never did in the old app.
            </p>
            <Button onClick={() => setShowHelp(false)}>Close</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { ROUNDS };
