export function formatStroke(n) {return n===0?'E':n>0?`+${n}`:String(n);}
export default function TeamScore({teams,totals,matches=[],tournamentFinal}) {
  const [a,b]=teams;
  const played=matches.reduce((n,m)=>n+(m.computed?.holesPlayed||0),0);
  const expected=matches.reduce((n,m)=>n+(m.holesCount||18),0);
  const leading=totals.a<totals.b?a:totals.b<totals.a?b:null;
  return <div className="card p-4 space-y-3">
    <div className="text-center"><div className="font-display font-bold text-xl">Black vs Crimson</div>
    <div className="text-xs uppercase tracking-widest text-ink/60">Cumulative Scramble Stroke Play · Lakeside Golf Course</div></div>
    <div className="grid grid-cols-2 gap-3">
      {[a,b].map((t,i)=><div key={t.id} className="text-center rounded-xl border border-bunker/60 p-3">
        <div className="font-semibold" style={{color:t.color}}>{t.name}</div>
        <div className="text-4xl font-display font-black tabular-nums">{formatStroke(i===0?totals.a:totals.b)}</div>
        <div className="text-xs text-ink/60">combined relative to par</div>
      </div>)}
    </div>
    <div className="text-center text-sm font-semibold">{tournamentFinal?(leading?`${leading.name} wins!`:'Tournament tied'):(leading?`${leading.name} leads`:'Teams tied')}</div>
    <div className="text-center text-xs text-ink/60">{played}/{expected} group-holes recorded · All five groups count · Lowest total wins</div>
  </div>;
}
