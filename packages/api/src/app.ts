import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import { ROUNDS } from '@dartix/core';
import { requireAuth } from './auth.js';
import { getDb } from './db.js';
import { scrub } from './env.js';
import { authRouter } from './routes/auth.js';
import { gamesRouter } from './routes/games.js';
import { playersRouter } from './routes/players.js';
import { statsRouter } from './routes/stats.js';

/** Where the built SPA lands. Absent until the web package has been built. */
const WEB_DIST = fileURLToPath(new URL('../../web/dist/', import.meta.url));

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  /** Liveness, and a cheap way to see whether the cluster is reachable. */
  app.get('/api/health', async (_req, res) => {
    try {
      await (await getDb()).command({ ping: 1 });
      res.json({ ok: true, database: 'reachable' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(503).json({ ok: false, database: 'unreachable', message: scrub(message) });
    }
  });

  /**
   * The rules, so the client never hardcodes them a second time.
   *
   * The legacy round list lived in three places at once — a JS array, twelve
   * C# properties and twelve more in an anonymous type — and they had to be
   * kept in step by hand.
   */
  app.get('/api/rules', (_req, res) => {
    res.json({
      rounds: ROUNDS.map((r) => ({
        key: r.key, label: r.label, name: r.name,
        kind: r.kind, multiplier: r.multiplier, maxInput: r.maxInput,
      })),
      halving: 'A round that scores nothing halves the running total, rounded up.',
    });
  });

  app.use('/api/auth', authRouter);

  // Everything else needs the session cookie.
  app.use('/api/players', requireAuth, playersRouter);
  app.use('/api/games', requireAuth, gamesRouter);
  app.use('/api/stats', requireAuth, statsRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found', message: 'No such endpoint.' });
  });

  /*
   * Serve the SPA from the same origin, which is why there is no CORS config
   * anywhere: there is no cross-origin request to allow. The old app had no
   * CORS either, but also no way to add a separate front end.
   */
  if (existsSync(WEB_DIST)) {
    app.use(express.static(WEB_DIST, { index: false, maxAge: '1h' }));
    app.get(/.*/, (_req, res) => {
      res.sendFile('index.html', { root: WEB_DIST });
    });
  } else {
    app.get('/', (_req, res) => {
      res
        .status(200)
        .type('text/plain')
        .send('DartiX API is running. The web app has not been built yet — npm run build -w packages/web');
    });
  }

  return app;
}
