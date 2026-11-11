// Small helpers for building the page's HTML strings, and the inline icons.
// Text from the save or the team data goes through esc(); translated strings from t() are trusted.
import { ariaKey, keyLabel } from '../keys.js';
import { t, has, up } from '../i18n/index.js';
import { opponentLogo } from '../logos.js';
import { keys, state } from './store.js';

// ---- Escaping and templates ----
export const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
// html`...` lets markup be written over several indented lines: a line break and the indent after it are dropped,
// so the page gets exactly the same HTML as a one-line template. Spaces inside a line are kept.
export const html = (parts, ...values) =>
  parts.reduce(
    (out, part, i) => out + part.replace(/\n\s*/g, '') + (i < values.length ? String(values[i]) : ''),
    '',
  );

// ---- Building blocks ----
// A button that runs ACTIONS[action] in actions.js.
export const btn = (text, action, cls = '', extra = '') =>
  `<button class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
export const pill = (text, cls = '') => `<span class="pill ${cls}">${text}</span>`;
export const svg = (d, cls = '') =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
export const kbd = k => `<kbd class="key${k.length > 2 ? ' kw' : ''}">${k}</kbd>`;
export const micon = k => `<span class="mouse-icon">${svg(MOUSE[k])}</span>`;
export const link = (href, label) => `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>`;
// The heading at the top of every page.
export function header(kicker, title, description = '') {
  return html`
    <div class="page-heading">
      <div>
        <span class="eyebrow">${kicker}</span>
        <h1 tabindex="-1">${title}</h1>
        ${description ? `<p>${description}</p>` : ''}
      </div>
    </div>`;
}
// Shortcut hint for a button: announced by screen readers and shown as a tooltip.
export const hint = (name, about = '') =>
  `aria-keyshortcuts="${esc(ariaKey(keys[name]))}" title="${esc((about ? about + ' · ' : '') + t('keys.shortcut', { key: keyLabel(keys[name]) }))}"`;
export const hintJ = 'aria-keyshortcuts="J"';

// ---- Numbers and words ----
export const sgn = n => `${n >= 0 ? '+' : ''}${n}`;
export const signed = (n, unit) => `${n > 0 ? '+' : '−'}${Math.abs(Math.round(n))} ${unit}`;
export const f1 = v => (v == null ? '—' : v.toFixed(1));
export const fgPct = (a, b) => (b ? `${a}/${b} · ${Math.round((100 * a) / b)}%` : '—');
export const speedLabel = n => `${n}×`;
export const cap1 = s => up(s.charAt(0)) + s.slice(1);
export const short2 = text =>
  Array.from(String(text || ''))
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase();

// ---- Basketball text ----
// The 3D gym names each phase of a possession in English; this is the translated name.
const PHASES = {
  'Pass & relocate': 'pass',
  'Attack & dribble': 'attack',
  'Gather & contest': 'gather',
  'Shot blocked': 'blocked',
  Turnover: 'turnover',
  'Shot in flight': 'flight',
  Basket: 'basket',
  Rebound: 'rebound',
};
export const phase = name => (PHASES[name] ? t(`phase.${PHASES[name]}`) : name);
export const shot = c => (has(`shot.${c.kind}`) ? t(`shot.${c.kind}`) : c.label);
export const capBadge = id =>
  state?.captain === id
    ? ` <abbr class="cap-badge" title="${esc(t('captain.badge'))}">${t('captain.c')}</abbr>`
    : '';
// Names every player in the rotation who cannot play and why; escape is for text that goes into the page rather than a notification.
export const issueText = (list, escape) =>
  t('lineup.warn', {
    names: list
      .map(x => t('lineup.item', { name: escape ? esc(x.name) : x.name, why: t(`lineup.${x.reason}`) }))
      .join(', '),
  });
// One effect of a choice (press room, inbox, tip-off), green when it helps the Kangs.
export const chipHtml = c => {
  const v = Number.isInteger(c.v) ? c.v : Math.round(c.v * 100) / 100,
    good = c.k === 'oppRating' || c.k === 'injury' ? v < 0 : v > 0,
    who = c.who && c.who !== 'team' && c.who !== 'next' ? `${esc(c.who)}: ` : '';
  return `<span class="chip ${good ? 'good' : 'bad'}">${who}${v > 0 ? '+' : '−'}${Math.abs(v)} ${t(`chip.${c.k}`)}${c.who === 'next' ? ` · ${t('chip.next')}` : ''}</span>`;
};

// ---- Logos ----
const LOGO = `${import.meta.env.BASE_URL}images/kangs-logo.png`;
export const LOGO_WHITE = `${import.meta.env.BASE_URL}images/kangs-logo-white.png`;
// The logo for themed pages: white in dark mode, purple in light mode (theme.css shows one). Pages on the 3D gym are always dark and use LOGO_WHITE.
export const logoPair = (cls, alt = '') =>
  `<img class="${cls} on-dark" src="${LOGO_WHITE}" alt="${alt}"><img class="${cls} on-light" src="${LOGO}" alt="${alt}">`;
// An opponent's logo if there is one, else the fallback markup.
export const oppMark = (n, cls, fb) => {
  const u = opponentLogo(n);
  return u ? `<img class="${cls}" src="${u}" alt="" decoding="async">` : fb;
};
export const oppBadge = n => oppMark(n, 'opp-badge', '<span class="opp-badge ph"></span>');
// Short letters for an opponent without a logo: "Bothell" -> BOT, "Mount Si" -> MS.
export const crestText = n =>
  String(n || '')
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .filter(w => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w, i, a) => (a.length > 1 ? w[0] : w.slice(0, 3)))
    .join('')
    .toUpperCase() || 'OPP';

// ---- Icons (SVG path data on a 24×24 grid) ----
const MOUSE = {
  drag: '<rect x="7" y="3" width="10" height="16" rx="5"/><path d="M12 3v6M7.5 9h9"/><path d="M3 21l2-2M21 21l-2-2"/>',
  scroll:
    '<rect x="7" y="3" width="10" height="16" rx="5"/><path d="M12 6.5v3"/><path d="M10 13.5l2 2 2-2"/>',
  tap: '<path d="M9 11V5.5a1.5 1.5 0 013 0V10l4.6 1a2 2 0 011.6 2.3L17.5 18a3 3 0 01-3 2.5H11a3 3 0 01-2.4-1.2L5.3 15a1.4 1.4 0 012.1-1.9L9 14.5"/>',
};
// The top bar's tabs, in order. Each opens the first page of its group in NAV (shell.js).
export const TAB_ICONS = {
  week: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.8V19h12V9.8M10 19v-5h4v5"/>',
  team: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.3 2.7-5 5.5-5s4.9 1.7 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.8 14.2c2.4.1 4 1.6 4.7 4.8"/>',
  season: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6"/>',
};
// Prep's practice plans, in the order of E.plans.
export const PLAN_ICONS = [
  '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/><path d="M8.5 11.5h2l1-2 1.5 4 1-2h1.5"/>',
  '<path d="M4 6.5C7 5 9.5 5 12 6.5 14.5 5 17 5 20 6.5V19c-3-1.5-5.5-1.5-8 0-2.5-1.5-5-1.5-8 0z"/><path d="M12 6.5V19"/>',
  '<path d="M4 17h16M6 17v-5a6 6 0 0112 0v5"/><path d="M12 4v2M8.5 20h7"/>',
];
export const TOAST_ICONS = {
  success: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  error: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  warn: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.01"/>',
  staff: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-4 3.6-6 7-6s6.2 2 7 6"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5l5 2.5-5 2.5z"/>',
};
// Staff, upgrades and Prep's non-practice picks.
const OFFICE_ICONS = {
  listen: '<path d="M4 4h16v12H9l-5 4z"/>',
  fundraise: '<path d="M12 3v18M17 7H9a3 3 0 000 6h6a3 3 0 010 6H6"/>',
  academics: '<path d="M3 5h7l2 2 2-2h7v14h-7l-2 2-2-2H3zM12 7v14"/>',
  development: '<path d="M4 19l6-7 4 3 6-11M13 4h7v7"/>',
  recovery: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  culture: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-3a8 8 0 0116 0v3"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 8l6 4-6 4z"/>',
  facility: '<path d="M3 21V7l9-4 9 4v14M8 21v-8h8v8"/>',
  nutrition: '<path d="M12 8c-8-6-12 5-5 12 2 2 3 0 5 0s3 2 5 0c7-7 3-18-5-12zM12 8V3l4-1"/>',
  tutor: '<path d="M3 5h7l2 2 2-2h7v14h-7l-2 2-2-2H3zM12 7v14"/>',
};
export const officeIcon = key =>
  `<span class="office-icon" aria-hidden="true">${svg(OFFICE_ICONS[key])}</span>`;
