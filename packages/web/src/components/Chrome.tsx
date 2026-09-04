import { NavLink, Outlet } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Label } from './ui';
import { useSession } from '../lib/useSession';
import { useTheme } from '../lib/theme';

/**
 * Two destinations, both real URLs.
 *
 * The old app had four nested levels of imperative show/hide — jQuery UI tabs,
 * a manual pane swap inside Play, an accordion inside Stats, and another pane
 * swap inside that — with no URL state at all, so the browser Back button left
 * the application entirely.
 */
export function Chrome() {
  const client = useQueryClient();
  const { readOnly } = useSession();
  const theme = useTheme();
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => client.clear(),
  });

  return (
    <div className="min-h-dvh bg-ground">
      <header className="flex h-15 items-center gap-2 border-b border-line-soft px-3
                         min-[360px]:gap-4 min-[360px]:px-4 sm:gap-8 sm:px-6 md:px-8">
        <NavLink to="/" className="dsp text-[22px] font-bold tracking-tight">
          DARTI<span className="text-accent">X</span>
        </NavLink>

        <nav className="flex shrink-0 gap-1">
          {[
            { to: '/', label: 'Play', end: true },
            { to: '/stats', label: 'Stats', end: false },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `label rounded-md px-3.5 py-2 transition-colors ${
                  isActive ? 'bg-raised text-ink' : 'hover:text-ink-2'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="grow" />

        {/* Named rather than merely implied by absent buttons — otherwise a
            missing Save reads as a bug. */}
        {readOnly ? (
          <span className="label shrink-0 whitespace-nowrap rounded-md border border-line px-2.5 py-1 text-ink-3">
            View&nbsp;only
          </span>
        ) : null}

        {/*
          * Theme. Follows the device until you touch it, then the choice is
          * remembered — one tap pins the opposite of what you can see, which
          * is never a surprise. Right-click, or a long press on a phone,
          * hands control back to the device.
          */}
        <button
          onClick={theme.toggle}
          onContextMenu={(event) => { event.preventDefault(); theme.follow(); }}
          title={
            theme.choice === 'system'
              ? `Following your device (${theme.resolved}) — tap for ${theme.resolved === 'dark' ? 'light' : 'dark'}`
              : `${theme.choice} — right-click to follow your device again`
          }
          aria-label={`Switch to ${theme.resolved === 'dark' ? 'light' : 'dark'} theme`}
          className="grid size-8 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-raised hover:text-ink"
        >
          {theme.resolved === 'dark' ? (
            /* A sun, offering the light one. */
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" className="size-4" aria-hidden>
              <circle cx="12" cy="12" r="4.2" />
              <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
            </svg>
          ) : (
            /* A moon, offering the dark one. */
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
              <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
            </svg>
          )}
          {theme.choice !== 'system' ? (
            <span className="sr-only">Pinned; right-click to follow the device</span>
          ) : null}
        </button>

        <button
          onClick={() => logout.mutate()}
          className="label shrink-0 whitespace-nowrap transition-colors hover:text-ink-2"
        >
          Sign out
        </button>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="hidden px-6 py-8 md:block md:px-8">
        <Label>DartiX — Half-it, since 2011</Label>
      </footer>
    </div>
  );
}
