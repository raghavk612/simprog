// Which built files the offline service worker downloads at install (scripts/offline.mjs). The players' baked detail maps
// (about 15 MB, both skin sizes of every variant) are left out: a device on Low never draws them and one on Medium never
// draws the 2k skins, and cache.addAll is all-or-nothing, so one dropped download would cost the whole offline install.
// The worker's fetch handler caches each map the first time it is used, so the maps a player needs still work offline.
export const precacheList = files =>
  files.filter(f => !f.replace(/\\/g, '/').includes('/models/players/maps/'));
