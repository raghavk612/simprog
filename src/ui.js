/* =========================================================================
   UI: screens, routing, input, accessibility, save/load.
   Vanilla JS, event delegation via data-act attributes.
   ========================================================================= */
'use strict';

const SAVE_KEY = 'rtc-save-v3', SET_KEY = 'rtc-settings-v1';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const UI = { screen: 'title', tab: 'week', modal: null, setup: null, sim: null, play: null, banner: null, prevFocus: null, ruleSec: 'goal' };
const SET = Object.assign({ theme: 'auto', text: 1, motion: 'auto', sound: true, vol: .6, cb: false, speed: 1, exact: null, tips: true }, (() => { try { return JSON.parse(store.get(SET_KEY) || '{}'); } catch (e) { return {}; } })());

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function reduced() { return SET.motion === 'reduce' || (SET.motion === 'auto' && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
function showExact() { return SET.exact != null ? SET.exact : (G && G.diff === 'rookie'); }
function saveSettings() { store.set(SET_KEY, JSON.stringify(SET)); }
function save() { if (!G) return; store.set(SAVE_KEY, JSON.stringify(G, (k, v) => k.startsWith('_') || k === 'gEnergy' ? undefined : v)); }
function loadSave() { const raw = store.get(SAVE_KEY); if (!raw) return null; try { const g = JSON.parse(raw); return g && g.v === 3 ? g : null; } catch (e) { return null; } }

function applySettings() {
  const b = document.body;
  if (SET.theme === 'auto') b.removeAttribute('data-gtheme'); else b.setAttribute('data-gtheme', SET.theme);
  document.documentElement.style.setProperty('--fs', (16 * SET.text) + 'px');
  b.classList.toggle('rm', SET.motion === 'reduce'); b.classList.toggle('motion-on', SET.motion === 'full');
  b.classList.toggle('cb', !!SET.cb);
  SFX.on = SET.sound; SFX.setVol(SET.vol);
}
function applyTeamColors() {
  const [c1, c2] = G ? schoolColors() : PALETTES[0].c; const r = document.documentElement.style;
  r.setProperty('--team', c1); r.setProperty('--team-ink', inkOn(c1)); r.setProperty('--team-2', c2); r.setProperty('--team-2-ink', inkOn(c2));
}
function announce(msg, assertive) { const el = $(assertive ? '#live-a' : '#live'); if (!el) return; el.textContent = ''; setTimeout(() => { el.textContent = msg; }, 30); }
function toast(msg) { const h = $('#toasts'); if (!h) return; const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; h.appendChild(t); setTimeout(() => t.remove(), 3200); }

/* ---------- small render helpers ---------- */
const E = U.esc;
function myCrest(cls = '') { const [c1, c2] = schoolColors(); return crest(G.school.name, G.school.mascot, c1, c2, myFull()).replace('class="crest"', `class="crest ${cls}"`); }
function oppCrest(t) { return crest(t.name, t.icon, t.c[0], t.c[1], t.name + ' ' + t.mascot); }
function jersey(p, opp) { if (opp) return `<span class="jersey opp" style="--oc:${opp.c[0]};--oci:${inkOn(opp.c[0])};--oc2:${opp.c[1]}" aria-hidden="true">${p.num}</span>`; return `<span class="jersey" aria-hidden="true">${p.num}</span>`; }
function pname(p) { return `${E(p.first)} ${E(p.last)}`; }
function stars(pot, o) { const room = pot - o; const n = room >= 16 ? 5 : room >= 12 ? 4 : room >= 8 ? 3 : room >= 4 ? 2 : 1; return `<span aria-label="Growth potential ${n} of 5" title="Potential ${pot}">${'★'.repeat(n)}<span style="opacity:.3">${'★'.repeat(5 - n)}</span></span>`; }
function ebar(v) { return `<span class="ebar ${v < 40 ? 'low' : v < 65 ? 'mid' : ''}" role="img" aria-label="Energy ${Math.round(v)}"><i style="width:${Math.round(v)}%"></i></span>`; }
function statusChips(p) {
  const c = [];
  if (p.inj) c.push(`<span class="chip bad">Injured · ${p.inj} wk</span>`);
  else if (p.suspended) c.push(`<span class="chip bad">Suspended</span>`);
  else if (p.gpa < 2.0) c.push(`<span class="chip bad">Ineligible · GPA ${p.gpa.toFixed(2)}</span>`);
  else if (p.energy < 40) c.push(`<span class="chip warn">Tired</span>`);
  if (p.gpa >= 2 && p.gpa < 2.3 && !p.inj) c.push(`<span class="chip warn">GPA ${p.gpa.toFixed(2)}</span>`);
  if (p.morale < 35) c.push(`<span class="chip warn">Unhappy</span>`);
  return c.join(' ');
}
function deltaChip(label, val, good) { return `<span class="chip ${good ? 'good' : 'bad'}">${good ? '▲' : '▼'} ${E(label)} ${E(val)}</span>`; }
function neutralChip(label, val) { return `<span class="chip">${E(label)} ${E(val)}</span>`; }
function meter(label, val, pct, desc, extra = '') {
  const cls = pct == null ? '' : pct < 35 ? 'lowv' : pct < 60 ? 'midv' : 'hiv';
  return `<div class="meter ${cls} ${extra}" title="${E(desc)}"><span class="lbl">${label}</span><span class="val">${val}</span>${pct != null ? `<span class="bar" aria-hidden="true"><i style="width:${U.clamp(pct, 0, 100)}%"></i></span>` : ''}<span class="sr-only">${E(desc)}</span></div>`;
}
function fmtClock(sec) { const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}:${String(s).padStart(2, '0')}`; }
function coachTip(key, html) {
  if (!SET.tips || (G && G.tipsSeen && G.tipsSeen[key])) return '';
  return `<div class="coach-tip" role="note">${icon('help', 'ico')}<div><b>Coach tip.</b> ${html}</div><button class="btn ghost sm x" data-act="tip-x" data-k="${key}" aria-label="Dismiss tip">Got it</button></div>`;
}

/* ---------- Router ---------- */
function render(focusSel) {
  const app = $('#app'); if (UI.screen !== 'game' && Court.cv) Court.unmount();
  applyTeamColors();
  const html = { title: renderTitle, setup: renderSetup, tryouts: renderTryouts, hub: renderHub, game: renderGame, ending: renderEnding }[UI.screen]();
  app.innerHTML = html;
  if (UI.screen === 'title') { const cv = $('#floor'); if (cv) requestAnimationFrame(() => drawTitleFloor(cv, G ? schoolColors()[0] : '#A6192E')); }
  if (UI.screen === 'game') mountGame();
  renderModal();
  const f = focusSel ? $(focusSel) : $('#app h1, #app h2');
  if (f) { if (!f.hasAttribute('tabindex') && !/^(BUTTON|A|INPUT|SELECT)$/.test(f.tagName)) f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: !!focusSel }); }
}
function go(screen, opts = {}) { UI.screen = screen; if (opts.tab) UI.tab = opts.tab; render(opts.focus); if (!opts.noScroll) window.scrollTo(0, 0); }

/* ---------- TITLE ---------- */
function renderTitle() {
  const saved = loadSave(); const c = PALETTES[0].c;
  const cont = saved && saved.phase !== 'ended' ? `<button class="btn big primary" data-act="continue">${icon('ball')} Continue season <span class="sub">${E(saved.school.name)} · ${saved.phase === 'tryouts' ? 'Tryouts' : saved.phase === 'playoffs' ? 'Playoffs' : 'Week ' + saved.week}</span></button>` : '';
  return `<div class="title-screen">
  <header class="rafters">
    <div class="beam"></div>
    <div class="banners" aria-label="Championship banners to earn">${ROUNDS.map((r, i) => pennant(r.replace('Sectional', 'Sect.').replace('Championship', 'Title'), false, c[0], c[1], ['I', 'II', 'III', 'IV'][i])).join('')}</div>
    <div class="title-hero">
      <div class="logo-line">High school hoops · One season</div>
      <h1>Road to the Championship</h1>
      <p>Take over a varsity basketball program. Recruit, develop players, manage the budget and the locker room, and outcoach your rivals all the way to the State title.</p>
    </div>
  </header>
  <main class="title-floor" id="main">
    <canvas id="floor" aria-hidden="true"></canvas>
    <nav class="title-menu" aria-label="Main menu">
      ${cont}
      <button class="btn big ${cont ? '' : 'primary'}" data-act="quick">${icon('bolts')} Quick Start <span class="sub">Jump in with a ready-made team</span></button>
      <button class="btn big" data-act="new">${icon('knights')} New Season <span class="sub">Name your school, pick colors &amp; difficulty</span></button>
      <div class="row2">
        <button class="btn" data-act="help">${icon('help')} How to Play</button>
        <button class="btn" data-act="settings">${icon('gear')} Settings</button>
        <button class="btn" data-act="credits">${icon('star')} Credits</button>
      </div>
      <p class="save-note">Keyboard: <span class="kbd">Tab</span> to move · <span class="kbd">Enter</span> to select · <span class="kbd">?</span> opens the rulebook anytime</p>
    </nav>
  </main></div>`;
}

/* ---------- SETUP ---------- */
function renderSetup() {
  const s = UI.setup;
  const [c1, c2] = PALETTES.find(p => p.id === s.pal).c;
  return `<main class="wrap" id="main">
  <div class="row" style="padding-top:16px"><button class="btn ghost" data-act="to-title">← Back</button></div>
  <div class="setup">
    <form class="stack" id="setup-form" style="gap:22px" novalidate>
      <div><div class="eyebrow">New season · Step 1 of 2</div><h1 style="font-family:var(--f-display);font-weight:400;font-size:2rem">Build your program</h1></div>
      <div class="field"><label for="f-name">School name</label>
        <input type="text" id="f-name" maxlength="16" value="${E(s.name)}" autocomplete="off" aria-describedby="f-name-h">
        <span id="f-name-h" class="muted" style="font-size:.9rem">Up to 16 letters. Shows on your crest, court and scoreboard.</span></div>
      <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="lbl" style="font-weight:700;margin-bottom:6px">Mascot</legend>
        <div class="opts">${Object.entries(MASCOTS).map(([k, m]) => `<label class="opt"><input type="radio" name="mascot" value="${k}" ${s.mascot === k ? 'checked' : ''}><span class="face" style="color:var(--ink)">${icon(k)}<span>${m.name}</span></span></label>`).join('')}</div></fieldset>
      <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="lbl" style="font-weight:700;margin-bottom:6px">School colors</legend>
        <div class="opts">${PALETTES.map(p => `<label class="opt"><input type="radio" name="pal" value="${p.id}" ${s.pal === p.id ? 'checked' : ''}><span class="face"><span class="swatch" aria-hidden="true"><i style="background:${p.c[0]}"></i><i style="background:${p.c[1]}"></i></span><span style="font-size:.85rem">${p.name}</span></span></label>`).join('')}</div>
        <span class="muted" style="font-size:.9rem">The whole game re-themes to your colors. Text color is picked automatically for readable contrast.</span></fieldset>
      <fieldset class="field diff" style="border:0;padding:0;margin:0"><legend class="lbl" style="font-weight:700;margin-bottom:6px">Difficulty</legend>
        <div class="opts">${Object.entries(DIFF).map(([k, d]) => `<label class="opt"><input type="radio" name="diff" value="${k}" ${s.diff === k ? 'checked' : ''}><span class="face"><b>${d.name}</b><span style="font-size:.88rem;color:var(--ink-2)">${d.d}</span></span></label>`).join('')}</div></fieldset>
      <details><summary style="cursor:pointer;font-weight:700">Advanced: season seed</summary>
        <div class="field" style="margin-top:8px"><label for="f-seed">Seed (optional)</label><input type="text" id="f-seed" maxlength="24" value="${E(s.seed)}" placeholder="e.g. STATE2027" aria-describedby="f-seed-h">
        <span id="f-seed-h" class="muted" style="font-size:.9rem">The same seed and choices replay the same season. Useful for demos and for challenging friends.</span></div></details>
      <div class="cta-bar"><span class="why">Next: hold tryouts and sign players.</span><button type="submit" class="btn big primary" data-act="setup-go">Hold Tryouts →</button></div>
    </form>
    <aside class="card preview-card" aria-label="Crest preview"><div class="eyebrow">Your crest</div><div id="crest-prev">${crest(s.name || 'Riverside', s.mascot, c1, c2, 'Preview')}</div>
      <div style="font-family:var(--f-display);font-size:1.3rem" id="name-prev">${E(s.name || 'Riverside')} ${MASCOTS[s.mascot].name}</div>
      <p class="muted" style="margin-top:8px">${DIFF[s.diff].name} difficulty · Starting budget ${U.money(DIFF[s.diff].budget)}</p></aside>
  </div></main>`;
}
function updateSetupPreview() {
  const s = UI.setup; const [c1, c2] = PALETTES.find(p => p.id === s.pal).c;
  $('#crest-prev').innerHTML = crest(s.name || 'Riverside', s.mascot, c1, c2, 'Preview');
  $('#name-prev').textContent = `${s.name || 'Riverside'} ${MASCOTS[s.mascot].name}`;
  const r = document.documentElement.style; r.setProperty('--team', c1); r.setProperty('--team-ink', inkOn(c1)); r.setProperty('--team-2', c2);
  const pv = $('.preview-card p'); if (pv) pv.textContent = `${DIFF[s.diff].name} difficulty · Starting budget ${U.money(DIFF[s.diff].budget)}`;
}

/* ---------- TOP BAR ---------- */
function topbar(sub) {
  const r = G.res; const m = teamMorale();
  return `<header class="topbar"><div class="wrap">
    <div class="team-id">${myCrest()}<div style="min-width:0"><div class="nm">${E(myFull())}</div><div class="sub">${sub}</div></div></div>
    <div class="meters" aria-label="Program resources">
      ${meter('Budget', U.money(r.budget), null, `Budget ${U.money(r.budget)}. Earn from home games and fundraisers; spend on upgrades and challenges. Below −$1,000 ends the season.`, r.budget < 0 ? 'neg' : '')}
      ${meter('Morale', m, m, `Team morale ${m} of 100. Boosts performance; below 30 players may quit.`)}
      ${meter('Chem', Math.round(r.chem), r.chem, `Chemistry ${Math.round(r.chem)} of 100. Better passing, fewer turnovers.`)}
      ${meter('Fans', r.fans, r.fans, `Fan support ${r.fans} of 100. More ticket money and home-court edge.`)}
      ${meter('Rep', Math.round(r.rep), r.rep, `Reputation ${Math.round(r.rep)} of 100. Community trust. Hitting 0 ends the season.`)}
    </div>
    <div class="tools">
      <button class="btn ghost sm" data-act="help" aria-label="Rulebook (question mark key)" title="Rulebook (?)">${icon('help')}<span class="sr-only">Rules</span></button>
      <button class="btn ghost sm" data-act="sound" aria-label="${SET.sound ? 'Mute sound' : 'Turn sound on'}" aria-pressed="${SET.sound}" title="Sound">${icon(SET.sound ? 'sound' : 'mute')}</button>
      <button class="btn ghost sm" data-act="settings" aria-label="Settings" title="Settings">${icon('gear')}</button>
      <button class="btn ghost sm" data-act="menu" aria-label="Main menu" title="Main menu">${icon('home')}</button>
    </div></div></header>`;
}
function recordStr() { const r = allRecord(); return `${r.w}–${r.l}`; }

/* ---------- TRYOUTS ---------- */
function renderTryouts() {
  const counts = {}; POS.forEach(p => counts[p] = 0); G.roster.forEach(p => counts[p.pos]++); G.prospects.filter(p => G.signed.includes(p.id)).forEach(p => counts[p.pos]++);
  const n = G.signed.length; const total = G.roster.length + n;
  const why = n < 2 ? `Sign at least ${2 - n} more to fill a 10-player roster.` : n < 4 ? `${4 - n} roster spot${4 - n > 1 ? 's' : ''} still open (max 12 players).` : 'Roster full: 12 players.';
  return `${topbar('Preseason · Tryouts')}
  <main class="wrap" id="main" style="padding-block:16px 48px">
    <div class="stack">
      <div><div class="eyebrow">Preseason · Step 2 of 2</div><h1 style="font-family:var(--f-display);font-weight:400;font-size:2rem">Tryouts</h1>
      <p class="muted" style="max-width:68ch">You have 8 returning players. Sign up to <b>4 prospects</b>. Their true ratings are fuzzy until you <b>scout</b> them. Scouting also reveals potential (★) and personality.</p></div>
      ${coachTip('tryouts', 'Look at the position counts. A team with no true point guard turns the ball over. Freshmen with high potential grow the most during the season.')}
      <div class="row">
        <span class="chip team">Scout points: <b class="num">&nbsp;${G.scoutPts}</b></span>
        <span class="chip">Signed ${n} / 4</span>
        <div class="needs" aria-label="Players per position">${POS.map(p => `<span class="chip ${counts[p] < 2 ? 'warn' : ''}" title="${POS_NAME[p]}">${p} ${counts[p]}</span>`).join('')}</div>
        <span class="spacer"></span>
        <button class="btn sm" data-act="auto-sign">Auto-pick best 4</button>
      </div>
      <div class="try-grid">${G.prospects.map(prospectCard).join('')}</div>
      <details class="card"><summary style="cursor:pointer;font-weight:700">Returning players (${G.roster.length})</summary>
        <div class="roster-list" style="margin-top:8px">${G.roster.map(rosterRow).join('')}</div></details>
      <div class="cta-bar"><span class="why" id="try-why">${why}</span>
        <button class="btn big primary" data-act="finalize" ${n < 2 ? 'aria-disabled="true"' : ''} aria-describedby="try-why">Finalize roster (${total}) →</button></div>
    </div></main>`;
}
function prospectCard(p) {
  const sc = !!G.scouted[p.id]; const sel = G.signed.includes(p.id); const [lo, hi] = prospectRange(p); const o = ovr(p);
  return `<article class="pcard ${sel ? 'sel' : ''}" aria-label="${pname(p)}, ${POS_NAME[p.pos]}">
    <div class="hd">${jersey(p)}<div class="who"><b>${pname(p)}</b><span class="muted num">${p.pos} · ${YEAR[p.year]}${p.transfer ? ' · Transfer' : ''}</span></div>
      <div class="ovr">${sc ? o : `${lo}–${hi}`}<small>${sc ? 'OVR' : 'OVR est.'}</small></div></div>
    ${sc ? attrBars(p) : `<p class="muted" style="font-size:.92rem">Coaches' guess from one practice: ${p.r.sho > p.r.ins ? 'looks like a shooter' : 'plays inside'}${p.r.def > 55 ? ', defends hard' : ''}${p.r.pas > 58 ? ', sharp passer' : ''}.</p>`}
    <div class="row" style="gap:6px">${sc ? `<span class="chip" title="${E(TRAITS[p.trait].d)}">${E(p.trait)}</span><span class="chip">Potential ${stars(p.pot, o)}</span><span class="chip">GPA ${p.gpa.toFixed(2)}</span>` : '<span class="chip">Potential ?</span><span class="chip">Personality ?</span>'}</div>
    <div class="acts">
      ${sc ? '' : `<button class="btn sm" data-act="scout" data-id="${p.id}" ${G.scoutPts <= 0 ? 'disabled title="No scout points left"' : ''}>Scout (1 pt)</button>`}
      <button class="btn sm ${sel ? '' : 'primary'}" data-act="sign" data-id="${p.id}" aria-pressed="${sel}" ${!sel && G.signed.length >= 4 ? 'disabled title="Roster is full"' : ''}>${sel ? 'Release' : 'Sign'}</button>
    </div></article>`;
}
function attrBars(p, showPot) {
  return `<div class="attrs">${ATTR.map(k => { const v = Math.round(p.r[k]); return `<span class="an">${ATTR_NAME[k]}</span><span class="ab" role="img" aria-label="${ATTR_NAME[k]} ${v}">${showPot ? `<u style="width:${Math.min(99, v + (p.pot - ovr(p)))}%"></u>` : ''}<i style="width:${v}%"></i></span><span class="av">${v}</span>`; }).join('')}</div>`;
}
function rosterRow(p) {
  return `<button class="prow" data-act="player" data-id="${p.id}">${jersey(p)}<span style="min-width:0"><span class="nm" style="display:block">${pname(p)}</span><span class="meta"><span>${p.pos} · ${YEAR[p.year]}</span>${ebar(p.energy)} ${statusChips(p)}</span></span><span class="ovr">${ovr(p)}<small>OVR</small></span></button>`;
}

/* ---------- HUB ---------- */
function stepIndex() { return { practice: 0, event: 1, prep: 2, recap: 3 }[G.step]; }
function renderHub() {
  const info = currentGameInfo(); const opp = info.opp; const [c1, c2] = schoolColors();
  const P = G.playoffs; const won = r => P && (P.round > r || (P.round === r && G.step === 'recap' && G.lastGame && G.lastGame.win));
  const wkLabel = G.phase === 'playoffs' ? ROUNDS[P.round] : `Week ${G.week} of 10`;
  const sub = G.phase === 'playoffs' ? `Playoffs · ${recordStr()}` : `Week ${G.week} · ${recordStr()}`;
  const steps = ['Practice', 'Challenge', 'Game day', 'Recap']; const si = stepIndex();
  const tabs = [['week', 'This week'], ['roster', 'Roster'], ['standings', G.phase === 'playoffs' ? 'Bracket' : 'Standings'], ['office', 'Front office'], ['log', 'Season log']];
  return `${topbar(sub)}
  <main class="wrap hub" id="main">
    <div style="min-width:0">
      <section class="road" aria-label="Road to the championship">
        <div class="beam"></div>
        <div class="road-inner">
          <div class="road-info"><div class="eyebrow">${G.phase === 'playoffs' ? 'Win or go home' : 'Regular season'}</div><h1 class="wk" style="font-weight:400">${wkLabel}</h1>
            <p style="color:#C9D2DC;margin-top:4px">${G.phase === 'playoffs' ? `Seed #${P.seed} · ${4 - P.round} win${4 - P.round > 1 ? 's' : ''} from the State title` : `Top 4 in the district make the playoffs · ${10 - G.week} week${10 - G.week === 1 ? '' : 's'} left after this`}</p></div>
          <div class="banners" aria-label="Playoff banners">${ROUNDS.map((r, i) => pennant(['Sect. Semi', 'Sect. Final', 'State Semi', 'State Title'][i], won(i), c1, c2, ['I', 'II', 'III', 'IV'][i])).join('')}</div>
        </div>
      </section>
      ${UI.banner ? UI.banner : ''}
      <ol class="stepper" aria-label="This week's steps">${steps.map((s, i) => `<li class="${i < si ? 'done' : i === si ? 'cur' : ''}" ${i === si ? 'aria-current="step"' : ''}><span class="dot">${i < si ? '✓' : i + 1}</span>${s}</li>`).join('')}</ol>
      <div class="tabs" role="tablist" aria-label="Hub sections">${tabs.map(([k, l]) => `<button class="tab" role="tab" id="tab-${k}" aria-controls="panel" aria-selected="${UI.tab === k}" tabindex="${UI.tab === k ? 0 : -1}" data-act="tab" data-tab="${k}">${l}</button>`).join('')}</div>
      <section class="tabpanel" id="panel" role="tabpanel" aria-labelledby="tab-${UI.tab}">${{ week: weekPanel, roster: rosterPanel, standings: standingsPanel, office: officePanel, log: logPanel }[UI.tab]()}</section>
    </div>
    <aside class="stack" aria-label="Next opponent and roster">
      <section class="card"><div class="eyebrow">Next game · ${E(info.label)}</div>
        <div class="opp" style="margin-top:8px">${oppCrest(opp)}<div><div class="vs">${info.neutral ? 'vs' : info.home ? 'vs' : '@'} ${E(opp.name)} ${E(opp.mascot)}</div>
          <div class="facts"><span class="chip">${opp.nd || opp.st ? 'Non-district' : `${opp.w}–${opp.l}`}</span><span class="chip">OVR ${oppRating(opp)}</span><span class="chip">${info.neutral ? 'Neutral site' : info.home ? 'Home' : 'Away'}</span></div></div></div>
        <p class="muted" style="margin-top:8px;font-size:.92rem">Your team OVR: <b class="num" style="color:var(--ink)">${myRating()}</b> · ${myRating() >= oppRating(opp) ? 'You’re favored.' : `Underdog by ${oppRating(opp) - myRating()}.`}</p></section>
      <section class="card"><div class="panel-title" style="margin-bottom:4px"><h2 style="font-size:1.1rem">Roster</h2><span class="muted num">${G.roster.length} players · avg energy ${avgEnergy()}</span></div>
        <div class="roster-list">${G.roster.slice().sort((a, b) => ovr(b) - ovr(a)).map(rosterRow).join('')}</div></section>
    </aside>
  </main>`;
}
function weekPanel() { return { practice: practicePanel, event: eventPanel, prep: prepPanel, recap: recapPanel }[G.step](); }

/* Practice: coach's whiteboard */
function practicePanel() {
  if (G.practiceDone) return practiceResults();
  const n = practiceSlots(); if (G.plan.length !== n) G.plan = new Array(n).fill(null);
  const days = ['Mon', 'Tue', 'Wed', 'Thu'].slice(0, n); const active = UI.slot != null ? UI.slot : G.plan.findIndex(x => !x);
  const pr = projectPractice(G.plan); const filled = G.plan.filter(Boolean).length;
  const risk = pr.injRisk > .09 ? ['High', 'down'] : pr.injRisk > .04 ? ['Medium', ''] : ['Low', 'up'];
  const growTxt = Object.entries(pr.grow).sort((a, b) => b[1] - a[1]).map(([k]) => ATTR_NAME[k]).slice(0, 3).join(', ') || 'None';
  return `${coachTip('practice', 'Pick a drill for each day. Tap a day, then a drill. Tired players (low energy) learn half as much and get hurt more, so mix in Rest. Repeating the same drill gives less each time.')}
  <div class="whiteboard">
    <div class="row"><div class="wb-title">Practice plan · ${G.phase === 'playoffs' ? 'short playoff week' : 'Week ' + G.week}</div><span class="spacer"></span><span class="wb-note">Friday = game day!</span></div>
    <div class="days" style="--days:${n}" role="group" aria-label="Practice days">${days.map((d, i) => { const k = G.plan[i]; return `<button class="day ${i === active ? 'active' : ''} ${k ? 'filled' : ''}" data-act="slot" data-i="${i}" aria-pressed="${i === active}" aria-label="${d}: ${k ? DRILLS[k].name : 'empty'}${i === active ? ', selected' : ''}"><span class="dn">${d}</span><span class="dr ${k ? '' : 'empty'}">${k ? E(DRILLS[k].name) : 'Pick a drill'}</span></button>`; }).join('')}</div>
    <div class="row" style="margin-top:10px;gap:6px"><span class="wb-note" style="color:#56616D;font-family:var(--f-body);font-size:.9rem">Quick plans:</span>${Object.entries(PRESETS).map(([k, p]) => `<button class="btn sm" data-act="preset" data-k="${k}">${p.name}</button>`).join('')}<button class="btn sm ghost" data-act="clear-plan">Clear</button></div>
  </div>
  <h3 class="eyebrow" style="margin-top:16px">Drills · assigning to <b style="color:var(--ink)">${active >= 0 ? days[active] : 'next open day'}</b></h3>
  <div class="drills">${Object.entries(DRILLS).map(([k, d]) => `<button class="drill" data-act="drill" data-k="${k}"><span class="dn">${icon(DRILL_ICON[k])}${d.name}</span><span class="dd">${d.d}</span></button>`).join('')}</div>
  <div class="projection" aria-label="Projected effects of this plan">
    <div class="proj"><div class="l">Energy</div><div class="v ${pr.energy >= 0 ? 'up' : 'down'}">${pr.energyBefore} → ${pr.energyAfter}</div></div>
    <div class="proj"><div class="l">Morale</div><div class="v ${pr.morale >= 0 ? 'up' : 'down'}">${U.signed(pr.morale)}</div></div>
    <div class="proj"><div class="l">Chemistry</div><div class="v ${pr.chem >= 0 ? 'up' : ''}">${U.signed(pr.chem)}</div></div>
    <div class="proj"><div class="l">Skills grown</div><div class="v" style="font-size:.95rem">${growTxt}</div></div>
    <div class="proj"><div class="l">Injury risk</div><div class="v ${risk[1]}">${risk[0]}</div></div>
    ${pr.money ? `<div class="proj"><div class="l">Fundraising</div><div class="v up">+${U.money(pr.money)}</div></div>` : ''}
    ${pr.gpa ? `<div class="proj"><div class="l">GPA</div><div class="v up">+${pr.gpa.toFixed(2)}</div></div>` : ''}
    <div class="proj"><div class="l">Scouting</div><div class="v ${pr.scout || G.upgrades.scouting ? 'up' : ''}" style="font-size:.95rem">${pr.scout || G.upgrades.scouting ? 'Game plan revealed' : 'Opponent unknown'}</div></div>
  </div>
  <div class="cta-bar"><span class="why" id="prac-why">${filled < n ? `Fill ${n - filled} more day${n - filled > 1 ? 's' : ''} to run practice.` : 'Plan ready.'}</span>
    <button class="btn big primary" data-act="run-practice" ${filled < n ? 'aria-disabled="true"' : ''} aria-describedby="prac-why">Run practice week →</button></div>`;
}
function practiceResults() {
  const r = G.practiceDone; const growers = Object.entries(r.grow).map(([id, d]) => ({ p: G.roster.find(x => x.id === id), d })).filter(x => x.p).sort((a, b) => b.d - a.d);
  return `<div class="card"><div class="panel-title"><h2>Practice complete</h2></div>
    <div class="deltas">${[['Energy', r.energyAfter - r.energyBefore], ['Morale', r.moraleAfter - r.moraleBefore], ['Chemistry', r.chemAfter - Math.round(r.chemBefore)]].map(([l, v]) => v === 0 ? neutralChip(l, '±0') : deltaChip(l, U.signed(v), v > 0)).join('')}${r.money ? deltaChip('Budget', '+' + U.money(r.money), true) : ''}${G.flags.filmThisWeek ? deltaChip('Scouting', 'opponent revealed', true) : ''}</div>
    <h3 class="eyebrow" style="margin-top:14px">Players who improved</h3>
    ${growers.length ? `<ul class="list-plain" style="margin-top:6px">${growers.slice(0, 6).map(x => `<li>${jersey(x.p)} <b>${pname(x.p)}</b> <span class="chip good">OVR +${x.d} → ${ovr(x.p)}</span></li>`).join('')}</ul>` : '<p class="muted">No visible OVR jumps this week. Growth still builds up underneath the rounding.</p>'}
    ${r.injuries.length ? `<p class="chip bad" style="margin-top:12px;white-space:normal">Injury: ${E(r.injuries.join('; '))}</p>` : ''}
    <div class="cta-bar"><span class="why">Next: an off-court challenge needs your decision.</span><button class="btn big primary" data-act="to-event">See this week’s challenge →</button></div></div>`;
}

/* Challenge memo */
function eventPanel() {
  if (!G.event) drawEvent();
  const ev = EVENTS.find(e => e.id === G.event.id); const ctx = eventCtx(); const done = G.eventDone;
  const tag = ([k, v]) => showExact() || !/[0-9$]/.test(v) ? `<span class="chip">${E(k)} ${E(v)}</span>` : `<span class="chip">${E(k)} ${/^[+]/.test(v) ? '▲' : /^[−-]/.test(v) ? '▼' : E(v)}</span>`;
  return `${coachTip('event', 'Every choice has a trade-off. Tags show what is at stake. Some effects show up later (a rushed injury, a bold promise to the media). Press 1, 2 or 3 to choose.')}
  <article class="memo" aria-labelledby="ev-title">
    <div class="memo-head">${icon(ev.icon)} Challenge · ${G.phase === 'playoffs' ? ROUNDS[G.playoffs.round] : 'Week ' + G.week}</div>
    <div class="memo-body"><h2 id="ev-title">${E(ev.title)}</h2><p class="story">${E(G.event.text)}</p>
      ${done ? `<div class="outcome" role="status"><b>You chose: ${E(done.label)}</b><p style="margin-top:4px">${E(done.text)}</p><div class="deltas">${done.chips.length ? done.chips.map(([l, v, g]) => deltaChip(l, v, g)).join('') : neutralChip('No change', '')}</div></div>
        <div class="cta-bar"><span class="why">Next: set your lineup and game plan.</span><button class="btn big primary" data-act="to-prep">Go to game prep →</button></div>` :
      `<div class="choices" role="group" aria-label="Your options">${ev.choices.map((c, i) => `<button class="choice" data-act="choose" data-i="${i}"><span class="k" aria-hidden="true">${i + 1}</span><span class="t">${E(typeof c.t === 'function' ? c.t(ctx) : c.t)}</span><span class="tags">${c.tags.filter(t => t[0] !== 'No change').map(tag).join('')}</span></button>`).join('')}</div>`}
    </div></article>`;
}

/* Game prep */
function prepPanel() {
  validateLineup();
  const info = currentGameInfo(); const opp = info.opp; const sc = isScouted(); const { rec, why } = recommend(opp); const st = G.strategy; const star = starOf(opp.roster);
  const avail = G.roster.filter(eligible); const out = G.roster.filter(p => !eligible(p));
  const seg = (key, opts) => `<div class="seg" role="radiogroup" aria-label="${key}">${opts.map(([v, l]) => `<label><input type="radio" name="st-${key}" value="${v}" data-act="strat" data-k="${key}" ${st[key] === v ? 'checked' : ''}><span>${l}${sc && rec[key] === v ? ' ✓' : ''}</span></label>`).join('')}</div>`;
  const hints = {
    tempo: { slow: 'Fewer possessions. More randomness helps an underdog.', balanced: 'Normal pace.', fast: 'More possessions: the better team usually wins. Tires players.' },
    def: { man: 'Your best defenders guard their best players.', zone: 'Protects the paint and hides weak defenders. Gives up threes and rebounds.', press: 'Forces turnovers from weak passers. Drains your energy fast.' },
    focus: { inside: 'Post-ups and drives. Great against man and press.', balanced: 'Take what the defense gives.', perimeter: 'Look for threes. Great against a zone.' },
    rot: { tight: 'Starters play heavy minutes.', normal: 'Standard rotation.', deep: 'Fresh legs, more bench minutes.' },
  };
  return `${coachTip('prep', 'Pick your five starters and a game plan. Film Study (or the Scouting Service) reveals the opponent’s style, and ✓ marks the counters. Matching counters gives a real edge.')}
  <div class="prep">
    <section class="scout ${sc ? 'known' : ''}" aria-label="Scouting report"><div class="row"><h2 style="font-family:var(--f-display);font-weight:400;font-size:1.2rem">Scouting report: ${E(opp.name)}</h2><span class="spacer"></span><span class="chip ${sc ? 'good' : 'warn'}">${sc ? 'Scouted' : 'Not scouted'}</span></div>
      ${sc ? `<div class="grid2" style="margin-top:8px;gap:10px">
          <p><b>Their style:</b> ${{ slow: 'Slow', balanced: 'Balanced', fast: 'Fast' }[opp.style.tempo]} tempo · ${{ man: 'Man-to-man', zone: 'Zone', press: 'Full-court press' }[opp.style.def]} · ${{ inside: 'Inside', balanced: 'Balanced', perimeter: 'Perimeter' }[opp.style.focus]} offense</p>
          <p><b>Star:</b> #${star.num} ${pname(star)} (${star.pos}, OVR ${ovr(star)})</p></div>
          <ul class="list-plain" style="margin-top:6px"><li>✓ <span><b>Defense: ${E(rec.def)}</b>. ${E(why.def)}</span></li><li>✓ <span><b>Offense: ${E(rec.focus)}</b>. ${E(why.focus)}</span></li><li>✓ <span><b>Tempo: ${E(rec.tempo)}</b>. ${E(why.tempo)}</span></li></ul>`
      : `<p class="muted" style="margin-top:6px">Their game plan is unknown. Add <b>Film Study</b> to next week’s practice or buy the <b>Scouting Service</b> in the Front Office to reveal it and see recommended counters.</p><p style="margin-top:4px">They’re rated <b>${oppRating(opp)}</b> (you: ${myRating()}).</p>`}
    </section>
    <section aria-label="Starting lineup"><div class="panel-title" style="margin-bottom:8px"><h2>Starting five</h2><button class="btn sm" data-act="auto-lineup">Best available five</button></div>
      <div class="lineup">${POS.map((pos, i) => { const cur = G.roster.find(p => p.id === G.lineup[i]); return `<div class="slot"><label for="ln-${i}">${pos} · ${POS_NAME[pos]}</label><select id="ln-${i}" data-act="lineup" data-i="${i}">${avail.map(p => `<option value="${p.id}" ${cur && cur.id === p.id ? 'selected' : ''}>#${p.num} ${E(p.last)} · ${ovr(p)}</option>`).join('')}</select>${cur ? `<div class="num" style="font-size:.85rem;margin-top:4px">${cur.pos} · ${cur.pos === pos ? '<span class="fit-good">✓ natural</span>' : '<span class="fit-bad">✕ out of position</span>'}</div><div style="margin-top:2px">${ebar(cur.energy)}</div>` : ''}</div>`; }).join('')}</div>
      ${out.length ? `<p class="muted" style="margin-top:8px;font-size:.92rem">Unavailable: ${out.map(p => `${pname(p)} (${p.inj ? 'injured' : p.suspended ? 'suspended' : 'GPA ' + p.gpa.toFixed(2)})`).join(', ')}</p>` : ''}
    </section>
    <section aria-label="Game plan"><div class="panel-title" style="margin-bottom:8px"><h2>Game plan</h2></div>
      <div class="strat">
        <div><div class="eyebrow">Tempo</div>${seg('tempo', [['slow', 'Slow'], ['balanced', 'Balanced'], ['fast', 'Fast']])}<p class="hint">${hints.tempo[st.tempo]}</p></div>
        <div><div class="eyebrow">Defense</div>${seg('def', [['man', 'Man'], ['zone', 'Zone'], ['press', 'Press']])}<p class="hint">${hints.def[st.def]}</p></div>
        <div><div class="eyebrow">Offense focus</div>${seg('focus', [['inside', 'Inside'], ['balanced', 'Balanced'], ['perimeter', 'Perimeter']])}<p class="hint">${hints.focus[st.focus]}</p></div>
        <div><div class="eyebrow">Rotation</div>${seg('rot', [['tight', 'Tight'], ['normal', 'Normal'], ['deep', 'Deep']])}<p class="hint">${hints.rot[st.rot]}</p></div>
      </div></section>
    <div class="cta-bar"><span class="why">${sc ? `Counters matched: ${['def', 'focus', 'tempo'].filter(k => st[k] === rec[k]).length} of 3` : 'You can still adjust at every quarter break.'}</span><button class="btn big primary" data-act="tipoff">${icon('ball')} Tip off</button></div>
  </div>`;
}

/* Recap */
function recapPanel() {
  const g = G.lastGame; if (!g) return '';
  const opp = teamById(g.opp); const mvp = g.mvp && G.roster.find(p => p.id === g.mvp.id);
  const ch = [];
  const dm = g.after.morale - g.before.morale; ch.push(dm === 0 ? neutralChip('Morale', '±0') : deltaChip('Morale', U.signed(dm), dm > 0));
  const dc = g.after.chem - Math.round(g.before.chem); ch.push(dc === 0 ? neutralChip('Chemistry', '±0') : deltaChip('Chemistry', U.signed(dc), dc > 0));
  const df = g.after.fans - g.before.fans; ch.push(df === 0 ? neutralChip('Fans', '±0') : deltaChip('Fans', U.signed(df), df > 0));
  if (g.gate) ch.push(deltaChip('Gate revenue', '+' + U.money(g.gate), true)); if (g.travel) ch.push(deltaChip('Travel', '−' + U.money(g.travel), false));
  g.injuries.forEach(id => { const p = G.roster.find(x => x.id === id); if (p) ch.push(deltaChip(p.last, `injured ${p.inj} wk`, false)); });
  const next = G.phase === 'playoffs' ? (g.win ? (G.playoffs.round === 3 ? 'Celebrate the title →' : `On to the ${ROUNDS[G.playoffs.round + 1]} →`) : 'See how your season ended →') : G.week >= 10 ? 'See final standings →' : `Start week ${G.week + 1} →`;
  return `${coachTip('recap', 'After each game, morale and chemistry shift. Bench players who never see the floor lose morale. Home games earn gate money; road games cost travel.')}
  <div class="stack">
    <div class="result-banner ${g.win ? 'win' : ''}" role="status"><div class="big">${g.win ? 'WIN' : 'LOSS'} ${g.us}–${g.them}</div><div>${g.home ? 'vs' : g.neutral ? 'vs' : '@'} ${E(opp.name)} ${E(opp.mascot)}<br><span style="opacity:.85">${E(g.label)}</span></div></div>
    ${lineScore(g, opp)}
    <div class="grid2">
      <section class="card"><h2 class="eyebrow">Player of the game</h2>${mvp ? `<div class="row" style="margin-top:8px">${jersey(mvp)}<b>${pname(mvp)}</b><span class="chip team">${g.mvp.pts} PTS · ${g.mvp.reb} REB · ${g.mvp.ast} AST</span></div>` : ''}</section>
      <section class="card"><h2 class="eyebrow">What changed</h2><div class="deltas">${ch.join('')}</div></section>
    </div>
    <details class="card"><summary style="cursor:pointer;font-weight:700">Box score</summary>${boxTable(g.box, G.roster, 'Your team')}${boxTable(g.box, opp.roster, opp.name)}</details>
    <div class="cta-bar"><button class="btn big primary" data-act="end-week">${next}</button></div>
  </div>`;
}
function lineScore(g, opp) {
  const ot = g.otPts;
  return `<div class="table-wrap"><table class="data"><caption class="sr-only">Score by quarter</caption><thead><tr><th scope="col">Team</th>${[1, 2, 3, 4].map(q => `<th class="n" scope="col">Q${q}</th>`).join('')}${ot ? '<th class="n" scope="col">OT</th>' : ''}<th class="n" scope="col">Final</th></tr></thead><tbody>
  <tr class="me"><th scope="row">${E(G.school.name)}</th>${g.qs.map(q => `<td class="n">${q[0]}</td>`).join('')}${ot ? `<td class="n">${ot[0]}</td>` : ''}<td class="n"><b>${g.us}</b></td></tr>
  <tr><th scope="row">${E(opp.name)}</th>${g.qs.map(q => `<td class="n">${q[1]}</td>`).join('')}${ot ? `<td class="n">${ot[1]}</td>` : ''}<td class="n"><b>${g.them}</b></td></tr></tbody></table></div>`;
}
function boxTable(box, roster, title) {
  const rows = roster.filter(p => box[p.id]).map(p => ({ p, b: box[p.id] })).sort((a, b) => b.b.pts - a.b.pts);
  return `<h3 class="eyebrow" style="margin:12px 0 6px">${E(title)}</h3><div class="table-wrap"><table class="data"><thead><tr><th scope="col">Player</th><th class="n" scope="col">PTS</th><th class="n" scope="col">FG</th><th class="n" scope="col">3PT</th><th class="n" scope="col">REB</th><th class="n" scope="col">AST</th></tr></thead><tbody>
  ${rows.map(({ p, b }) => `<tr><th scope="row" style="font-weight:400">#${p.num} ${pname(p)} <span class="muted">${p.pos}</span></th><td class="n">${b.pts}</td><td class="n">${b.fgm}/${b.fga}</td><td class="n">${b.tpm}/${b.tpa}</td><td class="n">${b.reb}</td><td class="n">${b.ast}</td></tr>`).join('')}</tbody></table></div>`;
}

/* Other tabs */
function rosterPanel() {
  return `<div class="table-wrap"><table class="data"><caption class="sr-only">Full roster</caption><thead><tr><th scope="col">Player</th><th scope="col">Pos</th><th scope="col">Yr</th><th class="n" scope="col">OVR</th><th class="n" scope="col">Growth</th><th scope="col">Pot.</th><th class="n" scope="col">Energy</th><th class="n" scope="col">Morale</th><th class="n" scope="col">GPA</th><th scope="col">Trait</th><th scope="col">Status</th></tr></thead><tbody>
  ${G.roster.slice().sort((a, b) => ovr(b) - ovr(a)).map(p => `<tr><th scope="row"><button class="btn ghost sm" data-act="player" data-id="${p.id}" style="padding-inline:4px">#${p.num} ${pname(p)}</button></th><td>${p.pos}</td><td>${YEAR[p.year]}</td><td class="n"><b>${ovr(p)}</b></td><td class="n">${ovr(p) - p.start > 0 ? '+' + (ovr(p) - p.start) : '—'}</td><td>${stars(p.pot, ovr(p))}</td><td class="n">${Math.round(p.energy)}</td><td class="n">${Math.round(p.morale)}</td><td class="n" style="${p.gpa < 2 ? 'color:var(--bad);font-weight:700' : ''}">${p.gpa.toFixed(2)}</td><td title="${E(TRAITS[p.trait].d)}">${E(p.trait)}</td><td>${statusChips(p) || '<span class="chip good">Ready</span>'}</td></tr>`).join('')}
  </tbody></table></div><p class="muted" style="margin-top:8px;font-size:.9rem">Select a player’s name for details. GPA below 2.00 makes a player ineligible to play.</p>`;
}
function standingsPanel() {
  if (G.phase === 'playoffs') return bracketView();
  const st = standings();
  return `<div class="table-wrap"><table class="data"><caption class="sr-only">District standings</caption><thead><tr><th scope="col">#</th><th scope="col">Team</th><th class="n" scope="col">W</th><th class="n" scope="col">L</th><th class="n" scope="col">Diff</th><th class="n" scope="col">OVR</th></tr></thead><tbody>
  ${st.map((r, i) => `<tr class="${r.me ? 'me' : ''} ${i === 3 ? 'cut' : ''}"><td class="n">${i + 1}</td><th scope="row" style="font-weight:inherit">${E(r.name)} ${E(r.mascot)}${r.me ? ' (you)' : ''}</th><td class="n">${r.w}</td><td class="n">${r.l}</td><td class="n">${U.signed(r.pf - r.pa)}</td><td class="n">${r.rating}</td></tr>`).join('')}
  </tbody></table></div><p class="muted" style="margin-top:8px;font-size:.9rem">Dashed line: the top 4 make the playoffs. Ties are broken by point differential.</p>`;
}
function bracketView() {
  const P = G.playoffs; const nm = id => id === 'me' ? `${E(G.school.name)} (you)` : E(teamById(id).name);
  const game = g => { if (!g) return `<div class="bgame"><div>TBD</div><div>TBD</div></div>`; const lost = x => g.winner && g.winner !== x; return `<div class="bgame"><div class="${g.a === 'me' ? 'me' : ''} ${lost(g.a) ? 'lost' : ''}"><span>${nm(g.a)}</span>${g.score ? `<b class="num">${g.score[0]}</b>` : ''}</div><div class="${g.b === 'me' ? 'me' : ''} ${lost(g.b) ? 'lost' : ''}"><span>${nm(g.b)}</span>${g.score ? `<b class="num">${g.score[1]}</b>` : ''}</div></div>`; };
  return `<div class="bracket" role="list" aria-label="Playoff bracket">${ROUNDS.map((r, i) => `<div class="bround" role="listitem"><h3>${r}</h3>${(P.bracket[i].length ? P.bracket[i] : [null]).map(game).join('')}</div>`).join('')}</div>
  <p class="muted" style="margin-top:8px;font-size:.9rem">Single elimination. You are seed #${P.seed}. The top two seeds host sectional games; State games are at a neutral arena.</p>`;
}
function officePanel() {
  return `<p class="muted" style="max-width:68ch;margin-bottom:12px">Invest your budget. Each upgrade lasts the rest of the season. Money comes from home games (${U.money(180 + G.res.fans * 6)} at current fan support), fundraisers and some challenges. Road trips cost $150 and weekly operations cost $100.</p>
  <div class="grid2">${Object.entries(UPGRADES).map(([k, u]) => { const own = G.upgrades[k]; const short = G.res.budget < u.cost; return `<section class="card" aria-label="${u.name}"><div class="row"><h3 style="font-size:1.05rem">${u.name}</h3><span class="spacer"></span><span class="chip ${own ? 'good' : ''}">${own ? 'Owned' : U.money(u.cost)}</span></div><p class="muted" style="margin:6px 0 10px">${u.d}</p>${own ? '' : `<button class="btn sm ${short ? '' : 'primary'}" data-act="buy" data-k="${k}" ${short ? `aria-disabled="true" title="Need ${U.money(u.cost - G.res.budget)} more"` : ''}>${short ? `Need ${U.money(u.cost - G.res.budget)} more` : `Buy for ${U.money(u.cost)}`}</button>`}</section>`; }).join('')}</div>`;
}
function logPanel() {
  return `<ol class="list-plain" style="gap:0">${G.log.slice().reverse().map(l => `<li style="padding:8px 0;border-bottom:1px solid var(--border)"><span class="chip ${l.good ? 'good' : l.bad ? 'bad' : ''}" style="min-width:52px;justify-content:center">${l.w === 0 ? 'Pre' : typeof l.w === 'number' ? 'Wk ' + l.w : l.w}</span><span>${E(l.t)}</span></li>`).join('')}</ol>`;
}

/* ---------- GAME ---------- */
function renderGame() {
  const s = UI.sim; const info = s.info; const opp = info.opp;
  return `${topbar(`${E(info.label)} · ${recordStr()}`)}
  <main class="wrap game" id="main">
    <h1 class="sr-only">Live game vs ${E(opp.name)}</h1>
    <section class="scoreboard" aria-label="Scoreboard">
      <div class="sb-team">${myCrest()}<div style="min-width:0"><div class="tn">${E(G.school.name)}</div><div class="sb-score" id="sb-us">${seg7(String(UI.play.dUs).padStart(2, ' '), 46)}</div></div></div>
      <div class="sb-mid"><div class="q" id="sb-q">${qLabel(UI.play.curQ || 0)}</div><div id="sb-clock">${seg7(fmtClock(UI.play.clock), 28, 'var(--led-red)')}</div><div class="q">${info.neutral ? 'Neutral' : info.home ? 'Home' : 'Away'}</div></div>
      <div class="sb-team r">${oppCrest(opp)}<div style="min-width:0"><div class="tn">${E(opp.name)}</div><div class="sb-score" id="sb-them" style="justify-content:flex-end">${seg7(String(UI.play.dThem).padStart(2, ' '), 46)}</div></div></div>
      <span class="sr-only" id="sb-text">${E(G.school.name)} ${UI.play.dUs}, ${E(opp.name)} ${UI.play.dThem}</span>
    </section>
    <div class="game-main">
      <div class="stack" style="min-width:0">
        <div class="court-wrap"><canvas id="court" role="img" aria-label="Court view. Your team attacks the right basket. Made shots are filled circles, misses are X marks."></canvas></div>
        <div class="court-legend"><span><b style="color:var(--team)">●</b> made · <b>✕</b> missed</span><span>Your team attacks → right basket</span><span>Striped dots = ${E(opp.name)}</span></div>
        <div class="controls" id="controls">${gameControls()}</div>
        <div id="break">${UI.play.breakHtml || ''}</div>
      </div>
      <section class="pbp" aria-label="Play-by-play"><h3>Play-by-play</h3><ol id="pbp" aria-live="off">${UI.play.lines.slice(0, 60).map(pbpLine).join('')}</ol></section>
    </div>
    <details class="card" id="live-box"><summary style="cursor:pointer;font-weight:700">Live box score</summary><div id="live-box-body"></div></details>
  </main>`;
}
function qLabel(q) { return q >= 4 ? (q === 4 ? 'OT' : `${q - 3}OT`) : ['1st', '2nd', '3rd', '4th'][q] + ' Qtr'; }
function gameControls() {
  const P = UI.play; if (P.breakHtml || P.final) return `<span class="muted">${P.final ? 'Game over.' : 'Timeout: make adjustments below.'}</span>`;
  return `<button class="btn" data-act="pause" aria-pressed="${P.paused}">${P.paused ? '▶ Resume' : '❚❚ Pause'} <span class="kbd">Space</span></button>
    <div class="seg" role="radiogroup" aria-label="Simulation speed">${[1, 2, 4].map(v => `<label><input type="radio" name="spd" value="${v}" data-act="speed" ${SET.speed === v ? 'checked' : ''}><span>${v}×</span></label>`).join('')}</div>
    <button class="btn" data-act="skipq">Skip to quarter end</button>
    <div class="momentum" role="img" aria-label="Momentum" title="Momentum"><i id="mom"></i></div>`;
}
function pbpLine(l) { return `<li class="${l.team === 'us' ? 'us' : ''} ${l.score ? 'score' : ''} ${l.big ? 'big' : ''}"><span class="tm">${l.tm}</span><span>${l.team === 'us' && l.score ? '<b>' + E(l.text) + '</b>' : E(l.text)}</span></li>`; }

function startGame() {
  SFX.init(); const sim = newGameSim(); UI.sim = sim;
  UI.play = { queue: [], timer: 0, paused: false, dUs: 0, dThem: 0, clock: 480, lines: [], breakHtml: '', final: false };
  UI.screen = 'game'; render(); SFX.whistle();
  G.log.push({ w: G.phase === 'playoffs' ? 'P' : G.week, t: `Game plan: ${sim.strat.tempo} tempo, ${sim.strat.def} defense, ${sim.strat.focus} focus.` });
  nextQuarter();
}
function mountGame() {
  const cv = $('#court'); if (!cv) return; const opp = UI.sim.info.opp; const [c1] = schoolColors();
  const home = !UI.sim.info.away && UI.sim.info.home; const paint = UI.sim.info.neutral ? '#2F4A6A' : home ? c1 : opp.c[0];
  const themClr = contrast(opp.c[0], c1) < 1.6 ? opp.c[1] : opp.c[0];
  Court.mount(cv, { us: c1, usInk: inkOn(c1), them: themClr, themInk: inkOn(themClr), paint, paintInk: inkOn(paint), initials: UI.sim.info.neutral ? 'STATE' : initials(home ? G.school.name : opp.name) }, reduced());
  updateLiveBox(); updateMomentum();
}
function nextQuarter() { const s = UI.sim; UI.play.curQ = s.q; UI.play.clock = s.q >= 4 ? 240 : 480; const evs = simQuarter(s); UI.play.queue = evs.slice(); UI.play.breakHtml = ''; refreshControls(); Court.clearMarks(); Court.formation('us', true); tick(); }
function delayFor(ev) { const base = { shot: 1150, to: 800, oreb: 550, note: 1100, inj: 1400, end: 400 }[ev.k] || 700; return base / (SET.speed || 1); }
function tick() {
  const P = UI.play; clearTimeout(P.timer); if (P.paused || UI.screen !== 'game') return;
  const ev = P.queue.shift(); if (!ev) return;
  showEvent(ev, true);
  if (ev.k === 'end') return onBreak(ev);
  P.timer = setTimeout(tick, delayFor(ev));
}
function showEvent(ev, animate) {
  const P = UI.play; const s = UI.sim; P.clock = ev.clock;
  const q = ev.q >= 4 ? (ev.q === 4 ? 'OT' : (ev.q - 3) + 'OT') : 'Q' + (ev.q + 1);
  const tm = `${q} ${fmtClock(ev.clock)}`;
  let score = false, big = false;
  if (ev.k === 'shot') {
    if (animate) { Court.formation(ev.team); Court.shoot(ev.team, ev.loc, ev.made, reduced() ? 0 : Math.min(700, 900 / (SET.speed || 1))); }
    else Court.marks.push({ ...(() => { const [x, y] = Court.toCourt(ev.team, ev.loc); return { x, y }; })(), made: ev.made, side: ev.team });
    if (ev.pts) { score = true; P.dUs = ev.us; P.dThem = ev.them;
      if (animate) { setTimeout(() => { if (ev.made) SFX.swish(); else SFX.rim(); if (ev.team === 'us' && ev.pts >= 3) { SFX.cheer(); Court.text(ev.pts === 3 ? '+3!' : 'AND ONE!', 'us'); } }, reduced() ? 0 : Math.min(650, 850 / (SET.speed || 1))); }
      const lead = P.dUs - P.dThem; if (P.lastLead != null && Math.sign(lead) !== Math.sign(P.lastLead) && lead !== 0) { big = true; announce(`Lead change. ${G.school.name} ${P.dUs}, ${s.info.opp.name} ${P.dThem}.`); } P.lastLead = lead;
    } else if (animate) setTimeout(() => SFX.rim(), reduced() ? 0 : Math.min(650, 850 / (SET.speed || 1)));
  } else if (ev.k === 'to' && animate) { Court.formation(ev.team === 'us' ? 'them' : 'us'); }
  else if (ev.k === 'inj') { big = true; if (animate) SFX.bad(); announce(ev.text, true); }
  else if (ev.k === 'note') big = true;
  if (ev.k === 'end') { P.dUs = ev.us; P.dThem = ev.them; big = true; }
  const who = ev.team === 'us' ? G.school.name : ev.team === 'them' ? s.info.opp.name : '';
  const line = { tm, text: (ev.k === 'shot' || ev.k === 'to' || ev.k === 'oreb') && who ? `${ev.text}` : ev.text, team: ev.team, score, big };
  P.lines.unshift(line);
  if (animate) { const ol = $('#pbp'); if (ol) { ol.insertAdjacentHTML('afterbegin', pbpLine(line)); while (ol.children.length > 60) ol.lastChild.remove(); } updateBoard(); updateMomentum(); }
}
function updateBoard() {
  const P = UI.play; const u = $('#sb-us'), t = $('#sb-them'), c = $('#sb-clock'), q = $('#sb-q'), tx = $('#sb-text');
  if (u) u.innerHTML = seg7(String(P.dUs).padStart(2, ' '), 46); if (t) t.innerHTML = seg7(String(P.dThem).padStart(2, ' '), 46);
  if (c) c.innerHTML = seg7(fmtClock(P.clock), 28, 'var(--led-red)');
  if (q) q.textContent = qLabel(P.curQ || 0);
  if (tx) tx.textContent = `${G.school.name} ${P.dUs}, ${UI.sim.info.opp.name} ${P.dThem}`;
}
function updateMomentum() { const m = $('#mom'); if (!m) return; const v = UI.sim.momentum / 6; m.style.left = v >= 0 ? '50%' : `${50 + v * 50}%`; m.style.width = `${Math.abs(v) * 50}%`; m.style.background = v >= 0 ? 'var(--team)' : 'var(--ink-3)'; }
function updateLiveBox() { const b = $('#live-box-body'); if (!b || !UI.sim) return; b.innerHTML = boxTable(UI.sim.box, G.roster, 'Your team') + boxTable(UI.sim.box, UI.sim.info.opp.roster, UI.sim.info.opp.name); }
function refreshControls() { const c = $('#controls'); if (c) c.innerHTML = gameControls(); const b = $('#break'); if (b) b.innerHTML = UI.play.breakHtml || ''; }
function skipQuarter() {
  const P = UI.play; clearTimeout(P.timer); let ev;
  while ((ev = P.queue.shift())) { showEvent(ev, false); if (ev.k === 'end') { const ol = $('#pbp'); if (ol) ol.innerHTML = P.lines.slice(0, 60).map(pbpLine).join(''); updateBoard(); updateMomentum(); return onBreak(ev); } }
}
function onBreak(ev) {
  const s = UI.sim; const P = UI.play; updateLiveBox(); updateBoard();
  const lead = s.us - s.them; const opp = s.info.opp;
  if (s.done) {
    SFX.buzzer(); P.final = true; const win = s.us > s.them;
    setTimeout(() => { if (win) SFX.good(); else SFX.bad(); }, 900);
    announce(`Final. ${win ? 'You win' : 'You lose'}, ${s.us} to ${s.them}.`, true);
    P.breakHtml = `<div class="timeout" role="region" aria-label="Final"><h2>Final: ${win ? 'You win!' : 'Tough loss.'} ${s.us}–${s.them}</h2><p class="muted" style="margin-top:4px">${win ? 'The locker room is loud.' : 'Learn from the tape and bounce back.'}</p><div class="cta-bar"><button class="btn big primary" data-act="to-recap" id="to-recap">See game recap →</button></div></div>`;
    refreshControls(); $('#to-recap') && $('#to-recap').focus(); return;
  }
  SFX.whistle();
  const half = s.q === 2; const st = s.strat; const quarterName = s.q >= 4 ? 'overtime' : ['', 'first quarter', 'halftime', 'third quarter'][s.q];
  announce(`${half ? 'Halftime' : 'End of the ' + quarterName}. ${G.school.name} ${s.us}, ${opp.name} ${s.them}.`);
  const seg = (key, opts) => `<div class="seg" role="radiogroup" aria-label="${key}">${opts.map(([v, l]) => `<label><input type="radio" name="tq-${key}" value="${v}" data-act="qstrat" data-k="${key}" ${st[key] === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
  const tired = s.my.map(id => simPlayer(s, id)).filter(p => s.onUs.includes(p.id)).sort((a, b) => a.gEnergy - b.gEnergy)[0];
  P.breakHtml = `<div class="timeout" role="region" aria-labelledby="to-h"><h2 id="to-h">${half ? 'Halftime' : s.q >= 4 ? 'Overtime' : 'Timeout'}: ${lead > 0 ? `up ${lead}` : lead < 0 ? `down ${-lead}` : 'tied'}</h2>
    <p class="muted" style="margin:4px 0 12px">${lead < -8 ? 'You need a change. Try a press or a faster tempo to create more chances.' : lead > 8 ? 'Protect the lead: slow the tempo and keep legs fresh.' : 'A close one. Small adjustments matter.'} ${tired ? `Most tired starter: ${pname(tired)} (energy ${Math.round(tired.gEnergy)}).` : ''}</p>
    ${half && !s.halfTalk ? `<fieldset style="border:0;padding:0;margin:0 0 12px"><legend class="eyebrow">Halftime talk (pick one)</legend><div class="choices" style="margin-top:6px">
      <button class="choice" data-act="talk" data-t="fire"><span class="k">1</span><span class="t">Fire them up</span><span class="tags"><span class="chip">Shooting boost</span><span class="chip">Needs chemistry 50+ or it may backfire</span></span></button>
      <button class="choice" data-act="talk" data-t="calm"><span class="k">2</span><span class="t">Stay calm, catch your breath</span><span class="tags"><span class="chip">Energy +10 for everyone</span></span></button>
      <button class="choice" data-act="talk" data-t="star"><span class="k">3</span><span class="t">Adjust to their top scorer</span><span class="tags"><span class="chip">Their star shoots worse</span></span></button></div></fieldset>` : ''}
    ${s.talkMsg ? `<p class="outcome" style="margin:0 0 12px">${E(s.talkMsg)}</p>` : ''}
    <div class="strat"><div><div class="eyebrow">Tempo</div>${seg('tempo', [['slow', 'Slow'], ['balanced', 'Balanced'], ['fast', 'Fast']])}</div><div><div class="eyebrow">Defense</div>${seg('def', [['man', 'Man'], ['zone', 'Zone'], ['press', 'Press']])}</div><div><div class="eyebrow">Offense</div>${seg('focus', [['inside', 'Inside'], ['balanced', 'Balanced'], ['perimeter', 'Perimeter']])}</div><div><div class="eyebrow">Rotation</div>${seg('rot', [['tight', 'Tight'], ['normal', 'Normal'], ['deep', 'Deep']])}</div></div>
    <div class="cta-bar"><button class="btn" data-act="sim-rest">Sim to final</button><button class="btn big primary" data-act="resume-q" id="resume-q">${s.q >= 4 ? 'Start overtime' : `Start the ${['', '2nd', '3rd', '4th'][s.q]} quarter`} →</button></div></div>`;
  refreshControls(); const b = $('#resume-q'); if (b) b.focus({ preventScroll: true });
}
function simRest() {
  const s = UI.sim; const P = UI.play; clearTimeout(P.timer); if (s.q === 2 && !s.halfTalk) s.talkMsg = applyHalftime(s, 'calm');
  while (!s.done) { P.clock = 0; P.curQ = s.q; const evs = simQuarter(s); evs.forEach(e => showEvent(e, false)); }
  const ol = $('#pbp'); if (ol) ol.innerHTML = P.lines.slice(0, 60).map(pbpLine).join('');
  updateMomentum(); onBreak({});
}

/* ---------- ENDING ---------- */
function renderEnding() {
  const e = G.ending; const E0 = ENDINGS[e.kind]; const L = e.legacy; const rec = allRecord(); const [c1, c2] = schoolColors();
  const top = G.roster.slice().sort((a, b) => b.s.pts - a.s.pts)[0]; const imp = G.roster.slice().sort((a, b) => (ovr(b) - b.start) - (ovr(a) - a.start))[0];
  const title = e.kind === 'missed' ? `${E0.title}: ${e.sub}` : E0.title; const text = e.why || E0.text;
  const P = G.playoffs; const won = i => P && (P.round > i || (P.round === i && G.lastGame && G.lastGame.win));
  return `<header class="rafters"><div class="beam"></div><div class="banners" style="padding-top:0">${ROUNDS.map((r, i) => pennant(['Sect. Semi', 'Sect. Final', 'State Semi', 'State Title'][i], won(i), c1, c2, ['I', 'II', 'III', 'IV'][i])).join('')}</div>
    <div class="title-hero" style="padding-bottom:20px"><div class="logo-line">${E(myFull())} · Season complete</div><h1>${E(title)}</h1><p>${E(text)}</p></div></header>
  <main class="wrap stack" id="main" style="padding-block:20px 48px;gap:16px">
    <div class="grid2">
      <section class="card" style="text-align:center"><div class="eyebrow">Legacy grade</div><div class="grade">${L.grade}</div><div class="num" style="font-size:1.2rem">${L.total} / ${L.max} legacy points</div>
        <div class="row" style="justify-content:center;margin-top:8px"><span class="chip">Record ${rec.w}–${rec.l}</span><span class="chip">${DIFF[G.diff].name}</span><span class="chip">Seed “${E(G.seed)}”</span></div></section>
      <section class="card"><div class="eyebrow" style="margin-bottom:8px">How the grade was earned</div>
        <div class="attrs">${L.parts.map(p => `<span class="an">${p.k}</span><span class="ab" role="img" aria-label="${p.k} ${p.v} of ${p.max}"><i style="width:${p.v / p.max * 100}%"></i></span><span class="av">${p.v}/${p.max}</span>`).join('')}</div></section>
    </div>
    <section class="card"><div class="panel-title"><h2>Season in two charts</h2></div><div class="grid2">${sparkChart('Team rating (OVR)', G.hist.map(h => h.rating), G.hist, false)}${sparkChart('Team morale (0–100)', G.hist.map(h => h.morale), G.hist, true)}</div>
      <p class="muted" style="font-size:.88rem;margin-top:6px">Each point is one week. W and L labels show that week’s result.</p></section>
    <div class="grid2">
      <section class="card"><div class="eyebrow">Season leaders</div><ul class="list-plain" style="margin-top:8px">
        ${top ? `<li>${jersey(top)}<span><b>${pname(top)}</b>: leading scorer, ${(top.s.pts / Math.max(1, top.s.gp)).toFixed(1)} PPG</span></li>` : ''}
        ${imp ? `<li>${jersey(imp)}<span><b>${pname(imp)}</b>: most improved, OVR ${imp.start} → ${ovr(imp)}</span></li>` : ''}
        <li>${icon('ball')}<span>Team OVR grew from ${G.hist.length ? G.hist[0].rating : myRating()} to ${myRating()}</span></li></ul></section>
      <section class="card"><div class="eyebrow">Coach’s notebook</div><ol class="list-plain" style="margin-top:8px;font-size:.92rem">${G.log.slice(-7).map(l => `<li>• ${E(l.t)}</li>`).join('')}</ol></section>
    </div>
    <section><div class="panel-title"><h2>Achievements</h2><span class="muted">${e.ach.filter(a => a.got).length} of ${e.ach.length} unlocked</span></div>
      <div class="ach">${e.ach.map(a => `<div class="a ${a.got ? 'got' : 'no'}">${icon(a.got ? 'trophy' : 'lock')}<div><b>${a.n}</b><div class="muted" style="font-size:.88rem">${a.d}</div><span class="sr-only">${a.got ? 'Unlocked' : 'Locked'}</span></div></div>`).join('')}</div></section>
    <div class="cta-bar"><button class="btn" data-act="to-title">Main menu</button><button class="btn" data-act="new">New school</button><button class="btn big primary" data-act="again">Play again with ${E(G.school.name)} →</button></div>
  </main>`;
}
function sparkChart(title, vals, hist, fixed) {
  if (vals.length < 2) return `<div><h3 class="eyebrow">${title}</h3><p class="muted">Not enough weeks to chart.</p></div>`;
  const W = 460, H = 180, pl = 34, pr = 12, pt = 14, pb = 30; const lo = fixed ? 0 : Math.floor(Math.min(...vals) - 2), hi = fixed ? 100 : Math.ceil(Math.max(...vals) + 2);
  const x = i => pl + i * (W - pl - pr) / (vals.length - 1), y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const ticks = fixed ? [0, 50, 100] : [lo, Math.round((lo + hi) / 2), hi];
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = d + ` L${x(vals.length - 1).toFixed(1)} ${y(lo)} L${x(0)} ${y(lo)} Z`;
  return `<figure style="margin:0"><figcaption class="eyebrow">${title}</figcaption><svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}: from ${vals[0]} to ${vals[vals.length - 1]}">
    ${ticks.map(t => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="var(--border)" stroke-width="1"/><text x="${pl - 6}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--ink-2)" font-family="var(--f-data)">${t}</text>`).join('')}
    <path d="${area}" fill="var(--team)" opacity=".12"/><path d="${d}" fill="none" stroke="var(--team)" stroke-width="2" stroke-linejoin="round"/>
    ${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="${i === vals.length - 1 ? 5 : 3.5}" fill="var(--team)" stroke="var(--surface)" stroke-width="2"><title>${hist[i].w}: ${v}${hist[i].win != null ? (hist[i].win ? ' (W)' : ' (L)') : ''}</title></circle>`).join('')}
    ${hist.map((h, i) => (vals.length <= 8 || i % 2 === 0 || i === hist.length - 1) ? `<text x="${x(i)}" y="${H - 14}" text-anchor="middle" font-size="10" fill="var(--ink-2)" font-family="var(--f-data)">${h.w}</text><text x="${x(i)}" y="${H - 2}" text-anchor="middle" font-size="10" font-weight="700" fill="${h.win ? 'var(--good)' : 'var(--bad)'}" font-family="var(--f-data)">${h.win ? 'W' : 'L'}</text>` : '').join('')}
    <text x="${x(vals.length - 1)}" y="${y(vals[vals.length - 1]) - 9}" text-anchor="end" font-size="12" font-weight="700" fill="var(--ink)" font-family="var(--f-data)">${vals[vals.length - 1]}</text>
  </svg></figure>`;
}

/* ---------- MODALS ---------- */
function openModal(m) { UI.prevFocus = document.activeElement; UI.modal = m; renderModal(); const f = $('.modal [data-autofocus]') || $('.modal .modal-h button') ; if (f) f.focus(); if (UI.play && !UI.play.paused && UI.screen === 'game') { UI.play.paused = true; UI.play.autoPaused = true; clearTimeout(UI.play.timer); } }
function closeModal() { UI.modal = null; renderModal(); if (UI.prevFocus && document.body.contains(UI.prevFocus)) UI.prevFocus.focus(); if (UI.play && UI.play.autoPaused) { UI.play.autoPaused = false; UI.play.paused = false; refreshControls(); tick(); } }
function renderModal() {
  const host = $('#modal-host'); if (!UI.modal) { host.innerHTML = ''; return; }
  const m = UI.modal; const body = { help: helpBody, settings: settingsBody, credits: creditsBody, player: playerBody, confirm: confirmBody }[m.type](m);
  const title = { help: 'Rulebook', settings: 'Settings', credits: 'Credits & tools', player: 'Player card', confirm: m.title }[m.type];
  host.innerHTML = `<div class="modal-bg" data-act="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-h"><h2 id="modal-title">${E(title)}</h2><button class="btn ghost sm" data-act="close" aria-label="Close dialog">✕ <span class="kbd">Esc</span></button></div><div class="modal-b">${body}</div></div></div>`;
}
function helpBody() {
  const secs = [
    ['goal', 'Goal', `<p>You are the new head coach. Win the <b>State Championship</b> in one season. Your team starts <b>weaker</b> than the best teams in the state, so you win by making smart decisions: developing players, managing money and morale, scouting, and choosing the right strategy.</p>`],
    ['season', 'Season', `<ul><li><b>Preseason:</b> tryouts. Scout prospects and sign up to 4 (roster of 10–12).</li><li><b>Regular season:</b> 10 weeks, one game each. 7 district games and 3 non-district games.</li><li><b>Playoffs:</b> the top 4 in the district standings qualify. Four single-elimination rounds: Sectional Semifinal, Sectional Final, State Semifinal, State Championship.</li></ul>`],
    ['week', 'Each week', `<ol><li><b>Practice:</b> plan 4 days (3 in the playoffs) on the whiteboard.</li><li><b>Challenge:</b> one off-court situation. Pick a response.</li><li><b>Game day:</b> set your starting five and game plan, then coach the game live. Adjust at every quarter break.</li><li><b>Recap:</b> see what changed, then move on.</li></ol>`],
    ['res', 'Resources', `<ul><li><b>Budget:</b> earned from home games (more with more fans), fundraisers and deals. Spent on upgrades and challenge choices. Road games cost $150, operations $100/week. Below −$1,000 ends your season.</li><li><b>Morale</b> (0–100): each player’s happiness. Raises shooting. Wins, bonding and playing time help. Under 30, players may quit.</li><li><b>Chemistry</b> (0–100): better passing, fewer turnovers.</li><li><b>Fans</b> (0–100): more ticket money and a bigger home-court edge.</li><li><b>Reputation</b> (0–100): community trust. Unethical choices hurt it. At 0 the program is suspended.</li><li><b>Energy</b> (per player): drops with hard practice and minutes played. Tired players shoot worse, learn less and get hurt more.</li></ul>`],
    ['practice', 'Practice drills', `<ul>${Object.values(DRILLS).map(d => `<li><b>${d.name}:</b> ${d.d}</li>`).join('')}</ul><p>Repeating a drill in the same week gives less each time (100%, 80%, 60%...). Players grow faster when they have more <b>potential</b> (★), a strong work ethic, or the Hard Worker trait.</p>`],
    ['strategy', 'Strategy & counters', `<ul><li><b>Zone</b> beats inside-heavy teams but gives up threes and offensive rebounds.</li><li><b>Press</b> forces turnovers against weak passers but drains your energy and allows layups.</li><li><b>Man-to-man</b> is best when your defenders are good.</li><li><b>Perimeter focus</b> beats a zone. <b>Inside focus</b> beats man and press.</li><li><b>Tempo:</b> slow games have fewer possessions, which means more luck. That helps the underdog. Fast games help the better team.</li><li><b>Rotation:</b> tight keeps starters in longer; deep keeps legs fresh.</li><li><b>Scouting:</b> Film Study or the Scouting Service reveals the opponent’s plan and marks counters with ✓. Each matched counter improves your shooting and hurts theirs.</li><li><b>Halftime talk:</b> fire them up (needs chemistry), calm (energy), or adjust to their top scorer.</li><li>Opponents adapt too: they may press when behind or slow down when ahead.</li></ul>`],
    ['rules', 'Eligibility & injuries', `<ul><li>A player needs a <b>2.00 GPA</b> to play. Grades drift down each week; Study Hall and tutoring raise them.</li><li>Injuries happen in practice (Scrimmage is riskiest) and games (tired players are at higher risk). Injured players sit out for the listed weeks.</li><li>Traits: ${Object.entries(TRAITS).map(([k, v]) => `<b>${k}</b> (${v.d.replace(/\.$/, '')})`).join('; ')}.</li></ul>`],
    ['outcomes', 'Endings', `<p>Your season can end six ways: <b>State Champions</b> (or a <b>Perfect Season</b> if you never lose), <b>State Runner-Up</b>, <b>Final Four</b>, <b>Playoff Contender</b>, <b>Missed the Playoffs</b> (either “Foundation Laid” or “Back to the Drawing Board”), or <b>Program in Crisis</b> (reputation hits 0, the budget falls below −$1,000, or too many players quit). Every ending gives a <b>Legacy grade</b> and up to 8 achievements.</p>`],
    ['controls', 'Controls', `<ul><li>Mouse, touch or keyboard. <span class="kbd">Tab</span> moves, <span class="kbd">Enter</span>/<span class="kbd">Space</span> selects.</li><li><span class="kbd">?</span> or <span class="kbd">H</span> opens this rulebook. <span class="kbd">Esc</span> closes dialogs.</li><li>Challenges: press <span class="kbd">1</span> <span class="kbd">2</span> <span class="kbd">3</span>.</li><li>During games: <span class="kbd">Space</span> pause, <span class="kbd">S</span> skip to the quarter break.</li><li>Your season saves automatically after every step.</li></ul>`],
  ];
  const cur = UI.ruleSec;
  return `<nav class="rules-nav" aria-label="Rule sections">${secs.map(([k, l]) => `<button class="btn sm ${k === cur ? 'primary' : ''}" data-act="rule" data-k="${k}" aria-pressed="${k === cur}">${l}</button>`).join('')}</nav>
    <div class="rules">${secs.filter(s => s[0] === cur).map(([k, l, h]) => `<h3>${l}</h3>${h}`).join('')}</div>`;
}
function settingsBody() {
  const opt = (name, val, cur, label) => `<label><input type="radio" name="${name}" value="${val}" data-act="set" data-k="${name}" ${String(cur) === String(val) ? 'checked' : ''}><span>${label}</span></label>`;
  return `<div class="settings-row"><div><b>Theme</b><div class="d">High contrast uses pure black and white with yellow focus rings.</div></div><div class="seg" role="radiogroup" aria-label="Theme">${opt('theme', 'auto', SET.theme, 'Auto')}${opt('theme', 'light', SET.theme, 'Light')}${opt('theme', 'dark', SET.theme, 'Dark')}${opt('theme', 'contrast', SET.theme, 'High contrast')}</div></div>
  <div class="settings-row"><div><b>Text size</b></div><div class="seg" role="radiogroup" aria-label="Text size">${opt('text', 1, SET.text, '100%')}${opt('text', 1.15, SET.text, '115%')}${opt('text', 1.3, SET.text, '130%')}</div></div>
  <div class="settings-row"><div><b>Motion</b><div class="d">Reduced turns off ball flights and animations. Auto follows your device.</div></div><div class="seg" role="radiogroup" aria-label="Motion">${opt('motion', 'auto', SET.motion, 'Auto')}${opt('motion', 'reduce', SET.motion, 'Reduced')}${opt('motion', 'full', SET.motion, 'Full')}</div></div>
  <div class="settings-row"><div><b>Color-blind friendly</b><div class="d">Swaps green/red for blue/orange. Shapes and labels always carry meaning too.</div></div><div class="seg" role="radiogroup" aria-label="Color-blind mode">${opt('cb', 'false', SET.cb, 'Off')}${opt('cb', 'true', SET.cb, 'On')}</div></div>
  <div class="settings-row"><div><b>Sound</b><div class="d">All sounds are generated live by the game.</div></div><div class="row"><div class="seg" role="radiogroup" aria-label="Sound">${opt('sound', 'true', SET.sound, 'On')}${opt('sound', 'false', SET.sound, 'Off')}</div><label for="vol" class="sr-only">Volume</label><input type="range" id="vol" min="0" max="1" step=".1" value="${SET.vol}" data-act="vol"></div></div>
  <div class="settings-row"><div><b>Default game speed</b></div><div class="seg" role="radiogroup" aria-label="Game speed">${opt('speed', 1, SET.speed, '1×')}${opt('speed', 2, SET.speed, '2×')}${opt('speed', 4, SET.speed, '4×')}</div></div>
  <div class="settings-row"><div><b>Exact numbers on choices</b><div class="d">Show exact amounts (like “−$400”) instead of ▲/▼ arrows. On by default in Rookie.</div></div><div class="seg" role="radiogroup" aria-label="Exact numbers">${opt('exact', 'null', SET.exact, 'By difficulty')}${opt('exact', 'true', SET.exact, 'Always')}${opt('exact', 'false', SET.exact, 'Arrows')}</div></div>
  <div class="settings-row"><div><b>Coach tips</b><div class="d">Short hints the first time you reach each step.</div></div><div class="seg" role="radiogroup" aria-label="Coach tips">${opt('tips', 'true', SET.tips, 'On')}${opt('tips', 'false', SET.tips, 'Off')}</div></div>
  ${G && G.phase !== 'ended' ? `<div class="settings-row"><div><b>Reset tips</b><div class="d">Show all coach tips again.</div></div><button class="btn sm" data-act="reset-tips">Show tips again</button></div>` : ''}`;
}
function creditsBody() {
  return `<div class="rules"><p><b>Road to the Championship</b> is a coaching and management simulation built for the FBLA 2026–27 Computer Game &amp; Simulation Programming topic, “Road to the Championship.”</p>
  <h3>Tools & technology</h3><ul>
    <li><b>Languages:</b> HTML5, CSS3 and JavaScript (ES2020). No game engine or framework. The whole game is one file that runs offline in any modern browser.</li>
    <li><b>Graphics:</b> Canvas 2D API for the court, drawn to real NFHS dimensions (84 × 50 ft court, 19′9″ three-point arc, 12 ft lane). SVG for crests, banners, icons and the 7-segment scoreboard. All art is generated by code.</li>
    <li><b>Audio:</b> Web Audio API. The swish, rim, whistle, buzzer and crowd are synthesized from oscillators and filtered noise, so there are no audio files.</li>
    <li><b>Simulation:</b> possession-by-possession basketball engine (shot selection, turnovers, rebounds, fouls, fatigue, substitutions), an adaptive opponent AI and a seeded Mulberry32 random generator so any season can be replayed.</li>
    <li><b>Accessibility:</b> WCAG contrast math chooses readable text on any team color; keyboard play; screen-reader announcements; reduced motion; high-contrast and color-blind modes.</li>
    <li><b>Testing:</b> automated Playwright browser tests play full seasons and check every screen. A balance harness simulates hundreds of seasons to tune difficulty.</li></ul>
  <h3>Fonts</h3><p>Graduate, Atkinson Hyperlegible, Barlow Condensed and Permanent Marker from Google Fonts, used under the SIL Open Font License. When offline, the game falls back to system fonts.</p>
  <h3>Content</h3><p>All schools, players, sponsors and events are fictional. No copyrighted images, logos or sounds are used.</p></div>`;
}
function playerBody(m) {
  const p = G.roster.find(x => x.id === m.id) || (G.prospects || []).find(x => x.id === m.id); if (!p) return '<p>Player not found.</p>'; const o = ovr(p);
  return `<div class="row">${jersey(p)}<div><div style="font-family:var(--f-display);font-size:1.4rem">${pname(p)}</div><div class="muted">${POS_NAME[p.pos]} · ${YEAR[p.year]} · <span title="${E(TRAITS[p.trait].d)}">${E(p.trait)}</span></div></div><span class="spacer"></span><div class="ovr" style="font-size:2rem">${o}<small>OVR${p.start && o > p.start ? ` (+${o - p.start})` : ''}</small></div></div>
  <p class="muted">${E(p.trait)}: ${E(TRAITS[p.trait].d)}</p>
  ${attrBars(p, true)}<p class="muted" style="font-size:.85rem">Dotted bar = room to grow toward potential ${p.pot}.</p>
  <div class="row"><span class="chip">Energy ${Math.round(p.energy)}</span><span class="chip">Morale ${Math.round(p.morale)}</span><span class="chip ${p.gpa < 2 ? 'bad' : ''}">GPA ${p.gpa.toFixed(2)}</span><span class="chip">Potential ${stars(p.pot, o)}</span>${statusChips(p)}</div>
  ${p.s && p.s.gp ? `<div class="table-wrap"><table class="data"><thead><tr><th class="n" scope="col">GP</th><th class="n" scope="col">PPG</th><th class="n" scope="col">RPG</th><th class="n" scope="col">APG</th><th class="n" scope="col">MPG</th></tr></thead><tbody><tr><td class="n">${p.s.gp}</td><td class="n">${(p.s.pts / p.s.gp).toFixed(1)}</td><td class="n">${(p.s.reb / p.s.gp).toFixed(1)}</td><td class="n">${(p.s.ast / p.s.gp).toFixed(1)}</td><td class="n">${(p.s.min / p.s.gp).toFixed(1)}</td></tr></tbody></table></div>` : '<p class="muted">No games played yet.</p>'}`;
}
function confirmBody(m) { return `<p>${E(m.body)}</p><div class="cta-bar"><button class="btn" data-act="close" data-autofocus>${E(m.no || 'Cancel')}</button><button class="btn primary" data-act="confirm-yes">${E(m.yes)}</button></div>`; }

/* ---------- ACTIONS ---------- */
function seenTip(k) { if (G) { G.tipsSeen = G.tipsSeen || {}; G.tipsSeen[k] = true; } }
function startNew(opts) { newGame(opts); UI.tab = 'week'; UI.banner = null; UI.slot = null; save(); go('tryouts'); }
const ACT = {
  quick() { SFX.init(); SFX.click(); newGame({ name: 'Riverside', mascot: 'hawks', pal: 'crimson', diff: 'varsity' }); autoSignBest(); finalizeTryouts(); UI.tab = 'week'; UI.banner = null; save(); go('hub'); toast('Quick Start: Riverside Hawks, Varsity. Best 4 prospects signed.'); },
  new() { SFX.init(); const go2 = () => { UI.setup = { name: 'Riverside', mascot: 'hawks', pal: 'crimson', diff: 'varsity', seed: '' }; go('setup'); };
    if (loadSave() && loadSave().phase !== 'ended' && UI.screen === 'title') openModal({ type: 'confirm', title: 'Start a new season?', body: 'Your current season will be replaced.', yes: 'Start new season', onYes: go2 }); else go2(); },
  continue() { SFX.init(); const s = loadSave(); if (!s) return; G = s; UI.tab = 'week'; UI.banner = null; go(G.phase === 'tryouts' ? 'tryouts' : G.phase === 'ended' ? 'ending' : 'hub'); },
  'to-title'() { go('title'); },
  menu() { openModal({ type: 'confirm', title: 'Leave to the main menu?', body: UI.screen === 'game' ? 'This game will restart from game prep when you continue. Everything else is saved.' : 'Your season is saved. Continue anytime from the main menu.', yes: 'Go to main menu', onYes: () => { if (UI.play) { clearTimeout(UI.play.timer); UI.play = null; } save(); go('title'); } }); },
  help() { UI.ruleSec = UI.ruleSec || 'goal'; openModal({ type: 'help' }); },
  settings() { openModal({ type: 'settings' }); },
  credits() { openModal({ type: 'credits' }); },
  close() { closeModal(); },
  'modal-bg'(d, el, ev) { if (ev.target === el) closeModal(); },
  'confirm-yes'() { const f = UI.modal.onYes; UI.modal = null; renderModal(); f(); },
  rule(d) { UI.ruleSec = d.k; renderModal(); const b = $(`.rules-nav [data-k="${d.k}"]`); if (b) b.focus(); },
  sound() { SET.sound = !SET.sound; saveSettings(); applySettings(); SFX.init(); if (SET.sound) SFX.click(); const b = $('[data-act="sound"]'); if (b) { b.setAttribute('aria-pressed', SET.sound); b.setAttribute('aria-label', SET.sound ? 'Mute sound' : 'Turn sound on'); b.innerHTML = icon(SET.sound ? 'sound' : 'mute'); } },
  'tip-x'(d) { seenTip(d.k); save(); const t = $('.coach-tip'); if (t) t.remove(); },
  'reset-tips'() { if (G) G.tipsSeen = {}; SET.tips = true; saveSettings(); save(); renderModal(); toast('Coach tips will show again.'); },
  'setup-go'(d, el, ev) { ev && ev.preventDefault(); const s = UI.setup; s.name = ($('#f-name').value || '').trim().replace(/\s+/g, ' ') || 'Riverside'; s.seed = $('#f-seed').value; SFX.click(); startNew(s); },
  scout(d) { if (scoutProspect(d.id)) { SFX.click(); save(); render(`[data-act="sign"][data-id="${d.id}"]`); announce('Scouted. True ratings revealed.'); } },
  sign(d) { const i = G.signed.indexOf(d.id); if (i >= 0) G.signed.splice(i, 1); else if (G.signed.length < 4) G.signed.push(d.id); SFX.click(); save(); render(`[data-act="sign"][data-id="${d.id}"]`); },
  'auto-sign'() { autoSignBest(); save(); render('[data-act="finalize"]'); toast('Signed the 4 best-looking prospects.'); },
  finalize(d, el) { if (el.getAttribute('aria-disabled') === 'true') { toast($('#try-why').textContent); return; } finalizeTryouts(); UI.tab = 'week'; save(); SFX.good(); go('hub'); },
  tab(d) { UI.tab = d.tab; render(`#tab-${d.tab}`); },
  player(d) { openModal({ type: 'player', id: d.id }); },
  slot(d) { UI.slot = +d.i; render(`[data-act="slot"][data-i="${d.i}"]`); },
  drill(d) { const n = practiceSlots(); let i = UI.slot != null ? UI.slot : G.plan.findIndex(x => !x); if (i < 0) i = n - 1; G.plan[i] = d.k; SFX.click(); const nx = G.plan.findIndex(x => !x); UI.slot = nx >= 0 ? nx : null; save(); render(nx >= 0 ? `[data-act="drill"][data-k="${d.k}"]` : '[data-act="run-practice"]'); announce(`${DRILLS[d.k].name} set for ${['Monday', 'Tuesday', 'Wednesday', 'Thursday'][i]}.`); },
  preset(d) { G.plan = PRESETS[d.k].plan.slice(0, practiceSlots()); UI.slot = null; SFX.click(); save(); render('[data-act="run-practice"]'); },
  'clear-plan'() { G.plan = new Array(practiceSlots()).fill(null); UI.slot = 0; save(); render('[data-act="slot"][data-i="0"]'); },
  'run-practice'(d, el) { if (el.getAttribute('aria-disabled') === 'true') { toast($('#prac-why').textContent); return; } runPractice(); UI.slot = null; seenTip('practice'); SFX.whistle(); save(); render('.tabpanel h2'); },
  'to-event'() { G.step = 'event'; drawEvent(); save(); render('#ev-title'); },
  choose(d) { if (G.eventDone) return; resolveEvent(+d.i); seenTip('event'); SFX.click(); save(); render('.outcome'); announce(G.eventDone.text); },
  'to-prep'() { G.step = 'prep'; validateLineup(); save(); render('.scout h2'); },
  'auto-lineup'() { autoLineup(); save(); render('[data-act="auto-lineup"]'); },
  lineup(d, el) { const i = +d.i; const id = el.value; const j = G.lineup.indexOf(id); if (j >= 0 && j !== i) G.lineup[j] = G.lineup[i]; G.lineup[i] = id; save(); render(`#ln-${i}`); },
  strat(d, el) { G.strategy[d.k] = el.value; save(); render(`input[name="st-${d.k}"][value="${el.value}"]`); },
  tipoff() { seenTip('prep'); save(); startGame(); },
  pause() { const P = UI.play; P.paused = !P.paused; refreshControls(); $('[data-act="pause"]') && $('[data-act="pause"]').focus(); if (!P.paused) tick(); else clearTimeout(P.timer); },
  speed(d, el) { SET.speed = +el.value; saveSettings(); },
  skipq() { skipQuarter(); },
  qstrat(d, el) { UI.sim.strat[d.k] = el.value; G.strategy[d.k] = el.value; },
  talk(d) { const s = UI.sim; s.talkMsg = applyHalftime(s, d.t); SFX.click(); onBreak({}); announce(s.talkMsg); },
  'resume-q'() { const s = UI.sim; if (s.q === 2 && !s.halfTalk) s.talkMsg = applyHalftime(s, 'calm'); SFX.whistle(); nextQuarter(); },
  'sim-rest'() { simRest(); },
  'to-recap'() { const res = finishGame(UI.sim); UI.sim = null; clearTimeout(UI.play.timer); UI.play = null; G.step = 'recap'; seenTip('game'); save(); UI.tab = 'week'; go('hub', { focus: '.result-banner' }); if (res.win && G.phase === 'playoffs' && G.playoffs.round === 3) SFX.fanfare(); },
  'end-week'() {
    const r = endWeek(); UI.banner = null; save();
    if (r === 'ended') { if (G.ending.kind === 'champion' || G.ending.kind === 'perfect') SFX.fanfare(); go('ending'); return; }
    if (r === 'playoffs') { UI.banner = `<div class="card" style="margin-top:12px;border-color:var(--team);border-width:2px" role="status"><div class="panel-title" style="margin:0"><h2>You’re in! #${G.playoffs.seed} seed</h2></div><p>You finished ${recordStr()}. Four wins from the State title. Playoff weeks have only 3 practice days.</p></div>`; SFX.good(); }
    UI.tab = 'week'; go('hub');
  },
  buy(d, el) { const u = UPGRADES[d.k]; if (el.getAttribute('aria-disabled') === 'true' || G.res.budget < u.cost) { toast(`Not enough money. You need ${U.money(u.cost - G.res.budget)} more.`); return; } G.res.budget -= u.cost; G.upgrades[d.k] = true; G.log.push({ w: G.phase === 'playoffs' ? 'P' : G.week, t: `Bought ${u.name} (${U.money(u.cost)}).` }); SFX.good(); save(); render('#tab-office'); toast(`${u.name} added. ${u.d}`); },
  again() { const s = G.school; newGame({ name: s.name, mascot: s.mascot, pal: s.pal, diff: G.diff }); save(); go('tryouts'); },
  set(d, el) { let v = el.value; if (v === 'true') v = true; else if (v === 'false') v = false; else if (v === 'null') v = null; else if (!isNaN(+v) && d.k !== 'theme' && d.k !== 'motion') v = +v; SET[d.k] = v; saveSettings(); applySettings(); if (d.k === 'motion' && Court.cv) Court.reduced = reduced(); if (UI.screen !== 'game') render(); else renderModal(); const back = $(`.modal input[name="${d.k}"][value="${el.value}"]`); if (back) back.focus(); },
  vol(d, el) { SET.vol = +el.value; saveSettings(); SFX.setVol(SET.vol); SFX.init(); SFX.click(); },
};

/* ---------- Wiring ---------- */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act;
  if (el.tagName === 'INPUT' || el.tagName === 'SELECT') return; // handled on change
  if (a === 'modal-bg') { if (ev.target === el) closeModal(); return; }
  if (ACT[a]) { if (a === 'setup-go') ev.preventDefault(); ACT[a](el.dataset, el, ev); }
});
document.addEventListener('change', ev => {
  const el = ev.target; if (UI.screen === 'setup' && el.name && ['mascot', 'pal', 'diff'].includes(el.name)) { UI.setup[el.name] = el.value; updateSetupPreview(); return; }
  const a = el.dataset && el.dataset.act; if (a && ACT[a]) ACT[a](el.dataset, el, ev);
});
document.addEventListener('input', ev => { if (ev.target.id === 'f-name') { UI.setup.name = ev.target.value.slice(0, 16); updateSetupPreview(); } if (ev.target.id === 'f-seed') UI.setup.seed = ev.target.value; });
document.addEventListener('submit', ev => { ev.preventDefault(); if (ev.target.id === 'setup-form') ACT['setup-go']({}, null, ev); });
document.addEventListener('keydown', ev => {
  const tag = (ev.target.tagName || '').toLowerCase(); const typing = tag === 'input' && ev.target.type === 'text';
  if (ev.key === 'Escape' && UI.modal) { ev.preventDefault(); closeModal(); return; }
  if (UI.modal && ev.key === 'Tab') { const f = $$('.modal button, .modal input, .modal select, .modal [tabindex]:not([tabindex="-1"])').filter(x => !x.disabled); if (f.length) { const first = f[0], last = f[f.length - 1]; if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); } } return; }
  if (typing || UI.modal) return;
  if (ev.key === '?' || ev.key === 'h' || ev.key === 'H') { ev.preventDefault(); ACT.help(); return; }
  if (UI.screen === 'hub' && G && G.step === 'event' && !G.eventDone && /^[1-3]$/.test(ev.key)) { const b = $(`[data-act="choose"][data-i="${+ev.key - 1}"]`); if (b) { ev.preventDefault(); b.click(); } return; }
  if (UI.screen === 'game' && UI.play) {
    const tb = $('[data-act="talk"]'); if (tb && /^[1-3]$/.test(ev.key)) { const b = $$('[data-act="talk"]')[+ev.key - 1]; if (b) { ev.preventDefault(); b.click(); } return; }
    if (ev.key === ' ' && !UI.play.breakHtml && !UI.play.final && tag !== 'button' && tag !== 'input') { ev.preventDefault(); ACT.pause(); }
    if ((ev.key === 's' || ev.key === 'S') && !UI.play.breakHtml && !UI.play.final) { ev.preventDefault(); ACT.skipq(); }
  }
  if (ev.target.getAttribute && ev.target.getAttribute('role') === 'tab' && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) { const tabs = $$('[role="tab"]'); const i = tabs.indexOf(ev.target); const n = tabs[(i + (ev.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]; n.click(); }
});
if (window.matchMedia) { try { matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => { if (Court.cv) Court.reduced = reduced(); }); } catch (e) {} }
window.addEventListener('resize', () => { if (UI.screen === 'title') { const cv = $('#floor'); if (cv) drawTitleFloor(cv, G ? schoolColors()[0] : '#A6192E'); } });

/* ---------- Test / balance hooks (used by the automated test suite) ---------- */
window.RTC = {
  get G() { return G; }, UI, SET,
  newGame, finalizeTryouts, autoSignBest, runPractice, drawEvent, resolveEvent, newGameSim, simQuarter, applyHalftime, finishGame, endWeek, recommend, isScouted, currentGameInfo, myRating, oppRating, standings, PRESETS, EVENTS, DRILLS, UPGRADES,
  // Plays a whole season headlessly with a simple policy. Returns the ending kind.
  autoSeason(opts = {}) {
    newGame({ name: 'Test', diff: opts.diff || 'varsity', seed: opts.seed || String(Math.random()) });
    autoSignBest(); finalizeTryouts(); let guard = 0;
    while (G.phase !== 'ended' && guard++ < 40) {
      const pol = opts.policy || 'smart';
      if (pol === 'smart') {
        if (G.upgrades.assistant !== true && G.res.budget >= 1300) { G.res.budget -= 1200; G.upgrades.assistant = true; }
        else if (!G.upgrades.scouting && G.res.budget >= 600) { G.res.budget -= 500; G.upgrades.scouting = true; }
        const e = U.avg(G.roster.map(p => p.energy)); const lowGpa = G.roster.some(p => p.gpa < 2.15);
        G.plan = (e < 55 ? ['shooting', 'rest', lowGpa ? 'study' : 'bonding', 'film'] : ['shooting', 'defense', lowGpa ? 'study' : 'scrimmage', 'film']).slice(0, practiceSlots());
      } else G.plan = ['scrimmage', 'scrimmage', 'conditioning', 'shooting'].slice(0, practiceSlots());
      runPractice(); G.step = 'event'; drawEvent(); const ev = EVENTS.find(x => x.id === G.event.id); resolveEvent(pol === 'smart' ? 0 : ri(0, ev.choices.length - 1)); G.step = 'prep';
      autoLineup();
      if (pol === 'smart') { const { rec } = recommend(currentOpp()); G.strategy = Object.assign({ rot: 'normal' }, rec); } else G.strategy = { tempo: 'balanced', def: 'man', focus: 'balanced', rot: 'normal' };
      const sim = newGameSim(); while (!sim.done) { if (sim.q === 2 && !sim.halfTalk) applyHalftime(sim, 'calm'); simQuarter(sim); }
      finishGame(sim); G.step = 'recap'; endWeek();
    }
    return { kind: G.ending.kind, rec: allRecord(), grade: G.ending.legacy.grade, rating: myRating() };
  },
};

/* ---------- Boot ---------- */
function boot() {
  applySettings();
  const s = loadSave(); if (s) G = s;
  if (G) applyTeamColors();
  document.addEventListener('pointerdown', () => SFX.init(), { once: true });
  render();
}
boot();
