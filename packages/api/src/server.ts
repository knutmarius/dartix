import { assertServerEnv, env, scrub } from './env.js';
import { closeDb, ensureIndexes, getDb } from './db.js';
import { createApp } from './app.js';

async function main(): Promise<void> {
  assertServerEnv();

  await getDb();
  const indexes = await ensureIndexes();
  console.log(`[api] indexes ready: ${indexes.join(', ')}`);

  const server = createApp().listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port}`);
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      console.log(`\n[api] ${signal}, shutting down`);
      server.close(() => {
        void closeDb().then(() => process.exit(0));
      });
    });
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[api] failed to start: ${scrub(message)}`);
  process.exit(1);
});
