import { Link } from 'react-router-dom';
import { formatStroke } from './TeamScore.jsx';
export default function MatchCard({match,teams}) {
  const [a,b]=teams,c=match.computed;
  return <Link to={`/score?match=${match.id}`} className="block card p-3 space-y-3">
    <div className="flex justify-between items-center text-xs text-ink/60"><span>Scramble Group {match.displayOrder} · 18 holes</span><span>{match.status==='final'?'Final':`${c.holesPlayed}/18 holes scored`}</span></div>
    <div className="grid grid-cols-2 gap-3">
      {[a,b].map((t,i)=><div key={t.id} className="min-w-0 space-y-1">
        <div className="text-sm font-bold" style={{color:t.color}}>{t.name}</div>
        <div className="text-3xl font-display font-black tabular-nums">{formatStroke(i===0?c.aToPar:c.bToPar)}</div>
        <div className="text-xs text-ink/50">{i===0?c.aStrokes:c.bStrokes} strokes · {c.holesPlayed} holes</div>
        <div className="text-xs text-ink/70">{(i===0?match.sideA:match.sideB).map(p=>p.name).join(' / ')||'Not assigned'}</div>
      </div>)}
    </div>
    <div className="text-xs text-ink/60">Start hole: {match.startHole||'Not set'} · Tap to enter or review scores</div>
  </Link>;
}
