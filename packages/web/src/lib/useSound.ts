import { useCallback, useRef } from 'react';

/**
 * One-shot sound effects, gated on the game's mute setting.
 *
 * The element is created lazily on first play rather than on mount, so nothing
 * is fetched for a sound that never fires.
 */
function useSoundEffect(src: string, muted: boolean) {
  const audio = useRef<HTMLAudioElement | null>(null);

  return useCallback(() => {
    if (muted) return;
    audio.current ??= new Audio(src);
    audio.current.currentTime = 0;
    // Autoplay policies reject this until the page has been interacted with,
    // and the browser gives no useful way to ask in advance. A silent failure
    // is the right outcome — a missing sound must never break the scoreboard.
    void audio.current.play().catch(() => {});
  }, [src, muted]);
}

/**
 * The trombone from the original, carried over.
 *
 * `Content/Sounds/fail-trombone.mp3`, played when a halving costs more than
 * 150 points — the same threshold as `GamePresenter.js:186`. Mutable, which it
 * was not before.
 */
export function useFailSound(muted: boolean) {
  return useSoundEffect('/sounds/fail-trombone.mp3', muted);
}

/** Applause, for the winner on the summary screen. */
export function useApplause(muted: boolean) {
  return useSoundEffect('/sounds/applause.mp3', muted);
}
