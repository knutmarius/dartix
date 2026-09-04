import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Choice = 'system' | 'light' | 'dark';

const KEY = 'dartix.theme';

/** What the device asks for, when there is no override. */
function device(): 'light' | 'dark' {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function stored(): Choice {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    // Private mode, or site data blocked. Follow the device and move on.
    return 'system';
  }
}

interface Theme {
  choice: Choice;
  resolved: 'light' | 'dark';
  toggle: () => void;
  follow: () => void;
}

const Ctx = createContext<Theme | null>(null);

/**
 * Theme, following the device unless told otherwise.
 *
 * The palette lives entirely in CSS variables (see `index.css`), so all this
 * does is set `data-theme` on the root element — or remove it, which hands
 * control back to the `prefers-color-scheme` media query. Nothing here knows a
 * single colour.
 *
 * A provider rather than a bare hook, and mounted above the auth gate: the
 * login screen renders before the app chrome does, and it should already be
 * in your chosen theme. Two independent hook instances would also race to
 * write the attribute from separately-held state.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<Choice>(stored);
  const [systemIs, setSystemIs] = useState<'light' | 'dark'>(device);

  /* Follow the device live, so a scheduled switch at sunset moves the app. */
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!query) return;
    const onChange = () => setSystemIs(device());
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (choice === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', choice);
    try {
      if (choice === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      // The theme still applies for this session; it just will not persist.
    }
  }, [choice]);

  const resolved = choice === 'system' ? systemIs : choice;

  const value = useMemo<Theme>(() => ({
    choice,
    resolved,
    // One tap pins the opposite of what you can currently see, rather than
    // cycling three states — the result is never a surprise.
    toggle: () => setChoice(resolved === 'dark' ? 'light' : 'dark'),
    follow: () => setChoice('system'),
  }), [choice, resolved]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(Ctx);
  if (!theme) throw new Error('useTheme needs a ThemeProvider above it.');
  return theme;
}
