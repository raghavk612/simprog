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
// The foot of a Shop page during a break: the next Shop tab, or (on the last one) ending the break. Nothing otherwise.
export function breakFoot(s, v) {
  const pause = E.breakDue(s);
  if (!pause || navGroup(v) !== 'shop') return null;
  return { pause, next: NAV.shop[NAV.shop.indexOf(v) + 1] || null };
}
// The way forward at the end of the row under the top bar, on pages that have none of their own: on a Shop page,
// ending the break while one is open, otherwise the week's next step. Other pages carry their own primary button.
export function subnavGo(s, v) {
  if (navGroup(v) !== 'shop') return null;
  return E.breakDue(s) ? 'break' : 'next';
}
