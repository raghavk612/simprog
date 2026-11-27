// What the Season pages and the context rail show besides their own lists: the Journal's game-by-game strip, the
// Bracket's "your seed if the season ended today", and the rail beside Journal, Bracket, Standings and Skills on a wide
// screen. No DOM here, so tests import it; season.js and rail.js draw it. The standings and the place in them are the
// Standings page's own (lists.js standingsRows, recap.js standingsRank), so every page agrees.
import * as E from '../engine.js';
import { standingsRows } from './lists.js';
import { standingsRank } from '../recap.js';
import { seasonTrack } from './scorebug.js';

// One card per scheduled game: its number ("01"), the opponent, home or away, the date, and its state as on the scorebug's track ('played', 'next', 'left'). A played game carries its
// result: won, the Kangs' score first, and the index of the result for its replay.
export function seasonStrip(s) {
  const track = seasonTrack(s);
  return s.schedule.map((g, i) => {
    const r = track[i] === 'played' ? s.results[i] : null;
    return {
      n: String(i + 1).padStart(2, '0'),
      opponent: g.opponent,
      home: !!g.home,
      date: g.date,
      status: track[i],
      result: r ? { won: r.won, for: r.home, against: r.away, index: i } : null,
    };
  });
}

// "Your seed if the season ended today": the place in the standings, while the regular season is still being played.
// Once the run starts (or the season is over) the bracket is real, so there is no projection.
export function bracketSeed(s) {
  if (s.finished || s.week >= E.seasonPlan(s).cut) return null;
  const { rank, of } = standingsRank(s);
  return rank == null ? null : { seed: rank, of };
}

// The pages with the context rail (320 px beside the page from 1440 px wide, under it below that).
export const RAIL_VIEWS = ['season', 'bracket', 'standings', 'skills'];
const TOP = 4;

// The rail: the next game, the last result and the top four. Each card is left out on the page that already shows it
// (Journal lists the results, Standings is the table). It never repeats a scorebug number (the Kangs' record, tokens,
// slots, the game count), and its links are secondary: never the page the purple way forward opens, never the page
// it is on. A card's `link` is a route or null.
export function railModel(s, v) {
  if (!RAIL_VIEWS.includes(v)) return null;
  const way = E.nextStep(s).view,
    usable = l => (l && l !== way && l !== v ? l : null),
    g = s.finished ? null : s.schedule[s.week];
  let next = null;
  if (g) {
    const rec = s.standings?.[g.opponent],
      scout = !s.scouted && s.actions > 0;
    next = {
      name: g.opponent,
      home: !!g.home,
      date: g.date,
      time: g.time || '',
      record: rec ? { w: rec.w, l: rec.l } : null,
      style: s.scouted ? E.opponent(s).style : null,
      // the way to scout while a slot is left, else the game's own page
      link: usable(scout ? 'practice' : null) || usable('game'),
    };
  }
  const r = v !== 'season' ? s.results.at(-1) : null,
    last = r
      ? {
          index: s.results.length - 1,
          opponent: r.opponent,
          won: r.won,
          for: r.home,
          against: r.away,
          date: r.date,
        }
      : null;
  let top = null;
  if (v !== 'standings' && s.standings) {
    const rows = standingsRows(s.standings).slice(0, TOP);
    top = {
      // the place, the name and the winning percentage: never the Kangs' record, which the scorebug shows
      rows: rows.map(x => ({ rank: x.rank, name: x.name, you: x.you, pct: x.pct })),
      place: rows.some(x => x.you) ? null : standingsRank(s),
      link: usable('standings'),
    };
  }
  return { next, last, top };
}
