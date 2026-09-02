import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import './index.css';
import { ApiError, api } from './api';
import { Chrome } from './components/Chrome';
import { Login } from './components/Login';
import { Loading } from './components/ui';

import { Home } from './routes/Home';
import { Setup } from './routes/Setup';
import { Play } from './routes/Play';

/*
 * Everything that draws a chart is split out.
 *
 * Recharts is most of the bundle and none of it is needed at the dartboard,
 * which is the one screen that has to come up instantly.
 */
const Summary = lazy(() => import('./routes/Summary').then((m) => ({ default: m.Summary })));
const StatsLayout = lazy(() => import('./routes/stats/StatsLayout').then((m) => ({ default: m.StatsLayout })));
const Leaderboard = lazy(() => import('./routes/stats/Leaderboard').then((m) => ({ default: m.Leaderboard })));
const PlayerPage = lazy(() => import('./routes/stats/PlayerPage').then((m) => ({ default: m.PlayerPage })));
const Compare = lazy(() => import('./routes/stats/Compare').then((m) => ({ default: m.Compare })));
const RecordsPage = lazy(() => import('./routes/stats/RecordsPage').then((m) => ({ default: m.RecordsPage })));
const History = lazy(() => import('./routes/stats/History').then((m) => ({ default: m.History })));

const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // A 401 means the session lapsed; retrying cannot fix it.
      retry: (count, error) => !(error instanceof ApiError && error.status === 401) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});

function Gate() {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ['session'],
    queryFn: api.session,
    staleTime: Infinity,
    retry: false,
  });

  if (session.isPending) return <Loading what="Starting up" />;

  if (!session.data?.authenticated) {
    return <Login onSignedIn={() => void queryClient.invalidateQueries()} />;
  }

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Chrome />}>
          <Route index element={<Home />} />
          <Route path="play/setup" element={<Setup />} />
          <Route path="play" element={<Play />} />
          <Route path="play/summary" element={<Summary />} />
          <Route path="stats" element={<StatsLayout />}>
            <Route index element={<Leaderboard />} />
            <Route path="player/:id" element={<PlayerPage />} />
            <Route path="compare" element={<Compare />} />
            <Route path="records" element={<RecordsPage />} />
            <Route path="history" element={<History />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
