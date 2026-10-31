/* Lake Washington gym video board, modelled on the real LED board in the Kangs gym.
   Pure Canvas 2D drawing (no Three.js) plus a helper that maps real simulation state to board fields.
   Nothing on the board is invented: fields the sim does not track are shown dark or as a dash. */

const FONT = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
const C = {
  bg0: '#040820', bg1: '#0a1645', navy: '#071034', frame0: '#3a6ee6', frame1: '#173a9c',
  panel0: '#2552c9', panel1: '#102a78', ink: '#ffffff', stroke: 'rgba(255,255,255,.92)',
  gold: '#e9b858', dim: 'rgba(120,150,230,.22)', purple: '#6832ab', purpleDark: '#43206f'
};

const GENERIC = new Set(['HERITAGE', 'ISLAND', 'CHRISTIAN', 'ACADEMY', 'PREP', 'PREPARATORY', 'VALLEY', 'HIGH', 'SCHOOL', 'HS']);
const COMPASS = new Set(['NORTH', 'SOUTH', 'EAST', 'WEST', 'MOUNT', 'MT', 'MT.']);

/** Board-friendly team name: "Liberty (Renton)" -> "LIBERTY", "Tulalip Heritage" -> "TULALIP", "North Creek" -> "N. CREEK". */
export function boardName(name) {
  let n = String(name || 'GUEST').replace(/\s*\([^)]*\)/g, '').replace(/\b(high school|hs)\b/gi, '').trim().toUpperCase() || 'GUEST';
  const words = n.split(/\s+/);
  if (n.length > 9 && words.length > 1) {
    if (GENERIC.has(words.at(-1))) n = words.slice(0, -1).join(' ');
    else if (COMPASS.has(words[0])) n = `${words[0][0]}. ${words.slice(1).join(' ')}`;
  }
  return n.slice(0, 14);
}

/** Crest initials: one letter per word (max 2), e.g. "Mount Si" -> "MS", "Liberty" -> "L". */
export function initials(name) {
  const words = boardName(name).replace(/[^A-Z' ]/g, ' ').split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.slice(0, 2).map(w => w[0]).join('') : (words[0] || 'G')[0]);
}

const sameEvent = (a, b) => a && b && (a === b || (a.number === b.number && a.home === b.home && a.visitor === b.visitor && a.id === b.id));

/** Which game the board is about: the live match, the result a replayed event belongs to, the last final, or (before tip-off) the next opponent. */
export function boardGame(s, event = null) {
  const m = s?.match || null;
  // Which game is on the board: the live match, the result a replayed event belongs to, or the last final.
  let game = m, result = null;
  if (event && !(m?.events || []).some(e => sameEvent(e, event))) result = (s?.results || []).findLast(r => (r.events || []).some(e => sameEvent(e, event))) || null;
  // Before tip-off (no match, nothing replaying, season still running) the last final belongs to the previous game: show the next opponent at 0-0 instead.
  const pre = !!s && !m && !event && !s.finished;
  if (!m && !result && !pre) result = s?.results?.at(-1) || null;
  if (result) game = result;
  const opponent = (m ? s?.schedule?.[s.week]?.opponent : result?.opponent) ?? s?.schedule?.[s?.week]?.opponent ?? 'Guest';
  const live = !!m && game === m;
  const final = !live && !!result && !event;
  return { m, game, result, opponent, live, final, pre };
}

/**
 * Derive the board fields from the game state.
 * `home`/`away` are the scores currently being presented (they lag the sim while a possession animates);
 * `event` is the possession being animated, if any.
 */
export function scoreboardData(s, home = 0, away = 0, event = null) {
  const { m, game, opponent, live, final, pre } = boardGame(s, event);
  if (pre) { home = 0; away = 0; }

  let events = game?.events || [];
  // While a possession animates, only count it once its home basket has been shown.
  if (event) {
    const at = events.findIndex(e => sameEvent(e, event));
    if (at >= 0 && home < event.home) events = events.slice(0, at);
  }
  const lastPoss = event ? event.number : live ? m.possession : (game?.events?.at(-1)?.number ?? 0);
  const poss = Math.max(0, lastPoss || 0);

  let period = '–', clock = '8:00';
  if (live || event) {
    period = poss > 64 ? 'OT' : String(Math.max(1, Math.min(4, Math.ceil(poss / 16))));
    clock = `${Math.max(0, 8 - Math.floor((poss ? ((poss - 1) % 16) + 1 : 0) / 2))}:00`;
  } else if (final) {
    period = poss > 64 ? 'OT' : '4';
    clock = '00.0';
  }

  // Last Kangs scorer: jersey and his points this game, from the per-player box line.
  const last = [...events].reverse().find(e => (e.points || 0) > 0);
  let plyr = null;
  if (last) {
    const lineAll = game?.line || {};
    const pts = event && events !== (game?.events || []) ? events.filter(e => e.id === last.id).reduce((t, e) => t + (e.points || 0), 0) : (lineAll[last.id]?.pts ?? game?.box?.[last.id] ?? 0);
    const num = s?.players?.find(p => p.id === last.id)?.number ?? last.jersey;
    plyr = { num: String(num ?? '–'), pts: String(pts) };
  }

  // Team rebounds tracked by the engine (m.stats.{home,away}.rebounds); older saves have none.
  const st = game?.stats;
  const reb = st ? [String(st.home?.rebounds ?? 0), String(st.away?.rebounds ?? 0)] : ['–', '–'];
  // Before tip-off there are no rebounds yet: show the two teams' real records instead (the opponent's comes from the standings, a dash when it has none).
  const opp = s?.standings?.[opponent], rec = pre ? [`${s.wins ?? 0}–${s.losses ?? 0}`, opp ? `${opp.w ?? 0}–${opp.l ?? 0}` : '–'] : reb;

  return {
    home: 'KANGS', away: boardName(opponent), opponent: String(opponent), crest: initials(opponent), awayLogo: OPP_LOGOS.has(String(opponent)),
    homeScore: String(home ?? 0), awayScore: String(away ?? 0),
    period, clock, final, pre, live: live || !!event,
    tolHome: live ? String(Math.max(0, Math.min(3, m.timeouts ?? 0))) : final ? '–' : '3', tolAway: '–',
    plyr, statLabel: pre ? 'RECORD' : 'TEAM REB', statHome: rec[0], statAway: rec[1]
  };
}

export const scoreboardKey = d => JSON.stringify(d);

/* ---------- drawing helpers ---------- */
function poly(ctx, pts) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
/* Parallelogram/trapezoid with slanted left (sl) and right (sr) edges; positive slant leans like "/". */
function slab(x, y, w, h, sl, sr) { return [[x + sl, y], [x + w, y], [x + w - sr, y + h], [x, y + h]]; }
function mirror(pts, W) { return pts.map(([x, y]) => [W - x, y]); }
function grad(ctx, y0, y1, a, b) { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }

function framed(ctx, pts, y0, y1, { fill0 = C.frame0, fill1 = C.frame1, inset = null, stroke = C.stroke, lw = 4 } = {}) {
  poly(ctx, pts); ctx.fillStyle = grad(ctx, y0, y1, fill0, fill1); ctx.fill();
  if (inset) { poly(ctx, inset); ctx.fillStyle = grad(ctx, y0, y1, '#0b1a52', C.navy); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.stroke(); }
  poly(ctx, pts); ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke();
}

/* Text centred on (x, y) that never exceeds maxW: shrink to 80%, then condense horizontally. */
function text(ctx, str, x, y, size, maxW, { weight = 900, color = C.ink, glow = true, align = 'center' } = {}) {
  str = String(str);
  ctx.save(); ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  let fs = size; ctx.font = `${weight} ${fs}px ${FONT}`;
  let w = ctx.measureText(str).width;
  if (w > maxW) { fs = Math.max(size * .8, fs * maxW / w); ctx.font = `${weight} ${fs}px ${FONT}`; w = ctx.measureText(str).width; }
  const sx = w > maxW ? maxW / w : 1;
  ctx.translate(x, y + fs * .36); ctx.scale(sx, 1);
  if (glow) { ctx.shadowColor = color === C.gold ? 'rgba(233,184,88,.55)' : 'rgba(170,200,255,.55)'; ctx.shadowBlur = fs * .08; }
  ctx.fillStyle = color; ctx.fillText(str, 0, 0);
  ctx.restore();
}

function triangle(ctx, x, y, s, color) { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 1.2, y); ctx.lineTo(x, y + s); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); }

function shield(ctx, cx, y0, w, h) {
  ctx.beginPath(); ctx.moveTo(cx - w / 2, y0); ctx.lineTo(cx + w / 2, y0); ctx.lineTo(cx + w / 2, y0 + h * .55);
  ctx.quadraticCurveTo(cx + w / 2, y0 + h * .86, cx, y0 + h); ctx.quadraticCurveTo(cx - w / 2, y0 + h * .86, cx - w / 2, y0 + h * .55); ctx.closePath();
}

/* Kangaroo logo (transparent PNG) supplied by the arena once it loads; the LW monogram is only a fallback. */
let LOGO_IMG = null;
export function setScoreboardLogo(img) { LOGO_IMG = img; }
function logo(ctx, cx, cy, maxW, maxH) {
  if (!LOGO_IMG || !LOGO_IMG.naturalWidth) return false;
  const r = Math.min(maxW / LOGO_IMG.naturalWidth, maxH / LOGO_IMG.naturalHeight), w = LOGO_IMG.naturalWidth * r, h = LOGO_IMG.naturalHeight * r;
  ctx.save(); ctx.shadowColor = 'rgba(255,255,255,.95)'; ctx.shadowBlur = 16; ctx.drawImage(LOGO_IMG, cx - w / 2, cy - h / 2, w, h); ctx.shadowColor = 'rgba(180,138,255,.9)'; ctx.shadowBlur = 30;
  ctx.drawImage(LOGO_IMG, cx - w / 2, cy - h / 2, w, h); ctx.restore(); return true;
}
/* Opponent mascot logos, supplied by the arena as they finish loading (keyed by opponent name); the initials crest is the fallback. */
const OPP_LOGOS = new Map();
export function setScoreboardOpponentLogo(name, img) { if (img && img.naturalWidth) OPP_LOGOS.set(String(name), img); }
function oppLogo(ctx, name, cx, cy, maxW, maxH) {
  const img = OPP_LOGOS.get(name);
  if (!img) return false;
  const r = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight), w = img.naturalWidth * r, h = img.naturalHeight * r;
  ctx.save(); ctx.shadowColor = 'rgba(13,26,79,.35)'; ctx.shadowBlur = 8; ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h); ctx.restore(); return true;
}
/* School monogram: block "LW" in purple with white and gold keylines, drawn (no image). */
function monogram(ctx, cx, cy, size) {
  ctx.save(); ctx.font = `italic 900 ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.translate(cx, cy); ctx.scale(1.12, 1);
  // Each letter is outlined and filled before the next, so the W locks over the foot of the L.
  ctx.lineJoin = 'round';
  for (const [ch, dx] of [['L', -size * .3], ['W', size * .15]]) {
    ctx.lineWidth = size * .12; ctx.strokeStyle = '#ffffff'; ctx.strokeText(ch, dx, 0);
    ctx.lineWidth = size * .065; ctx.strokeStyle = C.gold; ctx.strokeText(ch, dx, 0);
    const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, '#8350cf'); g.addColorStop(1, C.purpleDark);
    ctx.fillStyle = g; ctx.fillText(ch, dx, 0);
  }
  ctx.restore();
}

/**
 * Draw the board into a 2D context of size w x h (designed at 2048 x 768; other sizes scale).
 * `data` comes from scoreboardData().
 */
export function drawScoreboard(ctx, w, h, data) {
  const d = data || scoreboardData(null);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
  ctx.scale(w / 2048, h / 768);
  const W = 2048, H = 768;

  // Background: deep navy LED field with faint angled light streaks.
  ctx.fillStyle = grad(ctx, 0, H, C.bg1, C.bg0); ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalAlpha = .1; ctx.fillStyle = '#3d6cff';
  for (const x of [520, 980, 1440]) { poly(ctx, [[x, 0], [x + 70, 0], [x - 190, H], [x - 260, H]]); ctx.fill(); }
  ctx.restore();

  // Top row: team-name slabs and the clock box.
  const nameL = slab(28, 22, 676, 176, 0, 46), nameR = mirror(nameL, W);
  framed(ctx, nameL, 22, 198, { inset: slab(40, 34, 646, 152, 0, 40) });
  framed(ctx, nameR, 22, 198, { inset: mirror(slab(40, 34, 646, 152, 0, 40), W) });
  text(ctx, d.home, 344, 110, 176, 560);
  text(ctx, d.away, W - 344, 110, 176, 560);

  const clockBox = [[744, 16], [1304, 16], [1336, 112], [1304, 208], [744, 208], [712, 112]];
  poly(ctx, clockBox); ctx.fillStyle = '#02040f'; ctx.fill(); ctx.strokeStyle = C.stroke; ctx.lineWidth = 5; ctx.stroke();
  if (d.final || d.pre) { text(ctx, d.clock, 1024, 96, 160, 520); text(ctx, d.final ? 'FINAL' : 'TIP-OFF', 1024, 180, 40, 300, { weight: 800, color: C.gold }); }
  else text(ctx, d.clock, 1024, 114, 200, 540);

  // Score panels with angled blue frames.
  for (const side of [0, 1]) {
    const outer = slab(96, 232, 560, 236, 40, 40), inner = slab(116, 246, 520, 208, 34, 34);
    const o = side ? mirror(outer, W) : outer, i = side ? mirror(inner, W) : inner;
    framed(ctx, o, 232, 468, { fill0: '#4d82ff', fill1: '#1b3fa8' });
    poly(ctx, i); ctx.fillStyle = grad(ctx, 246, 454, C.panel0, C.panel1); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.stroke();
    text(ctx, side ? d.awayScore : d.homeScore, side ? W - 376 : 376, 342, 270, 470);
    // Timeouts-left tag.
    const tag = slab(236, 482, 280, 70, 18, 18), t = side ? mirror(tag, W) : tag;
    framed(ctx, t, 482, 552, { fill0: '#0d1d5a', fill1: '#060f36', lw: 3 });
    const cx = side ? W - 376 : 376, val = side ? d.tolAway : d.tolHome;
    text(ctx, 'TOL', cx - 46, 516, 58, 120, { weight: 800 });
    text(ctx, val, cx + 62, 516, 64, 70, { color: val === '–' ? 'rgba(233,184,88,.45)' : C.gold });
  }

  // Centre column: PERIOD with arrow, big period number, unlit bonus lamps (fouls are not simulated).
  text(ctx, 'PERIOD', 1004, 262, 70, 260, { weight: 800 });
  triangle(ctx, 1126, 263, 20, C.gold);
  const pBox = [[930, 300], [1118, 300], [1140, 322], [1140, 454], [1118, 476], [930, 476], [908, 454], [908, 322]];
  poly(ctx, pBox); ctx.fillStyle = '#02040f'; ctx.fill(); ctx.strokeStyle = C.stroke; ctx.lineWidth = 4; ctx.stroke();
  text(ctx, d.period, 1024, 384, d.period === 'OT' ? 150 : 190, 210);
  for (const x of [806, 1242]) {
    ctx.beginPath(); ctx.arc(x, 388, 34, 0, Math.PI * 2); ctx.fillStyle = '#050a22'; ctx.fill(); ctx.strokeStyle = C.dim; ctx.lineWidth = 3; ctx.stroke();
    text(ctx, 'B', x, 386, 52, 60, { weight: 800, color: C.dim, glow: false });
  }

  // Lower left: Kangs kangaroo logo over an angled panel.
  const lw = slab(30, 574, 640, 170, 0, 60);
  framed(ctx, lw, 574, 744, { fill0: '#2149b8', fill1: '#0c1f66', lw: 3 });
  if (!logo(ctx, 330, 650, 520, 212)) monogram(ctx, 330, 650, 238);

  // Lower right: visitor crest on a white panel (opponent mascot logo when we have one, otherwise a crest with initials).
  const vp = mirror(slab(30, 574, 640, 170, 0, 60), W);
  poly(ctx, vp); ctx.fillStyle = grad(ctx, 574, 744, '#ffffff', '#dfe4f2'); ctx.fill(); ctx.strokeStyle = C.stroke; ctx.lineWidth = 3; ctx.stroke();
  if (!d.awayLogo || !oppLogo(ctx, d.opponent, 1560, 654, 190, 146)) {
    shield(ctx, 1560, 588, 128, 144); ctx.fillStyle = grad(ctx, 588, 732, '#1b2f7a', '#0b1640'); ctx.fill(); ctx.strokeStyle = '#9aa6c8'; ctx.lineWidth = 6; ctx.stroke();
    text(ctx, d.crest, 1560, 650, d.crest.length > 1 ? 66 : 84, 100, { glow: false });
  }
  text(ctx, d.away, 1800, 642, 92, 340, { color: '#0d1a4f', glow: false });
  text(ctx, 'VISITOR', 1800, 712, 38, 300, { weight: 800, color: '#5866a0', glow: false });

  // Centre lower box: last Kangs scorer's number and his points this game.
  const pb = [[748, 498], [1300, 498], [1300, 646], [748, 646]];
  poly(ctx, pb); ctx.fillStyle = '#02040f'; ctx.fill(); ctx.strokeStyle = C.stroke; ctx.lineWidth = 4; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1024, 512); ctx.lineTo(1024, 632); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.stroke();
  text(ctx, 'PLYR', 886, 528, 50, 220, { weight: 800 });
  text(ctx, 'PTS', 1162, 528, 50, 220, { weight: 800 });
  text(ctx, d.plyr ? d.plyr.num : '–', 886, 596, 96, 220, { color: C.gold });
  text(ctx, d.plyr ? d.plyr.pts : '–', 1162, 596, 96, 220, { color: C.gold });

  // Bottom row: real team stat.
  text(ctx, d.statHome, 800, 704, 92, 120, { color: C.gold });
  text(ctx, d.statLabel, 1024, 704, 64, 300, { weight: 800 });
  text(ctx, d.statAway, 1248, 704, 92, 120, { color: C.gold });

  ctx.restore();
}
