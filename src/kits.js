// Jersey kits. The first three are always available; the three special kits are earned during the season (see unlockedKits in engine.js).
// Showcase palette (3D locker-room jerseys) and the two colours the 3D gym players wear: [jersey, lettering]. A lettering of null means the coach's trim colour.
import { TEAM_COLORS } from './teamColors.js';
import { logoSlug } from './logos.js';
export const CORE_KITS = ['home', 'away', 'alternate'];
export const SPECIAL_KITS = ['throwback', 'seniornight', 'blackout'];
export const ALL_KITS = [...CORE_KITS, ...SPECIAL_KITS];
export const KIT_NAMES = { throwback: 'Throwback', seniornight: 'Senior Night', blackout: 'Blackout' };
export const isSpecialKit = k => SPECIAL_KITS.includes(k);
export const KANGS_PURPLE = 0x6832ab; // the Kangs jersey before a kit is applied (the 3D gym)
export const KITS = {
  home: {
    body: '#6832ab',
    dark: '#4a1f80',
    trim: '#ffffff',
    ink: '#ffffff',
    accent: '#e9b858',
    scriptLine: '#2a1050',
    numLine: '#2a1050',
  },
  away: {
    body: '#f4effc',
    dark: '#d9cdee',
    trim: '#562494',
    ink: '#562494',
    accent: '#8b4fe0',
    scriptLine: '#ffffff',
    numLine: '#2a1050',
  },
  // Midnight: black with purple trim, white script and a purple number outlined in white (like the real Lake Washington black jersey).
  alternate: {
    body: '#16121b',
    dark: '#08060b',
    trim: '#7b3fd1',
    ink: '#ffffff',
    accent: '#7b3fd1',
    scriptLine: '#7b3fd1',
    num: '#8b4fe0',
    numLine: '#ffffff',
  },
  // Throwback: cream with vintage purple and gold trim.
  throwback: {
    body: '#f1e6c8',
    dark: '#d8c79b',
    trim: '#6832ab',
    ink: '#6832ab',
    accent: '#e9b858',
    vintage: true,
    scriptLine: '#e9b858',
    numLine: '#e9b858',
  },
  // Senior Night: purple with gold sleeves and neck, and a star.
  seniornight: {
    body: '#6832ab',
    dark: '#4a1f80',
    trim: '#e9b858',
    ink: '#e9b858',
    accent: '#e9b858',
    star: true,
    sleeves: '#e9b858',
    scriptLine: '#2a1050',
    numLine: '#2a1050',
  },
  // Blackout: all black with purple pinstripes, purple script and a black number outlined in purple.
  blackout: {
    body: '#0b0910',
    dark: '#030207',
    trim: '#5b2a9e',
    ink: '#9d5cf2',
    accent: '#7b3fd1',
    stripe: '#3b1f66',
    scriptLine: '#000000',
    num: '#0b0910',
    numLine: '#9d5cf2',
  },
};
const GYM = {
  home: ['#6832ab', null],
  away: ['#f4effc', '#562494'],
  alternate: ['#16121b', '#8b4fe0'],
  throwback: ['#f1e6c8', '#6832ab'],
  seniornight: ['#6832ab', '#e9b858'],
  blackout: ['#0b0910', '#9d5cf2'],
};
export const gymColors = (kit, trim = '#ffffff') => {
  const [bg, fg] = GYM[kit] || GYM.home;
  return [bg, fg || trim];
};

/* ---- The visitors' kit: their school's colour, from its logo (src/teamColors.js, scripts/team-colors.mjs) ---- */
// for a school with no logo: a classic team colour picked by its name, the same every time
export const FALLBACK_COLORS = [
  '#1f3a7a',
  '#9b1b30',
  '#1f5a3a',
  '#c8642a',
  '#202024',
  '#6a1b2a',
  '#13706d',
  '#b8862b',
];
const toRgb = h => {
  const n = parseInt(String(h).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lin = v => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
/* CIE L*a*b* of an sRGB hex colour (D65). */
export function lab(h) {
  const [r, g, b] = toRgb(h).map(lin),
    f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116),
    x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047),
    y = f(0.2126 * r + 0.7152 * g + 0.0722 * b),
    z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
/* How different two colours look (CIE76 delta E): under about 42 two jerseys are hard to tell apart on a broadcast (Bothell blue and North Creek indigo against the Kangs purple). */
export const colorDistance = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
export const luminance = h => {
  const [r, g, b] = toRgb(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const hashName = s =>
  [...String(s)].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
export const ROAD_WHITE = '#f1eff4',
  DARK_INK = '#17151c';
/* [jersey, lettering] for the visiting team against the Kangs' jersey colour `home`: the school's primary colour with white
   (or dark, on a light colour) lettering; road whites with the school colour as lettering when the two jerseys would be
   too alike (or when the Kangs are in a dark kit and the school colour is dark too). */
export function visitorKit(opponent, home = KITS.home.body) {
  const team = TEAM_COLORS[logoSlug(opponent)],
    primary = team?.primary || FALLBACK_COLORS[hashName(logoSlug(opponent)) % FALLBACK_COLORS.length],
    clash = colorDistance(primary, home) < 42;
  if (!clash)
    return [
      primary,
      luminance(primary) > 0.4
        ? team?.secondary && luminance(team.secondary) < 0.15
          ? team.secondary
          : DARK_INK
        : '#ffffff',
    ];
  // road whites: lettering in the school colour (or its second colour, or dark ink, if that is too light to read on white)
  if (colorDistance(ROAD_WHITE, home) < 42) {
    // the Kangs are in white: the visitors go dark instead
    return [DARK_INK, primary && luminance(primary) > 0.1 ? primary : '#ffffff'];
  }
  const ink = [primary, team?.secondary].find(c => c && luminance(c) < 0.35) || DARK_INK;
  return [ROAD_WHITE, ink];
}

/* ---- Socks and shoes: the team's socks and three shoe colourways; each player wears one (src/players.js feetFor) ---- */
// A colourway is [upper, accent, midsole band, outsole]: the upper and toe box in the first, the heel counter and side
// panel in the second, a band round the midsole in the third (src/clothFit.js shoeZones), and gum or dark rubber below.
export const GUM = '#a0683c',
  OUTSOLE_DARK = '#1c1b20';
const K_WHITE = '#f2f0f5',
  K_PURPLE = KITS.home.body,
  K_GOLD = KITS.home.accent,
  K_BLACK = KITS.alternate.body,
  K_BRIGHT = KITS.alternate.trim;
/* Every colour the Kangs' socks and shoes are made from (white, purple, gold, black). */
export const KANGS_FEET_COLORS = [K_WHITE, K_PURPLE, K_GOLD, K_BLACK, K_BRIGHT, KITS.away.trim];
// the Kangs: white, purple and gold; purple and gold; or black and purple. Socks in white, black or purple, by kit.
const KANGS_SHOES = [
  [K_WHITE, K_PURPLE, K_GOLD, GUM],
  [K_PURPLE, K_GOLD, K_WHITE, OUTSOLE_DARK],
  [K_BLACK, K_BRIGHT, K_WHITE, OUTSOLE_DARK],
];
const KANGS_SOCKS = {
  home: K_WHITE,
  away: KITS.away.trim,
  alternate: K_BLACK,
  throwback: K_WHITE,
  seniornight: K_WHITE,
  blackout: K_BLACK,
};
export const homeFeet = (kit = 'home') => ({
  sock: KANGS_SOCKS[kit] || KANGS_SOCKS.home,
  colourways: KANGS_SHOES,
});
/* The visitors' socks (their jersey colour) and shoes, from their kit ([jersey, lettering], visitorKit) and their school's
   colours: three colourways, each upper with the most different of those colours as its accent and band. */
export function visitorFeet(opponent, [jersey, ink] = visitorKit(opponent)) {
  const team = TEAM_COLORS[logoSlug(opponent)],
    palette = [];
  // near-identical colours (road white and a white second colour) count once
  for (const c of [jersey, ink, team?.primary, team?.secondary])
    if (c && !palette.some(p => colorDistance(p, c) < 8)) palette.push(c.toLowerCase());
  const far = (c, not = []) =>
      palette
        .filter(x => x !== c && !not.includes(x))
        .sort((a, b) => colorDistance(b, c) - colorDistance(a, c))[0],
    rubber = c => (luminance(c) > 0.35 ? GUM : OUTSOLE_DARK),
    out = [],
    add = c => out.length < 3 && !out.some(o => o.join() === c.join()) && out.push(c);
  for (const u of palette) {
    const accent = far(u) ?? u,
      next = far(u, [accent]),
      band = next && colorDistance(next, u) > 25 ? next : accent; // a band that stands out from the upper
    add([u, accent, band, rubber(u)]);
  }
  // a school with two colours: also a plain upper with a band in the other one
  for (const u of palette) add([u, u, far(u) ?? u, rubber(u)]);
  return { sock: palette[0], colourways: out };
}
