// Prints the measurements of ball-handling moves (src/moves/check.js), both hands, and exits 1 if any has a problem.
//   node scripts/moves-check.mjs                 # every move in the library
//   node scripts/moves-check.mjs --file between  # one family file on its own (src/moves/between.js)
//   node scripts/moves-check.mjs crossover       # named moves
import { MOVES, mirrorMove } from '../src/moves/index.js';
import { analyse, summary } from '../src/moves/check.js';
import { courtContext } from '../src/moves/context.js';
import { HERO, heroYaw } from '../src/title.js';

const argv = process.argv.slice(2),
  fi = argv.indexOf('--file'),
  file = fi >= 0 ? argv[fi + 1] : null,
  names = argv.filter((a, i) => !a.startsWith('--') && i !== fi + 1);
const lib = file
  ? (await import(new URL(`../src/moves/${file}.js?t=${Date.now()}`, import.meta.url).href)).default
  : MOVES;
const c = courtContext({ x: HERO.x, z: HERO.z, yaw: heroYaw() }),
  ctx = { rim: c.rim, feeder: c.feeder };
let bad = 0;
for (const m of lib.filter(m => !names.length || names.includes(m.id)))
  for (const mm of [m, mirrorMove(m)]) {
    const a = analyse(mm, { ctx });
    console.log(summary(a));
    if (a.problems.length) bad++;
  }
process.exit(bad ? 1 : 0);
