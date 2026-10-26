// Pure timing rules for the close-out and recovery drills (no Three.js or DOM).
// Every round has an "ideal" press time and a half-width in seconds; judge() says how a press compares.
export const CLOSEOUT = { half: [0.22, 0.17, 0.13], approach: [1.7, 1.45, 1.25], arrive: 0.3, catch: 0.55 };
export const BREATHE = { half: [0.5, 0.4, 0.32], period: [4.6, 4.2, 3.8], target: 0.18, lead: 0.6 };
export const ASSIST = { half: 1.6, slow: 1.3, maxHalf: 0.6 };

export function closeoutRound(round, assist = false) {
  const i = Math.min(round, 2), half = Math.min(assist ? ASSIST.maxHalf : 1, CLOSEOUT.half[i] * (assist ? ASSIST.half : 1));
  const approach = CLOSEOUT.approach[i] * (assist ? ASSIST.slow : 1), ideal = CLOSEOUT.catch + approach;
  // The shooter releases `arrive` seconds after the ideal press; the window always closes before that, so a hit is never after the ball has gone.
  const arrive = Math.max(CLOSEOUT.arrive, half + 0.08);
  return { half, approach, catchT: CLOSEOUT.catch, ideal, arrive, release: ideal + arrive };
}
// Breathing: b(t) is 0 fully exhaled, 1 fully inhaled, starting exhaled. The window sits on the falling half of the second breath.
export const breath = (t, period) => 0.5 - 0.5 * Math.cos(2 * Math.PI * t / period);
export function breatheRound(round, assist = false) {
  const i = Math.min(round, 2), half = Math.min(assist ? 0.9 : 2, BREATHE.half[i] * (assist ? 1.5 : 1)), period = BREATHE.period[i] * (assist ? 1.2 : 1);
  const u = 1 - Math.acos(1 - 2 * BREATHE.target) / (2 * Math.PI), ideal = BREATHE.lead + period * (1 + u);
  return { half, period, ideal, lead: BREATHE.lead, end: ideal + half + 0.35 };
}
export const judge = (press, ideal, half) => press < ideal - half ? 'early' : press > ideal + half ? 'late' : 'hit';
