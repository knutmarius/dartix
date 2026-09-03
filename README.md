# DartiX

A scoreboard for **Half-it**, the dart game. Rewrite of a 2011 ASP.NET app,
reading and writing the same MongoDB collections so a decade of history carries
over intact.

## The game

Twelve rounds, always in this order:

```
13  14  D  15  16  T  17  18  41  19  20  B
```

Score in a round and it adds to your total. **Blank a round and your whole
total is halved, rounded up.** That is the entire game, and it happens a lot —
across 546 real games the average player blanks 5.9 of the twelve rounds, and a
clean sheet has happened seven times in 2,135 results.

| Round | Points | What you enter |
|---|---|---|
| 13, 14, 15–20 | `input × round` | segments hit — a treble counts three, a double two (0–9) |
| `D` | `input × 2` | sum of the face values you hit as doubles (0–60) |
| `T` | `input × 3` | sum of the face values you hit as trebles (0–60) |
| `41` | `input × 41` | 1 if three darts totalled exactly 41, else 0 |
| `B` | `input × 25` | bull units — outer bull 1, bullseye 2 (0–6) |

Highest total after twelve rounds wins. Ties share a position.

## Layout

```
packages/core    the rules and the statistics. Pure functions, no dependencies.
packages/api     Express over the existing Mongo collections.
packages/web     React + Vite scoreboard and stats.
design/          .dc.html artboards for the Claude Design canvas.
```

`packages/core` is the single source of truth for scoring. Both the API and the
browser import it, so a total can never be computed two different ways.

## Running it

Copy `packages/api/.env.example` to `packages/api/.env` and fill it in. The
server refuses to start if `MONGODB_URI`, `APP_PASSCODE` or `SESSION_SECRET` is
missing, or still holds its example value.

```bash
npm install
npm start        # build everything, serve on http://localhost:3000
npm run dev      # hot reload: web on :5173, api on :3000
npm test         # 132 rules and stats tests, no database needed
npm run verify   # read-only audit of the live database (see below)
```

`npm start` runs a single process: the API serves the built SPA from its own
origin, which is why there is no CORS configuration anywhere.

## Two passcodes

`APP_PASSCODE` gives full access. `APP_PASSCODE_READONLY` is optional: set it
and that passcode can see and do everything *except* write — no saving a game,
no deleting one, no adding or removing players. Leave it unset and the role
does not exist. The server refuses to start if the two are equal, since the
full check wins and the read-only role would silently never apply.

The role is carried inside the signed session cookie, and the boundary is
`requireWrite` in the API. The web app also hides the buttons, but that is
courtesy: a read-only session with devtools open still has to come through the
middleware. It is not a boundary against people you distrust — read-only still
exposes every game and every name, and both passcodes reach the same database.

## `npm run verify`

A read-only pass over the live database that answers three questions:

1. Do the stored documents still have the field names `core` expects?
2. **The golden check** — does every stored `Sum` reproduce when replayed
   through the current rules? This validates the round order and the halving.
3. Do the multipliers divide cleanly, and are the implied inputs reachable by
   three darts? This is what actually validates the multipliers — the `Sum`
   replay cannot, because it divides by the multiplier and multiplies back.

Run it after any change to the scoring. A decade of real games is a far better
test of the halving than anything you could invent.

## Database compatibility

The old C# models carry no `[BsonIgnoreExtraElements]`, and the MongoDB C#
driver throws on unknown document elements by default. So while the old app is
still running:

> **Do not add fields to the `Player` or `HalfItGame` collections.** New data
> goes in a new collection the old app never reads.

`packages/core/src/mongo.test.ts` asserts the exact key set of every document —
3 fields on a game, 18 on each result. That test is the compatibility guard; a
stray extra field breaks the old reader and a unit test catches it long before
a deploy does.

Other shape notes: `_id` is a string GUID, never an ObjectId. Round fields hold
computed *points*, not raw input. `PlayerName` is denormalised into every
result, so renaming a player does not rewrite history. `TimeStamp` is UTC; the
`Date` field on each result is a `M.D.YY` string the 2011 browser wrote, kept
for backward compatibility and never read.

## Colour

The interface accent, red and green are **status** colours — active turn,
leader, halving, beat-your-average. They never identify a player. The chart
`SERIES` palette does that, and the two sets are deliberately disjoint: blue
was removed from the series palette when the accent became blue, because every
workable chrome blue sat within OKLab ΔE 14 of the series blue, under the
readability floor. See `packages/web/src/lib/palette.ts`.

## Secrets

Nothing secret is in this repo. `packages/api/.env` is gitignored; only
`.env.example` with placeholders is committed. In Azure the same values live
as App Settings.

The original ASP.NET app is **not** in this repo. It is kept locally as
reference but carries a live Atlas admin connection string, the old HTTP Basic
password and a working Azure Web Deploy password in its publish profile. Where
its behaviour mattered, the comments in `packages/core` cite it by `file:line`.

## Deploying

GitHub Actions builds and deploys to Azure App Service on every push to `main`.
See `.github/workflows/deploy.yml`. The environment values are App Settings on
the web app, not repository secrets — CI has no reason to hold the database
password.
