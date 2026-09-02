import { NavLink, Outlet } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Label } from './ui';

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
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => client.clear(),
  });

  return (
    <div className="min-h-dvh bg-ground">
      <header className="flex h-15 items-center gap-8 border-b border-line-soft px-6 md:px-8">
        <NavLink to="/" className="dsp text-[22px] font-bold tracking-tight">
          DARTI<span className="text-accent">X</span>
        </NavLink>

        <nav className="flex gap-1">
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

        <button
          onClick={() => logout.mutate()}
          className="label transition-colors hover:text-ink-2"
        >
          Sign out
        </button>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="px-6 py-8 md:px-8">
        <Label>DartiX — Half-it, since 2011</Label>
      </footer>
    </div>
  );
}
