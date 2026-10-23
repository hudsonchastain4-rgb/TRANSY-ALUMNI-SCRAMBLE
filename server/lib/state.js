import { db } from '../db.js';
import { computeStrokePlay } from './strokePlay.js';
import { COURSE, HOLES_ON_COURSE } from './course.js';
import { payoutFor } from './odds.js';

export function recomputeMatch(matchId) {
  const match = db.prepare('SELECT * FROM match WHERE id = ?').get(matchId);
  if (!match) return null;

  const holes = db
    .prepare('SELECT * FROM hole_result WHERE match_id = ? ORDER BY hole_index')
    .all(matchId);

  const suddenDeath = !!match.sudden_death;
  const holesCount = match.holes_count ?? 9;
  const computed = computeStrokePlay(holes, holesCount, match.team_a_size > 0 ? 'A' : 'B');
  const pts = {a:0,b:0};

  let status = match.status;
  if (status === 'pending' && holes.length > 0) status = 'in_progress';
  if (computed.final) status = 'final';
  else if (status === 'final' || status === 'closed') status = 'in_progress';

  db.prepare(
    `UPDATE match
       SET status = ?,
           closed_on_hole_index = ?,
           result = ?,
           team_a_points = ?,
           team_b_points = ?
     WHERE id = ?`
  ).run(
    status,
    computed.closedAtIndex,
    computed.result,
    pts.a,
    pts.b,
    matchId
  );

  return { match: { ...match, status }, computed, points: pts };
}

export function getFullState() {
  const tournament = db.prepare('SELECT id, name FROM tournament WHERE id = 1').get() || {
    id: 1,
    name: 'Transy Alumni Golf Scramble',
  };

  const teamsRaw = db.prepare('SELECT * FROM team ORDER BY id').all();
  const playersByTeam = db.prepare('SELECT * FROM player WHERE team_id = ? ORDER BY id');

  const matches = db
    .prepare('SELECT * FROM match ORDER BY display_order')
    .all();

  const matchPlayers = db.prepare(
    `SELECT mp.match_id, mp.side, p.id, p.name, p.team_id, p.handicap
       FROM match_player mp
       JOIN player p ON p.id = mp.player_id
      WHERE mp.match_id = ?`
  );

  const matchHoles = db.prepare(
    'SELECT * FROM hole_result WHERE match_id = ? ORDER BY hole_index'
  );

  const playerScoresStmt = db.prepare(
    'SELECT player_id, score FROM hole_player_score WHERE hole_result_id = ?'
  );

  const matchOut = matches.map((m) => {
    const players = matchPlayers.all(m.id);
    const toPlayer = (p) => ({
      id: p.id,
      name: p.name,
      teamId: p.team_id,
      handicap: p.handicap ?? 0,
    });
    const sideA = players.filter((p) => p.side === 'A').map(toPlayer);
    const sideB = players.filter((p) => p.side === 'B').map(toPlayer);
    const holes = matchHoles.all(m.id);
    const matchSuddenDeath = !!m.sudden_death;
    const holesCount = m.holes_count ?? 9;
    const computed = computeStrokePlay(holes, holesCount, m.team_a_size > 0 ? 'A' : 'B');
    const maxHoleIndex = holes.length
      ? Math.max(...holes.map((h) => h.hole_index))
      : -1;
    // For sudden-death matches in OT, include the next unplayed OT slot so
    // the scorekeeper UI knows the par/hole number for the upcoming hole.
    const nextOtSlot = matchSuddenDeath && computed.inOvertime
      ? computed.holesPlayed + 1
      : 0;
    const playLength = matchSuddenDeath
      ? Math.max(holesCount, maxHoleIndex + 1, nextOtSlot)
      : holesCount;
    const holePlayOrder = m.start_hole
      ? Array.from(
          { length: playLength },
          (_, i) => ((m.start_hole - 1 + i) % HOLES_ON_COURSE) + 1
        )
      : null;
    return {
      id: m.id,
      sessionId: m.session_id,
      format: m.format,
      groupSide: m.team_a_size > 0 ? 'A' : 'B',
      groupNumber: m.team_a_size > 0 ? m.display_order : m.display_order - 5,
      teamASize: m.team_a_size,
      teamBSize: m.team_b_size,
      startHole: m.start_hole,
      status: m.status,
      closedOnHoleIndex: m.closed_on_hole_index,
      result: m.result,
      teamAPoints: m.team_a_points,
      teamBPoints: m.team_b_points,
      pointsWeight: m.points_weight ?? 1,
      suddenDeath: matchSuddenDeath,
      holesCount,
      displayOrder: m.display_order,
      sideA,
      sideB,
      holes: holes.map((h) => {
        const ps = {};
        for (const row of playerScoresStmt.all(h.id)) {
          ps[row.player_id] = row.score;
        }
        return {
          id: h.id,
          holeIndex: h.hole_index,
          holeNumber: h.hole_number,
          teamAScore: h.team_a_score,
          teamBScore: h.team_b_score,
          winner: h.winner,
          playerScores: ps,
          createdAt: h.created_at,
        };
      }),
      holePlayOrder,
      computed,
    };
  });

  const sessionsRaw = db.prepare('SELECT * FROM session ORDER BY display_order').all();
  const sessions = sessionsRaw.map((s) => ({
    id: s.id,
    name: s.name,
    displayOrder: s.display_order,
    matches: matchOut.filter((m) => m.sessionId === s.id),
  }));

  const teams = teamsRaw.map((t, i) => {
    const side = i === 0 ? 'A' : 'B';
    const totalPoints = matchOut.filter(m=>m.groupSide===side).reduce((sum,m)=>sum+m.computed.toPar,0);
    return {
      id: t.id,
      name: t.name,
      color: t.color,
      side,
      players: playersByTeam.all(t.id).map((p) => ({
        id: p.id,
        name: p.name,
        teamId: p.team_id,
        handicap: p.handicap ?? 0,
      })),
      totalPoints,
    };
  });

  const allMatchesFinal =
    matchOut.length > 0 && matchOut.every((m) => m.status === 'final');

  const totals = {
    a: teams[0]?.totalPoints || 0,
    b: teams[1]?.totalPoints || 0,
  };

  const totalPointsAvailable = matchOut.reduce(
    (s, m) => s + (m.pointsWeight ?? 1),
    0
  );

  // No tiebreaker in this format — the cup can end tied.
  const tournamentFinal = allMatchesFinal;

  const bets = {bettors:[], bets:[]};
  const activity = [];

  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
    },
    teams,
    sessions,
    matches: matchOut,
    totals,
    scoringFormat: 'cumulative_stroke_play',
    totalHolesScored:matchOut.reduce((n,m)=>n+m.computed.holesPlayed,0),
    totalHolesExpected:matchOut.reduce((n,m)=>n+m.holesCount,0),
    totalPointsAvailable,
    allMatchesFinal,
    tournamentFinal,
    course: COURSE,
    bets,
    activity,
  };
}

function buildBets(matchOut) {
  const bettors = db.prepare('SELECT * FROM bettor ORDER BY id').all();
  const allBets = db.prepare('SELECT * FROM bet ORDER BY created_at').all();
  const matchById = new Map(matchOut.map((m) => [m.id, m]));

  const bettorRows = bettors.map((b) => {
    const myBets = allBets
      .filter((bt) => bt.bettor_id === b.id)
      .map((bt) => decorateBet(bt, matchById.get(bt.match_id)));
    const points = myBets.reduce((s, x) => s + (x.payout || 0), 0);
    const settled = myBets.filter((x) => x.outcome !== 'pending').length;
    const wins = myBets.filter((x) => x.outcome === 'win').length;
    return {
      id: b.id,
      name: b.name,
      bets: myBets,
      points,
      settled,
      wins,
      open: myBets.length - settled,
    };
  });

  const populated = bettorRows.filter((r) => r.bets.length > 0);
  populated.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  return populated;
}

function decorateBet(bet, match) {
  const moneyByPick = {
    A: bet.money_a,
    B: bet.money_b,
    halve: bet.money_halve,
  };
  const pickedMoney = moneyByPick[bet.pick];

  let outcome = 'pending';
  let payout = 0;

  if (match && match.status === 'final') {
    const c = match.computed;
    const actual = c.lead > 0 ? 'A' : c.lead < 0 ? 'B' : 'halve';
    if (actual === bet.pick) {
      outcome = 'win';
      payout = payoutFor(pickedMoney);
    } else {
      outcome = 'loss';
      payout = -100;
    }
  }

  return {
    id: bet.id,
    bettorId: bet.bettor_id,
    matchId: bet.match_id,
    pick: bet.pick,
    moneyA: bet.money_a,
    moneyB: bet.money_b,
    moneyHalve: bet.money_halve,
    moneyOnPick: pickedMoney,
    outcome,
    payout,
    locked: match ? match.status !== 'pending' : true,
    createdAt: bet.created_at,
  };
}

function buildActivity(matchOut) {
  const events = [];
  for (const m of matchOut) {
    const sortedHoles = [...m.holes].sort((a, b) => a.holeIndex - b.holeIndex);
    let aWins = 0;
    let bWins = 0;

    for (const h of sortedHoles) {
      if (h.winner === 'A') aWins++;
      else if (h.winner === 'B') bWins++;

      const closing =
        m.computed.isClosed && h.holeIndex === m.computed.closedAtIndex;

      events.push({
        type: closing ? 'match_close' : 'hole',
        matchId: m.id,
        matchFormat: m.format,
        holeNumber: h.holeNumber,
        holeIndex: h.holeIndex,
        winner: h.winner,
        teamAScore: h.teamAScore,
        teamBScore: h.teamBScore,
        leadAfter: aWins - bWins,
        sideA: m.sideA.map((p) => p.name),
        sideB: m.sideB.map((p) => p.name),
        result: closing ? m.result : null,
        createdAt: h.createdAt,
      });

      if (closing) break;
    }
  }
  events.sort((a, b) => {
    const ta = a.createdAt || 0;
    const tb = b.createdAt || 0;
    if (ta !== tb) return tb - ta;
    return b.matchId - a.matchId;
  });
  return events.slice(0, 50);
}
