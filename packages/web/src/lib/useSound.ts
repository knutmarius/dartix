import { useCallback, useRef } from 'react';

/**
 * The trombone from the original, carried over.
 *
 * `Content/Sounds/fail-trombone.mp3`, played when a halving costs more than
 * 150 points — the same threshold as `GamePresenter.js:186`. Mutable, which it
 * was not before.
 */
export function useFailSound(muted: boolean) {
  const audio = useRef<HTMLAudioElement | null>(null);

  return useCallback(() => {
    if (muted) return;
    audio.current ??= new Audio('/sounds/fail-trombone.mp3');
    audio.current.currentTime = 0;
    // Autoplay policies can reject this before the first interaction.
    void audio.current.play().catch(() => {});
  }, [muted]);
}
