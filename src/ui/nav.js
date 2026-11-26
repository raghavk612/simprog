// The top tabs, the tabs under them, and what a Shop page offers during a break. No DOM here, so tests import it.
// Every screen is its own route, so the tutorial and the judge demo can jump straight to one.
import * as E from '../engine.js';

// Route names, grouped by top-bar tab, all open at any time. The Shop holds everything that spends tokens; the three
// breaks (preseason, midseason, playoffs) walk through it in this order, but it never closes.
export const NAV = {
  week: ['home', 'practice', 'game'],
  team: ['roster'],
  season: ['season', 'bracket', 'standings', 'data'],
  shop: ['recruit', 'staff', 'skills', 'gear', 'locker'],
};
export const navGroup = v => Object.keys(NAV).find(g => NAV[g].includes(v)) || 'week';
// The tabs under the top bar: the pages of the open group (Team has one page, so it has none).
export function subTabs(v) {
  const pages = NAV[navGroup(v)];
  return pages.length > 1 ? pages : [];
}
// The sub-tabs carry a numeral ("01 Overview") only where their order is real: the week's three steps, and the Shop,
// which the breaks walk through in order. The Season pages have no order, so they have none.
const NUMBERED = ['week', 'shop'];
export function tabNumber(v) {
  const g = Object.keys(NAV).find(k => NAV[k].includes(v));
  return NUMBERED.includes(g) ? String(NAV[g].indexOf(v) + 1).padStart(2, '0') : '';
}
// The foot of a Shop page during a break: the next Shop tab, or (on the last one) ending the break. Nothing otherwise.
export function breakFoot(s, v) {
  const pause = E.breakDue(s);
  if (!pause || navGroup(v) !== 'shop') return null;
  return { pause, next: NAV.shop[NAV.shop.indexOf(v) + 1] || null };
}
// The way forward, in one slot at the end of the row under the top bar (on a phone, the bar above the tab bar), on every
// page that has none of its own: on a Shop page during a break, ending the break; elsewhere the week's next step.
// This week's pages carry their own (Home's next-step bar, Prep's Run the week, Game day's Tip off), the roster carries
// "Pick my best five" while the lineup has a problem, and the slot never offers the page it is on.
export function subnavGo(s, v) {
  const g = navGroup(v);
  if (g === 'week') return null;
  if (g === 'shop' && E.breakDue(s)) return 'break';
  if (g === 'team' && E.lineupIssues(s).length) return null;
  return E.nextStep(s).view === v ? null : 'next';
}
