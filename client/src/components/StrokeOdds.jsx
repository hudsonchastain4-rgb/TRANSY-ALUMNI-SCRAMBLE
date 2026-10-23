// Illustrative stroke-play win probabilities, not a betting market.
export default function StrokeOdds({state}) {
 const played=state.matches.reduce((s,m)=>s+m.computed.holesPlayed,0);
 const remaining=state.matches.reduce((s,m)=>s+m.computed.remaining,0);
 const lead=state.totals.b-state.totals.a;
 let probability;
 if(remaining===0) probability=lead>0?1:lead<0?0:0.5;
 else if(!played) probability=.5;
 else {
  // Simple normal approximation for remaining scramble strokes; intentionally conservative.
  const z=lead/Math.max(2,Math.sqrt(remaining)*1.2);
  const x=1/(1+Math.exp(-1.7*z));
  probability=Math.min(.98,Math.max(.02,x));
 }
 const fmt=n=>`${Math.round(n*100)}%`;
 return <div className="card p-3 space-y-2">
  <div className="text-sm font-bold">Estimated overall win chances</div>
  <div className="grid grid-cols-2 gap-2 text-center"><div><div className="font-semibold">Black</div><div className="text-2xl font-bold">{fmt(probability)}</div></div><div><div className="font-semibold">Crimson</div><div className="text-2xl font-bold">{fmt(1-probability)}</div></div></div>
  <div className="text-xs text-ink/60">Illustrative live estimate from combined scores and holes remaining; not calibrated betting odds. Ties are possible. Estimates become more informative as groups finish holes.</div>
 </div>;
}
