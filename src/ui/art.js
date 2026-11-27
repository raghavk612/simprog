// The still renders in public/images/ui (modelled in Houdini, drawn with Three.js; scripts/art/README.md): picture
// markup, which empty state shows which render, and when a header's render is left out. Every render is decorative
// (alt=""), served as AVIF with a WebP fallback at 1x and 2x, and never downloaded where it is hidden: forced colours, a
// system's more-contrast setting and a phone's header get a blank source, and the live game's header does not emit it.
// No DOM here, so tests import it.
import { bracketSeed } from './seasonModel.js';

export const UI_IMG = `${import.meta.env?.BASE_URL ?? '/'}images/ui/`;
export const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// The files of one render: [file name without extension, density]. The big renders are `<name>` and `<name>@2x`; the
// small glyphs are three sizes of one square (24, 48 and 72 px).
const pair = name => [
    [name, 1],
    [`${name}@2x`, 2],
  ],
  trio = name => [
    [`${name}-24`, 1],
    [`${name}-48`, 2],
    [`${name}-72`, 3],
  ],
  logoTrio = [
    ['logo-42', 1],
    ['logo-84', 2],
    ['logo-126', 3],
  ];
// Where a decorative render is hidden (a11y.css hides it in forced colours and in the app's own high contrast setting; the
// system's more-contrast setting is the default for that setting, so it is blank too and nothing is fetched).
const DECORATION = '(forced-colors: active), (prefers-contrast: more)';
const set = (files, ext) => files.map(([f, d]) => `${UI_IMG}${f}.${ext} ${d}x`).join(', ');

// A picture of a render.
// `media` adds one more blank source (the header's render is for 1200 px and up). `blank` is the media in which the picture
// is hidden: decoration goes in forced colours and in a system's more-contrast setting; the logo never does.
export function uiPicture(
  name,
  { w, h, cls = '', imgCls = '', files = pair(name), media = '', blank = DECORATION } = {},
) {
  return `<picture class="${cls}">${
    media ? `<source media="${media}" srcset="${BLANK}">` : ''
  }${blank ? `<source media="${blank}" srcset="${BLANK}">` : ''}<source type="image/avif" srcset="${set(files, 'avif')}"><source type="image/webp" srcset="${set(files, 'webp')}"><img${imgCls ? ` class="${imgCls}"` : ''} src="${UI_IMG}${files[0][0]}.webp" alt="" width="${w}" height="${h}" decoding="async"></picture>`;
}

// A small glyph (the token coin, the coach's whistle) in a 24 px box. Its SVG stays underneath: theme.css shows it when
// the image fails (installGlyphFallback marks the box), in high contrast and in forced colours, so the box is never empty.
export function glyphImage(name, svgPath, svgCls = '') {
  return `<span class="art-glyph"><svg class="${svgCls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${svgPath}</svg>${uiPicture(name, { w: 24, h: 24, files: trio(name), blank: '(forced-colors: active)' })}</span>`;
}
// The Kangs mark (purple, with white details) at 42 px, for themed pages in light mode; `cls` goes on the picture.
export const logoMark = cls =>
  uiPicture('logo', { w: 42, h: 42, cls, imgCls: 'logo-img', files: logoTrio, blank: '' });

// An image that fails leaves its glyph box showing the SVG underneath (error does not bubble: listen on capture).
export function installGlyphFallback(doc = document) {
  doc.addEventListener('error', e => e.target?.closest?.('.art-glyph')?.classList.add('no-img'), true);
}

// The empty-state render (a name in public/images/ui/) a page shows while it has nothing to list, else null.
export function emptyArt(v, s) {
  if (v === 'season') return s.results.length ? null : 'empty-journal';
  if (v === 'bracket') return bracketSeed(s) ? 'empty-bracket' : null;
  if (v === 'skills') return s.skills?.length ? null : 'empty-skills';
  return null;
}
// The empty state's picture, displayed at 400 × 300 and scaled by theme.css; '' where the page has no render or it is hidden.
export const emptyPicture = (name, cls, media = '') =>
  name ? uiPicture(name, { w: 400, h: 300, cls, media }) : '';

// The live game and its replays: body.live-match, whose stylesheet hides the page header (shell.js render()).
export const isLiveMatch = (v, s, ui) => v === 'game' && !!(s?.match || ui?.closingMatch || ui?.replayEvent);
