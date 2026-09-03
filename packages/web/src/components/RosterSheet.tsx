import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROUNDS, walk } from '@dartix/core';
import { api } from '../api';
import { useGame } from '../store/game';
import { useSession } from '../lib/useSession';
import { Avatar, Button, Label, Loading } from './ui';

/**
 * Add or drop a player without abandoning the game.
 *
 * The old app could not do this at all — the roster was fixed the moment you
 * left the setup screen, so a latecomer meant restarting or sitting out. Both
 * happen often enough in a real evening to be worth the modal.
 */
export function RosterSheet({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const { players, inputs, cursor, addPlayer, removePlayer } = useGame();
  const { canWrite } = useSession();

  const known = useQuery({ queryKey: ['players'], queryFn: api.players });
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  const create = useMutation({
    mutationFn: () => api.addPlayer(name.trim()),
    onSuccess: (made) => {
      void client.invalidateQueries({ queryKey: ['players'] });
      addPlayer({ id: made.id, name: made.name });
      setName('');
      setAdding(false);
    },
  });

  /* Which round a newcomer would be walking in on. */
  const roundIndex = players.length > 0
    ? Math.min(ROUNDS.length - 1, Math.floor(cursor / players.length))
    : 0;
  const missed = roundIndex;

  const inGame = new Set(players.map((p) => p.id));
  const available = useMemo(
    () => (known.data ?? [])
      .filter((p) => !inGame.has(p.id))
      .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [known.data, players.length],
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ground/80 p-0 sm:items-center sm:p-6"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[88dvh] w-full max-w-lg flex-col gap-4 rounded-t-2xl border border-line
                   bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
      >
        <div className="flex items-baseline gap-3">
          <div className="flex flex-col gap-0.5">
            <Label>Mid-game</Label>
            <span className="dsp text-2xl leading-none font-bold">Who&rsquo;s at the board?</span>
          </div>
          <div className="grow" />
          <Button variant="ghost" onClick={onClose}>Done</Button>
        </div>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          {/* in the game */}
          <div className="flex flex-col gap-1.5">
            <Label>Playing</Label>
            {players.map((player) => {
              const total = walk(inputs[player.id] ?? {}).total;
              return (
                <div
                  key={player.id}
                  className="flex items-center gap-3 rounded-lg border border-line-soft bg-ground px-3 py-2.5"
                >
                  <Avatar name={player.name} size="sm" />
                  <span className="dsp truncate text-[17px] font-semibold">{player.name}</span>
                  <div className="grow" />
                  <span className="dsp num text-lg font-bold text-ink-2">{total}</span>
                  <Button
                    variant="ghost"
                    disabled={players.length === 1}
                    onClick={() => {
                      if (confirm(`Take ${player.name} out? Their scores go with them.`)) {
                        removePlayer(player.id);
                      }
                    }}
                    className="text-danger!"
                  >
                    Remove
                  </Button>
                </div>
              );
            })}
            {players.length === 1 ? (
              <span className="text-[11px] text-ink-3">
                Someone has to be throwing — add a player before removing the last one.
              </span>
            ) : null}
          </div>

          {/* joining */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-2">
              <Label>Add</Label>
              <div className="grow" />
              {missed > 0 ? (
                <span className="text-[11px] text-ink-3">
                  {missed} round{missed === 1 ? '' : 's'} to catch up &mdash; they throw those first
                </span>
              ) : null}
            </div>

            {known.isPending ? <Loading what="Reading the player list" /> : null}

            <div className="grid grid-cols-2 gap-1.5">
              {available.slice(0, 12).map((player) => (
                <button
                  key={player.id}
                  onClick={() => addPlayer({ id: player.id, name: player.name })}
                  className="flex items-center gap-2.5 rounded-lg border border-line bg-raised px-3 py-2.5
                             text-left transition-colors hover:border-accent"
                >
                  <Avatar name={player.name} size="sm" tone="muted" />
                  <span className="dsp truncate text-[15px] font-semibold">{player.name}</span>
                </button>
              ))}
            </div>

            {!canWrite ? (
              /* Choosing from the list is local to this game; minting a new
                 player is a write. */
              <span className="mt-1 text-[11px] text-ink-3">
                This passcode cannot create new players.
              </span>
            ) : adding ? (
              <div className="mt-1 flex gap-2">
                <input
                  value={name}
                  autoFocus
                  placeholder="Name"
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && name.trim()) create.mutate();
                    if (event.key === 'Escape') setAdding(false);
                  }}
                  className="dsp grow rounded-lg border border-line bg-ground px-3 py-2.5 text-lg
                             text-ink outline-none placeholder:text-ink-4 focus:border-accent"
                />
                <Button
                  variant="primary"
                  disabled={!name.trim() || create.isPending}
                  onClick={() => create.mutate()}
                >
                  Add
                </Button>
              </div>
            ) : (
              <Button onClick={() => setAdding(true)} className="mt-1">
                Someone new&hellip;
              </Button>
            )}

            {create.isError ? (
              <span className="text-[13px] text-danger">
                {create.error instanceof Error ? create.error.message : 'Could not add that player.'}
              </span>
            ) : null}
          </div>
        </div>

        {/* Undo is a flat index over rounds × players, so it cannot survive a
            roster change. Better to say so than to replay it wrongly. */}
        <span className="text-[11px] leading-relaxed text-ink-3">
          Changing the roster clears the undo history — every score stays.
        </span>
      </div>
    </div>
  );
}
