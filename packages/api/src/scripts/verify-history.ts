/**
 * Read-only verification of the live DartiX database.
 *
 * Run this before the new app writes anything. It answers three questions:
 *
 *   1. Do the stored documents have the field names @dartix/core expects?
 *   2. Does every stored `Sum` reproduce when replayed through the current
 *      rules? This is the golden check — a decade of real games is a far
 *      better test of the halving than anything I could invent.
 *   3. What is actually in there — how many games, over what period, whose?
 *
 * It opens no writes and creates no indexes. Nothing here mutates the cluster.
 *
 *   npm run verify:history -w packages/api
 */

import { config } from 'dotenv';
import { ROUNDS, findSumMismatches } from '@dartix/core';
import type { HalfItGameDoc, PlayerDoc } from '@dartix/core';
import { closeDb, games, players } from '../db.js';

config({ path: new URL('../../.env', import.meta.url) });

const EXPECTED_GAME_FIELDS = ['_id', 'TimeStamp', 'Results'];
const EXPECTED_RESULT_FIELDS = [
  'PlayerId', 'PlayerName', 'Sum', 'IsWinner', 'IsLoser', 'Date',
  ...ROUNDS.map((r) => r.resultField),
];
const EXPECTED_PLAYER_FIELDS = ['_id', 'Name', 'Gender'];

const ok = (s: string) => `  [32m✓[0m ${s}`;
const bad = (s: string) => `  [31m✗[0m ${s}`;
const warn = (s: string) => `  [33m![0m ${s}`;
const head = (s: string) => `\n[1m${s}[0m`;

/** Every field name seen across a sample, so one odd document is not missed. */
function fieldsSeen(docs: readonly Record<string, unknown>[]): Set<string> {
  const set = new Set<string>();
  for (const doc of docs) for (const key of Object.keys(doc)) set.add(key);
  return set;
}

function compareFields(label: string, seen: Set<string>, expected: readonly string[]): boolean {
  const missing = expected.filter((f) => !seen.has(f));
  const extra = [...seen].filter((f) => !expected.includes(f));

  if (missing.length === 0 && extra.length === 0) {
    console.log(ok(`${label}: all ${expected.length} fields present, nothing unexpected`));
    return true;
  }
  if (missing.length) console.log(bad(`${label}: missing ${missing.join(', ')}`));
  if (extra.length) {
    console.log(warn(`${label}: unexpected ${extra.join(', ')}`));
    console.log(`      The old C# models have no [BsonIgnoreExtraElements], so if the`);
    console.log(`      new app writes these back the old app will throw on read.`);
  }
  return missing.length === 0;
}

async function main(): Promise<number> {
  let healthy = true;

  console.log(head('Connecting'));
  const gamesCol = await games();
  const playersCol = await players();
  console.log(ok('connected'));

  /* ---- inventory ---- */
  console.log(head('What is in there'));
  const gameCount = await gamesCol.countDocuments();
  const playerCount = await playersCol.countDocuments();
  console.log(`  ${gameCount} games, ${playerCount} players`);

  if (gameCount === 0) {
    console.log(warn('no games found — is MONGODB_DB pointing at the right database?'));
    return 1;
  }

  const oldest = await gamesCol.find().sort({ TimeStamp: 1 }).limit(1).next();
  const newest = await gamesCol.find().sort({ TimeStamp: -1 }).limit(1).next();
  const fmt = (d: Date | undefined) =>
    d instanceof Date
      ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Europe/Oslo' }).format(d)
      : '(not a date)';
  console.log(`  spanning ${fmt(oldest?.TimeStamp)} to ${fmt(newest?.TimeStamp)}`);

  /* ---- shapes ---- */
  console.log(head('Document shapes'));
  const sampleGames = await gamesCol.find().limit(50).toArray();
  const samplePlayers = await playersCol.find().limit(50).toArray();

  healthy = compareFields(
    'HalfItGame',
    fieldsSeen(sampleGames as unknown as Record<string, unknown>[]),
    EXPECTED_GAME_FIELDS,
  ) && healthy;

  const results = sampleGames.flatMap((g) => g.Results ?? []);
  healthy = compareFields(
    'PlayerResult',
    fieldsSeen(results as unknown as Record<string, unknown>[]),
    EXPECTED_RESULT_FIELDS,
  ) && healthy;

  healthy = compareFields(
    'Player',
    fieldsSeen(samplePlayers as unknown as Record<string, unknown>[]),
    EXPECTED_PLAYER_FIELDS,
  ) && healthy;

  const idTypes = new Set(sampleGames.map((g) => typeof g._id));
  if (idTypes.size === 1 && idTypes.has('string')) {
    console.log(ok('game _id is a string GUID, as core assumes'));
  } else {
    console.log(bad(`game _id is ${[...idTypes].join('/')} — core assumes string`));
    healthy = false;
  }

  const stamps = sampleGames.filter((g) => !(g.TimeStamp instanceof Date));
  if (stamps.length === 0) {
    console.log(ok('TimeStamp is a BSON date everywhere in the sample'));
  } else {
    console.log(bad(`${stamps.length} of ${sampleGames.length} sampled games have a non-date TimeStamp`));
    healthy = false;
  }

  /* ---- the golden check ---- */
  console.log(head('Golden check — replaying every stored game through the current rules'));
  const all = await gamesCol.find().toArray();
  const mismatches = findSumMismatches(all as HalfItGameDoc[]);
  const totalResults = all.reduce((n, g) => n + (g.Results?.length ?? 0), 0);

  if (mismatches.length === 0) {
    console.log(ok(`all ${totalResults} player results reproduce their stored Sum exactly`));
    console.log('      Confirms the round order and the halving rule (ceil, not floor).');
    console.log('      Says nothing about the multipliers — see the next section for those.');
  } else {
    healthy = false;
    const pct = ((mismatches.length / totalResults) * 100).toFixed(1);
    console.log(bad(`${mismatches.length} of ${totalResults} results (${pct}%) do not reproduce`));
    for (const m of mismatches.slice(0, 15)) {
      console.log(`      ${m.playerName.padEnd(10)} stored ${String(m.stored).padStart(4)} · recomputed ${String(m.recomputed).padStart(4)} · game ${m.gameId}`);
    }
    if (mismatches.length > 15) console.log(`      ... and ${mismatches.length - 15} more`);
    console.log('      A handful may be hand-edited or pre-date a rule change.');
    console.log('      A systematic offset means core has a rule wrong — investigate before writing.');
  }

  /* ---- multipliers and input ranges ----
   *
   * The golden check above cannot see the multipliers: it divides stored points
   * by the multiplier to recover the input, then multiplies straight back, so
   * the factor cancels. This section is what actually tests them.
   *
   * If a multiplier is right, every stored value for that round is a whole
   * multiple of it, and the input it implies falls inside what three darts can
   * do. A wrong multiplier shows up immediately as values that do not divide.
   */
  console.log(head('Multipliers and input ranges'));
  const allResults = all.flatMap((g) => g.Results ?? []);
  let rulesSound = true;

  console.log('  round  multiplier   implied input      indivisible  over max');
  for (const round of ROUNDS) {
    const values = allResults.map((r) => r[round.resultField] ?? 0);
    const indivisible = values.filter((v) => v % round.multiplier !== 0);
    const inputs = values.filter((v) => v % round.multiplier === 0).map((v) => v / round.multiplier);
    const over = inputs.filter((i) => i > round.maxInput);
    const lo = Math.min(...inputs);
    const hi = Math.max(...inputs);

    const flag = indivisible.length > 0 ? '  <- multiplier wrong' : over.length > 0 ? '  <- range wrong' : '';
    if (indivisible.length > 0 || over.length > 0) rulesSound = false;

    console.log(
      `  ${round.label.padEnd(6)} x${String(round.multiplier).padEnd(10)}` +
      ` ${String(lo).padStart(2)}..${String(hi).padStart(2)} (max ${String(round.maxInput).padStart(2)})   ` +
      ` ${String(indivisible.length).padStart(9)}  ${String(over.length).padStart(8)}${flag}`,
    );
  }

  const fortyOnes = [...new Set(allResults.map((r) => r.Result41 ?? 0))].sort((a, b) => a - b);
  if (fortyOnes.every((v) => v === 0 || v === 41)) {
    console.log(ok(`the 41 is genuinely all-or-nothing: only ${fortyOnes.join(' and ')} ever stored`));
  } else {
    console.log(bad(`the 41 holds values beyond 0 and 41: ${fortyOnes.join(', ')}`));
    rulesSound = false;
  }

  if (rulesSound) {
    console.log(ok('every multiplier divides cleanly and every implied input is reachable'));
  } else {
    healthy = false;
    console.log(bad('at least one multiplier or input range in core does not match history'));
  }

  /* ---- players referenced but deleted ---- */
  console.log(head('Referential state'));
  const known = new Set((await playersCol.find({}, { projection: { _id: 1 } }).toArray()).map((p) => p._id));
  const referenced = new Set(all.flatMap((g) => (g.Results ?? []).map((r) => r.PlayerId)));
  const orphaned = [...referenced].filter((id) => !known.has(id));
  if (orphaned.length === 0) {
    console.log(ok('every player id in history still exists in the Player collection'));
  } else {
    console.log(warn(`${orphaned.length} player id(s) appear in history but no longer exist`));
    console.log('      Deleting a player never removed their results. Names are');
    console.log('      denormalised into each result, so stats still read fine.');
  }

  console.log(head(healthy ? 'Ready to build on' : 'Needs a look before writing'));
  return healthy ? 0 : 1;
}

main()
  .then(async (code) => {
    await closeDb();
    process.exit(code);
  })
  .catch(async (err: unknown) => {
    // Never print the connection string: it carries the password.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n[31mFailed:[0m ${message.replace(/mongodb\+srv:\/\/[^\s]+/g, '<uri>')}`);
    if (/MONGODB_URI/.test(message)) {
      console.error('Copy packages/api/.env.example to packages/api/.env and fill in MONGODB_URI.');
    } else if (/ServerSelection|ETIMEDOUT|ENOTFOUND/i.test(message)) {
      console.error('Could not reach the cluster. Check that it is not paused, and that');
      console.error('your IP is on the Atlas Network Access list.');
    } else if (/Authentication failed|bad auth/i.test(message)) {
      console.error('Credentials rejected. Check the username, and percent-encode any');
      console.error('symbols in the password (@ -> %40, # -> %23, / -> %2F).');
    }
    await closeDb().catch(() => {});
    process.exit(1);
  });
