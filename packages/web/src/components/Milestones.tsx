import { ROUNDS } from '@dartix/core';
import type { Milestone } from '@dartix/core';
import { Card, Label, theRound } from './ui';

/** Loudest first — a record beaten outranks a personal best. */
const RANK: Record<Milestone['kind'], number> = {
  'round-record': 0,
  'top-game': 1,
  'win-streak': 2,
  'zero-game': 3,
  'personal-best': 4,
  'debut': 5,
  'personal-worst': 6,
};

type Tone = 'accent' | 'good' | 'danger' | 'plain';

interface Line {
  tone: Tone;
  badge: string;
  headline: string;
  detail: string;
}

function lineFor(m: Milestone): Line {
  switch (m.kind) {
    case 'round-record':
      return {
        tone: 'accent',
        badge: 'Board record',
        headline: `${m.playerName} owns ${theRound(ROUNDS.find((r) => r.key === m.round)!.name)}`,
        detail: `${m.points} points in one round — the best anyone has thrown was ${m.previous}.`,
      };
    case 'top-game':
      return {
        tone: 'accent',
        badge: `#${m.position} all time`,
        headline: `${m.playerName} is into the top ${m.of}`,
        detail: `${m.total} puts this game ${ordinal(m.position)} in the record books.`,
      };
    case 'win-streak':
      return {
        tone: 'good',
        badge: 'Win streak',
        headline: `${m.playerName} has won ${m.streak} in a row`,
        detail:
          m.streak > m.previous
            ? `The longest run on this board — the old mark was ${m.previous}.`
            : `That equals the longest run on this board.`,
      };
    case 'personal-best':
      return {
        tone: 'good',
        badge: 'Personal best',
        headline: `${m.playerName}'s best ever`,
        detail: `${m.total}, past a previous best of ${m.previous}.`,
      };
    case 'debut':
      return {
        tone: 'plain',
        badge: 'First game',
        headline: `${m.playerName}'s first time on the board`,
        detail: 'Everything from here is a personal best or a personal worst.',
      };
    case 'zero-game':
      return {
        tone: 'danger',
        badge: 'We’re off to Mexico..',
        headline: `${m.playerName} scored in no round at all`,
        detail:
          m.before === 0
            ? 'Nought. All twelve blanked — the first time it has ever happened.'
            : `Nought. All twelve blanked — the ${ordinal(m.before + 1)} time on record.`,
      };
    case 'personal-worst':
      return {
        tone: 'danger',
        badge: 'Personal worst',
        headline: `${m.playerName} has been better`,
        detail: `${m.total} is a new low — the old one was ${m.previous}.`,
      };
  }
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

const SKIN: Record<Tone, { card: string; badge: string; rule: string }> = {
  accent: { card: 'border-accent/45! bg-accent/9!', badge: 'text-accent!', rule: 'bg-accent/30' },
  good: { card: 'border-good/40! bg-good/8!', badge: 'text-good!', rule: 'bg-good/30' },
  danger: { card: 'border-danger/38! bg-danger/9!', badge: 'text-danger!', rule: 'bg-danger/30' },
  plain: { card: '', badge: '', rule: 'bg-line' },
};

/**
 * What the evening changed, shown before the save.
 *
 * The old app told you the total and nothing else, so the fact that someone
 * had just thrown their best game in two years passed unremarked — you would
 * only find out by going digging in the stats tab, which nobody did.
 */
export function Milestones({ milestones }: { milestones: readonly Milestone[] }) {
  if (milestones.length === 0) return null;

  const ordered = [...milestones].sort((a, b) => RANK[a.kind] - RANK[b.kind]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <Label>Worth noting</Label>
        <div className="h-px grow bg-line-soft" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ordered.map((m) => {
          const line = lineFor(m);
          const skin = SKIN[line.tone];
          return (
            <Card
              key={`${m.kind}-${m.playerId}-${'round' in m ? m.round : ''}`}
              className={`flex flex-col gap-2 ${skin.card}`}
            >
              <Label className={skin.badge}>{line.badge}</Label>
              <span className="dsp text-xl leading-tight font-bold">{line.headline}</span>
              <div className={`h-px ${skin.rule}`} />
              <p className="text-[13px] leading-relaxed text-ink-2">{line.detail}</p>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
