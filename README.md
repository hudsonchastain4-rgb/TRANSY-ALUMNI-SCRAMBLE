# Transy Alumni Scramble — Lakeside Golf Course

2026 tournament rules: Black vs Crimson, five 18-hole scramble groups per side. Each group records one score per side on each hole. The running leaderboard sums (strokes - actual Lakeside par) over all recorded holes in all five groups. Lower combined score at 90 holes per side wins. No match points or early closure.

Official scorecard: https://content.lexingtonky.gov/sites/default/files/2024-10/Lakeside%20GC%20scorecard.pdf

**Render:** Node web service, root directory blank, build `npm install`, start `npm start`. Attach a persistent disk mounted at `/var/data`, set `DB_PATH=/var/data/bbh.db` in Environment. Do not reset the database to deploy code changes. Test scoring with two devices before playing.

# Transy Alumni Scramble

Live tournament tracker for a team match-play golf event. Single Railway service
serving a React SPA + Express API, SQLite storage, Server-Sent Events for live
updates.

> Working on this with Claude? Read [`CLAUDE.md`](CLAUDE.md) first — it maps the
> architecture and shows where to change the tournament format.

## Features

- Live board — match cards with hole-by-hole scorecards, updating instantly on
  every phone via SSE (push, not polling)
- Match-play engine — early closure (`3&2`), dormie, halved matches, optional
  sudden-death overtime, per-match point weights
- Best ball with per-player scoring (4 scores per hole, server takes each side's
  low ball)
- Live moneyline odds per match and for the overall cup, driven by handicaps,
  format, and momentum
- Spectator pick'em — anyone can create a name + code and bet on matches, with a
  P&L leaderboard
- Per-player records, activity ticker, CSV export, one-file HTML archiving

## Stack

- Backend: Node 20, Express, better-sqlite3
- Frontend: Vite + React 18 + TailwindCSS + React Router
- Real-time: Server-Sent Events
- Hosting: Railway (Nixpacks build, persistent volume for SQLite)

## Local development

### One-process (production-style)
```bash
cd client && npm install && npm run build && cd ..
cd server && npm install && cd ..
PORT=3001 \
DB_PATH=$(pwd)/data/bbh.db \
TOURNAMENT_CODE=TRANSY2026 \
SCOREKEEPER_PIN=2018 \
ADMIN_PIN=2222 \
SESSION_SECRET=dev-secret \
node server/index.js
```
Open http://localhost:3001

### Two-process (with Vite HMR)
Terminal 1 — API:
```bash
cd server && npm install
PORT=3001 DB_PATH=../data/bbh.db TOURNAMENT_CODE=TRANSY2026 SCOREKEEPER_PIN=2018 ADMIN_PIN=2222 SESSION_SECRET=dev-secret npm run dev
```
Terminal 2 — Vite:
```bash
cd client && npm install && npm run dev
```
Open http://localhost:5173 — Vite proxies `/api` to :3001.

## Current tournament config

Transy Baseball Alumni Golf Scramble. Defined in `server/seed.js`.

- **Team Black** (20): Hank, Luke, Rob, Nick Wade, Neal, Max, Kirk, Carl, Blood, TP, Armstrong, Mitcham, Trey Simpson, Clay, Tom, Kam, Arnold, Hootie, Kemper, Tiller
- **Team Crimson** (19): Huddy, Wade, Winj, Rod, Schmidt, Z, Blair, Demi, Taylor, Rex, IT, Jared, Camden, Logan, Luke, Becker, Calvin, Forner, Bryce
- **Schedule**: 5 four-person scramble matches, 18 holes, 1 pt each (first to 3). Match 5 is Black 4 vs Crimson 3 since Crimson has 19 players.
- Handicaps default to 10 for everyone; edit on the Setup page.
- Default tournament code `TRANSY2026` (override with `TOURNAMENT_CODE`).

To re-seed locally, delete `data/bbh.db` and restart.

## Roles

- **Public** — the board, records, picks, and all read APIs. No auth.
- **Scorekeeper** (`SCOREKEEPER_PIN`) — unlocks Setup and Scorekeeper: lineups,
  starting holes, scoring, handicap edits, match reset. Cookie lasts 12 hours.
- **Admin** (`ADMIN_PIN`) — everything above, plus deleting bettors, factory
  reset, and DB backup download.
- **Spectator bettors** — self-serve name + personal code on the Picks tab.

## Pages

| Route | Auth | What it is |
|---|---|---|
| `/join` | — | Landing, optional tournament code |
| `/scoreboard` | public | Points bar, cup odds, activity ticker, all match cards |
| `/setup` | PIN | Handicaps, lineups, starting holes, start/reset matches |
| `/score` | PIN | Hole-by-hole entry, big steppers, undo, edit past holes |
| `/players` | public | Per-player W-L-H records and points |
| `/picks` | public | Spectator betting + leaderboard |
| `/final` | public | Winner banner, full results, CSV export |

## API

| Method | Path | Auth |
|---|---|---|
| GET | `/api/state` | public |
| GET | `/api/sse` | public |
| GET | `/api/export` | public |
| POST | `/api/auth/scorekeeper` | — (sets cookie; accepts scorekeeper or admin PIN) |
| POST | `/api/auth/join` | — (validates tournament code) |
| POST | `/api/auth/logout` | — |
| GET | `/api/auth/me` | — (returns `{ isScorekeeper, isAdmin }`) |
| POST | `/api/match/:id/setup` | PIN |
| POST | `/api/match/:id/start` | PIN |
| POST | `/api/match/:id/reset` | PIN |
| POST | `/api/match/:id/hole` | PIN |
| DELETE | `/api/match/:id/hole/:idx` | PIN |
| PATCH | `/api/player/:id/handicap` | PIN |
| POST | `/api/bet/auth` | — (spectator name + code) |
| POST | `/api/bet` | — (spectator credentials in body) |
| DELETE | `/api/bet` | — (spectator credentials in body) |
| DELETE | `/api/bet/bettor/:id` | ADMIN |
| POST | `/api/admin/factory-reset` | ADMIN |
| GET | `/api/admin/backup` | ADMIN — downloads the SQLite file |

## Deploy to Railway

1. Push this repo to GitHub.
2. Create a Railway project → **Deploy from GitHub repo**. Nixpacks picks up
   `railway.json`; `npm install` triggers `postinstall`, which builds the client
   and installs server deps.
3. **Settings → Volumes** → new volume mounted at `/data`.
4. **Variables**:
   - `DB_PATH=/data/bbh.db`
   - `TOURNAMENT_CODE=<your code>`
   - `SCOREKEEPER_PIN=<captains' PIN>`
   - `ADMIN_PIN=<your PIN>`
   - `SESSION_SECRET=<random string>`
   - `PORT` is set automatically by Railway.
5. **Settings → Networking → Generate Domain**, then deploy.

## Archiving a finished tournament

```bash
# Self-contained HTML snapshot of the live site (needs Chrome locally)
node scripts/export-archive.mjs https://your-app.up.railway.app archive/out.html
```
Or hit `GET /api/admin/backup` while signed in as admin to download the raw
SQLite file — that's the restorable copy.

## Layout

```
bbh-ryder-cup/
├── CLAUDE.md                 architecture + retargeting guide (read this)
├── client/                   Vite + React app
│   └── src/
│       ├── pages/            Join, Scoreboard, Setup, Scorekeeper,
│       │                     Players, Picks, Final, PinGate
│       ├── components/       MatchCard, TeamScore, CupOdds, ActivityTicker,
│       │                     HoleEntry, BestBallHoleEntry, FlagIcon
│       ├── hooks/useSSE.js   SSE client w/ exponential backoff
│       └── lib/              api.js, odds.js, colors.js
├── server/                   Express API
│   ├── index.js              entry — seeds, mounts API, serves client/dist
│   ├── db.js                 better-sqlite3 init, WAL, column migrations
│   ├── schema.sql
│   ├── seed.js               TEAMS + SESSIONS constants, factoryReset
│   ├── lib/                  auth, broadcast, course, matchPlay, odds, state
│   └── routes/               tournament, matches, players, bets, admin, sse
├── scripts/export-archive.mjs
├── railway.json
└── package.json
```
