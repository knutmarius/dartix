import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { PlayerSummary } from '../api';
import { useGame } from '../store/game';
import {
  Arrow, Avatar, Button, Card, Empty, ErrorNote, Label, Loading, formatDate,
} from '../components/ui';

function shuffle<T>(list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function Setup() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const start = useGame((s) => s.start);

  const players = useQuery({ queryKey: ['players'], queryFn: api.players });
  const [selected, setSelected] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const add = useMutation({
    mutationFn: () => api.addPlayer(name.trim()),
    onSuccess: (created) => {
      void client.invalidateQueries({ queryKey: ['players'] });
      setSelected((prev) => [...prev, created.id]);
      setOrder((prev) => [...prev, created.id]);
      setName('');
      setAdding(false);
    },
  });

  const byId = useMemo(
    () => new Map((players.data ?? []).map((p) => [p.id, p])),
    [players.data],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      setOrder(shuffle(next));
      return next;
    });
  }

  const throwingOrder = order.filter((id) => selected.includes(id));

  function begin() {
    const chosen = throwingOrder
      .map((id) => byId.get(id))
      .filter((p): p is PlayerSummary => Boolean(p))
      .map((p) => ({ id: p.id, name: p.name }));
    if (chosen.length === 0) return;
    start(chosen);
    navigate('/play');
  }

  /* Regulars first — the old list was alphabetical, which buried them. */
  const sorted = useMemo(
    () => [...(players.data ?? [])].sort((a, b) => b.games - a.games || a.name.localeCompare(b.name)),
    [players.data],
  );

  return (
    <div className="flex flex-col gap-6 p-6 md:flex-row md:p-8">
      <section className="flex grow flex-col gap-5">
        <div className="flex items-end gap-4">
          <div className="flex flex-col gap-1">
            <Label>New game</Label>
            <h1 className="dsp text-4xl leading-none font-bold">Who&rsquo;s throwing?</h1>
          </div>
          <div className="grow" />
          <span className="text-[13px] text-ink-3">Tap to pick. Any number of players.</span>
        </div>

        {players.isPending ? <Loading what="Reading the player list" /> : null}
        {players.isError ? <ErrorNote error={players.error} retry={() => void players.refetch()} /> : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((player) => {
            const on = selected.includes(player.id);
            return (
              <button
                key={player.id}
                onClick={() => toggle(player.id)}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                  on ? 'border-accent bg-accent/10' : 'border-line bg-surface hover:border-ink-3'
                }`}
              >
                <Avatar name={player.name} tone={on ? 'active' : 'muted'} />
                <div className="flex min-w-0 flex-col">
                  <span className="dsp truncate text-[19px] leading-tight font-semibold">{player.name}</span>
                  <span className="label text-[10px]!">
                    {player.games === 0
                      ? 'no games yet'
                      : `${player.games} games · avg ${player.average}`}
                  </span>
                </div>
                <div className="grow" />
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-full ${
                    on ? 'bg-accent text-ground' : 'border border-line'
                  }`}
                >
                  {on ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2"
                      strokeLinecap="round" className="size-3">
                      <path d="M4 12.5 9.5 18 20 6.5" />
                    </svg>
                  ) : null}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-3 rounded-xl border border-dashed border-ink-4 p-4 text-left transition-colors hover:border-ink-3"
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-dashed border-ink-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"
                strokeLinecap="round" className="size-4 text-ink-2">
                <path d="M12 5v14" /><path d="M5 12h14" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="dsp text-[19px] font-semibold text-ink-2">Add player</span>
              <span className="label text-[10px]!">Right here, no detour</span>
            </div>
          </button>
        </div>

        {/* Adding someone used to mean leaving for the Config tab, saving, then
            coming back and re-picking everybody. */}
        {adding ? (
          <Card accent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex grow flex-col gap-2">
              <Label className="text-accent!">New player</Label>
              <input
                value={name}
                autoFocus
                placeholder="Name"
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && name.trim()) add.mutate();
                  if (event.key === 'Escape') setAdding(false);
                }}
                className="dsp rounded-lg border border-line bg-ground px-4 py-3 text-xl
                           text-ink outline-none placeholder:text-ink-4 focus:border-accent"
              />
              {add.isError ? (
                <span className="text-[13px] text-danger">
                  {add.error instanceof Error ? add.error.message : 'Could not add that player.'}
                </span>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { setAdding(false); setName(''); }}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!name.trim() || add.isPending}
                onClick={() => add.mutate()}
              >
                Save &amp; select
              </Button>
            </div>
          </Card>
        ) : null}
      </section>

      {/*
        * Capped to the viewport and stuck in place.
        *
        * With 38 players on the books a long selection used to push the Start
        * button below the fold — the one control you always need. The order
        * list scrolls inside the card instead, so the count and the button
        * stay put.
        */}
      <aside className="flex w-full shrink-0 flex-col md:sticky md:top-8 md:max-h-[calc(100dvh-8rem)] md:w-[400px]">
        <Card className="flex min-h-0 grow flex-col gap-4">
          <div className="flex items-center">
            <Label>Throwing order</Label>
            <div className="grow" />
            <Button variant="ghost" onClick={() => setOrder(shuffle(selected))} className="px-0!">
              Reshuffle
            </Button>
          </div>

          <p className="text-[13px] leading-relaxed text-ink-2">
            Randomised, and shown because in turn mode it decides who actually
            throws first.
          </p>

          {throwingOrder.length === 0 ? (
            <Empty>Pick at least one player.</Empty>
          ) : (
            <div className="-mr-1 flex min-h-0 grow flex-col gap-2 overflow-y-auto pr-1">
              {throwingOrder.map((id, index) => {
                const player = byId.get(id);
                if (!player) return null;
                return (
                  <div key={id} className="flex items-center gap-3 rounded-lg border border-line-soft bg-ground px-3.5 py-3">
                    <span className="dsp w-4 text-[15px] font-bold text-accent">{index + 1}</span>
                    <Avatar name={player.name} size="sm" />
                    <span className="dsp truncate text-[19px] font-semibold">{player.name}</span>
                    <div className="grow" />
                    {index === 0 ? <Label className="text-[10px]!">throws first</Label> : null}
                    {player.lastPlayed ? (
                      <Label className="text-[10px]!">{index === 0 ? '' : formatDate(player.lastPlayed)}</Label>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex shrink-0 items-baseline gap-2.5 border-t border-line-soft pt-4">
            <span className="hero text-3xl leading-none font-bold text-accent">{selected.length}</span>
            <Label>{selected.length === 1 ? 'player' : 'players'} selected</Label>
          </div>

          <button
            onClick={begin}
            disabled={selected.length === 0}
            className={`flex shrink-0 items-center justify-center gap-3 rounded-xl py-4 transition-colors ${
              selected.length === 0
                ? 'cursor-not-allowed border border-line text-ink-3'
                : 'bg-accent text-ground hover:bg-accent/90'
            }`}
          >
            <span className="dsp text-xl font-bold">Start game</span>
            <Arrow />
          </button>
        </Card>
      </aside>
    </div>
  );
}
