import type { Round } from '@dartix/core';

/**
 * A schematic dartboard with the segments that count lit up.
 *
 * Not a picture of a dartboard — no red/green beds, no wire, no numbers you
 * have to squint at. It answers exactly one question, at a glance, from across
 * the room: *where am I throwing?* Everything not in play stays grey.
 *
 * Half-it is the one game where that question changes every round and the
 * answer is not always a single number: the doubles round wants the whole
 * outer band, and the 41 is really a question about which segments *don't*
 * overshoot.
 */

/** Clockwise from the top, as on every regulation board. */
const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

/** Centre of a 220-unit square viewBox, leaving room for the number ring. */
const C = 110;

/*
 * Regulation radii in mm — bull 6.35, outer bull 15.9, treble 99–107,
 * double 162–170 — scaled by 95/170 so the double ring lands at 95.
 */
const R = {
  bull: 3.6,
  outerBull: 8.9,
  trebleIn: 55.3,
  trebleOut: 59.8,
  doubleIn: 90.5,
  doubleOut: 95,
};
const LABEL_R = 103.5;

type Ring = 'inner' | 'treble' | 'outer' | 'double';

const RINGS: { ring: Ring; r1: number; r2: number }[] = [
  { ring: 'inner', r1: R.outerBull, r2: R.trebleIn },
  { ring: 'treble', r1: R.trebleIn, r2: R.trebleOut },
  { ring: 'outer', r1: R.trebleOut, r2: R.doubleIn },
  { ring: 'double', r1: R.doubleIn, r2: R.doubleOut },
];

/** What one dart in this ring is worth on a board — not in Half-it points. */
const FACE: Record<Ring, number> = { inner: 1, treble: 3, outer: 1, double: 2 };

/**
 * How brightly each band of a lit wedge burns.
 *
 * The grading is the scoring rule, not decoration: on a number round every
 * part of the wedge counts, but the treble counts three times, so it takes the
 * full accent and the plain beds are dimmed.
 */
const WEDGE: Record<Ring, number> = { treble: 1, double: 0.84, inner: 0.62, outer: 0.62 };

/**
 * Unlit fills, alternating by sector so the board still reads as a board.
 *
 * Tokens rather than literals: on a light surface the same two-step
 * alternation has to run the other way, or the whole board is a black disc on
 * white paper.
 */
const DARK = {
  bed: ['var(--color-board-bed-a)', 'var(--color-board-bed-b)'],
  ring: ['var(--color-board-ring-a)', 'var(--color-board-ring-b)'],
};

/** What to light, worked out once per render. */
interface Plan {
  weight: (sector: number, ring: Ring) => number;
  bull: (inner: boolean) => number;
  /** Only the 41 has segments that ruin the round on the first dart. */
  busts: (sector: number, ring: Ring) => boolean;
  /** Sector numbers whose label is worth printing large. */
  named: Set<number>;
  /** The bull is 4% of the radius, so on its own round it needs a target ring. */
  bullTarget: boolean;
}

const NOTHING: Plan = {
  weight: () => 0, bull: () => 0, busts: () => false, named: new Set(), bullTarget: false,
};

function planFor(round: Round): Plan {

  switch (round.kind) {
    case 'count': {
      const n = Number(round.key);
      return { ...NOTHING, weight: (s, r) => (s === n ? WEDGE[r] : 0), named: new Set([n]) };
    }
    case 'sum': {
      const band: Ring = round.key === 'D' ? 'double' : 'treble';
      return { ...NOTHING, weight: (_s, r) => (r === band ? 1 : 0) };
    }
    // The 41 is three darts to exactly 41, so what matters is which segments
    // keep you alive. Anything worth more than 41 on its own busts you before
    // the second dart: T14 through T20, and the bullseye. Those get painted in
    // the halving colour; the survivors are a wash rather than a glow, because
    // almost the whole board survives and a bright disc says nothing.
    case 'binary':
      return {
        ...NOTHING,
        weight: (s, r) => (s * FACE[r] <= 41 ? 0.13 : 0),
        bull: (inner) => (inner ? 0 : 0.13),
        busts: (s, r) => s * FACE[r] > 41,
      };
    case 'bull':
      return { ...NOTHING, bull: (inner) => (inner ? 1 : 0.72), bullTarget: true };
  }
}

/** Which band a hit lands in, on the two rounds where we know the faces. */
function hitBand(round: Round): Ring | null {
  if (round.kind !== 'sum') return null;
  return round.key === 'D' ? 'double' : 'treble';
}

function polar(r: number, deg: number): string {
  const t = (deg * Math.PI) / 180;
  return `${(C + r * Math.cos(t)).toFixed(2)} ${(C + r * Math.sin(t)).toFixed(2)}`;
}

/** One annular sector, wound outer-arc clockwise then inner-arc back. */
function segPath(r1: number, r2: number, a1: number, a2: number): string {
  return (
    `M${polar(r2, a1)}A${r2} ${r2} 0 0 1 ${polar(r2, a2)}` +
    `L${polar(r1, a2)}A${r1} ${r1} 0 0 0 ${polar(r1, a1)}Z`
  );
}

export interface DartboardProps {
  round: Round;
  /**
   * Faces already hit this turn, on the doubles and trebles rounds. Marked in
   * green over the lit band, so the pad's running sum has a picture.
   */
  hits?: readonly number[];
  /**
   * Which sector numbers to print. Below roughly 170px the full ring is
   * illegible — 8 units of a 220 viewBox is under 6 real pixels — so a small
   * board keeps only the numbers that matter and drops the rest.
   */
  labels?: 'all' | 'active';
  /** The lit segments breathe. */
  pulse?: boolean;
  className?: string;
}

export function Dartboard({
  round, hits, labels = 'all', pulse = true, className = '',
}: DartboardProps) {
  const plan = planFor(round);
  const band = hitBand(round);
  const hit = new Set(band ? (hits ?? []) : []);

  return (
    <svg
      viewBox="0 0 220 220"
      role="img"
      aria-label={describe(round, hit)}
      className={`h-full w-full ${className}`}
    >
      {/* Every segment, unlit. Two passes rather than one so the accent sits
          over the grey and blends against it instead of replacing it. */}
      {SECTORS.map((sector, i) => {
        const mid = -90 + i * 18;
        return RINGS.map(({ ring, r1, r2 }) => (
          <path
            key={`${sector}-${ring}`}
            d={segPath(r1, r2, mid - 9, mid + 9)}
            fill={(ring === 'treble' || ring === 'double' ? DARK.ring : DARK.bed)[i % 2]}
            stroke="var(--color-ground)"
            strokeWidth="0.5"
          />
        ));
      })}

      {/* Bull, before the lit layer so its edge is never cut by a sector. */}
      <circle cx={C} cy={C} r={R.outerBull} fill={DARK.ring[0]} stroke="var(--color-ground)" strokeWidth="0.5" />
      <circle cx={C} cy={C} r={R.bull} fill={DARK.bed[1]} stroke="var(--color-ground)" strokeWidth="0.5" />

      {/*
        * Everything in play, in one group.
        *
        * The pulse animates the group's opacity rather than each segment's
        * own, which keeps the grading above intact and costs one animated
        * property instead of eighty.
        *
        * Every segment stays mounted even at zero opacity, so a change of
        * round is a CSS transition on `fill-opacity` rather than a swap of
        * elements — the accent cross-dissolves from one target to the next
        * instead of snapping. It cross-dissolves cleanly precisely because
        * the grey beneath is opaque and identical in both rounds.
        */}
      <g className={`dartboard-lit ${pulse ? 'dartboard-pulse' : ''}`}>
        {SECTORS.map((sector, i) => {
          const mid = -90 + i * 18;
          return RINGS.map(({ ring, r1, r2 }) => {
            const busts = plan.busts(sector, ring);
            return (
              <path
                key={`lit-${sector}-${ring}`}
                d={segPath(r1, r2, mid - 9, mid + 9)}
                fill={busts ? 'var(--color-danger)' : 'var(--color-accent)'}
                fillOpacity={busts ? 0.66 : plan.weight(sector, ring)}
                // Ground-coloured, and identical to the seam the base layer
                // already draws, so an unlit segment's stroke is invisible.
                stroke="var(--color-ground)"
                strokeWidth="0.5"
              />
            );
          });
        })}

        <circle cx={C} cy={C} r={R.outerBull} fill="var(--color-accent)" fillOpacity={plan.bull(false)} />
        <circle
          cx={C}
          cy={C}
          r={R.bull}
          fill={round.kind === 'binary' ? 'var(--color-danger)' : 'var(--color-accent)'}
          fillOpacity={round.kind === 'binary' ? 0.66 : plan.bull(true)}
        />
        <circle
          cx={C}
          cy={C}
          r={R.outerBull + 6}
          fill="none"
          stroke="var(--color-accent)"
          strokeOpacity={plan.bullTarget ? 0.55 : 0}
          strokeWidth="1.4"
        />
      </g>

      {/*
        * What you have already hit.
        *
        * The band itself is only 4.5 of 95 units wide, which at phone sizes is
        * a two-pixel arc, so the whole wedge takes a green tint behind it —
        * the sector is what you are being told, the band is where the dart
        * went. Outside the pulse: a hit is a fact, not a target, and should
        * sit still while the rest breathes.
        */}
      {band
        ? SECTORS.map((sector, i) => {
            if (!hit.has(sector)) return null;
            const mid = -90 + i * 18;
            return (
              <g key={`hit-${sector}`}>
                {RINGS.map(({ ring, r1, r2 }) => (
                  <path
                    key={ring}
                    d={segPath(r1, r2, mid - 9, mid + 9)}
                    fill="var(--color-good)"
                    fillOpacity={ring === band ? 0.92 : 0.18}
                    stroke="var(--color-ground)"
                    strokeWidth="0.5"
                  />
                ))}
              </g>
            );
          })
        : null}

      <circle cx={C} cy={C} r={R.doubleOut} fill="none" stroke="var(--color-line)" strokeWidth="1" />

      {/* The number ring, so a lit wedge is identifiable and not just a
          direction. Only the ones that matter are legible; the rest are
          orientation. */}
      <g className="dartboard-lit">
      {SECTORS.map((sector, i) => {
        const mid = -90 + i * 18;
        const t = (mid * Math.PI) / 180;
        const on = plan.named.has(sector);
        const scored = hit.has(sector);
        if (labels === 'active' && !on && !scored) return null;
        return (
          <text
            key={`n-${sector}`}
            x={C + LABEL_R * Math.cos(t)}
            y={C + LABEL_R * Math.sin(t)}
            textAnchor="middle"
            dominantBaseline="central"
            className="dsp"
            fontSize={on || scored ? 12 : 8}
            fontWeight={on || scored ? 700 : 600}
            fill={scored ? 'var(--color-good)' : on ? 'var(--color-accent)' : 'var(--color-ink-4)'}
          >
            {sector}
          </text>
        );
      })}
      </g>
    </svg>
  );
}

/** The alt text, and the caption the desktop card prints beside the board. */
export function describe(round: Round, hit: ReadonlySet<number> = new Set()): string {
  const scored = hit.size > 0 ? `, with ${[...hit].join(' and ')} already hit` : '';
  switch (round.kind) {
    case 'count':
      return `Dartboard with the ${round.label} wedge lit — treble counts three, double two`;
    case 'sum':
      return round.key === 'D'
        ? `Dartboard with the whole double ring lit${scored}`
        : `Dartboard with the whole treble ring lit${scored}`;
    case 'binary':
      return 'Dartboard with every segment worth 41 or less lit, and the eight that overshoot on one dart — T14 to T20 and the bullseye — marked in red';
    case 'bull':
      return 'Dartboard with both bull rings lit — outer counts one, bullseye two';
  }
}
