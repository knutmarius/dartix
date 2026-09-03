import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { useRange } from '../../lib/useRange';
import { Card, Empty, ErrorNote, Label, Loading, formatDate } from '../../components/ui';

/**
 * How many record holders a row spells out before trimming.
 *
 * The 41 is held by everyone who has ever made it — seventeen players — which
 * ran to two wrapped lines. The count below the names carries what is hidden,
 * and the full list is on the element's title.
 */
const MAX_HOLDERS = 8;

export function RecordsPage() {
  const range = useRange();
  const records = useQuery({
    queryKey: ['records', ...range.cacheKey],
    queryFn: () => api.records({ ...range.query, top: 10 }),
  });

  if (records.isPending) return <Loading what="Digging through the record books" />;
  if (records.isError) return <ErrorNote error={records.error} retry={() => void records.refetch()} />;

  const r = records.data;
  if (r.topGames.length === 0) return <Empty>Nothing in this range yet.</Empty>;

  const best = r.topGames[0]!;
  /* One entry per person, most recent first. */
  const zeroClub = [...new Set(r.zeroGames.map((z) => z.playerName))];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-5 xl:flex-row">
        <div className="flex w-full shrink-0 flex-col gap-5 xl:w-[440px]">
          <Card accent className="flex flex-col gap-4">
            <Label className="text-accent!">Highest game</Label>
            <div className="flex items-end gap-5">
              <span className="hero text-7xl leading-[0.85] font-bold text-accent">{best.total}</span>
              <div className="flex flex-col gap-0.5 pb-1.5">
                <span className="dsp text-3xl leading-none font-bold">{best.playerName}</span>
                <span className="text-[13px] text-ink-2">{formatDate(best.when, 'long')}</span>
              </div>
            </div>
          </Card>

          {r.biggestHalving ? (
            <Card className="flex flex-wrap items-center gap-5 border-danger/38! bg-danger/9!">
              <div className="flex flex-col gap-1">
                <Label className="text-danger!">Biggest halving</Label>
                <span className="hero text-5xl leading-none font-bold text-danger">
                  –{r.biggestHalving.lost}
                </span>
              </div>
              <div className="h-13 w-px bg-danger/30" />
              <div className="flex flex-col gap-0.5">
                <span className="dsp text-xl font-semibold">
                  {r.biggestHalving.playerName}, on the {r.biggestHalving.round}
                </span>
                <span className="text-xs text-ink-2">
                  {r.biggestHalving.from} down to {r.biggestHalving.to} · {formatDate(r.biggestHalving.when)}
                </span>
              </div>
            </Card>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Award
              label="Longest winning streak"
              value={r.longestWinStreak?.streak ?? '—'}
              who={r.longestWinStreak?.playerName}
              note="games in a row"
            />
            <Award
              label="Bull king"
              value={r.bullKing ? `${r.bullKing.hitRate}%` : '—'}
              who={r.bullKing?.playerName}
              note="of games score on the bull"
              tone="accent"
            />
            <Award
              label="Most halved"
              value={r.mostHalved?.perGame ?? '—'}
              who={r.mostHalved?.playerName}
              note="blanks per game, of twelve"
              tone="danger"
            />
            {r.biggestComeback ? (
              <Award
                label="Comeback"
                value={`${r.biggestComeback.fromPosition} → ${r.biggestComeback.toPosition}`}
                who={r.biggestComeback.playerName}
                note={`of ${r.biggestComeback.fieldSize}, after the 41`}
                tone="good"
              />
            ) : null}
          </div>

          {/*
            * Deliberately shown even when empty — "nobody has ever managed
            * it" is the interesting fact most nights, and a card that only
            * appeared once someone finally did it would give no sense of how
            * hard it is.
            *
            * Names only, deduplicated: doing it twice does not make you twice
            * a member, and the date of a nought is not the interesting part.
            */}
          <Card className={`flex flex-col gap-3 ${zeroClub.length > 0 ? 'border-danger/38! bg-danger/9!' : ''}`}>
            <div className="flex items-center">
              <Label className={zeroClub.length > 0 ? 'text-danger!' : ''}>
                We&rsquo;re off to Mexico..
              </Label>
              <div className="grow" />
              <span className="text-xs text-ink-3">Finished on nothing</span>
            </div>

            {zeroClub.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-ink-2">
                <span className="dsp text-lg font-semibold text-ink">Nobody. Yet.</span>{' '}
                Halving rounds up, so one point in the 13s is still a point twelve
                rounds later — a total of nought means scoring in no round at all.
              </p>
            ) : (
              <div className="flex items-baseline gap-4">
                <span className="hero shrink-0 text-5xl leading-none font-bold text-danger">0</span>
                <span className="dsp text-xl leading-snug font-semibold">
                  {zeroClub.join(', ')}
                </span>
              </div>
            )}
          </Card>
        </div>

        <Card className="flex grow flex-col gap-0">
          <div className="mb-3">
            <Label>Top ten games</Label>
          </div>
          {r.topGames.map((game, index) => (
            <div
              key={`${game.gameId}-${game.playerId}`}
              className="flex items-center gap-3 border-b border-line-soft py-2.5 last:border-0"
            >
              <span className={`dsp w-5 shrink-0 text-sm font-bold ${index === 0 ? 'text-accent' : 'text-ink-3'}`}>
                {index + 1}
              </span>
              {/* Name over date rather than beside it. One player holds eight of
                  the top ten here, and a date column alongside squeezed every
                  row down to "Knut M...". */}
              <div className="flex min-w-0 grow flex-col">
                <span className="dsp truncate text-lg leading-tight font-semibold">
                  {game.playerName}
                </span>
                <Label className="text-[10px]! whitespace-nowrap">{formatDate(game.when)}</Label>
              </div>
              <span className={`dsp num shrink-0 text-right text-2xl font-bold ${index === 0 ? 'text-accent' : ''}`}>
                {game.total}
              </span>
            </div>
          ))}
        </Card>

        <Card className="flex grow flex-col gap-0">
          <div className="mb-3 flex items-center">
            <Label>Best in each round</Label>
            <div className="grow" />
            <span className="text-xs text-ink-3">Single round, all time</span>
          </div>
          {/* Left in playing order — 13 first, the bull last. Sorting by score
              just reproduces the multipliers, and it makes the row you are
              looking for move around between date ranges. */}
          {r.bestRounds
            .map((round) => {
              const names = round.holders.map((h) => h.playerName);
              const shown = names.slice(0, MAX_HOLDERS);
              const clipped = names.length > MAX_HOLDERS;
              return (
                <div
                  key={round.key}
                  className="flex items-start gap-3 border-b border-line-soft py-2.5 last:border-0"
                >
                  <span className="dsp w-7 shrink-0 pt-0.5 text-[17px] font-bold text-accent">
                    {round.key}
                  </span>
                  <div className="flex min-w-0 grow flex-col gap-0.5">
                    {/* Records are shared far more often than not, so every
                        holder is named rather than one picked arbitrarily —
                        trimmed to keep a row readable, with the full list on
                        hover and the count always spelled out below. */}
                    <span
                      className="text-[15px] leading-snug font-semibold text-ink/85"
                      title={clipped ? names.join(', ') : undefined}
                    >
                      {clipped ? `${shown.join(', ')}, …` : shown.join(', ')}
                    </span>
                    {round.shared ? (
                      <Label className="text-[10px]!">
                        all or nothing — all {names.length} who have made it
                      </Label>
                    ) : names.length > 1 ? (
                      <Label className="text-[10px]!">
                        {names.length} share it · first {formatDate(round.when)}
                      </Label>
                    ) : (
                      <Label className="text-[10px]!">{formatDate(round.when)}</Label>
                    )}
                  </div>
                  <span className="dsp num shrink-0 pt-0.5 text-xl font-bold">{round.points}</span>
                </div>
              );
            })}
        </Card>
      </div>
    </div>
  );
}

function Award({
  label, value, who, note, tone = 'default',
}: {
  label: string;
  value: string | number;
  who?: string;
  note: string;
  tone?: 'default' | 'accent' | 'danger' | 'good';
}) {
  const colour = {
    default: '', accent: 'text-accent', danger: 'text-danger', good: 'text-good',
  }[tone];
  return (
    <Card className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className={`hero text-4xl leading-none font-bold ${colour}`}>{value}</span>
        {who ? <span className="dsp text-xl font-semibold">{who}</span> : null}
      </div>
      <span className="text-xs text-ink-3">{note}</span>
    </Card>
  );
}
