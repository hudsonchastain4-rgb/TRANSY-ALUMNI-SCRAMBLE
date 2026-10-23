// Placeholder course data -- swap in the real pars/yardages for your course.
// Par only feeds the scorekeeper's default stepper value; scoring is match play.
const PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5];

export const COURSE = {
  name: 'Transy Alumni Scramble',
  holes: PARS.map((par, i) => ({ number: i + 1, par, yards: null, hcp: i + 1 })),
};

export const HOLES_ON_COURSE = COURSE.holes.length;

export function holeOrderFromStart(startHole) {
  return Array.from({ length: HOLES_ON_COURSE }, (_, i) => ((startHole - 1 + i) % HOLES_ON_COURSE) + 1);
}

export function holeByNumber(n) {
  return COURSE.holes.find((h) => h.number === n);
}
