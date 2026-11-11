// A player's portrait, drawn as SVG. The face is picked from a hash of the player's name, so it never changes;
// the shirt is the kit the team is wearing.
import * as E from '../engine.js';
import { isSpecialKit, gymColors } from '../kits.js';
import { t } from '../i18n/index.js';
import { state } from './store.js';
import { html, esc } from './markup.js';

const SKIN = ['#f1c7a3', '#e0a87e', '#c68a5e', '#a86f45', '#8a5634', '#6b3f24', '#4f2c19', '#d9a07a'];
const HAIR = ['#17110d', '#2a1b12', '#3d2616', '#5b3a22', '#8a5a2e', '#b9874a', '#d8b06a', '#20180f'];
export function avatar(p, size = 48) {
  const h = E.hashStr((p.originalName || p.name) + '|' + p.id),
    g = n => h >>> n,
    skin = SKIN[g(1) % SKIN.length],
    hair = HAIR[(g(4) + (SKIN.indexOf(skin) > 3 ? 0 : 2)) % HAIR.length],
    style = (g(7) + p.id) % 7,
    rx = 21 + (g(11) % 4),
    ry = 26 + (g(13) % 3),
    band = g(16) % 6 === 0,
    beard = ['Junior', 'Senior'].includes(p.year) && g(18) % 3 === 0,
    kit = isSpecialKit(state?.kit)
      ? gymColors(state.kit)
      : state?.kit === 'away'
        ? ['#f4effc', '#562494']
        : state?.kit === 'alternate'
          ? ['#191126', '#e9b858']
          : ['#6832ab', '#ffffff'];
  const top = 60 - ry,
    shade = `color-mix(in srgb,${skin} 78%,#000)`;
  const hairSvg = [
    `<path d="M${60 - rx} ${58 - ry * 0.15}Q${60 - rx} ${top - 3} 60 ${top - 3}Q${60 + rx} ${top - 3} ${60 + rx} ${58 - ry * 0.15}Q${60 + rx - 3} ${top + 8} 60 ${top + 6}Q${60 - rx + 3} ${top + 8} ${60 - rx} ${58 - ry * 0.15}Z" fill="${hair}" opacity=".9"/>`,
    `<path d="M${60 - rx + 1} ${top + 14}L${60 - rx + 2} ${top - 14}Q60 ${top - 20} ${60 + rx - 2} ${top - 14}L${60 + rx - 1} ${top + 14}Q60 ${top + 4} ${60 - rx + 1} ${top + 14}Z" fill="${hair}"/>`,
    html`
      <g fill="${hair}">
        ${[-16, -8, 0, 8, 16, -12, -4, 4, 12].map((x, k) => `<circle cx="${60 + x}" cy="${top + (k < 5 ? 2 : -5)}" r="${7.5}"/>`).join('')}
      </g>`,
    `<path d="M${60 - rx} ${top + 16}Q${60 - rx} ${top - 4} 60 ${top - 4}Q${60 + rx} ${top - 4} ${60 + rx} ${top + 16}Q60 ${top + 6} ${60 - rx} ${top + 16}Z" fill="${hair}"/><path d="M${60 - rx + 5} ${top + 6}q6 -3 12 0t12 0t12 0" stroke="${skin}" stroke-opacity=".25" fill="none"/>`,
    `<path d="M${60 - rx - 1} ${top + 20}Q${60 - rx - 2} ${top - 6} 60 ${top - 5}Q${60 + rx + 3} ${top - 5} ${60 + rx + 1} ${top + 18}Q${60 + 4} ${top + 4} ${60 - rx - 1} ${top + 20}Z" fill="${hair}"/>`,
    `<ellipse cx="60" cy="${top + 10}" rx="${rx + 9}" ry="${ry * 0.75}" fill="${hair}"/>`,
    `<path d="M${60 - rx} ${top + 18}Q${60 - rx} ${top - 2} 60 ${top - 2}Q${60 + rx} ${top - 2} ${60 + rx} ${top + 18}L${60 + rx - 2} ${top + 9}Q60 ${top + 3} ${60 - rx + 2} ${top + 9}Z" fill="${hair}"/><path d="M${60 - rx + 2} ${top + 10}Q${60 - rx - 6} ${top + 26} ${60 - rx - 1} ${top + 34}M${60 + rx - 2} ${top + 10}Q${60 + rx + 6} ${top + 26} ${60 + rx + 1} ${top + 34}" stroke="${hair}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  ][style];
  const behind = style === 5 ? hairSvg : '',
    front =
      style === 5
        ? `<path d="M${60 - rx + 2} ${top + 12}Q60 ${top + 2} ${60 + rx - 2} ${top + 12}" stroke="${hair}" stroke-width="6" fill="none"/>`
        : hairSvg;
  return html`
    <svg class="avatar" width="${size}" height="${(size * 7) / 6}" viewBox="0 0 120 140" ${size >= 96 ? `role="img" aria-label="${esc(t('rv.avatar', { name: p.name }))}"` : 'aria-hidden="true"'}>
      <rect width="120" height="140" rx="6" fill="#343740"/>${behind} <path d="M8 140C12 110 32 100 60 100S108 110 112 140Z" fill="${kit[0]}"/><path d="M44 101L60 118L76 101" fill="none" stroke="${kit[1]}" stroke-width="4"/><text x="60" y="137" text-anchor="middle" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-weight="800" font-size="20" fill="${kit[1]}">${esc(p.number)}</text> <rect x="51" y="78" width="18" height="26" rx="6" fill="${shade}"/><ellipse cx="${60 - rx}" cy="62" rx="4" ry="6" fill="${shade}"/><ellipse cx="${60 + rx}" cy="62" rx="4" ry="6" fill="${shade}"/><ellipse cx="60" cy="60" rx="${rx}" ry="${ry}" fill="${skin}"/>${front} ${band ? `<rect x="${60 - rx}" y="${top + 12}" width="${rx * 2}" height="6" rx="3" fill="${kit[0]}" stroke="${kit[1]}" stroke-width="1"/>` : ''} <path d="M${48 - (g(20) % 3)} 53q5 -${2 + (g(21) % 2)} 9 0M${63 + (g(20) % 3)} 53q5 -${2 + (g(21) % 2)} 9 0" stroke="${hair}" stroke-width="2.6" fill="none" stroke-linecap="round"/><ellipse cx="52.5" cy="60" rx="2.6" ry="3" fill="#1a1210"/><ellipse cx="67.5" cy="60" rx="2.6" ry="3" fill="#1a1210"/><path d="M60 62q-3 7 0 9" stroke="${shade}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M${53 + (g(22) % 2)} 77q7 ${3 + (g(23) % 3)} 14 0" stroke="#4a2a22" stroke-width="2.2" fill="none" stroke-linecap="round"/> ${beard ? `<path d="M${60 - rx + 3} 66Q${60 - rx + 6} ${60 + ry} 60 ${60 + ry + 1}Q${60 + rx - 6} ${60 + ry} ${60 + rx - 3} 66" stroke="${hair}" stroke-width="3.2" fill="none" opacity=".85"/>` : ''}
    </svg>`;
}
