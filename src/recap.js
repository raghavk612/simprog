// "What changed" at the end of a game week: a short, ranked list of what is different now from the start of the week
// (ratings, injuries, tokens, the place in the standings). Pure functions of two snapshots of the save; the result
// dialog (src/ui/screens/results.js) shows the list and the one next step under it.
import * as E from './engine.js';

import { standingsRows } from './ui/lists.js';

const RATINGS_SHOWN = 3;

// The Kangs' place in the standings (1 = first): the Standings page's own ranking (standingsRows), so the two agree.
export function standingsRank(s) {
  const rows = standingsRows(s.standings || {});
  return { rank: rows.find(r => r.you)?.rank ?? null, of: rows.length };
}

// What the recap compares, taken at the start of a week and again after its game.
export function weekSnapshot(s) {
  const { rank, of } = standingsRank(s);
  // The game's income is the budget line of the game just played: the trail numbers it with the week index it ends in.
  const budget = (s.log || []).find(e => e.k === 'budget' && e.week === s.week);
  return {
    week: s.week,
    tokens: s.tokens,
    rank,
    teams: of,
    games: s.wins + s.losses,
    earned: Number.isFinite(budget?.p?.net) ? budget.p.net : null,
    players: s.players.map(p => ({ id: p.id, name: p.name, ovr: E.ratings(p).ovr, injury: p.injury })),
  };
}

// The ranked list: the biggest rating changes (and how many more), new injuries and players back from one, the tokens
// the game earned (or the change in the balance when that isn't known), then the move in the standings.
export function whatChanged(before, after) {
  const was = new Map(before.players.map(p => [p.id, p])),
    both = after.players.filter(p => was.has(p.id)),
    out = [];
  const moved = both
    .filter(p => p.ovr !== was.get(p.id).ovr)
    .map(p => ({ k: 'ovr', id: p.id, name: p.name, from: was.get(p.id).ovr, to: p.ovr }))
    .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from));
  out.push(...moved.slice(0, RATINGS_SHOWN));
  if (moved.length > RATINGS_SHOWN) out.push({ k: 'ovrMore', n: moved.length - RATINGS_SHOWN });
  for (const p of both)
    if (p.injury > 0 && !was.get(p.id).injury)
      out.push({ k: 'injured', id: p.id, name: p.name, n: p.injury });
  for (const p of both)
    if (!p.injury && was.get(p.id).injury > 0) out.push({ k: 'healed', id: p.id, name: p.name });
  out.push({ k: 'tokens', v: after.earned ?? after.tokens - before.tokens });
  out.push({ k: 'rank', from: before.games ? before.rank : null, to: after.rank, of: after.teams });
  return out;
}
