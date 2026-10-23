import {Link} from 'react-router-dom';
import {formatStroke} from './TeamScore.jsx';
export default function MatchCard({match,teams}) {
 const team=teams[match.groupSide==='A'?0:1], c=match.computed;
 const players=match.groupSide==='A'?match.sideA:match.sideB;
 return <Link to={`/score?match=${match.id}`} className="block card p-3 space-y-2">
  <div className="flex justify-between text-sm font-bold"><span style={{color:team.color}}>{team.name} · Group {match.groupNumber}</span><span>{c.holesPlayed}/18</span></div>
  <div className="text-3xl font-bold">{formatStroke(c.toPar)}</div>
  <div className="text-xs text-ink/60">{c.strokes} strokes · {players.map(p=>p.name).join(' / ')||'Players not assigned'}</div>
  <div className="text-xs text-ink/60">Starting hole {match.startHole||'not set'} · Tap for scorecard</div>
 </Link>;
}
