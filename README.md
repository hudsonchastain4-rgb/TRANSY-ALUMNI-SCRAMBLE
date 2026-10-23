# Transy Alumni Scramble — Lakeside Golf Course

18-hole cumulative scramble stroke play. Ten independent foursome scorecards: five Black and five Crimson (Crimson Group 5 has three players). All group scores count; lower combined score to par wins.

The homepage displays each team’s five group cards and indicative win probability. Scores are protected with the scorekeeper PIN.

## Existing Render database
On startup, the application automatically splits an existing 5-paired-group setup into 10 separate scorecards only if **no scores** are present. It preserves existing assigned players and starting holes. If scores already exist, it makes no database changes: take an admin backup then perform a deliberate admin factory reset to create the new structure. This deletes test scores, lineups and bets. Do not reset if you need to preserve recorded results.

Persistent SQLite: `DB_PATH=/var/data/bbh.db` with disk mounted at `/var/data`.

Render: root empty; `npm install` build; `npm start` run.
