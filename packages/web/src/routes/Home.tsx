import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ROUNDS, rankPlayers, totalFor } from '@dartix/core';
import { api } from '../api';
import { useGame, hasGameInProgress, activeRound } from '../store/game';
import { RoundCarousel } from '../components/RoundCarousel';
import { useRoundCycle } from '../lib/useRoundCycle';
import { Arrow, Avatar, Button, Card, Label, Loading, ErrorNote, formatDate, formatTime } from '../components/ui';

export function Home() {
  const navigate = useNavigate();
  const game = useGame();
  const inProgress = hasGameInProgress(game);
  const recent = useQuery({ queryKey: ['games'], queryFn: () => api.games() });
  const cycle = useRoundCycle();

  return (
    <div className="flex flex-col gap-6 p-6 md:flex-row md:p-8">
      {/* start */}
      <section className="flex grow flex-col rounded-2xl border border-line bg-surface p-8 md:p-10">
        <div className="flex flex-col items-stretch gap-8 lg:flex-row lg:items-start lg:gap-10">
          <div className="flex min-w-0 grow flex-col">
            <Label className="text-accent!">Half-it</Label>
            <h1 className="dsp mt-3 text-5xl leading-[0.98] font-bold md:text-6xl">
              Twelve rounds.<br />One blank and<br />you lose half.
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-ink-2">
              Work through the board in order. Score in a round and it adds up; miss it
              entirely and your whole total is halved, rounded up. The 41 is where most
              evenings are decided — it gets blanked more than four times in five.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/play/setup"
                className="flex items-center gap-3 rounded-xl bg-accent px-7 py-4 text-ground transition-colors hover:bg-accent/90"
              >
                <span className="dsp text-xl font-bold">New game</span>
                <Arrow />
              </Link>
              <Link to="/stats" className="dsp rounded-xl border border-line px-5 py-4 text-[17px] font-semibold text-ink-2 transition-colors hover:text-ink">
                Stats
              </Link>
            </div>
          </div>

          {/*
            * The twelve rounds in order, two seconds each.
            *
            * On a phone it drops below the copy and the strip of rounds below
            * goes away instead — the board says the same thing better, and
            * two round indicators on one screen is one too many.
            */}
          <div className="mx-auto w-full max-w-[264px] shrink-0 sm:max-w-[300px] lg:mx-0 lg:w-[250px] lg:max-w-none xl:w-[300px]">
            <RoundCarousel index={cycle.index} onPick={cycle.pick} />
          </div>
        </div>

        <div className="grow" />

        {/* Desktop only: on a phone the carousel above already carries the
            order, and this row is what pays for its space. */}
        <div className="mt-10 hidden lg:block">
          <Label>The order, always the same</Label>
          <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
            {ROUNDS.map((round, index) => {
              const special = round.kind !== 'count';
              const brutal = round.key === '41';
              /* The one the board beside is showing. A filled block rather
                 than a brighter border, so it wins against the D/T/B and 41
                 tints already in play here. */
              const now = index === cycle.index;
              return (
                <button
                  key={round.key}
                  onClick={() => cycle.pick(index)}
                  title={`${round.name} — ×${round.multiplier}`}
                  className={`flex h-14 flex-col items-center justify-center rounded-lg border transition-colors duration-300 ${
                    now
                      ? 'border-accent bg-accent'
                      : brutal
                        ? 'border-danger/50 bg-danger/10'
                        : special
                          ? 'border-accent/45 bg-accent/8'
                          : 'border-line hover:border-ink-3'
                  }`}
                >
                  <span
                    className={`dsp text-lg font-semibold transition-colors duration-300 ${
                      now ? 'text-ground' : brutal ? 'text-danger' : special ? 'text-accent' : ''
                    }`}
                  >
                    {round.label}
                  </span>
                  {special ? (
                    <span
                      className={`text-[9px] font-semibold tracking-wide uppercase transition-colors duration-300 ${
                        now ? 'text-ground/75' : brutal ? 'text-danger' : 'text-accent'
                      }`}
                    >
                      {round.key === 'D' ? 'doubles' : round.key === 'T' ? 'trebles' : round.key === 'B' ? 'bull' : 'exact'}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* right column */}
      <aside className="flex w-full shrink-0 flex-col gap-4 md:w-[420px]">
        {inProgress ? <ResumeCard onResume={() => navigate('/play')} /> : null}

        <Card className="flex grow flex-col gap-1">
          <div className="mb-2 flex items-center">
            <Label>Recent games</Label>
            <div className="grow" />
            <Link to="/stats/history" className="label text-accent! transition-opacity hover:opacity-80">
              All history
            </Link>
          </div>

          {recent.isPending ? <Loading what="Reading history" /> : null}
          {recent.isError ? <ErrorNote error={recent.error} retry={() => void recent.refetch()} /> : null}

          {recent.data?.slice(0, 6).map((entry) => (
            <Link
              key={entry.gameId}
              to="/stats/history"
              className="flex items-center gap-3.5 border-b border-line-soft py-3 last:border-0 hover:bg-ink/4"
            >
              <div className="flex w-16 shrink-0 flex-col">
                <span className="dsp text-[15px] font-semibold">{formatDate(entry.when)}</span>
                <span className="label text-[10px]!">{formatTime(entry.when)}</span>
              </div>
              <Avatar name={entry.winner.playerName} size="sm" />
              <div className="flex min-w-0 flex-col">
                <span className="dsp truncate text-[17px] font-semibold">{entry.winner.playerName}</span>
                <span className="label text-[10px]!">
                  {entry.players.length} player{entry.players.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="grow" />
              <span className="dsp text-2xl font-bold">{entry.winner.total}</span>
            </Link>
          ))}
        </Card>
      </aside>
    </div>
  );
}

/**
 * The reason the old app warned you not to close the tab.
 *
 * Game state lived only in the DOM there, so a reload lost the evening. Here it
 * is mirrored to localStorage on every entry and offered back.
 */
function ResumeCard({ onResume }: { onResume: () => void }) {
  const game = useGame();
  const reset = useGame((s) => s.reset);
  const round = activeRound(game);

  const standings = rankPlayers(
    game.players.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      total: totalFor(game.inputs[p.id] ?? {}),
    })),
  );
  const leader = standings[0]?.total ?? 0;

  return (
    <Card accent className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span className="size-2 animate-pulse rounded-full bg-accent" />
        <Label className="text-accent!">Game in progress</Label>
        <div className="grow" />
        {game.startedAt ? <Label>Started {formatTime(new Date(game.startedAt))}</Label> : null}
      </div>

      <div className="flex items-baseline gap-2.5">
        <span className="dsp text-3xl font-bold leading-none">Round {(round?.index ?? 0) + 1}</span>
        <span className="dsp text-[17px] font-semibold text-ink-2">of 12 — {round?.round.name}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {standings.map((standing) => (
          <div key={standing.playerId} className="flex items-center gap-2.5">
            <span className="dsp w-20 shrink-0 truncate text-[17px] font-semibold">{standing.playerName}</span>
            <div className="h-1.5 grow overflow-hidden rounded-full bg-raised">
              <div
                className={`h-full rounded-full ${standing.position === 1 ? 'bg-accent' : 'bg-ink-3'}`}
                style={{ width: `${leader > 0 ? (standing.total / leader) * 100 : 0}%` }}
              />
            </div>
            <span className={`dsp num w-11 text-right text-lg font-bold ${standing.position === 1 ? 'text-accent' : ''}`}>
              {standing.total}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="primary" className="grow" onClick={onResume}>Resume</Button>
        <Button
          onClick={() => {
            if (confirm('Throw this game away?')) reset();
          }}
        >
          Discard
        </Button>
      </div>
    </Card>
  );
}
