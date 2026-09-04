/**
 * Chart colours.
 *
 * Kept strictly apart from the interface palette. Amber, red and green in the
 * chrome are STATUS colours — active turn, leader, halving, beat-your-average —
 * and never identify a player. These do.
 *
 * These are the dataviz reference slots stepped for a dark surface, minus blue
 * — the interface accent owns blue, and every chrome blue tested sat within
 * OKLab ΔE 14 of the reference series blue, under the 15 normal-vision floor.
 *
 * Validated as a set against #181a20: every slot inside the L 0.48–0.67 band,
 * worst adjacent colour-vision-deficiency ΔE 8.4, worst adjacent normal-vision
 * ΔE 19.3, all above 3:1 contrast. Assign in order and never cycle — an eighth
 * player folds into grey rather than getting an invented hue. Real games reach
 * seven, so seven slots is exactly enough.
 *
 * Re-validated for light mode against #fcfcfb. Six of the seven passed
 * unchanged; the yellow came in at 2.99:1, a hair under the 3:1 a categorical
 * fill needs, so light mode darkens that one slot to #b37a00 and the set
 * passes every check on both surfaces. That swap lives in `index.css`, which
 * is why these are variables rather than literals now — the hex values are
 * recorded in the comments beside each slot as the record of what was
 * measured.
 *
 * One caveat: these clear the *adjacent* pairlist, which is what lines, radars
 * and bars use. Orange and yellow fail the all-pairs gate against each other
 * (ΔE 4.8 deutan), so do not reach for this palette for a scatter or a set of
 * small multiples without re-validating.
 */
export const SERIES = [
  'var(--color-series-1)', // orange  #d95926
  'var(--color-series-2)', // aqua    #199e70
  'var(--color-series-3)', // yellow  #c98500 dark / #b37a00 light
  'var(--color-series-4)', // magenta #d55181
  'var(--color-series-5)', // green   #008300
  'var(--color-series-6)', // violet  #9085e9
  'var(--color-series-7)', // red     #e66767
] as const;

export const SERIES_OVERFLOW = 'var(--color-series-more)';

/** Colour follows the entity, never its rank — filtering must not repaint. */
export function seriesColour(index: number): string {
  return SERIES[index] ?? SERIES_OVERFLOW;
}

/**
 * A single-hue blue ramp for magnitude, low to high.
 *
 * Left as literals in both themes: these are heatmap *fills*, so what matters
 * is that the lightness is monotonic and that each step carries legible ink —
 * both true against either surface. Only the surface behind an empty cell
 * changes, and the palest step is still plainly blue against white.
 */
export const SEQUENTIAL = ['#104281', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4'] as const;

/** Ink that stays legible on each step of the ramp above, in either theme. */
export const SEQUENTIAL_INK = ['#f3f4f6', '#f3f4f6', '#f3f4f6', '#101114', '#101114'] as const;

export function rampIndex(share: number): number {
  const clamped = Math.min(0.999, Math.max(0, share));
  return Math.floor(clamped * SEQUENTIAL.length);
}

/*
 * Chart furniture, as variables so the graphs follow the theme.
 *
 * SVG presentation attributes are parsed as CSS values, so `stroke="var(--x)"`
 * resolves — which is how the dartboard has been drawing itself all along.
 */
export const CHART = {
  grid: 'var(--color-grid)',
  axis: 'var(--color-axis)',
  muted: 'var(--color-ink-2)',
  surface: 'var(--color-surface)',
  ground: 'var(--color-ground)',
  line: 'var(--color-line)',
} as const;
