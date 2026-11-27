// The navigation's two motions, each played once per change and never looped (docs/superpowers/reports/
// 2026-11-26-game-nav-design.md, "Tab change" and "Value change"). No DOM here, so tests import it; shell.js plays them
// and theme.css draws them.

// The buttons whose click morphs the open tab: the top bar's groups and the band's sub-tabs.
export const NAV_BUTTONS = '.main-nav .nav-item, .subnav .sub-item';

// The open tab's plate morphs into its new place (a View Transition, 180 ms) only when a nav button is clicked: never
// on the way to play (Continue from the title, the purple way forward, Game day where Tip off is), never on the tab
// already open or the first paint, never under reduced motion, and only where the browser has View Transitions.
export function tabMorphs({ nav = false, from, to, supported = false, reduced = false }) {
  if (!nav || !supported || reduced) return false;
  if (!from || from === 'landing' || from === to) return false;
  return to !== 'game';
}

// What the flash compares: the record and the tokens, the scorebug's two numbers that change by the coach's doing.
export const scoreValues = s => (s ? { rec: `${s.wins}-${s.losses}`, tokens: s.tokens } : null);

// Which of the scorebug's values flash on this render ('rec', 'tokens'), and the values to remember for the next one
// (`memo`; shell.js keeps it, since render() rebuilds the page). `s` is null on the title screen, which forgets them, so
// a new season never flashes. While the scorebug is hidden (the live game) the last values seen are kept, so a change
// made there flashes when the scorebug shows again. Never on the first paint; under reduced motion or Fewer flashes
// nothing flashes, but the values are still remembered.
export function scoreFlash(prev, s, { shown = true, reduced = false, noFlash = false } = {}) {
  const now = scoreValues(s);
  if (!now) return { memo: null, keys: [] };
  if (!shown) return { memo: prev, keys: [] };
  const keys = prev && !reduced && !noFlash ? ['rec', 'tokens'].filter(k => prev[k] !== now[k]) : [];
  return { memo: now, keys };
}
