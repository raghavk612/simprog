/* Opponent mascot logos (transparent PNGs in public/images/opponents), supplied by the project team for identification.
   Opponents without a logo return null and the UI falls back to the initials crest. */

const SLUGS = new Set(['bothell', 'redmond', 'juanita', 'north-creek', 'woodinville', 'hazen', 'arlington', 'eastlake', 'newport', 'issaquah', 'skyline', 'mount-si', 'bellevue']);
const ALIASES = { 'mt si': 'mount-si', 'mt. si': 'mount-si', 'mountsi': 'mount-si', 'mount si': 'mount-si', 'north creek': 'north-creek', 'northcreek': 'north-creek', 'mount-si': 'mount-si', 'north-creek': 'north-creek' };

/** "Liberty (Renton)" -> "liberty", "Mount Si" -> "mount-si", "Hazen High School" -> "hazen". */
export function logoSlug(name) {
  let n = String(name ?? '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\b(high school|hs)\b/g, ' ').replace(/\s+/g, ' ').trim();
  n = ALIASES[n] || n.replace(/\s+/g, '-');
  return n;
}

/** URL of the opponent's logo PNG, or null when there is none. */
export function opponentLogo(name) {
  const slug = logoSlug(name);
  return SLUGS.has(slug) ? `${import.meta.env?.BASE_URL ?? '/'}images/opponents/${slug}.png` : null;
}

const CACHE = new Map();
/** Promise of the loaded HTMLImageElement for canvas use (cached per URL), or null when the opponent has no logo or it fails to load. */
export function loadOpponentLogo(name) {
  const url = opponentLogo(name);
  if (!url) return Promise.resolve(null);
  if (!CACHE.has(url)) {
    CACHE.set(url, new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    }));
  }
  return CACHE.get(url);
}
