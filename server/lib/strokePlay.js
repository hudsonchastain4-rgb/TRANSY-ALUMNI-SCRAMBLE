import { holeByNumber } from './course.js';
export function computeStrokePlay(holes, holesCount=18, side='A') {
 const field=side==='A'?'team_a_score':'team_b_score';
 const valid=holes.filter(h=>Number.isInteger(h[field]) && h[field]>0 && Number.isInteger(h.hole_number) && holeByNumber(h.hole_number));
 const strokes=valid.reduce((n,h)=>n+h[field],0);
 const parPlayed=valid.reduce((n,h)=>n+holeByNumber(h.hole_number).par,0);
 const holesPlayed=new Set(valid.map(h=>h.hole_index)).size;
 const final=holesPlayed===holesCount&&Array.from({length:holesCount},(_,i)=>i).every(i=>valid.some(h=>h.hole_index===i));
 const toPar=strokes-parPlayed;const fmt=n=>n===0?'E':n>0?`+${n}`:String(n);
 return {side,holesPlayed,strokes,parPlayed,toPar,aStrokes:side==='A'?strokes:0,bStrokes:side==='B'?strokes:0,
  aToPar:side==='A'?toPar:0,bToPar:side==='B'?toPar:0,remaining:Math.max(0,holesCount-holesPlayed),
  final,isClosed:final,closedAtIndex:final?holesCount-1:null,result:final?fmt(toPar):null,status:fmt(toPar),inOvertime:false};
}
