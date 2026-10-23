import TeamScore from '../components/TeamScore.jsx';
import MatchCard from '../components/MatchCard.jsx';
import StrokeOdds from '../components/StrokeOdds.jsx';
export default function Scoreboard({state}) {
 return <div className="space-y-4">
  <TeamScore teams={state.teams} totals={state.totals} matches={state.matches} tournamentFinal={state.tournamentFinal}/>
  <StrokeOdds state={state}/>
  <div className="card p-3 text-xs text-ink/65">Lakeside Golf Course · 18-hole gross scramble stroke play. Each foursome enters one score per hole. Every Black and Crimson group counts toward the combined team total.</div>
  {state.teams.map((team,i)=><section key={team.id} className="space-y-2"><h2 className="font-bold" style={{color:team.color}}>{team.name} — Five Groups</h2>{state.matches.filter(m=>m.groupSide===(i===0?'A':'B')).map(m=><MatchCard key={m.id} match={m} teams={state.teams}/>)}</section>)}
 </div>;
}
