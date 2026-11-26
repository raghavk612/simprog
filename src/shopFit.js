// What the Shop needs to say about a decision before the coach makes it: how a tryout compares with the team (on the
// roster's OVR scale), what the team needs most, how many tokens a refused purchase is missing, and what dismissing the
// assistant loses. Pure functions of the save; no DOM, so tests/shop.test.js reads the same numbers the cards show.
import { ratings, bio, staff } from './engine.js';
import { t } from './i18n/index.js';
import { tv } from './narrative.js';

const RATINGS = ['ins', 'mid', 'tpt', 'perd', 'insd'];
const ovr = p => ratings(p).ovr;
// +4, −3 or ±0: the sign is always shown, so the line reads the same without its colour.
const signedDiff = d => (d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0');

// The five the comparison is made against: the chosen starters, or the five best by OVR before a lineup is set.
export function startersOf(s) {
  const set = s.players.filter(p => p.starter);
  return set.length ? set : [...s.players].sort((a, b) => ovr(b) - ovr(a)).slice(0, 5);
}
const weakest = list => list.reduce((a, b) => (ovr(b) < ovr(a) ? b : a), list[0]);

// A tryout against the team: his OVR, where he would rank, and the starter he would have to beat (the weakest starter at
// his position, or the weakest starter of all when nobody in the five plays it).
export function prospectFit(s, p) {
  const o = ovr(p),
    position = bio(p).position,
    five = startersOf(s),
    same = five.filter(q => bio(q).position === position),
    vs = weakest(same.length ? same : five);
  const fit = {
    ovr: o,
    position,
    rank: 1 + s.players.filter(q => ovr(q) > o).length,
    total: s.players.length + 1,
    vs: null,
    diff: 0,
    starts: false,
  };
  if (!vs) return fit;
  fit.vs = { id: vs.id, name: vs.name, ovr: ovr(vs), pos: bio(vs).position, samePos: same.length > 0 };
  fit.diff = o - fit.vs.ovr;
  fit.starts = fit.diff > 0;
  return fit;
}
// One line under a tryout card: "Would start: +4 over Karter Martin, starting Guard · #3 of 14 by OVR".
export function fitLine(s, p) {
  const f = prospectFit(s, p),
    rank = t('recruit.rank', { rank: f.rank, total: f.total });
  if (!f.vs) return rank;
  const key = `recruit.${f.starts ? 'over' : 'under'}${f.vs.samePos ? 'Pos' : 'Any'}`;
  return `${t(key, { d: signedDiff(f.diff), name: f.vs.name, pos: tv(f.position) })} · ${rank}`;
}

// The team's needs: its weakest starter, and the rating the five are lowest in on average.
export function teamNeeds(s) {
  const five = startersOf(s);
  if (!five.length) return null;
  const low = weakest(five),
    all = five.map(ratings),
    avg = k => all.reduce((n, r) => n + r[k], 0) / all.length,
    key = RATINGS.reduce((a, b) => (avg(b) < avg(a) ? b : a));
  return {
    weakest: { id: low.id, name: low.name, ovr: ovr(low), pos: bio(low).position },
    rating: { key, value: Math.round(avg(key)) },
  };
}
// The pinned line at the top of Tryouts.
export function needsLine(s) {
  const n = teamNeeds(s);
  return n
    ? t('recruit.needs', {
        pos: tv(n.weakest.pos),
        name: n.weakest.name,
        ovr: n.weakest.ovr,
        rating: t(`rv.${n.rating.key}T`),
        value: n.rating.value,
      })
    : '';
}

// A purchase the tokens do not cover: how many are missing and how many the coach has.
export function tokenShort(s, cost) {
  return s.tokens < cost ? { n: cost - s.tokens, have: s.tokens } : null;
}
export function shortText(s, cost) {
  const m = tokenShort(s, cost);
  return m ? t('shop.needTokens', m) : '';
}

// The confirmation before dismissing the assistant: who goes and the tokens paid for them, which are not refunded.
export function dismissText(s) {
  const a = staff.find(a => a.key === s.assistant);
  return a ? t('confirm.dismiss', { name: t(`staff.${a.key}.name`), cost: a.cost }) : '';
}
