/* =========================================================================
   ROAD TO THE CHAMPIONSHIP · ENGINE
   Pure game logic: no DOM access. All randomness flows through the seeded
   Mulberry32 generator stored in G.rs, so a seed replays an identical season.
   ========================================================================= */
'use strict';

const U = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  esc: s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  money: n => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US'),
  sum: a => a.reduce((s, x) => s + x, 0),
  avg: a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0,
  signed: (n, d = 0) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n).toFixed(d),
  hash(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return (h >>> 0) || 1; },
  clone: o => JSON.parse(JSON.stringify(o)),
};

/* ---------- Seeded RNG (Mulberry32) ---------- */
let G = null;               // the whole saved game state
function R() {
  let s = G.rs | 0; s = (s + 0x6D2B79F5) | 0; G.rs = s;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
const pick = arr => arr[Math.floor(R() * arr.length)];
const chance = p => R() < p;
const gauss = () => (R() + R() + R() + R() - 2) / 0.8165; // ~N(0,1)
function wpick(items, wf) { const ws = items.map(wf); let t = U.sum(ws) * R(); for (let i = 0; i < items.length; i++) { t -= ws[i]; if (t <= 0) return items[i]; } return items[items.length - 1]; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ---------- Static data ---------- */
const FIRST = ['Marcus','Eli','Jaylen','Owen','Mateo','Caleb','Isaiah','Noah','Darius','Leo','Andre','Ty','Gabe','Micah','Julian','Xavier','Cole','Rashad','Nico','Evan','Tariq','Luis','Devin','Kai','Malik','Wes','Jonah','Dante','Ramon','Theo','Bryce','Omar','Quentin','Silas','Hector','Jalen','Aaron','Felix','Troy','Nate','Kendrick','Vince','Isaac','Ben','Diego','Marco','Reggie','Tomas','Zion','Ahmad','Ivan','Hugo','Keon','Parker','Jace','Emmett','Dom','Rafael','Sam','Chris'];
const LAST = ['Carter','Brooks','Reyes','Hayes','Whitfield','Okafor','Lindqvist','Duarte','Pryor','Castillo','Nguyen','Bennett','Holloway','Kim','Oyelaran','Marsh','Delgado','Fitzgerald','Coleman','Park','Abernathy','Vance','Mendez','Sutton','Ramsey','Beaumont','Ellis','Tran','Ashford','Kowalski','Grant','Mbeki','Harlow','Ortega','Pierce','Novak','Hale','Sandoval','Winslow','Achebe','Barrett','Quinn','Lowery','Fontaine','Dawson','Silva','Moreau','Tate','Iverson','Crane','Rhodes','Baptiste','Kerr','Montoya','Singh','Whitaker','Osei','Lambert','Rowe','Foster'];

const POS = ['PG', 'SG', 'SF', 'PF', 'C'];
const POS_NAME = { PG: 'Point Guard', SG: 'Shooting Guard', SF: 'Small Forward', PF: 'Power Forward', C: 'Center' };
const ATTR = ['sho', 'ins', 'def', 'pas', 'reb', 'sta'];
const ATTR_NAME = { sho: 'Shooting', ins: 'Inside', def: 'Defense', pas: 'Passing', reb: 'Rebounding', sta: 'Stamina' };
const WEIGHT = {
  PG: { sho: .25, ins: .10, def: .20, pas: .30, reb: .05, sta: .10 },
  SG: { sho: .35, ins: .15, def: .20, pas: .15, reb: .05, sta: .10 },
  SF: { sho: .25, ins: .20, def: .20, pas: .10, reb: .15, sta: .10 },
  PF: { sho: .10, ins: .30, def: .20, pas: .05, reb: .25, sta: .10 },
  C:  { sho: .05, ins: .30, def: .25, pas: .05, reb: .30, sta: .05 },
};
const PROFILE = {
  PG: { sho: 3, ins: -6, def: 0, pas: 9, reb: -10, sta: 4 },
  SG: { sho: 8, ins: -2, def: 0, pas: 1, reb: -7, sta: 2 },
  SF: { sho: 2, ins: 2, def: 2, pas: -2, reb: 0, sta: 1 },
  PF: { sho: -6, ins: 6, def: 1, pas: -6, reb: 8, sta: -1 },
  C:  { sho: -12, ins: 9, def: 3, pas: -8, reb: 12, sta: -3 },
};
const TRAITS = {
  Leader:      { d: 'Team chemistry +1 each week. Never loses morale from sitting.' },
  'Hard Worker': { d: 'Gains 25% more from practice.' },
  Scholar:     { d: 'Grades never slip. Adds reputation.' },
  Showboat:    { d: 'Fans love him (+fans on wins), but chemistry −1 each week.' },
  Clutch:      { d: 'Shoots better in the 4th quarter.' },
  Hothead:     { d: 'Big morale swings after wins and losses.' },
  Steady:      { d: 'Morale changes are halved.' },
};
const YEAR = { 9: 'FR', 10: 'SO', 11: 'JR', 12: 'SR' };

const MASCOTS = {
  hawks:  { name: 'Hawks' },
  wolves: { name: 'Wolves' },
  bolts:  { name: 'Bolts' },
  flames: { name: 'Flames' },
  knights:{ name: 'Knights' },
  comets: { name: 'Comets' },
};
const PALETTES = [
  { id: 'crimson', name: 'Crimson & Gold', c: ['#A6192E', '#F2B632'] },
  { id: 'royal',   name: 'Royal & White',  c: ['#1D4FA3', '#FFFFFF'] },
  { id: 'forest',  name: 'Forest & Gold',  c: ['#1F6B3A', '#E8B923'] },
  { id: 'purple',  name: 'Purple & Silver',c: ['#5B2A86', '#C9CED6'] },
  { id: 'orange',  name: 'Orange & Black', c: ['#D9581A', '#1A1A1A'] },
  { id: 'navy',    name: 'Navy & Sky',     c: ['#16294F', '#7DB7E8'] },
  { id: 'maroon',  name: 'Maroon & Cream', c: ['#6E1E2B', '#F1E6D6'] },
  { id: 'teal',    name: 'Teal & Charcoal',c: ['#0F7C7A', '#23292F'] },
];
const DISTRICT = [
  { name: 'Lakeview', mascot: 'Lions', icon: 'comets', c: ['#0B5D8C', '#F2C14E'] },
  { name: 'Pine Hollow', mascot: 'Pioneers', icon: 'knights', c: ['#2E5E3A', '#D8C9A3'] },
  { name: 'Eastbrook', mascot: 'Eagles', icon: 'hawks', c: ['#7A1F2B', '#C0C6CC'] },
  { name: 'Maple Falls', mascot: 'Miners', icon: 'flames', c: ['#3B3F46', '#E5A33B'] },
  { name: 'Summit Valley', mascot: 'Stallions', icon: 'bolts', c: ['#4B2C82', '#F0B429'] },
  { name: 'Harbor City', mascot: 'Mariners', icon: 'wolves', c: ['#12507A', '#7FC8C4'] },
  { name: 'Westfield', mascot: 'Wolverines', icon: 'wolves', c: ['#8C4A12', '#1E1E1E'] },
];
const NONDISTRICT = [
  { name: 'Brookside', mascot: 'Beavers', icon: 'knights', c: ['#6A4B2A', '#E2D3B5'] },
  { name: 'Ironwood', mascot: 'Rams', icon: 'bolts', c: ['#303841', '#D64541'] },
  { name: 'Clearwater', mascot: 'Cougars', icon: 'wolves', c: ['#1F7A8C', '#F3F3F3'] },
];
const STATE_FIELD = [
  { name: 'Granite Peak', mascot: 'Rams', icon: 'bolts', c: ['#44505C', '#E9B44C'] },
  { name: 'Silver Lake', mascot: 'Storm', icon: 'comets', c: ['#23395B', '#A7C4E2'] },
  { name: 'Capital Prep', mascot: 'Titans', icon: 'knights', c: ['#151B2C', '#C9A227'] },
];

const DIFF = {
  rookie: { name: 'Easy', opp: -5, you: 2, budget: 3200, scout: 6, inj: .7, sev: .75, d: 'More money ($3,200), weaker rivals, 6 scout points, fewer injuries, smaller penalties, exact numbers on every choice.' },
  varsity:{ name: 'Medium', opp: -1, you: 0, budget: 2400, scout: 4, inj: 1, sev: 1, d: 'The intended challenge: $2,400, normal rivals, 4 scout points. Smart planning wins titles.' },
  legend: { name: 'Hard', opp: 2, you: -1, budget: 1700, scout: 3, inj: 1.25, sev: 1.25, d: 'Tight money ($1,700), stacked rivals, 3 scout points, more injuries, bigger penalties.' },
};
const DRILLS = {
  shooting:   { name: 'Shooting Drills',  short: 'Shooting', grow: { sho: 1 }, energy: -5, morale: 0, chem: 0, inj: .010, d: 'Grow Shooting. Light fatigue.' },
  defense:    { name: 'Defensive Drills', short: 'Defense', grow: { def: 1, reb: .4 }, energy: -7, morale: -1, chem: 1, inj: .015, d: 'Grow Defense & Rebounding.' },
  scrimmage:  { name: 'Full Scrimmage',   short: 'Scrimmage', grow: { ins: .6, pas: .6, sho: .3, def: .3 }, energy: -10, morale: 2, chem: 3, inj: .045, d: 'All-round growth + chemistry. Highest injury risk.' },
  conditioning:{ name: 'Conditioning',    short: 'Conditioning', grow: { sta: 1.3 }, energy: -9, morale: -3, chem: 0, inj: .02, d: 'Grow Stamina. Players hate it.' },
  film:       { name: 'Film Study',       short: 'Film', grow: { pas: .35, def: .3 }, energy: 2, morale: 0, chem: 1, inj: 0, scout: true, d: 'Reveals the next opponent’s game plan. Restful.' },
  bonding:    { name: 'Team Bonding',     short: 'Bonding', grow: {}, energy: 4, morale: 5, chem: 6, inj: 0, d: 'Big chemistry & morale boost. No skill growth.' },
  rest:       { name: 'Rest & Recovery',  short: 'Rest', grow: {}, energy: 15, morale: 2, chem: 0, inj: 0, heal: true, d: 'Restore energy, speed up injury healing.' },
  study:      { name: 'Study Hall',       short: 'Study Hall', grow: {}, energy: 3, morale: -1, chem: 0, gpa: .14, inj: 0, d: 'Raise everyone’s GPA to keep them eligible.' },
  fundraiser: { name: 'Fundraiser',       short: 'Fundraiser', grow: {}, energy: -3, morale: 0, chem: 1, inj: 0, money: true, d: 'Car wash or bake sale. Earn money and fan support.' },
};
const PRESETS = {
  balanced: { name: 'Balanced week', plan: ['shooting', 'defense', 'scrimmage', 'film'] },
  develop:  { name: 'Skill builder', plan: ['shooting', 'defense', 'conditioning', 'scrimmage'] },
  recover:  { name: 'Recovery week', plan: ['film', 'bonding', 'rest', 'study'] },
};

const UPGRADES = {
  assistant: { name: 'Assistant Coach', cost: 1200, d: 'Practice gains +25% for the rest of the season.' },
  trainer:   { name: 'Athletic Trainer', cost: 900, d: 'Injury risk −40% and injuries heal twice as fast.' },
  equipment: { name: 'Recovery Equipment', cost: 700, d: 'Players recover +8 extra energy every week.' },
  scouting:  { name: 'Scouting Service', cost: 500, d: 'Always see the opponent’s full game plan, no Film Study needed.' },
  store:     { name: 'Team Store', cost: 600, d: '+$150 at each home game and +1 fan support per week.' },
  tutoring:  { name: 'Tutoring Program', cost: 450, d: 'Every player’s GPA +0.05 each week.' },
};

const TEMPO_POSS = { slow: 13, balanced: 16, fast: 19 };
const ROUNDS = ['Sectional Semifinal', 'Sectional Final', 'State Semifinal', 'State Championship'];

/* ---------- Players & teams ---------- */
function ovr(p) { const w = WEIGHT[p.pos]; let o = 0; for (const k in w) o += p.r[k] * w[k]; return Math.round(o); }
function usedNums(list) { return new Set(list.map(p => p.num)); }
function genPlayer(base, pos, year, taken) {
  const r = {};
  for (const k of ATTR) r[k] = U.clamp(Math.round(base + PROFILE[pos][k] + gauss() * 6), 25, 94);
  let num; const pool = [0, 1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 15, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 40, 41, 42, 43, 44, 45, 50, 51, 52, 53, 54, 55];
  do { num = pick(pool); } while (taken && taken.has(num) && taken.size < pool.length);
  if (taken) taken.add(num);
  const p = { id: 'p' + Math.floor(R() * 1e9).toString(36), first: pick(FIRST), last: pick(LAST), num, pos, year, r,
    pot: 0, ethic: +R().toFixed(2), trait: pick(Object.keys(TRAITS)), gpa: +(2.15 + R() * 1.75).toFixed(2),
    morale: ri(60, 78), energy: 100, inj: 0, start: 0, s: { gp: 0, pts: 0, reb: 0, ast: 0, min: 0 } };
  const o = ovr(p);
  p.pot = U.clamp(o + ri(4, 16) + (12 - year) * 2, o + 3, 96);
  p.start = o;
  if (p.trait === 'Scholar') p.gpa = Math.max(p.gpa, 3.2);
  p.gpaBase = p.gpa;
  return p;
}
function genRoster(base, n = 10) {
  const taken = new Set(); const out = [];
  const posPlan = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C', 'SF', 'SG'];
  for (let i = 0; i < n; i++) out.push(genPlayer(base - (i >= 5 ? 5 : 0) + gauss() * 1.5, posPlan[i], ri(10, 12), taken));
  return out;
}
function teamRating(roster) {
  const avail = roster.filter(p => !p.inj).map(ovr).sort((a, b) => b - a);
  const top = avail.slice(0, 8); const w = [1.25, 1.2, 1.15, 1.1, 1.05, .7, .55, .45];
  let s = 0, ws = 0; top.forEach((v, i) => { s += v * w[i]; ws += w[i]; });
  return ws ? s / ws : 40;
}
function makeOpp(def, base, extra = {}) {
  const styles = { tempo: pick(['slow', 'balanced', 'fast']), def: pick(['man', 'man', 'zone', 'press']), focus: pick(['inside', 'balanced', 'perimeter']) };
  const roster = genRoster(base, 9);
  return Object.assign({ id: 't' + Math.floor(R() * 1e9).toString(36), name: def.name, mascot: def.mascot, icon: def.icon, c: def.c, style: styles, roster, w: 0, l: 0, pf: 0, pa: 0 }, extra);
}
function oppRating(t) { return Math.round(teamRating(t.roster)); }
function starOf(roster) { return roster.filter(p => !p.inj).slice().sort((a, b) => (ovr(b) + b.r.sho * .3) - (ovr(a) + a.r.sho * .3))[0]; }

/* ---------- New game / career ---------- */
const MAX_SEASONS = 4;
function seasonLabel(n) { return `${2025 + n}–${String(26 + n).padStart(2, '0')}`; }
function titleYear(n) { return 2026 + n; }
function newGame(opts) {
  const seedStr = (opts.seed || '').trim() || String(Date.now());
  G = { v: 4, seed: seedStr, rs: U.hash(seedStr), diff: opts.diff || 'varsity', school: { name: opts.name || 'Riverside', mascot: opts.mascot || 'hawks', pal: opts.pal || 'crimson' },
    season: 1, career: [], banners: [], prestige: 50, campBoost: 0, alumni: [],
    strategy: { tempo: 'balanced', def: 'man', focus: 'balanced', rot: 'normal' }, lineup: [],
    res: { budget: DIFF[opts.diff || 'varsity'].budget, fans: 45, rep: 60, chem: 50 }, upgrades: {}, tips: true };
  const d = DIFF[G.diff];
  // your returning roster: 8 players, slightly under the district middle
  const taken = new Set();
  const plan = ['PG', 'SG', 'SF', 'PF', 'C', 'SG', 'PF', 'SF'];
  G.roster = plan.map((pos, i) => genPlayer(51 + d.you - (i >= 5 ? 5 : 0) + gauss() * 1.5, pos, ri(10, 12), taken));
  G.roster.forEach(p => p.joined = 1);
  setupSeason();
  G.log.push({ w: 0, t: `Hired as head coach of the ${G.school.name} ${MASCOTS[G.school.mascot].name} on a ${MAX_SEASONS}-year contract. Goal: win State.` });
  return G;
}
/* Fresh world for a season: prospects, opponents, schedule. Your roster/school carry over. */
function setupSeason() {
  const d = DIFF[G.diff]; const n = G.season;
  Object.assign(G, { phase: 'tryouts', week: 1, step: 'practice', plan: [], practiceDone: null, event: null, eventDone: null,
    flags: {}, usedEvents: [], log: [], hist: [], games: [], scoutPts: d.scout, scouted: {}, signed: [], playoffs: null, ending: null, offseason: null,
    lastGame: null, injuriesTotal: 0, comeback: false, giantSlayer: false, startBudget: G.res.budget });
  const taken = usedNums(G.roster);
  // Prospects: winning programs (higher prestige) attract better players; a youth camp improves freshmen.
  const pres = (G.prestige - 50) / 6;
  G.prospects = [];
  const pp = shuffle(['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'C', 'SF', 'SG', 'PF']);
  pp.forEach((pos, i) => { const yr = i < 4 ? 9 : ri(9, 11); const base = 46 + d.you + pres + (yr === 9 ? G.campBoost : 0) + gauss() * 5.5 + (i === 0 ? 7 : 0) + (i === 1 ? 4 : 0); const p = genPlayer(base, pos, yr, taken); p.joined = n; G.prospects.push(p); });
  G.prospects.forEach(p => { p.fog = ri(4, 8); p.fogShift = ri(-3, 3); p.transfer = p.year >= 10 && chance(.5); });
  G.campBoost = 0;
  G.maxSign = Math.max(0, 12 - G.roster.length); G.minSign = Math.max(0, 10 - G.roster.length);
  // Rivals reload every year and the state field gets tougher as your program rises.
  const grow = (n - 1) * 3.2;
  const bases = shuffle([50, 52.5, 54, 55.5, 57, 58.5, 60.5]);
  G.teams = DISTRICT.map((t, i) => makeOpp(t, bases[i] + d.opp + grow));
  G.nondistrict = NONDISTRICT.map((t, i) => makeOpp(t, [53, 55.5, 58][i] + d.opp + grow));
  G.stateField = STATE_FIELD.map((t, i) => makeOpp(t, [61.5, 64, 66.5][i] + d.opp + grow * 1.55, { st: true }));
  buildSchedule();
}
function canContinueCareer() { return G.ending && G.ending.kind !== 'crisis' && G.season < MAX_SEASONS; }
const SUMMER = {
  league:   { name: 'Summer league', cost: 600, d: 'Every returning player grows across all skills.', grow: { sho: .7, ins: .7, def: .7, pas: .7, reb: .7, sta: .7 } },
  skills:   { name: 'Shooting & skills camp', cost: 450, d: 'Big jump in Shooting and Passing.', grow: { sho: 2.2, pas: 1.6 } },
  strength: { name: 'Strength program', cost: 450, d: 'Big jump in Inside, Rebounding and Stamina.', grow: { ins: 1.6, reb: 1.6, sta: 1.4 } },
  youth:    { name: 'Youth camp for middle schoolers', cost: 500, d: 'No growth now, but next year’s freshmen tryout class is much stronger. Fans +5.', grow: {} },
  rest:     { name: 'Rest & family time', cost: 0, d: 'Free. Players return happy (morale +10) with only natural growth.', grow: {} },
};
function startOffseason() {
  const grads = G.roster.filter(p => p.year >= 12);
  G.phase = 'offseason';
  G.offseason = { grads: grads.map(p => p.id), summer: 'league' };
}
function nextBudgetPreview(summerKey) {
  const left = G.res.budget; const k = G.ending.kind;
  const bonus = { perfect: 600, champion: 500, runnerup: 400, final4: 300, contender: 200, missed: 0, crisis: 0 }[k] || 0;
  const base = DIFF[G.diff].budget; const carry = left >= 0 ? Math.round(left * .35) : left; const gate = Math.round(G.res.fans * 4);
  const cost = SUMMER[summerKey] ? SUMMER[summerKey].cost : 0;
  return { base, carry, bonus, gate, cost, total: base + carry + bonus + gate - cost };
}
function applyOffseason(summerKey) {
  const sp = SUMMER[summerKey] || SUMMER.rest; const n = G.season; const k = G.ending.kind;
  const b = nextBudgetPreview(summerKey);
  // graduation
  const grads = G.roster.filter(p => p.year >= 12);
  grads.forEach(p => G.alumni.push({ name: `${p.first} ${p.last}`, num: p.num, pos: p.pos, ovr: ovr(p), joined: p.joined || 1, joinedYear: p.joinedYear || p.year, pts: (p.cs ? p.cs.pts : 0) + p.s.pts, gp: (p.cs ? p.cs.gp : 0) + p.s.gp, left: n, fourYear: (p.joinedAsFr && n - (p.joined || 1) >= 3) }));
  G.roster = G.roster.filter(p => p.year < 12);
  // returning players: age, grow, reset
  G.roster.forEach(p => {
    p.cs = p.cs || { gp: 0, pts: 0, reb: 0, ast: 0, min: 0 }; for (const key in p.s) p.cs[key] += p.s[key];
    p.s = { gp: 0, pts: 0, reb: 0, ast: 0, min: 0 };
    p.year++;
    const room = Math.max(0, p.pot - ovr(p)); const nat = (1.2 + room * .18) * (.6 + p.ethic * .6);
    for (const a of ATTR) p.r[a] = U.clamp(p.r[a] + nat * .5 + (sp.grow[a] || 0) * (.7 + p.ethic * .6) + gauss() * .6, 20, 99);
    p.start = ovr(p); p.energy = 100; p.inj = 0; p.suspended = false; p.suspendWeeks = 0;
    p.morale = U.clamp(Math.round(p.morale * .4 + 62 * .6 + (summerKey === 'rest' ? 10 : 0)), 0, 100);
    p.gpa = U.clamp(+((p.gpaBase || 2.8) * .7 + p.gpa * .3 + (R() - .5) * .2).toFixed(2), 1.6, 4); // new school year: grades reset toward the player's norm
  });
  if (summerKey === 'youth') { G.campBoost = 5; }
  // program-level carryover
  const succ = { perfect: 25, champion: 22, runnerup: 14, final4: 10, contender: 5, missed: -4, crisis: -10 }[k] || 0;
  G.prestige = U.clamp(Math.round(G.prestige * .6 + (50 + succ * 1.4) * .4 + succ * .5), 20, 95);
  G.res.fans = U.clamp(Math.round(G.res.fans * .7 + 45 * .3 + succ * .4 + (summerKey === 'youth' ? 5 : 0)), 10, 100);
  G.res.rep = U.clamp(Math.round(G.res.rep * .8 + 60 * .2), 5, 100);
  G.res.chem = U.clamp(Math.round(G.res.chem * .5 + 48 * .5), 0, 100);
  G.res.budget = b.total;
  ['assistant', 'trainer', 'scouting', 'tutoring'].forEach(u => delete G.upgrades[u]); // yearly contracts; facilities stay
  G.season = n + 1;
  setupSeason();
  G.log.push({ w: 0, t: `Season ${G.season} (${seasonLabel(G.season)}) begins. ${grads.length} senior${grads.length === 1 ? '' : 's'} graduated. Summer: ${sp.name}. Program prestige ${G.prestige}.` });
}
const CAREER_END = {
  dynasty:  { title: 'Dynasty Builder', text: 'Multiple State titles. Your name goes on the gym floor.' },
  champion: { title: 'Championship Coach', text: 'You brought a State title home. The banner hangs forever.' },
  builder:  { title: 'Program Builder', text: 'Year after year in the playoffs. You turned this into a winning program.' },
  journey:  { title: 'Journeyman Coach', text: 'Some good moments, but the program never broke through.' },
  fired:    { title: 'Contract Terminated', text: 'The school ended your contract after the program fell into crisis.' },
};
function endCareer() {
  const titles = G.career.filter(c => c.kind === 'champion' || c.kind === 'perfect').length;
  const playoffs = G.career.filter(c => !['missed', 'crisis'].includes(c.kind)).length;
  const fired = G.career.some(c => c.kind === 'crisis');
  const kind = fired ? 'fired' : titles >= 2 ? 'dynasty' : titles === 1 ? 'champion' : playoffs >= Math.ceil(G.career.length / 2) ? 'builder' : 'journey';
  const w = U.sum(G.career.map(c => c.rec.w)), l = U.sum(G.career.map(c => c.rec.l));
  const avgPct = U.avg(G.career.map(c => c.total / c.max));
  const grade = avgPct >= .9 ? 'A+' : avgPct >= .8 ? 'A' : avgPct >= .7 ? 'B' : avgPct >= .58 ? 'C' : avgPct >= .45 ? 'D' : 'F';
  let streak = 0, b2b = false; G.career.forEach(c => { if (c.kind === 'champion' || c.kind === 'perfect') { streak++; if (streak >= 2) b2b = true; } else streak = 0; });
  const ach = [
    { n: 'Back-to-Back', d: 'Win State in consecutive seasons.', got: b2b },
    { n: 'Dynasty', d: 'Win two or more State titles.', got: titles >= 2 },
    { n: 'Full Contract', d: `Coach all ${MAX_SEASONS} seasons.`, got: G.career.length >= MAX_SEASONS && !fired },
    { n: 'Homegrown Hero', d: 'Coach a player from freshman tryouts all the way to graduation.', got: G.alumni.some(a => a.fourYear) },
    { n: 'Perennial Contender', d: 'Make the playoffs every season.', got: G.career.length > 1 && playoffs === G.career.length },
    { n: 'Packed Program', d: 'Reach 80 program prestige.', got: G.prestige >= 80 },
  ];
  G.phase = 'career'; G.careerEnd = { kind, titles, playoffs, w, l, grade, ach };
}
function buildSchedule() {
  // circle method round robin for 8 teams (index 0 = you)
  const ids = ['me', ...G.teams.map(t => t.id)]; const n = ids.length; const rounds = [];
  const arr = ids.slice();
  for (let r = 0; r < n - 1; r++) {
    const pairs = []; for (let i = 0; i < n / 2; i++) pairs.push([arr[i], arr[n - 1 - i]]);
    rounds.push(pairs); arr.splice(1, 0, arr.pop());
  }
  const districtWeeks = [1, 2, 4, 5, 7, 8, 10]; const ndWeeks = [3, 6, 9];
  G.schedule = [];
  for (let w = 1; w <= 10; w++) {
    if (ndWeeks.includes(w)) {
      const ndi = ndWeeks.indexOf(w); G.schedule.push({ w, opp: G.nondistrict[ndi].id, home: ndi !== 1, nd: true, others: null });
    } else {
      const pairs = rounds[districtWeeks.indexOf(w)];
      const mine = pairs.find(p => p.includes('me')); const opp = mine[0] === 'me' ? mine[1] : mine[0];
      G.schedule.push({ w, opp, home: w % 2 === 1, others: pairs.filter(p => p !== mine) });
    }
  }
}
function teamById(id) { return G.teams.find(t => t.id === id) || G.nondistrict.find(t => t.id === id) || G.stateField.find(t => t.id === id) || (G.playoffs && G.playoffs.extra && G.playoffs.extra.find(t => t.id === id)); }
function myRating() { return Math.round(teamRating(G.roster)); }
function teamMorale() { return Math.round(U.avg(G.roster.map(p => p.morale))); }
function avgEnergy() { return Math.round(U.avg(G.roster.filter(p => !p.inj).map(p => p.energy))); }
function eligible(p) { return !p.inj && p.gpa >= 2.0 && !p.suspended; }
function schoolColors() { return (PALETTES.find(p => p.id === G.school.pal) || PALETTES[0]).c; }
function myName() { return G.school.name; }
function myFull() { return G.school.name + ' ' + MASCOTS[G.school.mascot].name; }
function currentOpp() {
  if (G.phase === 'playoffs') return teamById(G.playoffs.opp);
  const s = G.schedule[G.week - 1]; return teamById(s.opp);
}
function currentGameInfo() {
  if (G.phase === 'playoffs') { const r = G.playoffs.round; return { opp: teamById(G.playoffs.opp), home: r < 2 ? G.playoffs.seed <= 2 || G.playoffs.homeCourt : null, label: ROUNDS[r], neutral: r >= 2 }; }
  const s = G.schedule[G.week - 1]; return { opp: teamById(s.opp), home: s.home, label: s.nd ? 'Non-district · ' + ['Holiday Classic', 'Rivalry Showcase', 'Winter Invitational'][[3, 6, 9].indexOf(s.w)] : 'District game', neutral: false };
}
function practiceSlots() { return G.phase === 'playoffs' ? 3 : 4; }

/* ---------- Tryouts ---------- */
function scoutProspect(id) { if (G.scoutPts <= 0 || G.scouted[id]) return false; G.scoutPts--; G.scouted[id] = true; return true; }
function prospectRange(p) { const o = ovr(p); return [o - p.fog + p.fogShift, o + p.fog + p.fogShift]; }
function finalizeTryouts() {
  const chosen = G.prospects.filter(p => G.signed.includes(p.id));
  chosen.forEach(p => { delete p.fog; delete p.fogShift; p.start = ovr(p); p.joined = G.season; p.joinedAsFr = p.year === 9; G.roster.push(p); });
  G.log.push({ w: 0, t: `Signed ${chosen.length} player${chosen.length === 1 ? '' : 's'} at tryouts: ${chosen.map(p => p.first + ' ' + p.last).join(', ') || 'none'}.` });
  G.prospects = []; G.phase = 'season'; G.week = 1; G.step = 'practice'; G.plan = new Array(practiceSlots()).fill(null);
  weekStart(true);
  autoLineup();
}
function autoSignBest() {
  const need = G.maxSign; const ranked = G.prospects.slice().sort((a, b) => (ovr(b) + (b.pot - ovr(b)) * .3) - (ovr(a) + (a.pot - ovr(a)) * .3));
  G.signed = ranked.slice(0, need).map(p => p.id);
}

/* ---------- Weekly flow ---------- */
function weekStart(first) {
  const up = G.upgrades;
  G.roster.forEach(p => {
    if (!first) p.energy = U.clamp(p.energy + 18 + (up.equipment ? 8 : 0), 0, 100);
    if (!first) {
      let drift = p.trait === 'Scholar' ? 0.01 : -(0.02 + R() * 0.05);
      if (up.tutoring) drift += .05;
      p.gpa = U.clamp(+(p.gpa + drift).toFixed(2), 1.2, 4.0);
    }
    p.suspended = p.suspendWeeks > 0; if (p.suspendWeeks > 0) p.suspendWeeks--;
  });
  const leaders = G.roster.filter(p => p.trait === 'Leader').length, show = G.roster.filter(p => p.trait === 'Showboat').length;
  G.res.chem = U.clamp(G.res.chem + leaders - show * 0.5, 0, 100);
  if (up.store) G.res.fans = U.clamp(G.res.fans + 1, 0, 100);
  if (!first) G.res.budget -= 100; // officials, laundry, gym costs
  G.plan = new Array(practiceSlots()).fill(null); G.practiceDone = null; G.event = null; G.eventDone = null; G.step = 'practice';
  G.flags.filmThisWeek = false;
}

function planComplete() { return G.plan.length && G.plan.every(Boolean); }
function projectPractice(plan) {
  // returns an approximate preview without consuming RNG
  const out = { energy: 0, morale: 0, chem: 0, gpa: 0, money: 0, fans: 0, inj: 0, grow: {}, scout: false, heal: false };
  const counts = {};
  plan.forEach(k => { if (!k) return; const d = DRILLS[k]; counts[k] = (counts[k] || 0) + 1; const dim = [1, .8, .6, .45][counts[k] - 1] || .35;
    out.energy += d.energy; out.morale += d.morale; out.chem += d.chem * dim; out.gpa += d.gpa || 0; out.inj += d.inj;
    if (d.money) { out.money += Math.round(300 * (0.6 + G.res.fans / 100)); out.fans += 3; }
    if (d.scout) out.scout = true; if (d.heal) out.heal = true;
    for (const a in d.grow) out.grow[a] = (out.grow[a] || 0) + d.grow[a] * dim; });
  const e0 = avgEnergy(); out.energyAfter = U.clamp(e0 + out.energy, 0, 100); out.energyBefore = e0;
  out.injRisk = out.inj * DIFF[G.diff].inj * (G.upgrades.trainer ? .6 : 1) * (out.energyAfter < 40 ? 1.6 : 1);
  return out;
}
function runPractice() {
  const plan = G.plan.slice(); const up = G.upgrades; const res = { grow: {}, injuries: [], money: 0, fans: 0, notes: [], energyBefore: avgEnergy(), moraleBefore: teamMorale(), chemBefore: G.res.chem };
  const counts = {};
  const growthLog = {}; G.roster.forEach(p => growthLog[p.id] = ovr(p));
  plan.forEach(k => {
    const d = DRILLS[k]; counts[k] = (counts[k] || 0) + 1; const dim = [1, .8, .6, .45][counts[k] - 1] || .35;
    G.roster.forEach(p => {
      if (p.inj) { if (d.heal && chance(up.trainer ? .5 : .3)) p.inj = Math.max(0, p.inj - 1); return; }
      const room = U.clamp((p.pot - ovr(p)) / 14, .12, 1);
      const mult = .62 * (.7 + p.ethic * .6) * room * (up.assistant ? 1.25 : 1) * (p.trait === 'Hard Worker' ? 1.25 : 1) * (p.energy < 35 ? .5 : 1) * dim;
      for (const a in d.grow) { const g = d.grow[a] * mult; p.r[a] = U.clamp(p.r[a] + g, 20, 99); }
      p.energy = U.clamp(p.energy + d.energy, 0, 100);
      moraleChange(p, d.morale);
      if (d.gpa) p.gpa = U.clamp(+(p.gpa + d.gpa).toFixed(2), 1.2, 4.0);
    });
    G.res.chem = U.clamp(G.res.chem + d.chem * dim, 0, 100);
    if (d.money) { const m = Math.round(300 * (0.6 + G.res.fans / 100)); res.money += m; G.res.budget += m; G.res.fans = U.clamp(G.res.fans + 3, 0, 100); G.res.rep = U.clamp(G.res.rep + 1, 0, 100); res.fans += 3; }
    if (d.scout) { G.flags.filmThisWeek = true; }
    // injury roll: one roll per drill for the team
    const tired = U.avg(G.roster.map(p => p.energy)) < 40 ? 1.6 : 1;
    if (d.inj && chance(d.inj * DIFF[G.diff].inj * (up.trainer ? .6 : 1) * tired)) {
      const cands = G.roster.filter(p => !p.inj); if (cands.length) { const v = wpick(cands, p => 120 - p.energy); v.inj = ri(1, 2); G.injuriesTotal++; res.injuries.push(`${v.first} ${v.last} (${DRILLS[k].short}, out ${v.inj} wk)`); }
    }
  });
  G.roster.forEach(p => { const d = ovr(p) - growthLog[p.id]; if (d > 0) res.grow[p.id] = d; });
  res.energyAfter = avgEnergy(); res.moraleAfter = teamMorale(); res.chemAfter = Math.round(G.res.chem);
  G.practiceDone = res; G.log.push({ w: G.week, t: `Practice: ${plan.map(k => DRILLS[k].short).join(', ')}.` });
  if (res.injuries.length) G.log.push({ w: G.week, t: `Practice injury: ${res.injuries.join('; ')}.`, bad: true });
  return res;
}
function moraleChange(p, d) {
  if (p.trait === 'Steady') d *= .5; if (p.trait === 'Hothead') d *= 1.6;
  p.morale = U.clamp(p.morale + d, 0, 100);
}
function allMorale(d) { G.roster.forEach(p => moraleChange(p, d)); }

/* ---------- Line-up ---------- */
function autoLineup() {
  const avail = G.roster.filter(eligible);
  const chosen = [];
  for (const pos of POS) {
    const cand = avail.filter(p => !chosen.includes(p)).sort((a, b) => fitScore(b, pos) - fitScore(a, pos))[0];
    if (cand) chosen.push(cand);
  }
  G.lineup = chosen.map(p => p.id);
  while (G.lineup.length < 5) { const x = avail.find(p => !G.lineup.includes(p.id)); if (!x) break; G.lineup.push(x.id); }
}
function fitScore(p, pos) {
  const w = WEIGHT[pos]; let o = 0; for (const k in w) o += p.r[k] * w[k];
  return o * (0.8 + 0.2 * p.energy / 100) - (p.pos === pos ? 0 : 3);
}
function validateLineup() {
  G.lineup = G.lineup.filter(id => { const p = G.roster.find(x => x.id === id); return p && eligible(p); });
  if (G.lineup.length < 5 || new Set(G.lineup).size !== G.lineup.length) autoLineup();
}

/* ---------- Scouting & counters ---------- */
function isScouted() { return !!(G.flags.filmThisWeek || G.upgrades.scouting); }
function recommend(opp) {
  const s = opp.style; const rec = {}; const why = {};
  const oppPas = U.avg(opp.roster.slice(0, 5).map(p => p.r.pas));
  if (s.focus === 'inside') { rec.def = 'zone'; why.def = 'They pound it inside. A zone packs the paint.'; }
  else if (oppPas < 50) { rec.def = 'press'; why.def = 'Their guards are shaky passers. Pressure forces turnovers.'; }
  else { rec.def = 'man'; why.def = 'They shoot from outside. Man-to-man contests every shot.'; }
  const mine = G.roster.filter(eligible).slice().sort((a, b) => ovr(b) - ovr(a)).slice(0, 5);
  const mySho = U.avg(mine.map(p => p.r.sho)), myIns = U.avg(mine.map(p => p.r.ins));
  if (s.def === 'zone') { rec.focus = 'perimeter'; why.focus = 'Zones leave shooters open. Let it fly.'; }
  else if (s.def === 'press') { rec.focus = 'inside'; why.focus = 'Beat the press, then attack the rim for easy layups.'; }
  else { rec.focus = myIns > mySho ? 'inside' : 'perimeter'; why.focus = myIns > mySho ? 'Your bigs have the edge down low.' : 'Your shooters have the edge.'; }
  const diff = myRating() - oppRating(opp);
  if (diff < -1) { rec.tempo = 'slow'; why.tempo = 'You’re the underdog. Fewer possessions means more chance for an upset.'; }
  else if (diff > 1) { rec.tempo = 'fast'; why.tempo = 'You’re the better team. More possessions lets talent win out.'; }
  else { rec.tempo = 'balanced'; why.tempo = 'Even matchup. Stay balanced.'; }
  return { rec, why };
}

/* ---------- Game simulation ---------- */
function eff(p, k, morale) {
  const m = morale != null ? morale : p.morale;
  return p.r[k] * (0.78 + 0.22 * p.gEnergy / 100) * (0.94 + 0.12 * m / 100);
}
/* Never let a game be unplayable: call up JV players if fewer than 5 are eligible. */
function ensureFive() {
  const short = 5 - G.roster.filter(eligible).length; const called = [];
  for (let i = 0; i < short; i++) { const pos = POS[i % 5]; const p = genPlayer(42 + DIFF[G.diff].you + gauss() * 2, pos, ri(9, 10), usedNums(G.roster)); p.jv = true; p.joined = G.season; p.gpa = Math.max(p.gpa, 2.4); p.gpaBase = p.gpa; G.roster.push(p); called.push(p); }
  if (called.length) { G.log.push({ w: G.phase === 'playoffs' ? 'P' : G.week, t: `Only ${5 - called.length} eligible players, so you called up ${called.map(p => p.first + ' ' + p.last).join(', ')} from JV.`, bad: true }); validateLineup(); }
  return called;
}
function newGameSim() {
  ensureFive();
  const info = currentGameInfo(); const opp = info.opp; validateLineup();
  const my = G.roster.filter(eligible).map(p => { p.gEnergy = p.energy; return p; });
  const them = opp.roster.filter(p => !p.inj).map(p => { p.gEnergy = 100; return p; });
  const sim = {
    info, oppId: opp.id, q: 0, us: 0, them: 0, qs: [[0, 0], [0, 0], [0, 0], [0, 0]], events: [], done: false,
    my: my.map(p => p.id), their: them.map(p => p.id),
    onUs: G.lineup.slice(), onThem: them.slice().sort((a, b) => ovr(b) - ovr(a)).slice(0, 5).map(p => p.id),
    strat: Object.assign({}, G.strategy), oppStrat: Object.assign({}, opp.style), box: {}, momentum: 0, halfTalk: null, starStop: null,
    poss: 0, lead: [0, 0], counter: 0, bigDeficit: 0, injuries: [], ot: 0,
    to: { full: 3, short: 2 }, oppTO: 3, Q: null, forced: null, totalPoss: 0, headless: false,
  };
  [...my, ...them].forEach(p => sim.box[p.id] = { pts: 0, reb: 0, ast: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, poss: 0 });
  // counter bonus: scouted and matching the recommendation
  sim.scouted = isScouted();
  return sim;
}
function simPlayer(sim, id) { return G.roster.find(p => p.id === id) || teamById(sim.oppId).roster.find(p => p.id === id); }
function counterScore(sim) {
  if (!sim.scouted) return 0; const { rec } = recommend(teamById(sim.oppId)); let c = 0;
  ['def', 'focus', 'tempo'].forEach(k => { if (sim.strat[k] === rec[k]) c++; }); return c;
}
/* Possession-level simulation. The UI steps one possession at a time so strategy changes,
   timeouts and substitutions take effect immediately. simQuarter() runs a whole quarter (headless). */
function tempoSecs(sim) { const t = (TEMPO_POSS[sim.strat.tempo] + TEMPO_POSS[sim.oppStrat.tempo]) / 2; return 480 / (t * 2); }
function startQuarter(sim) {
  const q = sim.q; const qLen = q >= 4 ? 240 : 480;
  sim.Q = { q, qLen, clock: qLen, offense: q % 2 === 0 ? 'us' : 'them', clutchAsked: false, n: 0, lastOppTO: -99 };
}
function simStep(sim) {
  if (!sim.Q) startQuarter(sim);
  const Q = sim.Q;
  if (Q.clock <= 0) return endQuarter(sim);
  // Final-shot decision: your ball, last 40 seconds of the 4th/OT, within 3 points
  if (!sim.headless && !sim.forced && Q.offense === 'us' && Q.q >= 3 && Q.clock <= 40 && Math.abs(sim.us - sim.them) <= 3 && !Q.clutchAsked) {
    Q.clutchAsked = true;
    return [{ k: 'clutch', team: 'us', q: Q.q, clock: Q.clock, diff: sim.us - sim.them, text: `${fmtSec(Q.clock)} left, ${sim.us === sim.them ? 'tied' : sim.us > sim.them ? 'up ' + (sim.us - sim.them) : 'down ' + (sim.them - sim.us)}. Your ball. Draw up the final play.` }];
  }
  const evs = simPossession(sim);
  // Opponent coach calls timeout to stop your run
  if (sim.momentum >= 4.2 && sim.oppTO > 0 && Q.n - Q.lastOppTO > 6 && Q.clock > 0) {
    sim.oppTO--; Q.lastOppTO = Q.n; sim.momentum = 0; sim.their.forEach(id => { const p = simPlayer(sim, id); p.gEnergy = U.clamp(p.gEnergy + 6, 0, 100); });
    evs.push({ k: 'note', team: 'them', q: Q.q, clock: Q.clock, text: `${teamById(sim.oppId).name} calls timeout to stop your run.` });
  }
  return evs;
}
function fmtSec(sec) { const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}:${String(s).padStart(2, '0')}`; }
function simQuarter(sim) { const evs = []; for (let g = 0; g < 200; g++) { const e = simStep(sim); evs.push(...e); if (e.some(x => x.k === 'end')) break; if (e.some(x => x.k === 'clutch')) { sim.forced = { auto: true }; } } return evs; }
function callTimeout(sim, kind) {
  if (!sim.to || sim.to[kind] <= 0) return null;
  sim.to[kind]--; sim.momentum = 0;
  const gain = kind === 'full' ? 8 : 3;
  sim.my.forEach(id => { const p = simPlayer(sim, id); p.gEnergy = U.clamp(p.gEnergy + gain, 0, 100); });
  const ev = { k: 'note', team: 'us', q: sim.Q ? sim.Q.q : sim.q, clock: sim.Q ? sim.Q.clock : 0, text: `${myName()} calls a ${kind === 'full' ? '60' : '30'}-second timeout.` };
  sim.events.push(ev); return ev;
}
function setOnCourt(sim, slot, id) {
  if (!sim.my.includes(id)) return false; const p = simPlayer(sim, id); if (p.inj) return false;
  const j = sim.onUs.indexOf(id); if (j >= 0) { sim.onUs[j] = sim.onUs[slot]; }
  sim.onUs[slot] = id; return true;
}
function simPossession(sim) {
  const Q = sim.Q; const q = Q.q; const evs = []; const opp = teamById(sim.oppId);
  const forced = sim.forced; sim.forced = null;
  let secs = tempoSecs(sim) * (0.8 + R() * 0.4);
  if (forced && forced.hold) secs = Q.clock; // run the clock down for the last shot
  Q.clock = Math.max(0, Q.clock - secs); Q.n++;
  const clock = Q.clock;
  const home = sim.info.neutral ? 0 : (sim.info.home ? 1 : -1);
  const cs = counterScore(sim);
  sim.totalPoss = (sim.totalPoss || 0) + 1;
  const off = Q.offense, onO = off === 'us' ? sim.onUs : sim.onThem, onD = off === 'us' ? sim.onThem : sim.onUs;
  const O = onO.map(id => simPlayer(sim, id)), D = onD.map(id => simPlayer(sim, id));
  const oStrat = off === 'us' ? sim.strat : sim.oppStrat, dStrat = off === 'us' ? sim.oppStrat : sim.strat;
  const mor = off === 'us' ? null : 62, dmor = off === 'us' ? 62 : null;
  const chem = off === 'us' ? G.res.chem : 58;
  const oPas = U.avg(O.map(p => eff(p, 'pas', mor))) * (0.9 + 0.2 * chem / 100);
  let dDef = U.avg(D.map(p => eff(p, 'def', dmor)));
  if (dStrat.def === 'zone') dDef = dDef * 0.85 + 9;
  const oReb = U.avg(O.map(p => eff(p, 'reb', mor))), dReb = U.avg(D.map(p => eff(p, 'reb', dmor)));
  const tempoMul = { slow: .85, balanced: 1, fast: 1.2 }[oStrat.tempo];
  const drain = (p, press) => { p.gEnergy = U.clamp(p.gEnergy - 1.05 * tempoMul * (1.35 - p.r.sta / 100) * (press ? 1.35 : 1), 5, 100); };
  O.forEach(p => { drain(p, false); sim.box[p.id].poss++; }); D.forEach(p => { drain(p, dStrat.def === 'press'); sim.box[p.id].poss++; });
  const benchIds = (off === 'us' ? sim.my : sim.their).filter(id => !onO.includes(id)).concat((off === 'us' ? sim.their : sim.my).filter(id => !onD.includes(id)));
  benchIds.forEach(id => { const p = simPlayer(sim, id); p.gEnergy = U.clamp(p.gEnergy + 1.3, 0, 100); });
  for (const p of (off === 'us' ? O : D)) {
    const ir = 0.0003 * DIFF[G.diff].inj * (p.gEnergy < 40 ? 2.2 : 1) * (G.upgrades.trainer ? .6 : 1) * (G.flags.rushed === p.id ? 8 : 1);
    if (chance(ir)) { p.inj = G.upgrades.trainer ? ri(1, 2) : ri(1, 3); G.injuriesTotal++; sim.injuries.push(p.id); evs.push({ k: 'inj', team: 'us', pid: p.id, clock, q, text: `${p.first} ${p.last} goes down hurt and heads to the bench.` }); subOut(sim, 'us', p.id, true); break; }
  }
  let to = 0.125 - (oPas - 55) * 0.0018 + (dDef - 55) * 0.0008 - (chem - 50) * 0.0004;
  if (dStrat.def === 'press') to += 0.045 + (55 - oPas) * 0.002;
  if (off === 'us' && G.flags.hero) to += .015;
  if (forced && !forced.auto) to *= .6; // a set play out of a timeout is cleaner
  to = U.clamp(to, .04, .3);
  const scorer = () => {
    if (forced && forced.pid) { const fp = O.find(p => p.id === forced.pid); if (fp) return fp; }
    const f = oStrat.focus; const star = off === 'us' && G.flags.hero ? starOf(O) : null;
    return wpick(O, p => { let w = Math.pow((p.r.sho * (f === 'perimeter' ? 1.3 : f === 'inside' ? .8 : 1) + p.r.ins * (f === 'inside' ? 1.3 : f === 'perimeter' ? .8 : 1)) / 100, 3); if (p === star) w *= 1.7; if (off === 'us' && G.flags.heavy === p.id) w *= 1.3; return w; });
  };
  if (chance(to)) {
    const stealer = wpick(D, p => p.r.def);
    const text = pick([`${stealer.last} jumps the passing lane. Steal.`, `Turnover. ${stealer.last} pokes it loose.`, `Bad pass, picked off by ${stealer.last}.`, `Traveling called. Turnover.`]);
    sim.momentum += off === 'us' ? -1 : 1;
    evs.push({ k: 'to', team: off, clock, q, text, pid: stealer.id, handler: O[0].id });
  } else {
    let attempts = 0, done = false, assisted = null;
    while (!done && attempts < 3) {
      attempts++;
      const sh = attempts === 1 ? scorer() : wpick(O, p2 => Math.pow(p2.r.sho + p2.r.ins, 2));
      const f = oStrat.focus;
      let w3 = { perimeter: .45, balanced: .33, inside: .2 }[f], wi = { perimeter: .30, balanced: .40, inside: .55 }[f];
      const shift = (sh.r.sho - sh.r.ins) / 220; w3 = U.clamp(w3 + shift, .05, .7); wi = U.clamp(wi - shift, .1, .8); const wm = Math.max(.1, 1 - w3 - wi);
      const r = R() * (w3 + wi + wm);
      const type = (attempts === 1 && forced && forced.type) ? forced.type : (r < w3 ? 'three' : r < w3 + wi ? 'inside' : 'mid');
      const p = shotChance(sim, sh, type, off, dStrat, dDef, home, cs, q);
      const fouled = type === 'inside' ? chance(.14) : type === 'mid' ? chance(.05) : chance(.02);
      const made = chance(p);
      const ftp = U.clamp(.5 + sh.r.sho / 250, .45, .9);
      const box = sim.box[sh.id]; box.fga++; if (type === 'three') box.tpa++;
      let pts = 0, ftm = 0;
      if (made) { pts = type === 'three' ? 3 : 2; box.fgm++; if (type === 'three') box.tpm++; if (fouled && chance(ftp)) ftm = 1; }
      else if (fouled) { const n = type === 'three' ? 3 : 2; for (let k = 0; k < n; k++) if (chance(ftp)) ftm++; }
      pts += ftm; box.pts += pts;
      if (made && attempts === 1 && chance(.58)) { const cands = O.filter(p2 => p2 !== sh); if (cands.length) { assisted = wpick(cands, p2 => p2.r.pas * p2.r.pas); sim.box[assisted.id].ast++; } }
      if (off === 'us') sim.us += pts; else sim.them += pts;
      if (q < 4) sim.qs[q][off === 'us' ? 0 : 1] += pts; else { sim.otPts = sim.otPts || [0, 0]; sim.otPts[off === 'us' ? 0 : 1] += pts; }
      const loc = shotLoc(type);
      sim.momentum += (pts > 0 ? 1 : 0) * (off === 'us' ? 1 : -1);
      const txt = shotText(sh, type, made, fouled, ftm, assisted);
      evs.push({ k: 'shot', team: off, pid: sh.id, ast: assisted && assisted.id, type, made, pts, ftm, fouled, clock, q, loc, us: sim.us, them: sim.them, text: txt, clutch: !!(forced && !forced.auto), pct: Math.round(p * 100) });
      if (made || fouled) { done = true; break; }
      if (clock <= 0) { done = true; break; } // no time for a put-back
      const orp = U.clamp(0.27 + (oReb - dReb) * 0.004 + (dStrat.def === 'zone' ? .03 : 0), .12, .45);
      if (chance(orp)) { const rb = wpick(O, p2 => Math.pow(p2.r.reb, 2)); sim.box[rb.id].reb++; evs.push({ k: 'oreb', team: off, pid: rb.id, clock, q, text: `Offensive board, ${rb.last}.` }); }
      else { const rb = wpick(D, p2 => Math.pow(p2.r.reb, 2)); sim.box[rb.id].reb++; done = true; }
    }
  }
  sim.momentum = U.clamp(sim.momentum * 0.92, -6, 6);
  Q.offense = off === 'us' ? 'them' : 'us';
  sim.bigDeficit = Math.max(sim.bigDeficit, sim.them - sim.us);
  if (Q.n % 2 === 0) { autoSubs(sim, 'us'); autoSubs(sim, 'them'); }
  sim.events.push(...evs);
  return evs;
}
function shotChance(sim, sh, type, off, dStrat, dDef, home, cs, q) {
  const mor2 = off === 'us' ? null : 62;
  const skill = type === 'inside' ? eff(sh, 'ins', mor2) : eff(sh, 'sho', mor2);
  let p = { three: .335, mid: .405, inside: .545 }[type] + (skill - dDef) * 0.0045;
  if (dStrat.def === 'zone') { if (type === 'inside') p -= .05; if (type === 'three') p += .03; }
  if (dStrat.def === 'press' && type === 'inside') p += .035;
  if (home) p += (off === 'us' ? 1 : -1) * home * (0.012 + G.res.fans / 5000);
  p += (off === 'us' ? 1 : -1) * sim.momentum * 0.004; // runs feed on themselves; timeouts reset momentum
  if (off === 'us') { p += cs * 0.009; if (G.flags.motivated) p += .02; if (sim.halfTalk === 'fire' && q >= 2) p += sim.fireBonus || 0; if (sh.trait === 'Clutch' && q >= 3) p += .04; }
  else { if (sim.starStop && sh.id === sim.starStop && q >= 2) p -= .08; p -= cs * 0.006; }
  return U.clamp(p, .12, .78);
}
/* Estimated make chance for the final-shot picker (no RNG used). */
function clutchOdds(sim, pid, type) {
  const sh = simPlayer(sim, pid); let dDef = U.avg(sim.onThem.map(id => eff(simPlayer(sim, id), 'def', 62)));
  if (sim.oppStrat.def === 'zone') dDef = dDef * 0.85 + 9;
  const home = sim.info.neutral ? 0 : (sim.info.home ? 1 : -1);
  return Math.round(shotChance(sim, sh, type, 'us', sim.oppStrat, dDef, home, counterScore(sim), 3) * 100);
}
function endQuarter(sim) {
  const opp = teamById(sim.oppId); const q = sim.Q.q; const evs = [];
  const diff = sim.them - sim.us;
  if (q === 1) sim.halfDeficit = diff;
  if (q === 1 || q === 2) {
    if (diff < -7 && sim.oppStrat.def !== 'press') { sim.oppStrat.def = 'press'; evs.push({ k: 'note', team: 'them', q, clock: 0, text: `${opp.name} switches to a full-court press to claw back.` }); }
    else if (diff > 9 && sim.oppStrat.tempo !== 'slow') { sim.oppStrat.tempo = 'slow'; evs.push({ k: 'note', team: 'them', q, clock: 0, text: `${opp.name} slows it down to protect the lead.` }); }
  }
  sim.Q = null; sim.q++;
  if (sim.q >= 4 && sim.us !== sim.them) sim.done = true;
  if (sim.q > 7) { if (sim.us === sim.them) sim.us++; sim.done = true; }
  let text = sim.done ? 'Final buzzer!' : q === 1 ? 'Halftime.' : `End of the ${['1st', '2nd', '3rd', '4th'][q] || 'period'}.`;
  if (q >= 3 && !sim.done) text = q === 3 ? 'Tied at the end of regulation. Overtime!' : 'Still tied. Another overtime!';
  evs.push({ k: 'end', q, clock: 0, us: sim.us, them: sim.them, text });
  sim.events.push(...evs);
  return evs;
}
function shotLoc(type) {
  // feet from the basket on a half court (basket at x=0,y=0)
  const a = (R() - .5) * Math.PI * 0.95;
  const d = type === 'inside' ? 1 + R() * 5 : type === 'mid' ? 8 + R() * 9 : 20.3 + R() * 3.5;
  let x = Math.cos(a) * d, y = Math.sin(a) * d;
  y = U.clamp(y, -23, 23); if (type === 'three' && Math.abs(y) > 20) { x = Math.max(x, .5); }
  return { x: Math.max(x, -3), y };
}
function shotText(p, type, made, fouled, ftm, ast) {
  const n = p.last; const aTxt = ast ? ` (assist ${ast.last})` : '';
  if (made) {
    const base = type === 'three' ? pick([`${n} drills a three`, `${n} from deep. Bang!`, `${n} splashes a corner three`, `${n} pulls up from the arc. Good`]) :
      type === 'mid' ? pick([`${n} hits the pull-up jumper`, `${n} with the elbow jumper`, `${n} fades away. Good`]) :
      pick([`${n} finishes at the rim`, `${n} lays it in`, `${n} powers it home`, `${n} with the put-back`, `${n} spins baseline and scores`]);
    return base + aTxt + (fouled ? (ftm ? '. And one!' : '. Misses the and-one.') : '.');
  }
  if (fouled) return `${n} is fouled on the ${type === 'three' ? 'three' : 'shot'} and hits ${ftm} of ${type === 'three' ? 3 : 2} free throws.`;
  return type === 'three' ? pick([`${n} misses from three.`, `${n}'s three rims out.`]) : type === 'mid' ? `${n} misses the jumper.` : pick([`${n} can’t finish inside.`, `${n} is blocked at the rim!`]);
}
function subThreshold(rot) { return { tight: 40, normal: 52, deep: 64, manual: -1 }[rot] ?? 52; }
function autoSubs(sim, side) {
  const on = side === 'us' ? sim.onUs : sim.onThem; const all = side === 'us' ? sim.my : sim.their;
  const th = side === 'us' ? subThreshold(sim.strat.rot) : 50;
  if (th < 0) return; // Manual rotation: only you make substitutions
  for (let i = 0; i < on.length; i++) {
    const p = simPlayer(sim, on[i]); if (p.gEnergy >= th && !p.inj) continue;
    const bench = all.filter(id => !on.includes(id)).map(id => simPlayer(sim, id)).filter(b => !b.inj && b.gEnergy > th + 18);
    if (!bench.length) continue;
    const best = bench.sort((a, b) => fitScore(b, p.pos) - fitScore(a, p.pos))[0];
    if (p.inj || fitScore(best, p.pos) > ovr(p) * (p.gEnergy / 100) * 0.9 + 4 || p.gEnergy < th - 12) on[i] = best.id;
  }
  // starters come back when fresh
  if (side === 'us') {
    G.lineup.forEach((sid, idx) => { if (on.includes(sid)) return; const s = simPlayer(sim, sid); if (!s || s.inj || !sim.my.includes(sid)) return; if (s.gEnergy > 82) { const worst = on.map(id => simPlayer(sim, id)).filter(x => !G.lineup.includes(x.id)).sort((a, b) => a.gEnergy - b.gEnergy)[0]; if (worst) on[on.indexOf(worst.id)] = sid; } });
  }
}
function subOut(sim, side, id, injured) {
  const on = side === 'us' ? sim.onUs : sim.onThem; const all = side === 'us' ? sim.my : sim.their; const i = on.indexOf(id); if (i < 0) return;
  const bench = all.filter(x => !on.includes(x)).map(x => simPlayer(sim, x)).filter(b => !b.inj);
  if (injured && side === 'us') { const k = sim.my.indexOf(id); if (k >= 0) sim.my.splice(k, 1); }
  if (bench.length) on[i] = bench.sort((a, b) => b.gEnergy * ovr(b) - a.gEnergy * ovr(a))[0].id;
}
function applyHalftime(sim, talk) {
  sim.halfTalk = talk;
  if (talk === 'fire') { sim.fireBonus = G.res.chem >= 50 ? .03 : (chance(.5) ? .03 : -.02); return sim.fireBonus > 0 ? 'The locker room is fired up. Shooting boost for the second half.' : 'The speech fell flat. Players look tight.'; }
  if (talk === 'calm') { sim.my.forEach(id => { const p = simPlayer(sim, id); p.gEnergy = U.clamp(p.gEnergy + 10, 0, 100); }); return 'Players catch their breath. Energy +10 for everyone.'; }
  if (talk === 'star') { const opp = teamById(sim.oppId); const best = Object.entries(sim.box).filter(([id]) => sim.their.includes(id)).sort((a, b) => b[1].pts - a[1].pts)[0]; const p = opp.roster.find(x => x.id === best[0]); sim.starStop = p.id; return `You'll shade help toward ${p.first} ${p.last} (${best[1].pts} pts). Their star shoots worse in the second half.`; }
  return '';
}

/* ---------- After the game ---------- */
function finishGame(sim) {
  const opp = teamById(sim.oppId); const win = sim.us > sim.them; const margin = sim.us - sim.them;
  const res = { win, us: sim.us, them: sim.them, opp: opp.id, label: sim.info.label, home: sim.info.home, neutral: sim.info.neutral, changes: [], mvp: null, injuries: sim.injuries.slice(), grow: {} };
  const before = { morale: teamMorale(), chem: G.res.chem, fans: G.res.fans, budget: G.res.budget, rep: G.res.rep };
  // stats & energy carry-over
  G.roster.forEach(p => {
    const b = sim.box[p.id]; if (!b) { if (!p.inj) moraleChange(p, p.trait === 'Leader' ? 0 : -2); return; }
    const min = Math.round(b.poss / Math.max(1, sim.totalPoss || b.poss) * 32);
    p.s.gp++; p.s.pts += b.pts; p.s.reb += b.reb; p.s.ast += b.ast; p.s.min += min;
    p.energy = U.clamp(Math.round(p.gEnergy), 15, 100);
    const played = b.poss > 6;
    if (played) { const g = .14 * Math.min(1, b.poss / 60); const k = pick(ATTR); p.r[k] = U.clamp(p.r[k] + g * 3, 20, 99); }
    let dm = win ? (margin > 15 ? 6 : 4) : (margin < -15 ? -7 : -4);
    if (!played && p.trait !== 'Leader') dm -= 3;
    moraleChange(p, dm);
  });
  G.roster.forEach(p => delete p.gEnergy); opp.roster.forEach(p => delete p.gEnergy);
  G.res.chem = U.clamp(G.res.chem + (win ? 2 : -1), 0, 100);
  G.res.fans = U.clamp(G.res.fans + (win ? 3 + (sim.info.home ? 1 : 0) : -2) + (win && G.roster.some(p => p.trait === 'Showboat') ? 1 : 0), 0, 100);
  // money
  if (sim.info.neutral) { const m = 250 + Math.round(G.res.fans * 4); G.res.budget += m; res.gate = m; }
  else if (sim.info.home) { const m = 180 + Math.round(G.res.fans * 6) + (G.upgrades.store ? 150 : 0); G.res.budget += m; res.gate = m; }
  else { G.res.budget -= 150; res.travel = 150; }
  // flags that resolve after a game
  if (G.flags.media) { if (win) { G.res.fans = U.clamp(G.res.fans + 5, 0, 100); } else { allMorale(-6); } delete G.flags.media; }
  if (G.flags.motivated) delete G.flags.motivated; if (G.flags.hero) delete G.flags.hero; if (G.flags.heavy) delete G.flags.heavy; if (G.flags.rushed) delete G.flags.rushed;
  // records
  if (win) opp.l++; else opp.w++; opp.pf += sim.them; opp.pa += sim.us;
  G.games.push({ w: G.phase === 'playoffs' ? 'P' + (G.playoffs.round + 1) : G.week, opp: opp.id, us: sim.us, them: sim.them, win, label: sim.info.label, oppR: oppRating(opp), myR: myRating() });
  if (win && oppRating(opp) - myRating() >= 5) G.giantSlayer = true;
  if (win && sim.halfDeficit >= 10) G.comeback = true;
  // MVP
  const mine = Object.entries(sim.box).filter(([id]) => G.roster.some(p => p.id === id));
  const mv = mine.sort((a, b) => (b[1].pts + b[1].reb * .8 + b[1].ast) - (a[1].pts + a[1].reb * .8 + a[1].ast))[0];
  if (mv) res.mvp = { id: mv[0], ...mv[1] };
  res.after = { morale: teamMorale(), chem: Math.round(G.res.chem), fans: G.res.fans, budget: G.res.budget };
  res.before = before; res.box = sim.box; res.qs = sim.qs; res.otPts = sim.otPts;
  G.lastGame = res;
  G.log.push({ w: G.phase === 'playoffs' ? 'P' : G.week, t: `${win ? 'W' : 'L'} ${sim.us}–${sim.them} vs ${opp.name} (${sim.info.label}).`, good: win, bad: !win });
  // other district games this week
  if (G.phase !== 'playoffs') simOtherGames();
  // injuries tick
  return res;
}
function quickSim(a, b, homeAdv = 1.5) {
  const ra = teamRating(a.roster) + homeAdv, rb = teamRating(b.roster);
  const p = 1 / (1 + Math.exp(-(ra - rb) / 4.2)); const aw = chance(p);
  const base = ri(48, 64); const m = ri(1, 16);
  const as = aw ? base + m : base, bs = aw ? base : base + m;
  a.pf += as; a.pa += bs; b.pf += bs; b.pa += as; if (aw) { a.w++; b.l++; } else { b.w++; a.l++; }
  return aw;
}
function simOtherGames() {
  const s = G.schedule[G.week - 1];
  if (s.others) s.others.forEach(([x, y]) => quickSim(teamById(x), teamById(y)));
  else { // non-district week: everyone else plays someone generic
    G.teams.forEach(t => { if (chance(1 / (1 + Math.exp(-(teamRating(t.roster) - (55 + DIFF[G.diff].opp)) / 4.2)))) { t.w++; t.pf += 60; t.pa += 54; } else { t.l++; t.pf += 54; t.pa += 60; } });
  }
  // opponents slowly improve too
  if (G.week % 3 === 0) G.teams.concat(G.stateField).forEach(t => t.roster.forEach(p => { const k = pick(ATTR); p.r[k] = U.clamp(p.r[k] + 1.2, 20, 99); }));
}
function myRecord() { const g = G.games.filter(x => typeof x.w === 'number'); return { w: g.filter(x => x.win).length, l: g.filter(x => !x.win).length }; }
function standings() {
  const rec = myRecord(); const me = { id: 'me', name: myName(), mascot: MASCOTS[G.school.mascot].name, w: rec.w, l: rec.l, pf: U.sum(G.games.filter(x => typeof x.w === 'number').map(x => x.us)), pa: U.sum(G.games.filter(x => typeof x.w === 'number').map(x => x.them)), me: true, rating: myRating() };
  const rows = [me, ...G.teams.map(t => ({ id: t.id, name: t.name, mascot: t.mascot, w: t.w, l: t.l, pf: t.pf, pa: t.pa, rating: oppRating(t) }))];
  return rows.sort((a, b) => (b.w - b.l) - (a.w - a.l) || (b.pf - b.pa) - (a.pf - a.pa));
}

/* ---------- End of week ---------- */
function endWeek() {
  // injuries heal
  G.roster.forEach(p => { if (p.inj) { p.inj = Math.max(0, p.inj - (G.upgrades.trainer && chance(.5) ? 2 : 1)); } });
  G.hist.push({ w: G.phase === 'playoffs' ? 'P' + (G.playoffs.round + 1) : 'W' + G.week, morale: teamMorale(), chem: Math.round(G.res.chem), rating: myRating(), fans: G.res.fans, budget: G.res.budget, win: G.lastGame && G.lastGame.win });
  const crisis = checkCrisis(); if (crisis) return crisis;
  if (G.phase === 'playoffs') return advancePlayoffs();
  if (G.week >= 10) return startPlayoffs();
  G.week++; weekStart(); validateLineup(); return 'next';
}
function checkCrisis() {
  if (G.res.rep <= 0) { endSeason('crisis', 'The school board suspended the program after a string of bad decisions cost the community’s trust.'); return 'ended'; }
  if (G.res.budget < -1000) { endSeason('crisis', 'The athletic department froze the program. The budget ran more than $1,000 in the red.'); return 'ended'; }
  if (G.roster.filter(p => !p.quit).length < 7) { endSeason('crisis', 'Too many players quit. You couldn’t field a team.'); return 'ended'; }
  return null;
}
function startPlayoffs() {
  const st = standings(); const seed = st.findIndex(r => r.me) + 1;
  G.hist.at(-1).seed = seed;
  if (seed > 4) { endSeason('missed'); return 'ended'; }
  const top4 = st.slice(0, 4); const oppRow = top4[4 - seed]; // 1v4, 2v3
  const otherPair = top4.filter(r => r !== top4[seed - 1] && r !== oppRow);
  G.phase = 'playoffs';
  G.playoffs = { round: 0, seed, opp: oppRow.id, bracket: [[{ a: 'me', b: oppRow.id, seeds: [seed, 4 - seed + 1] }, { a: otherPair[0].id, b: otherPair[1].id, seeds: [st.indexOf(otherPair[0]) + 1, st.indexOf(otherPair[1]) + 1] }], [], [], []], extra: [], alive: true, homeCourt: seed <= 2 };
  G.log.push({ w: 'P', t: `Clinched the #${seed} seed. Playoffs begin: ${ROUNDS[0]} vs ${teamById(oppRow.id).name}.`, good: true });
  allMorale(5);
  weekStart(); validateLineup();
  return 'playoffs';
}
function advancePlayoffs() {
  const P = G.playoffs; const last = G.lastGame; const r = P.round;
  P.bracket[r][0].winner = last.win ? 'me' : P.opp; P.bracket[r][0].score = [last.us, last.them];
  if (r === 0) { const g = P.bracket[0][1]; const a = teamById(g.a), b = teamById(g.b); const aw = quickSim(a, b, g.seeds[0] < g.seeds[1] ? 1.5 : -1.5); g.winner = aw ? a.id : b.id; }
  if (!last.win) { endSeason(r === 3 ? 'runnerup' : r === 2 ? 'final4' : 'contender'); return 'ended'; }
  if (r === 3) { endSeason('champion'); return 'ended'; }
  P.round++;
  if (P.round === 1) { const other = P.bracket[0][1].winner; P.opp = other; P.bracket[1] = [{ a: 'me', b: other }]; P.homeCourt = P.seed <= 2 || G.teams.find(t => t.id === other) && standings().findIndex(x => x.id === other) + 1 > P.seed; }
  if (P.round === 2) { P.opp = G.stateField[1].id; P.bracket[2] = [{ a: 'me', b: G.stateField[1].id }, { a: G.stateField[0].id, b: G.stateField[2].id }]; P.bracket[2][1].winner = G.stateField[2].id; }
  if (P.round === 3) { P.opp = G.stateField[2].id; P.bracket[3] = [{ a: 'me', b: G.stateField[2].id }]; }
  G.log.push({ w: 'P', t: `Advanced to the ${ROUNDS[P.round]}.`, good: true });
  weekStart(); validateLineup(); return 'next';
}

/* ---------- Endings, legacy, achievements ---------- */
const ENDINGS = {
  champion: { title: 'State Champions', tone: 'win', text: 'You climbed the ladder and the net is yours. The banner goes up in the rafters forever.' },
  perfect:  { title: 'Perfect Season', tone: 'win', text: 'Undefeated State Champions. Every decision paid off.' },
  runnerup: { title: 'State Runner-Up', tone: 'mid', text: 'One win short. You reached the final game of the season, and the program is on the map.' },
  final4:   { title: 'Final Four', tone: 'mid', text: 'A State Semifinal run. Your team belonged on the big stage.' },
  contender:{ title: 'Playoff Contender', tone: 'mid', text: 'You made the playoffs but fell in the sectional bracket. The foundation is real.' },
  missed:   { title: 'Missed the Playoffs', tone: 'low', text: '' },
  crisis:   { title: 'Program in Crisis', tone: 'low', text: '' },
};
function endSeason(kind, why) {
  let k = kind; const rec = allRecord();
  if (k === 'champion' && rec.l === 0) k = 'perfect';
  G.phase = 'ended'; G.ending = { kind: k, why: why || '' };
  if (k === 'missed') {
    const dev = U.sum(G.roster.map(p => ovr(p) - p.start));
    G.ending.sub = (teamMorale() >= 60 && dev >= 25) ? 'Foundation Laid' : 'Back to the Drawing Board';
    G.ending.why = G.ending.sub === 'Foundation Laid' ? 'You finished outside the top 4, but your young roster grew a lot and the locker room believes. Next year looks bright.' : 'Outside the top 4, and the program needs a new plan. Try balancing development, morale and scouting.';
  }
  G.ending.legacy = legacy(); G.ending.ach = achievements();
  if (k === 'champion' || k === 'perfect') G.banners.push({ year: titleYear(G.season), season: G.season });
  G.career.push({ season: G.season, label: seasonLabel(G.season), kind: k, rec, grade: G.ending.legacy.grade, total: G.ending.legacy.total, max: G.ending.legacy.max, seed: G.playoffs ? G.playoffs.seed : (G.hist.at(-1) && G.hist.at(-1).seed) || null, rating: myRating() });
  G.log.push({ w: 'END', t: `Season over: ${ENDINGS[k].title}.` });
}
function allRecord() { return { w: G.games.filter(g => g.win).length, l: G.games.filter(g => !g.win).length }; }
function legacy() {
  const rec = allRecord(); const gp = Math.max(1, rec.w + rec.l);
  const prog = { champion: 400, perfect: 450, runnerup: 310, final4: 240, contender: 170, missed: 60, crisis: 0 }[G.ending.kind];
  const parts = [
    { k: 'Championship run', v: prog, max: 450 },
    { k: 'Win percentage', v: Math.round(200 * rec.w / gp), max: 200 },
    { k: 'Team morale', v: Math.round(teamMorale()), max: 100 },
    { k: 'Chemistry', v: Math.round(G.res.chem / 2), max: 50 },
    { k: 'Reputation', v: Math.round(G.res.rep), max: 100 },
    { k: 'Player development', v: Math.min(100, Math.max(0, Math.round(U.sum(G.roster.map(p => ovr(p) - p.start)) * 2))), max: 100 },
    { k: 'Budget health', v: G.res.budget >= 0 ? Math.min(50, Math.round(25 + G.res.budget / 80)) : 0, max: 50 },
  ];
  const total = U.sum(parts.map(p => p.v)); const max = U.sum(parts.map(p => p.max));
  const pct = total / max; const grade = pct >= .9 ? 'A+' : pct >= .8 ? 'A' : pct >= .7 ? 'B' : pct >= .58 ? 'C' : pct >= .45 ? 'D' : 'F';
  return { parts, total, max, grade };
}
const ACH = [
  { id: 'perfect', n: 'Perfect Season', d: 'Win every game including the playoffs.', t: () => G.ending.kind === 'perfect' },
  { id: 'giant', n: 'Giant Slayer', d: 'Beat a team rated 5+ points higher than you.', t: () => G.giantSlayer },
  { id: 'comeback', n: 'Comeback Kids', d: 'Win after trailing by 10+ at halftime.', t: () => G.comeback },
  { id: 'scholar', n: 'Scholar Squad', d: 'Finish with every player at a 3.0 GPA or higher.', t: () => G.roster.every(p => p.gpa >= 3.0) },
  { id: 'fans', n: 'Packed House', d: 'Reach 90 fan support.', t: () => G.res.fans >= 90 },
  { id: 'black', n: 'In the Black', d: 'End with more money than you started the season with.', t: () => G.res.budget >= (G.startBudget ?? DIFF[G.diff].budget) },
  { id: 'iron', n: 'Iron Roster', d: 'Get through the season with zero injuries.', t: () => G.injuriesTotal === 0 },
  { id: 'culture', n: 'Culture Builder', d: 'Finish with morale 75+ and chemistry 75+.', t: () => teamMorale() >= 75 && G.res.chem >= 75 },
];
function achievements() { return ACH.map(a => ({ id: a.id, n: a.n, d: a.d, got: !!a.t() })); }
