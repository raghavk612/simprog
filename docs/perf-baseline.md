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

The end of the realism pass, measured **back to back with the baseline in the same session** (the baseline commit
ef072c8 built in a separate worktree, then this branch), three runs each, faster median kept: `docs/perf/before-same.json`
and `docs/perf/after.json`. A run hours apart drifts by 3–8% on this machine (a run of the final code earlier the same
evening measured 3–8% slower across every level, code proven identical by `npm run trace`), so only a same-session pair is
compared. The original `before` run above agrees with `before-same` within that drift.

| config / level | scene | frame median ms (before-same → after) | p95 ms | draw calls | triangles | heap MB |
|---|---|---|---|---|---|---|
| laptop/high | title | 11.1 → 10.5 (-5%) | 12.6 → 11.7 | 585 → 526 | 2.44M → 1.19M | 29 → 45 |
| laptop/high | live | 10.6 → 10.1 (-5%) | 12.4 → 11.8 | 705 → 700 | 2.10M → 0.94M | 38 → 55 |
| laptop/high | replay | 11.7 → 11.2 (-4%) | 12.8 → 12.1 | 575 → 570 | 2.45M → 1.24M | 35 → 50 |
| laptop/medium | title | 6.4 → 5.6 (-13%) | 7.4 → 6.5 | 375 → 343 | 1.23M → 0.61M | 36 → 34 |
| laptop/medium | live | 6.1 → 5.6 (-8%) | 7.5 → 6.9 | 420 → 406 | 1.05M → 0.47M | 34 → 47 |
| laptop/medium | replay | 6.7 → 6.2 (-7%) | 8.1 → 8.5 | 364 → 350 | 1.23M → 0.63M | 41 → 45 |
| laptop/low | title | 2.0 → 1.5 (-25%) | 2.5 → 2.1 | 220 → 118 | 0.02M → 0.02M | 27 → 20 |
| laptop/low | live | 2.5 → 1.8 (-28%) | 3.9 → 3.1 | 322 → 169 | 0.03M → 0.03M | 28 → 21 |
| laptop/low | replay | 1.3 → 1.5 (15%) | 2.3 → 2.0 | 72 → 77 | 0.00M → 0.01M | 29 → 26 |
| retina/high | title | 21.0 → 21.1 (0%) | 21.8 → 21.9 | 580 → 517 | 2.44M → 1.19M | 38 → 35 |
| retina/high | live | 21.6 → 22.0 (2%) | 23.4 → 23.8 | 694 → 689 | 2.46M → 1.29M | 33 → 65 |
| retina/high | replay | 23.1 → 23.6 (2%) | 26.0 → 26.1 | 575 → 570 | 2.45M → 1.28M | 46 → 63 |
| retina/medium | title | 8.9 → 8.3 (-7%) | 10.1 → 9.3 | 372 → 340 | 1.23M → 0.61M | 34 → 44 |
| retina/medium | live | 8.8 → 8.3 (-6%) | 10.1 → 9.8 | 415 → 401 | 1.23M → 0.65M | 37 → 42 |
| retina/medium | replay | 9.6 → 9.0 (-6%) | 11.7 → 11.8 | 364 → 350 | 1.23M → 0.64M | 44 → 48 |
| retina/low | title | 2.0 → 1.6 (-20%) | 2.6 → 2.2 | 200 → 115 | 0.01M → 0.02M | 25 → 19 |
| retina/low | live | 2.6 → 1.9 (-27%) | 3.8 → 3.3 | 319 → 166 | 0.03M → 0.03M | 26 → 20 |
| retina/low | replay | 1.4 → 1.6 (14%) | 2.3 → 2.5 | 70 → 76 | 0.00M → 0.01M | 27 → 20 |

| config / level | downloaded MB (before-same → after) | player maps MB | player models MB | JS MB |
|---|---|---|---|---|
| laptop/high | 15.75 → 17.80 (13%) | 10.75 → 12.77 | 3.11 → 3.11 | 0.37 → 0.40 |
| laptop/medium | 13.28 → 10.06 (-24%) | 8.28 → 5.03 | 3.11 → 3.11 | 0.37 → 0.40 |
| laptop/low | 1.85 → 1.88 (2%) | 0.00 → 0.00 | 0.00 → 0.00 | 0.37 → 0.40 |
| retina/high | 15.75 → 17.80 (13%) | 10.75 → 12.77 | 3.11 → 3.11 | 0.37 → 0.40 |
| retina/medium | 13.28 → 10.06 (-24%) | 8.28 → 5.03 | 3.11 → 3.11 | 0.37 → 0.40 |
| retina/low | 1.85 → 1.88 (2%) | 0.00 → 0.00 | 0.00 → 0.00 | 0.37 → 0.40 |

Main chunk: 1120 kB (332 kB gzip) → 519 kB (193 kB gzip). All JS: 1.75 MB → 1.86 MB.

Reading it:

- **Medium** (the default on most school laptops): 6–13% faster frames, half the triangles, 24% less to download.
- **Low**: title and live 20–28% faster, half the draw calls (the classic figures are instanced, 4.8). The Player-view
  replay is 0.2 ms slower (1.3 → 1.5 ms, still over 600 frames a second): Phase 2's motion runs for all ten players, and
  the first-person eye now sits at each player's own height, so the shot itself differs a little (4.9).
- **High**: 4–5% faster at the laptop window; at retina resolution flat (0 to +2%, within the spread between runs) after
  paying for SMAA (+3–9%) and the new motion out of the crowd and pass savings. Downloads +13%: the third athlete variant
  is now on court (docs/OPEN-QUESTIONS.md 1).
- **Main chunk** 1,120 → 519 kB; the first load (entry plus the three.js and gym chunk) is 1,166 kB raw / 366 kB gzip
  against 1,120 kB / 332 kB, because the pass added code (finishes, actions, reactions, cloth fit, team colours, the
  instanced figures); the drills now load when first opened.

Reproduce: `node scripts/perf.mjs --label after`, and the baseline the same way from a worktree at ef072c8; then
`node scripts/perf.mjs --compare before-same,after`.
