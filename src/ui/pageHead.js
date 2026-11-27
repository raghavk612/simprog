// What a page's header shows besides its own title and sub-line, and when it slides in. No DOM here, so tests import it;
// markup.js header() draws it and shell.js render() decides the entrance.
import * as E from '../engine.js';
import { navGroup } from './nav.js';

// The groups with a header render (public/images/ui/hero-<group>.avif/.webp, 480 × 270 and @2x).
export const HERO_GROUPS = ['week', 'team', 'season', 'shop'];
// Pages without the shared header: Home and the title screen keep the gym. The live game and its replays draw one, which
// body.live-match hides (theme.css), so the page keeps its h1.
const NO_HEAD = ['home', 'landing'];

// Up to three numbers of the page's own, never one the scorebug shows (record, tokens, slots, the game count). Each has
// a translation key for its label. Prep: the numbers the game model uses (E.modelSnapshot), so they match Game day:
// the rotation's energy (buffs and next-game modifiers in, the bench out) and the next opponent's strength.
export function headChips(v, s) {
  if (v !== 'practice') return [];
  const chips = [{ id: 'energy', label: 'tipoff.energy', value: readyFigures(s).energy }];
  if (!s.finished) chips.push({ id: 'opp', label: 'head.opp', value: Math.round(E.modelSnapshot(s).rating) });
  return chips;
}
// The rotation's energy and morale for the next game as the game model counts them (E.modelSnapshot: buffs and pending
// next-game modifiers in, such as a press-room answer). Prep's chip and Game day's readiness rows both show these, so the
// same label never carries two numbers.
export function readyFigures(s) {
  const M = E.modelSnapshot(s);
  return { energy: Math.round(M.energy), morale: Math.round(M.morale) };
}

// The header's model: the ghost word (a translation key: the page's name, drawn live, never baked into an image), the
// group's render and the chips. null where the page has none.
export function headModel(v, s) {
  if (NO_HEAD.includes(v)) return null;
  return { ghost: `nav.${v}`, hero: `hero-${navGroup(v)}`, chips: headChips(v, s) };
}

// The entrance (the title and the ghost word slide in) plays once, when render() draws a different page than last time:
// never on a re-render of the same page, never on the way to play (the purple way forward, Continue from the title, or
// Game day, where Tip off is), never on the first paint, and never under reduced motion.
export function headEnters({ from, to, way = false, reduced = false }) {
  if (!from || from === to || from === 'landing') return false;
  if (way || reduced) return false;
  return !NO_HEAD.includes(to) && to !== 'game';
}

// The ghost word shows whole in the free span between the text column and the render slot (or the grid's edge): its
// font size shrinks from the CSS size until the name fits on one line, down to GHOST_FLOOR px. A name of several words
// that needs less than that goes on two lines instead (both within the band's height, at the 0.8 line height). Only a
// name that fits neither way (a long one in another language) stays at the floor on one line and fades out at its end
// (`squeezed`). `one` is the name's width on one line at `size`, `two` the wider of its two lines (ghostSplit), `room`
// the span ({ w, h }); nothing changes where there is no room to measure (the ghost is hidden on a phone).
export const GHOST_FLOOR = 64;
const LINE = 0.8;
const down = x => Math.floor(x * 0.98 * 2) / 2;
export function ghostFit({ one, two = null, room, size }) {
  if (!one || !room.w || one <= room.w) return { size, lines: 1, squeezed: false };
  const single = down((size * room.w) / one);
  if (single >= GHOST_FLOOR) return { size: single, lines: 1, squeezed: false };
  const double = two ? down(Math.min((size * room.w) / two, room.h / (2 * LINE), size)) : 0;
  if (double >= GHOST_FLOOR) return { size: double, lines: 2, squeezed: false };
  return { size: GHOST_FLOOR, lines: 1, squeezed: (one * GHOST_FLOOR) / size > room.w };
}
// Where a name of `n` words breaks into two lines so the wider line is as short as it can be. `width(a, b)` is the
// width of words a to b - 1 on one line. null for a single word.
export function ghostSplit(n, width) {
  let best = null;
  for (let at = 1; at < n; at++) {
    const widest = Math.max(width(0, at), width(at, n));
    if (!best || widest < best.widest) best = { at, widest };
  }
  return best;
}
