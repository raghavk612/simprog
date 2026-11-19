# Realism pass: log

The running record of the realism pass (brief: [REALISM-BRIEF.md](REALISM-BRIEF.md)): what changed, why, what it measured,
and an honest critique of the images after each step. Decisions made without the owner are marked **Decision**.
Branch: `realism-pass`. Numbers: [perf-baseline.md](perf-baseline.md). Sheets: `docs/sheets/before/` and
`docs/sheets/after/`.

## Phase 0: baseline (no behaviour changes)

### Audit claims, checked

| Claim | Found |
|---|---|
| 291 tests pass | Yes (291, ~2.2 s). |
| No AnimationMixer; sampleClip + animateAthlete | Yes. |
| arena.js is ~1,900 lines and owns everything | 1,904 lines: renderer, lights, court, crowd, players, ball, loop, cameras, title. |
| Visitors always orange | Yes: `setIdentity` uses `#db7536` for every visitor (arena.js). Bothell shows orange in the sheets. |
| Skin tone and face follow the slot | Yes: `SKIN_TONES[i % 7]` and `faceTexture(tone, i)` with `i` the body slot (players.js). |
| Height from position class | Yes: `variantFor(position)` picks guard/forward/center; roster height is not read. |
| Athletes `frustumCulled = false` | Yes, every mesh (players.js). |
| ~46 per-frame allocations in motion.js | 46 `new THREE.*` / `.clone()` sites, most of them per frame per player. |
| Ball trail re-runs sampleClip 8× a frame | Yes (arena.js, the `trail` loop), and a block runs sampleClip recursively inside sampleClip. |
| Auto quality steps down once | Yes: one probe, `lowerLevel` once (High → Medium). Nothing reaches Low automatically. |
| ~2.4 M triangles a frame on High; crowd casts shadows | Measured 2.44 M on the title, 585 draw calls; `crowd: 'full'` casts shadows on High. |
| 15.8 MB of player assets on High | Measured 15.75 MB for the whole High session (10.75 MB PNG maps + 3.11 MB GLB). Medium 13.28 MB: the kit and gear atlases are fetched at the same size as High. |
| Main chunk 1.12 MB / 333 kB gzip | 1,120 kB / 332 kB gzip. |
| PLAYER_STYLES dead | Defined in players.js, used nowhere. |
| src/moves only on the title | Only arena.js imports it (titleShow). |
| visual-overhaul README outdated | Yes: describes primitive players with no skeleton and a 3.9 MB dist. |
| Houdini source at /Users/raghav/coding/kangs-assets | Not on this machine. **Decision:** visual fixes that would need a re-bake are done in shaders, geometry processing in Node, or skipped and logged. |

### Tools added

- `scripts/gym-harness.mjs`: serves the game (dev or built), opens it in Chrome with a save and graphics settings, stops
  the animation loop and steps `arena.frame()` at a fixed 1/60 s with seeded `Math.random`, so runs are repeatable.
  **Decision:** the built game exposes `window.__kangsArena` when opened with `?perf` (it already did in dev builds), so
  the measurements run on what ships. Nothing else changes for players.
- `scripts/perf.mjs` (`npm run perf`): frame cost median/p95 (CPU + GPU, synced by a 1-pixel readPixels, so not capped at
  60 fps), draw calls, triangles, JS heap, bytes on the wire per level, and chunk sizes. Two window sizes (school laptop
  1366×768 at 1×, MacBook 1440×900 at 2×), three scenes (title, live possession, replay close-up), three levels.
  **Decision:** headless rAF frame rates are capped by vsync and would hide every improvement; stepping and syncing gives
  a number that moves when the work moves.
- `tests/golden.test.js` + `tests/golden/poses.json` (`npm run golden:update`): sampleClip hashed at 23 moments for 162
  plays (13 kinds × 2 teams × made, missed, three kinds of block, steal, plus open/tight and after-steal variants), and
  animateAthlete's every bone for 8 driven scenes (guard, forward and center; shooter, defender, help, putback, steal,
  screen). Plays without a motion version are frozen: an update that would change one fails.
  Found while building it: three.js draws `Math.random` for object ids while bodies are built, so the idle clock seed
  (`motionState.t`) depended on load order. The test reseeds right before each scene.
- `scripts/contact-sheet.mjs` (`npm run sheets`): real plays staged in the gym, captured at fixed moments. A follow camera
  at a fixed offset (picked among 24 directions to keep other players out of the line of sight and the camera inside the
  gym); the broadcast and replay rows use the game's own director. Sheets: finishes, jumpers, passes, defense,
  locomotion, reactions, broadcast, closeups, aa (1:1 pixels).

### Bug found: black frames with the broadcast look

While making the sheets, some captures were completely black. Measured in the raw scene render (half-float), 15 of 1,200
frames had NaN pixels (3–5 pixels each) from low camera angles near players. Bloom averages every pixel into its blur
chain, so one NaN turns the whole frame black: a one-frame black flash in the game, most likely on the low sideline,
baseline and replay cameras. Cause: `kPerturb` in `src/materials.js` (the triplanar bump detail on skin, kit, shoes and
hair) normalises the screen-space derivatives `dFdx/dFdy(surf_pos)`, which are zero on degenerate pixel quads; the
direct lights hide the NaN (`saturate`), the environment light's reflection lookup does not (it went away with
`scene.environment = null`). Guarding the zero derivative removes every NaN pixel (0 of 1,200 frames). The fix is the
first commit of Phase 1, so the baseline stays the original code; the "before" sheets were captured with a retry (cells
marked `*` needed one).

### Before sheets: critique against the checklist

- **Airplane arms** (defense.jpg, closeups.jpg): every off-ball defender and the on-ball defender hold both arms straight
  out to the side at shoulder height, the same pose whatever the play, on every defender at once. The most "video game"
  thing on screen at broadcast distance.
- **Finishes** (finishes.jpg): layup, euro, floater, hook, spin and roll read as the same jump: the arms go up in the
  shot preset and the legs tuck, the take-off has no gather steps, no one-foot plant, no knee drive; the euro has no
  lateral step; the spin has no spin; the landing is a plain drop onto both feet. Dunks rise to the rim but the arm does
  not reach over and down through it and there is no rim hang. The jump shots (jumpers.jpg) are much better (the title
  jumper's form).
- **Passes** (passes.jpg): the passer's arms switch to a static chest-pass preset; no step, no wind-up, no follow-through;
  the receiver's hands do not come up to the ball before it arrives. The steal is the defender's ball simply changing
  owner: no reach.
- **Locomotion** (locomotion.jpg): one stride for every speed; the cutter and the help defender slide on the same
  pattern; off-ball players sway on sine waves in place; no start/stop lean.
- **Reactions** (reactions.jpg): after a make or a dunk everyone simply carries on; no celebration, no dejection.
- **Close-ups** (closeups.jpg): the dark arm sleeve shows skin through it in blotches; skin shows through the shorts at the
  hips; the white neck and armhole trim is fuzzy and uneven; hands are spread mitts that rest on the ball rather than
  grip it. Faces read fine at this distance (stylized).
- **Aliasing** (aa.png): at 1× the court lines, the rim, the bleacher rails and the players' silhouettes stair-step; the
  broadcast look renders into a target with no multisampling and no FXAA/SMAA.
- **Weight and balance**: on-ball defence and the dribbler are crouched and planted (good); the transition run and the
  sprint keep the feet planted (the stride is tied to distance). Jump arcs are real gravity arcs.
