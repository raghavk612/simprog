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
