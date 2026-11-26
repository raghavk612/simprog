// The week's Prep picks as data: what each one changes, why one can't be picked, and the two one-click plans
// ("Suggested plan", "Repeat last week"). Pure functions of the save; src/ui/screens/prep.js shows them.
import * as E from './engine.js';

// Everything a week can hold, in the order Prep lists it: the practice sessions, then the clinic and the film.
export const PREP = [...Object.keys(E.plans), 'fundraise', 'film'];

export const planCap = s => Math.max(0, Math.min(3, s?.actions ?? 0));

// Prep's one purple button, the same way forward Home shows: 'run' (Run the week) while planning the week is the next
// step, 'game' (Go to the game) when tip-off is, and otherwise 'step': that next step (the press room, a break, the
// lineup...) is purple and Run the week waits as a secondary button.
export function prepPrimary(s) {
  const n = E.nextStep(s);
  if (n.view === 'practice' && planCap(s) > 0) return 'run';
  return n.id === 'tipoff' ? 'game' : 'step';
}

const r2 = n => Math.round(n * 100) / 100;
// What a pick changes for the whole team, as chips ({ k, v }) for chipHtml, with the hired assistant's and the
// Training facility's bonuses included (the same rules as E.train). Zero changes are left out.
export function planEffects(s, key) {
  const p = E.plans[key];
  if (key === 'fundraise')
    return [
      { k: 'tokens', v: E.CLINIC.tokens },
      { k: 'fans', v: E.CLINIC.fans },
      { k: 'energy', v: E.CLINIC.energy },
    ];
  if (key === 'film') return E.filmCost(s) ? [{ k: 'tokens', v: -E.filmCost(s) }] : [];
  if (!p) return [];
  const culture = s.assistant === 'culture' && key === 'bond' ? 3 : 0;
  return [
    {
      k: 'skill',
      v: p.skill
        ? r2(
            (p.skill + (s.assistant === 'development' ? 1 : 0)) *
              (E.hasUpgrade(s, 'facility') ? E.UPG.facility : 1),
          )
        : 0,
    },
    { k: 'energy', v: p.energy + (s.assistant === 'recovery' && key === 'recovery' ? 8 : 0) },
    { k: 'morale', v: p.morale + culture },
    { k: 'chem', v: p.chem + culture },
    { k: 'gpa', v: p.gpa },
  ].filter(c => c.v);
}

// Why a pick can't go in this week's plan, as a locale key (and its number), or null when it can.
export function prepBlock(s, key) {
  if (key === 'fundraise' && s.conversation) return { key: 'office.checkDone' };
  if (key === 'film' && s.scouted) return { key: 'prep.filmDone' };
  if (key === 'film' && s.tokens < E.filmCost(s))
    return { key: 'office.needTokens', n: E.filmCost(s) - s.tokens };
  return null;
}

// The plan with picks added to its empty slots, in the order given. A pick the coach already made stays where it is,
// and a pick that is unknown, already in the plan or blocked is skipped. Returns a new array.
export function fillPlan(s, plan, picks) {
  const out = [...plan];
  for (const k of picks) {
    if (out.length >= planCap(s)) break;
    if (PREP.includes(k) && !out.includes(k) && !prepBlock(s, k)) out.push(k);
  }
  return out;
}

// What ran last week, in the order it ran, read from the decision trail (so it survives a reload).
// The trail numbers weeks from 1 at the time of writing, so last week's entries carry the current week index.
const FROM_LOG = { talkFundraise: 'fundraise', scout: 'film' };
export function lastWeekPlan(s) {
  const out = [];
  for (const e of [...(s.log || [])].reverse()) {
    if (e.week !== s.week) continue;
    const k = e.k === 'train' ? e.p?.plan : FROM_LOG[e.k];
    if (k && PREP.includes(k) && !out.includes(k)) out.push(k);
  }
  return out;
}

// Picks ranked by what the rotation needs: recovery for the hurt or tired, study hall for slipping grades, film when it
// hasn't been watched, a team dinner for low chemistry or morale, then skill work. fillPlan takes as many as fit.
export function suggestedPlan(s) {
  const rot = s.players.filter(p => p.starter || p.minutes > 0),
    team = rot.length ? rot : s.players,
    out = [];
  if (team.some(p => p.injury > 0 || p.energy < 40) || E.mean(team, 'energy') < 65) out.push('recovery');
  if (team.some(p => p.gpa < 2.3)) out.push('study');
  if (!prepBlock(s, 'film')) out.push('film');
  if (s.chemistry < 55 || E.mean(team, 'morale') < 60) out.push('bond');
  for (const k of ['shooting', 'defense', 'recovery', 'study', 'bond']) if (!out.includes(k)) out.push(k);
  return out;
}
