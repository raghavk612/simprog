// Which built files the offline service worker downloads at install (scripts/offline.mjs). Left out:
// - the players' baked detail maps (about 15 MB, both skin sizes of every variant): a device on Low never draws them and
//   one on Medium never draws the 2k skins, and cache.addAll is all-or-nothing, so one dropped download would cost the
//   whole offline install;
// - the interface renders in images/ui (AVIF and WebP at 1x, 2x and 3x): a device draws one format at one density, a
//   phone never draws the header renders, and high contrast and forced colours draw none (art.js, markup.js).
// The worker's fetch handler caches each file the first time a page uses it, so what a player has seen still works offline.
const LEFT_OUT = ['/models/players/maps/', '/images/ui/'];
export const precacheList = files =>
  files.filter(f => {
    const p = f.replace(/\\/g, '/');
    return !LEFT_OUT.some(d => p.includes(d));
  });
