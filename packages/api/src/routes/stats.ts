import { Router } from 'express';
import { headToHead, leaderboard, playerProfile, records, roundMatrix } from '@dartix/core';
import { gamesInRange } from '../db.js';
import { badRequest, dateParam, intParam, notFound, sendError } from '../http.js';
import type { Request } from 'express';

export const statsRouter = Router();

/**
 * The minimum games a player needs before appearing in aggregate views.
 *
 * Ten by default. Of the 38 players in the real database, 17 have fewer than
 * five games, and without a floor the leaderboard is topped by whoever played
 * once and got lucky. Pass `minGames=1` to see everyone.
 */
const DEFAULT_MIN_GAMES = 10;

async function scoped(req: Request) {
  const from = dateParam(req, 'from');
  const to = dateParam(req, 'to');
  return gamesInRange({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
}

statsRouter.get('/leaderboard', async (req, res) => {
  try {
    const games = await scoped(req);
    res.json({
      minGames: intParam(req, 'minGames', DEFAULT_MIN_GAMES),
      rows: leaderboard(games, { minGames: intParam(req, 'minGames', DEFAULT_MIN_GAMES) }),
    });
  } catch (err) {
    sendError(res, err);
  }
});

statsRouter.get('/round-matrix', async (req, res) => {
  try {
    res.json(roundMatrix(await scoped(req), {
      minGames: intParam(req, 'minGames', DEFAULT_MIN_GAMES),
    }));
  } catch (err) {
    sendError(res, err);
  }
});

statsRouter.get('/records', async (req, res) => {
  try {
    res.json(records(await scoped(req), {
      top: intParam(req, 'top', 10),
      minGames: intParam(req, 'minGames', DEFAULT_MIN_GAMES),
    }));
  } catch (err) {
    sendError(res, err);
  }
});

statsRouter.get('/player/:id', async (req, res) => {
  try {
    const profile = playerProfile(await scoped(req), req.params.id, {
      rollingWindow: intParam(req, 'window', 5),
    });
    if (!profile) throw notFound('That player has no games in this range.');
    res.json(profile);
  } catch (err) {
    sendError(res, err);
  }
});

statsRouter.get('/head-to-head', async (req, res) => {
  try {
    const ids = String(req.query['ids'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length !== 2) {
      throw badRequest('invalid_ids', 'Pass exactly two player ids: ?ids=a,b');
    }
    const result = headToHead(await scoped(req), ids[0]!, ids[1]!);
    if (!result) throw notFound('Those two have never played the same game.');
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});
