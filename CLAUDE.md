# BBH Ryder Cup — orientation for Claude

You're picking up a working, deployed golf tournament tracker. It was built for a
specific buddies trip, but it's a solid starting point for any team match-play
event. This file explains the architecture and, more importantly, **where the
knobs are** so you can retarget it quickly.

Read this first, then `README.md` for run/deploy commands.

## What it does

Live scoreboard for a team-vs-team match-play tournament (Ryder Cup style).
Captains score hole-by-hole on their phones; everyone else watches a public
board that updates instantly. Also has live betting-style odds, a spectator
pick'em game, and per-player records.

## Stack + shape

- **One** Express server (`server/`) serves both the JSON API and the built
  React app. No separate frontend host.
- SQLite via `better-sqlite3`, single file at `DB_PATH`. On Railway that's a
  mounted volume so it survives deploys.
- Live updates are **Server-Sent Events**, not polling. Every write handler
  calls `broadcast('state', getFullState())`. The client has one SSE
  subscription in `useSSE.js` and re-renders from whole-state snapshots.
  There is no client-side state management beyond that — it's deliberate.
- Frontend: Vite + React 18 + Tailwind + React Router.

### The one idea that explains most of the code

`getFullState()` in `server/lib/state.js` builds the **entire** app state —
teams, matches, computed match status, odds inputs, bets, activity feed — in one
pass, and that same object is what `/api/state` returns and what SSE pushes.
Nearly every UI question ("what should this card say?") is answered by reading
that object. If you add a field, add it there.

## Retargeting for a different tournament

This is what you'll most likely be asked to do. Almost everything lives in
**`server/seed.js`** — two constants at the top:

- `TEAMS` — team names, colors (hex, used throughout the UI), players, handicaps.
- `SESSIONS` — the schedule. Each match takes:
  - `format`: `'scramble' | 'alt_shot' | 'best_ball' | 'singles'`
  - `team_a_size` / `team_b_size` — players per side
  - `points_weight` — points the match is worth (supports `0.5`, `2`, etc.)
  - `holes_count` — match length (6, 9, 18 all work)
  - `sudden_death` — optional; if `1`, a tied match plays OT holes until decided

Derived automatically from those constants: total points available, the
"N to win" threshold, the number of blocks in the points bar, the scorecard
column counts, and the odds model's hole count. **You should not need to touch
UI code to change the format.**

### Applying a format change to an existing database

`seedIfEmpty()` only runs on a virgin DB, so editing the constants isn't enough
for a DB that already exists. The pattern used here is a **one-shot migration**:

```js
export function migrateToNewFormatIfNeeded() {
  const withDoubleWeight = db
    .prepare('SELECT COUNT(*) AS c FROM match WHERE points_weight = 2')
    .get().c;
  if (withDoubleWeight > 0) return { migrated: false, reason: 'already up to date' };
  factoryReset();
  return { migrated: true };
}
```

It runs on every boot but detects a fingerprint unique to the new schedule, so
it fires exactly once. **When you change the format, change the fingerprint** to
something only the new layout satisfies, or the migration won't run.

`factoryReset()` wipes scoring/bets/rosters and reseeds. It's also exposed as a
PIN-gated admin endpoint and a button on the Setup page, so the owner can reset
without a redeploy.

## Match play rules (server/lib/matchPlay.js)

`computeMatch(holeResults, { suddenDeath, holesCount })` is the scoring engine.
Worth understanding before touching:

- A match **closes early** when a team's lead exceeds the holes remaining
  (result formatted `"3&2"`). This is real match-play behavior, not a bug.
- `DORMIE` = lead exactly equals holes remaining.
- Tied after regulation → `AS` (halved, ½ point each), unless `sudden_death`,
  in which case the match stays open and the first decisive OT hole wins it.
- `pointsFor(computed, weight)` multiplies the result by the match's weight.

**Best ball is special.** Every other format stores one score per team per hole.
Best ball stores each player's score in `hole_player_score` and the server takes
the min per side. The scorekeeper UI swaps in `BestBallHoleEntry` (four steppers)
and the scorecard renders a row per player. If you add another format needing
per-player scores, follow that path.

## Auth model

Deliberately lightweight — it's a friends' golf trip, not a bank.

- **Public**: the board, the state API, the SSE stream. No auth.
- **Scorekeeper PIN** (`SCOREKEEPER_PIN`): signed cookie, gates all scoring and
  lineup writes.
- **Admin PIN** (`ADMIN_PIN`): separate signed cookie for destructive actions
  (delete a bettor, factory reset, download a DB backup). Entering the admin PIN
  also grants scorekeeper.
- **Spectator bettors**: pick a name + their own code, stored plaintext. Stops
  casual impersonation, nothing more. Don't represent it as real auth.

## Odds model

`client/src/lib/odds.js` (mirrored at `server/lib/odds.js` so the server can
snapshot a moneyline when a bet is placed — **keep the two in sync**).

Per-hole win probability comes from format, the effective handicap differential,
and recent momentum; then a DP over the remaining holes produces P(win)/P(halve).
Results are shrunk 40% toward neutral because the raw model overstates leader
confidence in short matches. `computeCupOdds` runs a second DP over the points
differential across all unfinished matches.

It's a toy model tuned to feel right, not a real forecast. Tune the constants
freely.

## Gotchas

- **SQLite `ALTER TABLE` can't take an expression default.** Adding a column
  with `DEFAULT (strftime('%s','now'))` fails on an existing DB. Add the column
  bare, then backfill with an `UPDATE`. See `server/db.js`, which does exactly
  this and is the right place for future column additions.
- **Express 5 rejects the bare `'*'` route.** The SPA fallback uses a regex
  (`app.get(/^(?!\/api).*/)`).
- **Course data is hardcoded** in `server/lib/course.js` (Sweetens Cove, 9 holes,
  par/yardage/handicap). A different course means editing that file. Hole
  rotation math does `% 9` in a couple of places — if the new course isn't 9
  holes, grep for `% 9`.
- Matches loop the course when `holes_count` exceeds the hole count, and OT
  continues the same rotation.

## Archiving a finished tournament

`scripts/export-archive.mjs` renders the live site to a single self-contained
HTML file (headless Chrome, inlined CSS, no JS framework) that opens from
`file://` anywhere. Useful for keeping a permanent record before wiping for the
next event:

```bash
node scripts/export-archive.mjs https://your-app.up.railway.app archive/out.html
```

There's also `GET /api/admin/backup` (admin PIN) which downloads the raw SQLite
file — that's the restorable copy.

## Working style that fits this repo

- Ship small, verify against a real server. `curl` against `/api/state` after a
  change is faster than reasoning about it.
- Wipe and reseed freely during setup (`rm data/bbh.db`); the seed is fast.
- The UI is mobile-first — it's used one-handed on a golf course. Touch targets
  stay large, and the board must stay glanceable at arm's length.
