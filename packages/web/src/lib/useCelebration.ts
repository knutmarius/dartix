import { useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { SERIES } from './palette';
import { useApplause } from './useSound';

/** The app's own colours, so the burst reads as designed rather than generic. */
const COLOURS = ['#4dabf7', '#3ed68b', ...SERIES.slice(0, 4)];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Applause and a confetti burst for the end of a game.
 *
 * Fires at most once per mount: the summary re-renders whenever the save
 * mutation changes state, and React's StrictMode double-invokes effects in
 * development, so the guard is doing real work rather than being defensive.
 *
 * Honours `prefers-reduced-motion` by dropping the confetti entirely — a
 * full-screen particle burst is exactly what that setting is asking about. The
 * applause still plays, since it is the mute toggle that governs sound.
 */
export function useCelebration(muted: boolean) {
  const applaud = useApplause(muted);
  const fired = useRef(false);

  return useCallback(() => {
    if (fired.current) return;
    fired.current = true;

    applaud();
    if (prefersReducedMotion()) return;

    const common = {
      colors: COLOURS,
      disableForReducedMotion: true,
      zIndex: 60,
      scalar: 1.1,
    } as const;

    // The explosion: one dense burst from just below centre, thrown wide.
    void confetti({
      ...common,
      particleCount: 140,
      spread: 100,
      startVelocity: 45,
      origin: { x: 0.5, y: 0.58 },
    });

    // Two cannons from the lower corners a beat later, angled inward, which
    // fills the width that a single centre burst leaves empty.
    const cannons = window.setTimeout(() => {
      void confetti({ ...common, particleCount: 60, angle: 60, spread: 65, origin: { x: 0, y: 0.75 } });
      void confetti({ ...common, particleCount: 60, angle: 120, spread: 65, origin: { x: 1, y: 0.75 } });
    }, 220);

    // A last thin drift from the top, so it settles rather than stopping dead.
    const drift = window.setTimeout(() => {
      void confetti({
        ...common,
        particleCount: 50,
        spread: 120,
        startVelocity: 22,
        decay: 0.92,
        gravity: 0.7,
        origin: { x: 0.5, y: 0 },
      });
    }, 520);

    return () => {
      window.clearTimeout(cannons);
      window.clearTimeout(drift);
    };
  }, [applaud]);
}
