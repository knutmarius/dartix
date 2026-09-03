import { Router } from 'express';
import {
  ROUND_KEYS, buildGameDocument, gameHistory, isRoundKey, milestones, pointsByRound,
  totalFor, validateSubmission,
} from '@dartix/core';
import type { GameEntry, RoundInputs } from '@dartix/core';
import { allGames, gamesInRange, games, invalidateGames } from '../db.js';
import { requireWrite } from '../auth.js';
import { badRequest, dateParam, notFound, sendError } from '../http.js';

export const gamesRouter = Router();

gamesRouter.get('/', async (req, res) => {
  try {
    const docs = await gamesInRange({
      ...(dateParam(req, 'from') ? { from: dateParam(req, 'from')! } : {}),
      ...(dateParam(req, 'to') ? { to: dateParam(req, 'to')! } : {}),
    });
    res.json(gameHistory(docs));
  } catch (err) {
    sendError(res, err);
  }
});

/** One game in full, so the history view can expand the whole scoreboard. */
gamesRouter.get('/:id', async (req, res) => {
  try {
    const doc = (await allGames()).find((g) => g._id === req.params.id);
    if (!doc) throw notFound('No such game.');
    res.json({
      id: doc._id,
      playedAt: doc.TimeStamp,
      rounds: ROUND_KEYS,
      results: doc.Results.map((r) => ({
        playerId: r.PlayerId,
        playerName: r.PlayerName,
        total: r.Sum,
        points: ROUND_KEYS.map((key) => {
          const field = `Result${key}` as keyof typeof r;
          return r[field] as number;
        }),
      })),
    });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * Save a finished game.
 *
 * The body is JSON — the old endpoint took a form-encoded `gameJson` string
 * parsed by `JavaScriptSerializer`, and trusted every number in it. Here the
 * client sends only what the players typed; the server derives every score,
 * every total and the standings, and mints the id.
 */
gamesRouter.post('/', requireWrite, async (req, res) => {
  try {
    const entries = parseEntries(req.body);
    const { errors, warnings } = validateSubmission(entries);
    if (errors.length > 0) {
      res.status(400).json({ error: 'invalid_game', message: 'The game is not complete.', errors });
      return;
    }

    const doc = buildGameDocument({ entries });
    await (await games()).insertOne(doc);
    invalidateGames();

    res.status(201).json({
      id: doc._id,
      playedAt: doc.TimeStamp,
      results: doc.Results.map((r) => ({
        playerId: r.PlayerId,
        playerName: r.PlayerName,
        total: r.Sum,
        isWinner: r.IsWinner,
        isLoser: r.IsLoser,
      })),
      warnings,
    });
  } catch (err) {
    sendError(res, err);
  }
});

gamesRouter.delete('/:id', requireWrite, async (req, res) => {
  try {
    const result = await (await games()).deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) throw notFound('No such game.');
    invalidateGames();
    res.json({ deleted: true });
  } catch (err) {
    sendError(res, err);
  }
});

/** Turn a posted body into game entries, rejecting anything malformed. */
/**
 * What a game would mean, measured against everything played before it.
 *
 * A POST because it takes a whole game in the body, but it writes nothing —
 * the summary screen calls it before the save so the room can see who just
 * broke what while everyone is still standing at the board. Deliberately
 * left open to a read-only session for the same reason: it changes nothing,
 * and they should still see what the game they just played was worth.
 *
 * Server-side because the comparison needs the full history, and shipping ten
 * years of documents to the client to compute six sentences would be silly.
 * The games are already cached in-process.
 */
gamesRouter.post('/milestones', async (req, res) => {
  try {
    const entries = parseEntries(req.body);
    const history = await allGames();
    res.json(
      milestones(
        entries.map((entry) => ({
          playerId: entry.playerId,
          playerName: entry.playerName,
          total: totalFor(entry.inputs),
          points: pointsByRound(entry.inputs),
        })),
        history,
        { top: 10 },
      ),
    );
  } catch (err) {
    sendError(res, err);
  }
});

function parseEntries(body: unknown): GameEntry[] {
  const raw = (body as { players?: unknown } | undefined)?.players;
  if (!Array.isArray(raw)) {
    throw badRequest('invalid_body', 'Expected { players: [{ playerId, playerName, inputs }] }.');
  }

  return raw.map((item, index) => {
    const player = item as Record<string, unknown>;
    const playerId = player['playerId'];
    const playerName = player['playerName'];
    const inputs = player['inputs'];

    if (typeof playerId !== 'string' || playerId === '') {
      throw badRequest('invalid_body', `players[${index}].playerId is required.`);
    }
    if (typeof playerName !== 'string' || playerName === '') {
      throw badRequest('invalid_body', `players[${index}].playerName is required.`);
    }
    if (typeof inputs !== 'object' || inputs === null) {
      throw badRequest('invalid_body', `players[${index}].inputs must be an object.`);
    }

    const parsed: RoundInputs = {};
    for (const [key, value] of Object.entries(inputs as Record<string, unknown>)) {
      if (!isRoundKey(key)) {
        throw badRequest('invalid_body', `players[${index}].inputs has unknown round "${key}".`);
      }
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw badRequest('invalid_body', `players[${index}].inputs.${key} must be a whole number.`);
      }
      parsed[key] = value;
    }

    return { playerId, playerName, inputs: parsed };
  });
}
