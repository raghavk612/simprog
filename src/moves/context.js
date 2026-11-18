// Context points a move can ask for (move.needs), in the base frame of a player standing at base ({x, z, yaw}, world):
//   rim: the centre of the ring he shoots at; feeder: where a teammate stands to rebound and pass the ball back (his feet).
// The title screen's hero shoots at the near-left basket (x = -12.15), which is the one beside him.
import { BALL } from '../basketball.js';
import { yawRot } from './core.js';

export const RIM_X = 12.15;
/* World -> base frame. */
export const toBase = ([x, y, z], base) => yawRot([x - base.x, y, z - base.z], -base.yaw);

/* The rim on `side` (-1 = the -x basket) and a rebounder's spot a stride in front of it, toward the player. */
export function courtContext(base, side = -1) {
  const rim = [side * RIM_X, BALL.rim, 0],
    dx = base.x - rim[0],
    dz = base.z - rim[2],
    d = Math.hypot(dx, dz) || 1,
    feeder = [rim[0] + (dx / d) * 1.6, 0, rim[2] + (dz / d) * 1.6];
  return { rim: toBase(rim, base), feeder: toBase(feeder, base), rimWorld: rim, feederWorld: feeder };
}
