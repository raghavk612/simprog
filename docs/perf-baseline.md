# Performance baseline

Measured with `scripts/perf.mjs` (see the header of that file): the built game (`npm run build`, served by `vite preview`)
in Google Chrome on this machine, an **Apple M1 Pro** (16-core GPU), service worker blocked so each level's own downloads
are counted. Every frame is stepped at a fixed 1/60 s and timed up to a 1-pixel `readPixels`, so a frame's cost is the
real CPU + GPU time, not capped at the display's refresh rate. Each scene is run twice and the faster median kept.

- **title**: 5 s of the title screen (the hero's ball-handling show, the jib camera), after 1 s to settle.
- **live**: a whole live possession, 10 s, on the Auto camera: a Kangs crossover layup (made), the run back, a visitors'
  pull-up jumper (missed and rebounded).
- **replay**: 1 s of the replay close-up (the director's low rim camera with depth of field) around a floater. On Low there
  is no broadcast director, so the Auto camera is in its first-person shot at that moment.
- **laptop**: a 1366×768 window at 1×, a school laptop. **retina**: a 1440×900 window at 2×, a 13-inch MacBook (High
  renders at 1.65× and Medium at 1.35× there, after the pixel budgets in `src/graphics.js`).

Draw calls and triangles count every pass of a frame (shadow map, court mirror, main view, ambient-occlusion normals,
post-processing). Downloads are bytes on the wire (`vite preview` gzips JavaScript and JSON; PNG maps do not shrink).

Reproduce: `node scripts/perf.mjs --label before` (builds first), then `node scripts/perf.mjs --table before`.
Compare two runs: `node scripts/perf.mjs --compare before,after`.

## Before (commit at the start of the realism pass)

| config / level | scene | frame median ms | p95 ms | draw calls | triangles | heap MB |
|---|---|---|---|---|---|---|
| laptop/high | title | 11.2 | 11.9 | 585 | 2.44M | 28 |
| laptop/high | live | 10.5 | 12.1 | 705 | 2.10M | 35 |
| laptop/high | replay | 11.9 | 12.7 | 575 | 2.45M | 34 |
| laptop/medium | title | 6.5 | 6.9 | 375 | 1.23M | 31 |
| laptop/medium | live | 6.1 | 7.0 | 420 | 1.05M | 41 |
| laptop/medium | replay | 6.8 | 7.9 | 364 | 1.23M | 33 |
| laptop/low | title | 2.1 | 2.6 | 220 | 0.02M | 23 |
| laptop/low | live | 2.5 | 4.0 | 322 | 0.03M | 23 |
| laptop/low | replay | 1.3 | 1.9 | 72 | 0.00M | 27 |
| retina/high | title | 20.7 | 21.8 | 580 | 2.44M | 47 |
| retina/high | live | 21.4 | 22.8 | 694 | 2.46M | 51 |
| retina/high | replay | 22.8 | 25.8 | 575 | 2.45M | 46 |
| retina/medium | title | 9.0 | 10.4 | 372 | 1.23M | 38 |
| retina/medium | live | 8.9 | 10.2 | 415 | 1.23M | 39 |
| retina/medium | replay | 10.1 | 10.9 | 364 | 1.23M | 46 |
| retina/low | title | 2.3 | 2.8 | 200 | 0.01M | 23 |
| retina/low | live | 2.8 | 4.3 | 319 | 0.03M | 27 |
| retina/low | replay | 1.6 | 2.2 | 70 | 0.00M | 24 |

| config / level | downloaded MB | player maps MB | player models MB | JS MB |
|---|---|---|---|---|
| laptop/high | 15.75 | 10.75 | 3.11 | 0.37 |
| laptop/medium | 13.28 | 8.28 | 3.11 | 0.37 |
| laptop/low | 1.85 | 0.00 | 0.00 | 0.37 |
| retina/high | 15.75 | 10.75 | 3.11 | 0.37 |
| retina/medium | 13.28 | 8.28 | 3.11 | 0.37 |
| retina/low | 1.85 | 0.00 | 0.00 | 0.37 |

Main chunk index-BbR-JSld.js: 1120 kB (332 kB gzip). All JS: 1.75 MB.

Reading it: on High the crowd and the extra passes cost most (2.4 M triangles a frame against 0.14 M for the ten
players); Medium already halves the frame; Low is the classic gym (no models, no broadcast look). High and Medium both
download 3.1 MB of player models and 8.3 to 10.8 MB of lossless PNG detail maps, and Medium fetches the kit and gear
atlases at High size.

## After

Filled in at the end of the realism pass (see docs/realism-log.md).
