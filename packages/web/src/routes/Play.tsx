import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ROUNDS, halve, walk } from '@dartix/core';
import {
  activePlayer, activeRound, hasGameInProgress, isFinished, useGame,
} from '../store/game';
import { useHistoricalAverages } from '../lib/useHistoricalAverages';
import { useFailSound } from '../lib/useSound';
import { Board } from '../components/Board';
import { MobileBoard } from '../components/MobileBoard';
import { EntryPad } from '../components/EntryPad';
import { TurnCard } from '../components/TurnCard';
import { RosterSheet } from '../components/RosterSheet';
import { Button, Label } from '../components/ui';

/** A halving worth more than this plays the trombone, as it always has. */
const TROMBONE_THRESHOLD = 150;

export function Play() {
  const navigate = useNavigate();
  const game = useGame();
  const {
    players, inputs, draft, draftFaces, muted, reviewing,
    commit, undo, clearCell, moveBy, moveTo, addToDraft, clearDraft, toggleMute, endReview,
  } = game;

  const [typed, setTyped] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showRoster, setShowRoster] = useState(false);

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
    if (finished && !reviewing) navigate('/play/summary', { replace: true });
  }, [finished, reviewing, navigate]);

  const done = useCallback(() => {
    endReview();
    navigate('/play/summary', { replace: true });
  }, [endReview, navigate]);

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
  /* A typed total overrides the tapped faces, and we cannot know which faces
     it stood for, so the board marks nothing rather than something stale. */
  const shownHits = typed !== null ? [] : draftFaces;

  const jumpTo = (r: number, p: number) => { setTyped(null); moveTo(r, p); };

  return (
    <div
      className="flex h-[calc(100dvh-3.75rem)] flex-col overflow-hidden
                 md:h-auto md:min-h-[calc(100dvh-3.75rem)] md:overflow-visible"
    >
      {/*
        * Two boards, switched by CSS rather than by measuring the viewport.
        * A media query has no hydration flicker and follows a rotation or a
        * resized window for free. Both derive their totals from the same
        * `walk`, so they cannot disagree about the score.
        */}
      <div className="flex min-h-0 grow flex-col md:hidden">
        <MobileBoard
          players={players}
          inputs={inputs}
          activeRoundIndex={round.index}
          activePlayerIndex={playerIndex}
          hits={shownHits}
          onPick={jumpTo}
          onRoster={() => setShowRoster(true)}
        />
      </div>

      <div className="hidden md:block">
        <Board
          players={players}
          inputs={inputs}
          activeRoundIndex={round.index}
          activePlayerIndex={playerIndex}
          averages={averages}
          showTrend
          onPick={jumpTo}
        />
      </div>

      {/*
        * On a phone this is the bottom of a fixed-height shell, so the pad is
        * always in the thumb zone — it was previously a thousand pixels down
        * the page. A sticky pad would have worked too, but it overlays the
        * list it sits above, hiding the last player.
        *
        * The turn card is redundant here: the mobile board already carries the
        * player, the total and the stakes. It returns from lg up.
        */}
      <div
        className="flex shrink-0 flex-col gap-4 border-t border-line-soft bg-ground
                   px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]
                   md:border-0 md:px-8 md:pt-6 md:pb-0 lg:flex-row"
      >
        <div className="hidden lg:block">
          <TurnCard
            playerName={player.name}
            round={round.round}
            total={total}
            hits={shownHits}
          />
        </div>
        <EntryPad
          round={round.round}
          playerName={player.name}
          draft={shownDraft}
          hits={shownHits}
          onCommit={enter}
          onAddFace={addToDraft}
          onClearDraft={() => { setTyped(null); clearDraft(); }}
          onCommitDraft={() => enter(shownDraft)}
          onUndo={() => { setTyped(null); undo(); }}
          canUndo={game.past.length > 0}
        />
      </div>

      {/* Keyboard shortcuts are noise on a device without a keyboard. */}
      <div className="hidden flex-wrap items-center gap-5 px-6 py-6 md:flex md:px-8">
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
        {reviewing ? (
          <Button variant="primary" onClick={done}>Back to summary</Button>
        ) : null}
        <Button variant="ghost" onClick={() => setShowRoster(true)}>
          Players ({players.length})
        </Button>
        <Button variant="ghost" onClick={toggleMute}>{muted ? 'Sound off' : 'Sound on'}</Button>
        <Button variant="ghost" onClick={() => navigate('/')}>Pause</Button>
      </div>

      {showRoster ? <RosterSheet onClose={() => setShowRoster(false)} /> : null}

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
