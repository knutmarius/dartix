import { MongoClient } from 'mongodb';
import type { Collection, Db, Filter } from 'mongodb';
import type { HalfItGameDoc, PlayerDoc } from '@dartix/core';
import { env } from './env.js';

/**
 * One MongoClient for the process.
 *
 * The old app built a `new MongoClient(...)` per request via StructureMap's
 * transient lifecycle (`Bootstrapper.cs`), each with its own connection pool.
 * It survived on a low-traffic hobby app, but Atlas free tier caps connections.
 */
let client: MongoClient | undefined;
let db: Db | undefined;

/** Collection names are the C# class names, per `MongoSession.GetCollection`. */
export const COLLECTIONS = { players: 'Player', games: 'HalfItGame' } as const;

export async function getDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(env.mongoUri, {
    // Fail fast rather than hanging, since free M0 clusters pause when idle.
    serverSelectionTimeoutMS: 8000,
  });
  await client.connect();
  db = client.db(env.mongoDb);
  return db;
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = undefined;
  db = undefined;
  invalidateGames();
}

export async function players(): Promise<Collection<PlayerDoc>> {
  return (await getDb()).collection<PlayerDoc>(COLLECTIONS.players);
}

export async function games(): Promise<Collection<HalfItGameDoc>> {
  return (await getDb()).collection<HalfItGameDoc>(COLLECTIONS.games);
}

/**
 * Indexes the old app never created — every one of its stats endpoints did a
 * full collection scan and filtered in the web process. Idempotent.
 */
export async function ensureIndexes(): Promise<string[]> {
  const g = await games();
  return Promise.all([
    g.createIndex({ TimeStamp: -1 }, { name: 'timestamp_desc' }),
    g.createIndex({ 'Results.PlayerId': 1 }, { name: 'results_playerid' }),
  ]);
}

/* ------------------------------------------------------------------ *
 * Games cache
 *
 * Every statistic is derived from the whole game collection, and the whole
 * collection is small — 546 documents, and all the stats compute from it in
 * under 50ms. So load it once and keep it, rather than re-reading per request
 * the way the old app did. Invalidated on any write.
 * ------------------------------------------------------------------ */

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; docs: HalfItGameDoc[] } | undefined;

export function invalidateGames(): void {
  cache = undefined;
}

export async function allGames(): Promise<HalfItGameDoc[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.docs;
  const docs = await (await games()).find().sort({ TimeStamp: 1 }).toArray();
  cache = { at: Date.now(), docs };
  return docs;
}

export interface DateRange {
  from?: Date;
  to?: Date;
}

/**
 * Games within a date range.
 *
 * `to` is inclusive of the whole day, matching the old endpoint's
 * `to.Value.AddDays(1)` (`HalfItController.cs:113`) so that a range picked in
 * the UI behaves the way a person expects.
 */
export async function gamesInRange(range: DateRange): Promise<HalfItGameDoc[]> {
  const all = await allGames();
  if (!range.from && !range.to) return all;
  const from = range.from?.getTime() ?? -Infinity;
  const to = range.to ? endOfDay(range.to).getTime() : Infinity;
  return all.filter((g) => {
    const at = g.TimeStamp?.getTime?.() ?? 0;
    return at >= from && at <= to;
  });
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export type { Filter };
