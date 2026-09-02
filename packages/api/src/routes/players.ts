import { Router } from 'express';
import { buildPlayerDocument, leaderboard } from '@dartix/core';
import { allGames, invalidateGames, players } from '../db.js';
import { badRequest, notFound, sendError, stringField } from '../http.js';

export const playersRouter = Router();

/**
 * Every player, with enough context to pick a side.
 *
 * The old `Player/List` returned only `{Id, Name, Gender}`, so the setup screen
 * had no idea who actually plays. Games and average come along so the picker
 * can put the regulars first.
 */
playersRouter.get('/', async (_req, res) => {
  try {
    const [docs, board] = await Promise.all([
      (await players()).find().sort({ Name: 1 }).toArray(),
      allGames().then((games) => leaderboard(games)),
    ]);
    const stats = new Map(board.map((row) => [row.playerId, row]));

    res.json(
      docs.map((doc) => {
        const row = stats.get(doc._id);
        return {
          id: doc._id,
          name: doc.Name,
          games: row?.games ?? 0,
          average: row?.average ?? null,
          lastPlayed: row?.lastPlayed ?? null,
        };
      }),
    );
  } catch (err) {
    sendError(res, err);
  }
});

playersRouter.post('/', async (req, res) => {
  try {
    const name = stringField(req, 'name', 40);
    const collection = await players();

    // The old endpoint was a mutating GET with unencoded query params and no
    // duplicate check, so "Knut" could be added twice and history would split
    // across two ids.
    const clash = await collection.findOne({
      Name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });
    if (clash) {
      throw badRequest('duplicate_player', `${clash.Name} is already on the list.`);
    }

    const doc = buildPlayerDocument(name);
    await collection.insertOne(doc);
    res.status(201).json({ id: doc._id, name: doc.Name, games: 0, average: null, lastPlayed: null });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * Remove a player from the picker.
 *
 * Their results stay in history — names are denormalised into every result, so
 * past games still read correctly. The old app had this same behaviour but the
 * button was dead UI: `#deletePlayers` was `display:none` and the handler was
 * bound to an id that existed nowhere.
 */
playersRouter.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await (await players()).deleteOne({ _id: id });
    if (result.deletedCount === 0) throw notFound('No such player.');
    invalidateGames();
    res.json({ deleted: true, keptInHistory: true });
  } catch (err) {
    sendError(res, err);
  }
});
