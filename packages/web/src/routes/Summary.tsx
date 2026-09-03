import { useEffect, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROUNDS, rankPlayers, walk } from '@dartix/core';
import { api } from '../api';
import { hasGameInProgress, isFinished, useGame } from '../store/game';
import { useCelebration } from '../lib/useCelebration';
import { useSession } from '../lib/useSession';
import { RunChart } from '../components/RunChart';
import { Milestones } from '../components/Milestones';
import { Avatar, Button, Card, ErrorNote, Label, Stat, Warning, theRound } from '../components/ui';

export function Summary() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const game = useGame();
  const reset = useGame((s) => s.reset);
  const review = useGame((s) => s.review);
  const { canWrite } = useSession();
  const { players, inputs } = game;

  const celebrate = useCelebration(game.muted);
  const gameOver = hasGameInProgress(game) && isFinished(game);

  /*
   * Applause and confetti, once the twelve rounds are actually in.
   *
   * Gated on `gameOver` rather than firing on mount, because this route also
   * renders for a moment when someone lands here with an unfinished game
   * before the redirect below takes them back to the board.
   */
  useEffect(() => {
    if (gameOver) return celebrate();
  }, [gameOver, celebrate]);

  const save = useMutation({
    mutationFn: () =>
      api.saveGame(
        players.map((p) => ({ playerId: p.id, playerName: p.name, inputs: inputs[p.id] ?? {} })),
      ),
    onSuccess: () => {
      void client.invalidateQueries();
      reset();
      navigate('/', { replace: true });
    },
  });

  /*
   * What tonight changed, worked out against the whole history.
   *
   * Asked of the server rather than computed here: the comparison needs every
   * game ever played, which the API already holds in a process cache, and it
   * is not worth shipping a decade of documents to the browser to produce six
   * sentences. Nothing is written — the save is still the explicit button.
   */
  const notable = useQuery({
    queryKey: ['milestones', players.map((p) => p.id).join(','), JSON.stringify(inputs)],
    queryFn: () =>
      api.milestones(
        players.map((p) => ({ playerId: p.id, playerName: p.name, inputs: inputs[p.id] ?? {} })),
      ),
    enabled: gameOver,
    staleTime: Infinity,
    retry: false,
  });

  const analysis = useMemo(() => {
    const walks = new Map(players.map((p) => [p.id, walk(inputs[p.id] ?? {})]));
    const standings = rankPlayers(
      players.map((p) => ({ playerId: p.id, playerName: p.name, total: walks.get(p.id)!.total })),
    );

    let worst: { name: string; round: string; from: number; to: number; lost: number } | null = null;
    let blanks = 0;
    for (const player of players) {
      for (const cell of walks.get(player.id)!.cells) {
        if (!cell.halved) continue;
        blanks += 1;
        const lost = cell.before - cell.after;
        if (!worst || lost > worst.lost) {
          worst = {
            name: player.name,
            round: ROUNDS.find((r) => r.key === cell.key)!.name,
            from: cell.before,
            to: cell.after,
            lost,
          };
        }
      }
    }

    const clean = players.filter((p) => !walks.get(p.id)!.cells.some((c) => c.halved));
    const totals = standings.map((s) => s.total);

    return {
      walks, standings, worst, blanks, clean,
      field: Math.round(totals.reduce((a, b) => a + b, 0) / Math.max(1, totals.length)),
      best: Math.max(...totals),
    };
  }, [players, inputs]);

  if (!hasGameInProgress(game)) return <Navigate to="/" replace />;
  if (!isFinished(game)) return <Navigate to="/play" replace />;

  const { standings, worst, blanks, clean, field } = analysis;
  const winner = standings[0]!;

  return (
    <div className="flex flex-col gap-5 p-6 md:p-8">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <Label>All twelve rounds in</Label>
          <h1 className="dsp text-4xl leading-none font-bold">
            {winner.tied ? 'A dead heat' : `${winner.playerName} takes it`}
          </h1>
        </div>
        <div className="grow" />
        <Button onClick={() => { if (confirm('Discard this game without saving?')) { reset(); navigate('/'); } }}>
          Discard
        </Button>
        {/* Nothing is written until Save, so a mistyped round should not cost
            the whole game. Reopens the board sitting on the last entry. */}
        <Button onClick={() => { review(); navigate('/play'); }}>
          Fix a score
        </Button>
        {canWrite ? (
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving' : 'Save game'}
          </Button>
        ) : (
          /* Discard and Fix a score both stay — a view-only session can still
             score a whole game, it just cannot commit it to the database. */
          <span className="text-[13px] text-ink-3">
            This passcode cannot save games.
          </span>
        )}
      </div>

      {save.isError ? <ErrorNote error={save.error} retry={() => save.mutate()} /> : null}

      <Milestones milestones={notable.data ?? []} />

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* standings */}
        <section className="flex w-full shrink-0 flex-col gap-2.5 lg:w-[420px]">
          <Label>Final</Label>
          {standings.map((standing, index) => {
            const state = analysis.walks.get(standing.playerId)!;
            const cleanSheet = !state.cells.some((c) => c.halved);
            const first = standing.position === 1;
            return (
              <div
                key={standing.playerId}
                className={`flex items-center gap-4 rounded-xl p-4 ${
                  first ? 'border border-accent/45 bg-accent/8' : 'border border-line bg-surface'
                }`}
              >
                <span className={`dsp w-4 text-[17px] font-bold ${first ? 'text-accent' : 'text-ink-3'}`}>
                  {standing.position}
                </span>
                <Avatar name={standing.playerName} tone={first ? 'active' : 'muted'} size={first ? 'lg' : 'md'} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  {first ? <Label className="text-accent!">{standing.tied ? 'Tied first' : 'Winner'}</Label> : null}
                  <span className="dsp truncate text-2xl leading-none font-bold">{standing.playerName}</span>
                  <span className={`text-xs ${cleanSheet ? 'text-good' : 'text-ink-3'}`}>
                    {cleanSheet
                      ? 'Clean sheet — no blanks'
                      : `${state.cells.filter((c) => c.halved).length} blank${
                          state.cells.filter((c) => c.halved).length === 1 ? '' : 's'
                        }`}
                  </span>
                </div>
                <div className="grow" />
                <div className="flex flex-col items-end">
                  <span className={`hero text-4xl leading-none font-bold ${first ? 'text-accent' : ''}`}>
                    {standing.total}
                  </span>
                  {index > 0 ? (
                    <Label className="num text-[10px]!">–{standings[0]!.total - standing.total}</Label>
                  ) : null}
                </div>
              </div>
            );
          })}

          {/* Only 7 of 2135 results in the whole database have no blanks. */}
          {clean.length > 0 ? (
            <Card className="flex items-start gap-3 border-good/35! bg-good/8!">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
                strokeLinecap="round" className="mt-0.5 size-4 shrink-0 text-good">
                <path d="M4 12.5 9.5 18 20 6.5" />
              </svg>
              <p className="text-[13px] leading-relaxed text-ink">
                <span className="font-semibold">
                  {clean.map((p) => p.name).join(' and ')} went the whole way without a blank.
                </span>{' '}
                That has happened seven times in the entire history of this board.
              </p>
            </Card>
          ) : null}

          {worst ? (
            <Card className="flex flex-col gap-2 border-danger/38! bg-danger/10!">
              <Label className="text-danger!">Moment of the night</Label>
              <div className="flex items-baseline gap-3">
                <span className="hero text-4xl leading-none font-bold text-danger">–{worst.lost}</span>
                <span className="dsp text-lg font-semibold">{worst.name}, on {theRound(worst.round)}</span>
              </div>
              <p className="text-[13px] leading-relaxed text-ink-2">
                Sitting on {worst.from}, blanked it, and walked away from the board on {worst.to}.
              </p>
            </Card>
          ) : null}
        </section>

        {/* the run of play */}
        <section className="flex grow flex-col gap-4 rounded-xl border border-line bg-surface p-5">
          <div className="flex flex-col gap-0.5">
            <Label>The run of play</Label>
            <span className="dsp text-xl font-semibold">Running total after each round</span>
          </div>
          <RunChart players={players} inputs={inputs} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Halvings" value={blanks} tone={blanks > 0 ? 'danger' : 'good'} />
            <Stat label="Field average" value={field} />
            <Stat label="Winning score" value={standings[0]!.total} tone="accent" />
            <Stat label="Spread" value={standings[0]!.total - standings[standings.length - 1]!.total} />
          </div>
        </section>
      </div>

      <Card className="flex items-start gap-3">
        <Warning className="text-ink-3" />
        <p className="text-[13px] leading-relaxed text-ink-2">
          Saving writes to the same MongoDB collections the old app reads, in the
          same shape, so nothing in your history is orphaned — and the old DartiX
          can still open this game.
        </p>
      </Card>
    </div>
  );
}
