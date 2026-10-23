import { holeByNumber } from './course.js';
export function computeStrokePlay(holes, holesCount = 18) {
  const valid = holes.filter(h => Number.isInteger(h.team_a_score) && Number.isInteger(h.team_b_score) && Number.isInteger(h.hole_number) && holeByNumber(h.hole_number));
  const aStrokes = valid.reduce((s,h)=>s+h.team_a_score,0);
  const bStrokes = valid.reduce((s,h)=>s+h.team_b_score,0);
  const parPlayed = valid.reduce((s,h)=>s+holeByNumber(h.hole_number).par,0);
  const holesPlayed = new Set(valid.map(h=>h.hole_index)).size;
  const final = holesPlayed===holesCount && Array.from({length:holesCount},(_,i)=>i).every(i=>valid.some(h=>h.hole_index===i));
  const aToPar=aStrokes-parPlayed, bToPar=bStrokes-parPlayed;
  const fmt=n=>n===0?'E':n>0?`+${n}`:String(n);
  return { holesPlayed, aStrokes,bStrokes,parPlayed,aToPar,bToPar,lead:bToPar-aToPar,
    remaining:Math.max(0,holesCount-holesPlayed),final,isClosed:final,closedAtIndex:final?holesCount-1:null,
    result:final?`${fmt(aToPar)} / ${fmt(bToPar)}`:null,
    status:`${fmt(aToPar)} / ${fmt(bToPar)}`,inOvertime:false };
}
