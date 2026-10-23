// Official Lakeside Golf Course scorecard, Lexington, Kentucky (par 72).
// Source: https://content.lexingtonky.gov/sites/default/files/2024-10/Lakeside%20GC%20scorecard.pdf
const PARS = [4, 5, 3, 4, 4, 3, 4, 4, 5, 4, 3, 5, 3, 4, 4, 5, 4, 4];
const HCPS = [9, 1, 17, 3, 11, 15, 13, 7, 5, 6, 18, 2, 16, 8, 4, 10, 14, 12];
// Blue tees (tee #4), yardages are optional informational fields.
const YARDS = [385,490,145,380,285,160,340,360,520,340,150,500,170,320,350,460,325,350];
export const COURSE = {
  name: 'Lakeside Golf Course — Lexington, KY',
  holes: PARS.map((par,i) => ({number:i+1,par,yards:YARDS[i],hcp:HCPS[i]})),
};
export const HOLES_ON_COURSE = COURSE.holes.length;
export function holeOrderFromStart(startHole) {
  return Array.from({length:HOLES_ON_COURSE},(_,i)=>((startHole-1+i)%HOLES_ON_COURSE)+1);
}
export function holeByNumber(n) { return COURSE.holes.find(h=>h.number===n); }
