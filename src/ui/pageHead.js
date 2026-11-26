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
  const M = E.modelSnapshot(s),
    chips = [{ id: 'energy', label: 'tipoff.energy', value: Math.round(M.energy) }];
  if (!s.finished) chips.push({ id: 'opp', label: 'head.opp', value: Math.round(M.rating) });
  return chips;
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
