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
 * One caveat: these clear the *adjacent* pairlist, which is what lines, radars
 * and bars use. Orange and yellow fail the all-pairs gate against each other
 * (ΔE 4.8 deutan), so do not reach for this palette for a scatter or a set of
 * small multiples without re-validating.
 */
export const SERIES = [
  '#d95926', // orange
  '#199e70', // aqua
  '#c98500', // yellow
  '#d55181', // magenta
  '#008300', // green
  '#9085e9', // violet
  '#e66767', // red
] as const;

export const SERIES_OVERFLOW = '#8d95a2';

/** Colour follows the entity, never its rank — filtering must not repaint. */
export function seriesColour(index: number): string {
  return SERIES[index] ?? SERIES_OVERFLOW;
}

/**
 * A single-hue blue ramp for magnitude, low to high.
 *
 * On a dark surface the low end recedes toward the ground and the high end
 * reads bright, which is the opposite direction from a light-mode ramp.
 */
export const SEQUENTIAL = ['#104281', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4'] as const;

/** Ink that stays legible on each step of the ramp above. */
export const SEQUENTIAL_INK = ['#f3f4f6', '#f3f4f6', '#f3f4f6', '#101114', '#101114'] as const;

export function rampIndex(share: number): number {
  const clamped = Math.min(0.999, Math.max(0, share));
  return Math.floor(clamped * SEQUENTIAL.length);
}

export const CHART = {
  grid: '#262b33',
  axis: '#626a77',
  muted: '#8d95a2',
  surface: '#181a20',
  ground: '#101114',
  line: '#2b3038',
} as const;
