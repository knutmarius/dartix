import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import { Button, Label, Warning } from './ui';

export function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [passcode, setPasscode] = useState('');
  const login = useMutation({
    mutationFn: () => api.login(passcode),
    onSuccess: onSignedIn,
  });

  return (
    <div className="grid min-h-dvh place-items-center bg-ground p-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (passcode) login.mutate();
        }}
        className="flex w-full max-w-sm flex-col gap-5"
      >
        <div className="flex flex-col gap-2">
          <span className="dsp text-3xl font-bold tracking-tight">
            DARTI<span className="text-accent">X</span>
          </span>
          <p className="text-sm text-ink-2">
            Twelve rounds. Miss one and you lose half.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Passcode</Label>
          <input
            type="password"
            value={passcode}
            autoFocus
            autoComplete="current-password"
            onChange={(event) => setPasscode(event.target.value)}
            className="dsp rounded-lg border border-line bg-surface px-4 py-3 text-xl
                       text-ink outline-none focus:border-accent"
          />
        </div>

        {login.isError ? (
          <div className="flex items-center gap-2.5 text-sm text-danger">
            <Warning />
            {login.error instanceof Error ? login.error.message : 'That did not work.'}
          </div>
        ) : null}

        <Button type="submit" variant="primary" disabled={!passcode || login.isPending}>
          {login.isPending ? 'Checking' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
