import { db } from './db.js';

const TOURNAMENT_CODE = process.env.TOURNAMENT_CODE || 'TRANSY2026';
const SCOREKEEPER_PIN = process.env.SCOREKEEPER_PIN || '1234';

// Handicaps default to 10 for everyone (neutral odds). Edit them on the Setup
// page once you have real numbers.
const TEAMS = [
  {
    name: 'Team Black',
    color: '#111111',
    players: [
      { name: 'Hank', handicap: 10 },
      { name: 'Luke', handicap: 10 },
      { name: 'Rob', handicap: 10 },
      { name: 'Nick Wade', handicap: 10 },
      { name: 'Neal', handicap: 10 },
      { name: 'Max', handicap: 10 },
      { name: 'Kirk', handicap: 10 },
      { name: 'Carl', handicap: 10 },
      { name: 'Blood', handicap: 10 },
      { name: 'TP', handicap: 10 },
      { name: 'Armstrong', handicap: 10 },
      { name: 'Mitcham', handicap: 10 },
      { name: 'Trey Simpson', handicap: 10 },
      { name: 'Clay', handicap: 10 },
      { name: 'Tom', handicap: 10 },
      { name: 'Kam', handicap: 10 },
      { name: 'Arnold', handicap: 10 },
      { name: 'Hootie', handicap: 10 },
      { name: 'Kemper', handicap: 10 },
      { name: 'Tiller', handicap: 10 },
    ],
  },
  {
    name: 'Team Crimson',
    color: '#8b1a2b',
    players: [
      { name: 'Huddy', handicap: 10 },
      { name: 'Wade', handicap: 10 },
      { name: 'Winj', handicap: 10 },
      { name: 'Rod', handicap: 10 },
      { name: 'Schmidt', handicap: 10 },
      { name: 'Z', handicap: 10 },
      { name: 'Blair', handicap: 10 },
      { name: 'Demi', handicap: 10 },
      { name: 'Taylor', handicap: 10 },
      { name: 'Rex', handicap: 10 },
      { name: 'IT', handicap: 10 },
      { name: 'Jared', handicap: 10 },
      { name: 'Camden', handicap: 10 },
      { name: 'Logan', handicap: 10 },
      { name: 'Luke', handicap: 10 },
      { name: 'Becker', handicap: 10 },
      { name: 'Calvin', handicap: 10 },
      { name: 'Forner', handicap: 10 },
      { name: 'Bryce', handicap: 10 },
    ],
  },
];

// One scramble session: five 4-person foursome matches, 1 point each (5 total,
// first to 3). Crimson has 19 players, so match 5 is Black 4 vs Crimson 3.
const SESSIONS = [
  {
    name: 'Scramble',
    matches: [
      { format: 'scramble', team_a_size: 4, team_b_size: 4, points_weight: 1, holes_count: 18 },
      { format: 'scramble', team_a_size: 4, team_b_size: 4, points_weight: 1, holes_count: 18 },
      { format: 'scramble', team_a_size: 4, team_b_size: 4, points_weight: 1, holes_count: 18 },
      { format: 'scramble', team_a_size: 4, team_b_size: 4, points_weight: 1, holes_count: 18 },
      { format: 'scramble', team_a_size: 4, team_b_size: 3, points_weight: 1, holes_count: 18 },
    ],
  },
];

export function seedIfEmpty() {
  const tournamentCount = db.prepare('SELECT COUNT(*) AS c FROM tournament').get().c;
  if (tournamentCount > 0) {
    return { seeded: false };
  }

  const insertTournament = db.prepare(
    'INSERT INTO tournament (id, name, code, scorekeeper_pin) VALUES (1, ?, ?, ?)'
  );

  const tx = db.transaction(() => {
    insertTournament.run('Transy Alumni Golf Scramble', TOURNAMENT_CODE, SCOREKEEPER_PIN);
    insertTeamsAndPlayers();
    insertSessionsAndMatches();
  });

  tx();
  return { seeded: true };
}

function insertTeamsAndPlayers() {
  const insertTeam = db.prepare('INSERT INTO team (name, color) VALUES (?, ?)');
  const insertPlayer = db.prepare(
    'INSERT INTO player (name, team_id, handicap) VALUES (?, ?, ?)'
  );
  for (const team of TEAMS) {
    const { lastInsertRowid: teamId } = insertTeam.run(team.name, team.color);
    for (const player of team.players) {
      insertPlayer.run(player.name, teamId, player.handicap);
    }
  }
}

function insertSessionsAndMatches() {
  const insertSession = db.prepare(
    'INSERT INTO session (name, display_order) VALUES (?, ?)'
  );
  const insertMatch = db.prepare(
    `INSERT INTO match (session_id, format, team_a_size, team_b_size, points_weight, sudden_death, holes_count, display_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  let order = 0;
  SESSIONS.forEach((session, sIdx) => {
    const { lastInsertRowid: sessionId } = insertSession.run(session.name, sIdx + 1);
    for (const m of session.matches) {
      order += 1;
      insertMatch.run(
        sessionId,
        m.format,
        m.team_a_size,
        m.team_b_size,
        m.points_weight,
        m.sudden_death ? 1 : 0,
        m.holes_count ?? 9,
        order
      );
    }
  });
}

// Wipes all scoring, bets, bettors, and roster/schedule config, then re-seeds
// teams, players, sessions, and matches from the constants above. Only the
// tournament row (name/code/PIN) survives.
export function factoryReset() {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM hole_player_score').run();
    db.prepare('DELETE FROM hole_result').run();
    db.prepare('DELETE FROM match_player').run();
    db.prepare('DELETE FROM bet').run();
    db.prepare('DELETE FROM bettor').run();
    db.prepare('DELETE FROM tiebreaker_hole').run();
    db.prepare('DELETE FROM tiebreaker').run();
    db.prepare('DELETE FROM match').run();
    db.prepare('DELETE FROM session').run();
    db.prepare('DELETE FROM player').run();
    db.prepare('DELETE FROM team').run();
    insertTeamsAndPlayers();
    insertSessionsAndMatches();
  });
  tx();
}

// One-shot startup migration to the current format: the 5-match scramble layout is
// identified by its 18-hole matches. Fires until one exists, then
// never again.
export function migrateToNewFormatIfNeeded() {
  const withNewLayout = db
    .prepare('SELECT COUNT(*) AS c FROM match WHERE holes_count = 18')
    .get().c;
  if (withNewLayout > 0) return { migrated: false, reason: 'already up to date' };
  factoryReset();
  return { migrated: true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { seeded } = seedIfEmpty();
  const mig = migrateToNewFormatIfNeeded();
  console.log(seeded ? 'Seeded.' : 'Already seeded; no changes.');
  if (mig.migrated) console.log('Wiped and reseeded with the Transy scramble format.');
  else if (mig.reason) console.log(`Migration skipped: ${mig.reason}.`);
}
