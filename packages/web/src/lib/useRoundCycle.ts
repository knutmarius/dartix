import { useEffect, useState } from 'react';
import { ROUNDS } from '@dartix/core';

/** How long each round holds before the board moves on. */
const DWELL = 2000;

/**
 * Walks the twelve rounds in order, for the landing page.
 *
 * Lives in a hook rather than inside the board so the page can point more
 * than one thing at the same index — the board and the strip of rounds below
 * it move together, which is what makes the strip legible as the game's
 * running order rather than a static list.
 *
 * Picking a round by hand stops the cycle: someone reading a specific round
 * does not want it taken away from them three seconds later.
 */
export function useRoundCycle() {
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % ROUNDS.length), DWELL);
    return () => clearInterval(timer);
  }, [running]);

  return {
    index,
    round: ROUNDS[index]!,
    pick: (next: number) => { setRunning(false); setIndex(next); },
  };
}
