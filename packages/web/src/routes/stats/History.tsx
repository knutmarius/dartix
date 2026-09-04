import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { useRange } from '../../lib/useRange';
import { useSession } from '../../lib/useSession';
import {
  Avatar, Button, Card, Empty, ErrorNote, Label, Loading, formatDate, formatTime,
} from '../../components/ui';

export function History() {
  const range = useRange();
  const client = useQueryClient();
  const { canWrite } = useSession();
  const [open, setOpen] = useState<string | null>(null);

  const games = useQuery({
    queryKey: ['games', ...range.cacheKey],
    queryFn: () => api.games(range.query),
  });

  const remove = useMutation({
    mutationFn: api.deleteGame,
    onSuccess: () => void client.invalidateQueries(),
  });

  if (games.isPending) return <Loading what="Reading history" />;
  if (games.isError) return <ErrorNote error={games.error} retry={() => void games.refetch()} />;
  if (games.data.length === 0) return <Empty>No games in this range.</Empty>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center">
        <Label>{games.data.length} games, newest first</Label>
      </div>

      {games.data.map((game) => (
        <Card key={game.gameId} className="p-0! overflow-hidden">
          <button
            onClick={() => setOpen(open === game.gameId ? null : game.gameId)}
            className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-ink/5"
          >
            <div className="flex w-24 shrink-0 flex-col">
              <span className="dsp text-[15px] font-semibold">{formatDate(game.when)}</span>
              <Label className="text-[10px]!">{formatTime(game.when)}</Label>
            </div>
            <Avatar name={game.winner.playerName} size="sm" tone="active" />
            <div className="flex min-w-0 flex-col">
              <span className="dsp truncate text-lg font-semibold">{game.winner.playerName}</span>
              <Label className="text-[10px]!">
                won on {game.winner.total} · {game.players.length} players
              </Label>
            </div>
            <div className="grow" />
            <div className="hidden items-center gap-2 md:flex">
              {game.players.slice(0, 6).map((player) => (
                <span key={player.playerId} className="dsp num text-sm text-ink-3">
                  {player.total}
                </span>
              ))}
            </div>
            <span className="label text-accent!">{open === game.gameId ? 'Hide' : 'Details'}</span>
          </button>

          {open === game.gameId ? (
            <GameDetail id={game.gameId} canDelete={canWrite} onDelete={() => {
              if (confirm('Delete this game from the database?')) remove.mutate(game.gameId);
            }} deleting={remove.isPending} />
          ) : null}
        </Card>
      ))}
    </div>
  );
}

/**
 * The full scoreboard for one game.
 *
 * The old history table had a Details icon with no handler attached at all —
 * it looked clickable and did nothing.
 */
function GameDetail({
  id, onDelete, deleting, canDelete,
}: { id: string; onDelete: () => void; deleting: boolean; canDelete: boolean }) {
  const detail = useQuery({ queryKey: ['game', id], queryFn: () => api.game(id) });

  if (detail.isPending) return <div className="px-4 pb-4"><Loading what="Opening the scoreboard" /></div>;
  if (detail.isError) return <div className="px-4 pb-4"><ErrorNote error={detail.error} /></div>;

  const { rounds, results } = detail.data;

  return (
    <div className="border-t border-line-soft bg-ground/60 p-4">
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          <div className="flex items-center">
            <div className="w-36 shrink-0" />
            <div className="grid grow grid-cols-12">
              {rounds.map((key) => (
                <Label key={key} className={`dsp text-center ${key === '41' ? 'text-danger!' : ''}`}>
                  {key}
                </Label>
              ))}
            </div>
            <Label className="w-16 shrink-0 text-right">Total</Label>
          </div>

          {[...results]
            .sort((a, b) => b.total - a.total)
            .map((result) => (
              <div key={result.playerId} className="mt-1 flex items-center rounded-md py-1.5 hover:bg-ink/5">
                <span className="dsp w-36 shrink-0 truncate pl-1 text-base font-semibold">
                  {result.playerName}
                </span>
                <div className="grid grow grid-cols-12">
                  {result.points.map((points, index) => (
                    <span
                      key={rounds[index]}
                      className={`dsp num text-center text-base ${
                        points === 0 ? 'font-bold text-danger' : 'font-semibold'
                      }`}
                    >
                      {points}
                    </span>
                  ))}
                </div>
                <span className="dsp num w-16 shrink-0 text-right text-xl font-bold">
                  {result.total}
                </span>
              </div>
            ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs text-ink-3">
          A red zero halved everything above it, rounded up.
        </span>
        <div className="grow" />
        {canDelete ? (
          <Button variant="danger" onClick={onDelete} disabled={deleting}>
            {deleting ? 'Deleting' : 'Delete game'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
