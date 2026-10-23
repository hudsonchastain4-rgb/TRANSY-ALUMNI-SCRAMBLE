import {formatStroke} from '../components/TeamScore.jsx';
export default function Final({state}) {
  const [a,b]=state.teams;const {totals}=state;
  if(!state.tournamentFinal)return <div className="card p-4">Tournament is not final. All ten groups must enter 18 holes.</div>;
  const winner=totals.a<totals.b?a:totals.b<totals.a?b:null;
  return <div className="space-y-4"><div className="card p-5 text-center space-y-3">
    <div className="text-sm uppercase tracking-widest">Final · Lakeside Golf Course</div>
    <div className="text-3xl font-display font-black">{winner?`${winner.name} wins!`:'Tournament tied'}</div>
    <div className="text-xl">Black {formatStroke(totals.a)} · Crimson {formatStroke(totals.b)}</div>
    <div className="text-sm text-ink/60">All five groups per team combined · Lowest score wins</div>
  </div><div className="card p-3 space-y-2"><div className="font-semibold">Group results</div>
    {state.matches.map(m=><div key={m.id} className="flex justify-between gap-3 border-t border-bunker/40 py-2 text-sm"><span>{m.groupSide === "A" ? "Black" : "Crimson"} Group {m.groupNumber}</span><span>{formatStroke(m.computed.toPar)}</span></div>)}
    <a className="btn block text-center" href="/api/export">Download CSV</a>
  </div></div>;
}
