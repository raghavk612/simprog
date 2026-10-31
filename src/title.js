/* Pure helpers for the title screen (no DOM, no Three): which game the scoreboard previews, and the title/fly-in camera shots. */
import {teamFor} from './engine.js';

/** The game the title screen is about: the save's next game (or last, once finished), else the chosen difficulty's first game at 0-0. */
export function titleMatchup(state, data, difficulty = 'standard') {
  if (state?.schedule?.length) {
    const games = state.schedule.length, over = !!state.finished, game = over ? games : Math.min(games, (state.week || 0) + 1), row = state.schedule[game - 1];
    return { opponent: (over ? state.results?.at(-1)?.opponent : null) ?? row?.opponent ?? null, game, games, wins: state.wins || 0, losses: state.losses || 0, date: row?.date ?? null, continuing: true };
  }
  const list = teamFor(data, difficulty)?.games || [];
  return { opponent: list[0]?.opponent ?? null, game: 1, games: list.length, wins: 0, losses: 0, date: list[0]?.date ?? null, continuing: false };
}

export const SWEEP = 60;
export const HERO = { x: -4.2, z: 2.6 };
export const END = { position: [0, 7.5, 15.5], target: [0, 1, 0] };

/** Slow broadcast-jib drift along the near sideline: azimuth -10 +- 15deg about +z (-25..+5), 13 from the target, periodic every SWEEP seconds.
 *  The target sits 4 m toward -x of the hero's half-way point and 3.2 m up, so with the title lens the dribbler stays right of centre, clear of the menu,
 *  and the scoreboard with the real next game stays in shot (the jib's gentle 3.2-4 m rise keeps its team names below the top letterbox).
 *  A wider swing cannot hold both: past about +5deg the board leaves the frame. */
export function titleCamera(time) {
  const p = 2 * Math.PI * time / SWEEP, az = (-10 + 15 * Math.sin(p)) * Math.PI / 180, target = [HERO.x * .5 - 4, 3.2, HERO.z * .5];
  return { position: [target[0] + 13 * Math.sin(az), 3.6 + .4 * Math.cos(2 * p), target[2] + 13 * Math.cos(az)], target };
}

/** The reduced-motion still: the sweep moment (azimuth -25deg) that holds the hero furthest right of the menu. */
export const STILL = 45;

/** Vertical FOV for the title shot: a long 38deg lens on wide screens (65deg when tall, aspect < .8, like the other views), eased to the broadcast 43deg as the fly-in (progress u) lands. */
export function titleFov(aspect, u = 0) {
  if (aspect < .8) return 65;
  const k = Math.min(1, Math.max(0, +u || 0));
  return 38 + 5 * k * k * (3 - 2 * k);
}

/** Smoothstep move from a title shot (u=0) to the broadcast end shot (u=1); u is clamped to [0,1]. */
export function flyIn(u, from) {
  const k = Math.min(1, Math.max(0, +u || 0)), e = k * k * (3 - 2 * k), mix = (a, b) => a.map((v, i) => v + (b[i] - v) * e);
  return { position: mix(from.position, END.position), target: mix(from.target, END.target) };
}

/** Yaw (0 = facing +z) that turns the title dribbler toward the middle of the sweep, so he plays to the camera without swivelling as it moves (a constant, worked out once). */
const HERO_YAW = (([x, , z]) => Math.atan2(x - HERO.x, z - HERO.z))(titleCamera(0).position);
export function heroYaw() {
  return HERO_YAW;
}
