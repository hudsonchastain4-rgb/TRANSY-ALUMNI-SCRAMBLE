import TeamScore from '../components/TeamScore.jsx';
import MatchCard from '../components/MatchCard.jsx';
export default function Scoreboard({state}) {
  return <div className="space-y-4">
    <TeamScore teams={state.teams} totals={state.totals} matches={state.matches} tournamentFinal={state.tournamentFinal}/>
    <div className="card p-3 text-xs text-ink/65">Gross scramble stroke play. Each group records one Black and one Crimson score per hole. All five group totals count; lower combined score relative to par wins. Par 72 at Lakeside Golf Course, Lexington.</div>
    {state.matches.map(m=><MatchCard key={m.id} match={m} teams={state.teams}/>)}
  </div>;
}
