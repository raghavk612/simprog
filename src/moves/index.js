// The move library: every set piece, written for the right hand (the Routine mirrors them for the left). See README.md.
// family 'handle' (ball-handling moves) or 'show' (showtime extras, weighted up on the title screen); needs: context points
// a move cannot do without (the step-back jumper needs a rim and a rebounder to pass the ball back).
import crossovers from './crossovers.js';
import between from './between.js';
import behind from './behind.js';
import fakes from './fakes.js';
import spin from './spin.js';
import waist from './waist.js';
import finger from './finger.js';
import jumper from './jumper.js';

export const MOVES = [
  ...crossovers,
  ...between,
  ...behind,
  ...fakes,
  ...spin,
  ...waist,
  ...finger,
  ...jumper,
];
export const moveById = id => MOVES.find(m => m.id === id);
export { Routine, seeded, walkUpMove } from './routine.js';
export { prepare, sample, mirrorMove, dribbleMove, topOf } from './core.js';
