import {useEffect,useState} from 'react';
export default function GroupHoleEntry({holeNumber,holeIndex,par=4,team,side,existing,onSubmit,disabled}) {
 const old=side==='A'?existing?.teamAScore:existing?.teamBScore;
 const [score,setScore]=useState(old??par);
 useEffect(()=>setScore(old??par),[old,par,holeIndex]);
 const diff=score-par;
 return <div className="card p-4 space-y-3">
   <div className="text-sm font-bold">{team.name} · Hole {holeNumber} · Par {par}</div>
   <div className="flex justify-center items-center gap-6">
     <button className="btn text-2xl" onClick={()=>setScore(x=>Math.max(1,x-1))}>−</button>
     <div className="text-center"><div className="text-5xl font-bold">{score}</div><div className="text-sm text-ink/60">{diff===0?'Par':diff<0?`${diff} to par`:`+${diff} to par`}</div></div>
     <button className="btn text-2xl" onClick={()=>setScore(x=>x+1)}>+</button>
   </div>
   <button className="btn btn-primary w-full" disabled={disabled} onClick={()=>onSubmit(side==='A'?{holeIndex,teamAScore:score}:{holeIndex,teamBScore:score})}>{existing?'Update score':'Save hole'}</button>
 </div>;
}
