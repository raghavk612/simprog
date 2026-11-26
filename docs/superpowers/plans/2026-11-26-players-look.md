# Players that look finished and move like athletes: plan

Request (2026-11-26): "also work on simultaneously improving the design of the players and their animations as well".
It runs at the same time as the navigation and page restyle (`ui-ease` / game-nav, another checkout), so this track owns
only the 3D players and their motion: `src/players.js`, `src/materials.js`, `src/clothFit.js`, `src/motion.js`,
`src/finishes.js`, `src/actions.js`, `src/reactions.js`, `src/moves/`, `src/arena/{cast,pose,idle,playback}.js`,
`src/classicBatch.js`, `src/basketball.js` (versioning only), `assets-src/players/`, `scripts/build_players.py`,
`scripts/player_lods.mjs`, `public/models/players/`, the sheet and capture scripts, and their tests. No `src/ui/` work is
planned. If any UI is touched, the project's UI rules apply (tokens, one primary button, plain headings, all 7 locales).

Branch `players-look` (from `ui-ease` d8596d8), checkout `/home/claude/wt/players`.

## Audit (full report: `docs/superpowers/reports/2026-11-26-players-audit.md`)

Before images: `ui-shots/players-before/` (sheets at Medium, git-ignored), `ui-shots/players-before/live/` (Game day
through the UI: Auto camera and close cameras, desktop 1440×900 and phone 390×844, Medium and Low),
`ui-shots/players-before/moves-*.png`, `ui-shots/players-before/motion/`. Evidence crops in the repo:
`docs/players/before/*.jpg`. High reference (M1 Pro): `docs/sheets/after/`.

Top problems, ranked by how visible they are to a judge in five minutes:

1. **The kit is torn.** The jersey has 21–30 boundary loops and the shorts 17–24, where 4 and 3 are right. The result is
   white shards on the hems, slits at the hips that show skin, and a ragged V-neck
   (`docs/players/before/kit-shorts-defender.jpg`, `kit-neckline-face-visitor.jpg`, `kit-hip-slit-dribble-clip.jpg`).
2. **Ten pairs of identical white slippers and no socks.** This shows at every distance (`shoes-no-socks.jpg`,
   `broadcast-medium-desktop.jpg`).
3. **Heads.** The hair reads as a grey rubber cap with a hard line, the skin as waxy red-brown, and the faces are flat
   and all alike (`face-hair-home.jpg`, `face-closeup-sheet.jpg`).
4. **Poses that break the body.** The defender's high hand passes through his face, the defensive stances squat with
   frog knees, and the dribbled ball passes through the thigh (`defender-hand-face-shorts.jpg`, `defense.jpg`).
5. **Stiff body language.** The crossover moves only the ball, and in games the body never does the move `ballsim.js`
   picks. Feet stay flat with no push-off. Reactions do not read at game distance. Between plays the run back starts at
   full speed (`move-crossover.jpg`, `reactions.jpg`).
6. **Readability.** The purple Kangs sit on the purple key in front of purple stands (`broadcast-medium-phone.jpg`).
   On Low the figures are toy-like up close (`low-classic-close.jpg`), and variety is thin (three builds, four hair styles,
   one shoe, plain visitor kits).

Kept as they are: no foot sliding, the shooting form, the finishes, the passes, version 3's paths, and High lighting.

## Global constraints (every task)

- **Old plays replay exactly.** Anything that changes where a player or the ball is (sampleClip) goes behind a new
  `MOTION_VERSION`. Body-pose changes in this plan (Tasks 5 and 6) are also gated by the play's motion version, so a v1–v3
  play looks bit-identical in the gym. Before the first gated change (Task 5), freeze version 3: add `v: 3` clips to
  `tests/golden.test.js goldenClips()`, run `npm run motion:qa -- --freeze` so `docs/motion/qa-baseline.json` holds v3's
  hashes, and save a trace `npm run trace -- --v 3 --out ui-shots/trace-v3.json`. Only then bump `MOTION_VERSION` to 4.
  Never regenerate the golden clips of an older version. Golden "bodies" may be regenerated (`npm run golden:update`) only
  for scenes the commit message names, with the reason. The title and the idle gym have no play version: changes there
  are deliberate, listed in the commit, and trace differences are confined to those scenes.
- **Gates for every task:** `npm test` green; `npm run build`; `npm run motion:qa` passes; `npm run trace -- --v 2
  --compare` and `--v 3 --compare` show identical frames (look-only tasks: the whole default trace is identical, because
  materials and textures are not traced; a geometry rebuild that keeps the bones is identical too).
- **Performance must not get worse at any level.** No new draw calls per player (new looks go into existing meshes,
  materials and atlases), triangles per player stay under the 15k cap (`tests/players.test.js`), Low's instanced draw
  count (169 live, M1) stays the same, and downloads per level grow by at most 5%. Measure back to back with the baseline
  on this machine: `node scripts/perf.mjs --label <task> --levels low,medium --configs laptop --repeat 1` against
  `docs/perf/players-before-cloud.json`. Calls and triangles are machine-independent and are also checked against
  `docs/perf/after.json`. If the M1 is available to the coordinator, High is measured there.
- **TDD for logic.** Pure helpers (kit topology, look tables, shoe zones, clearances, gating) get a failing test first.
  Shader and texture work is checked by eye in before/after sheets, with a number where one exists.
- **Pictures.** Every task saves before/after sheets for the rows it touches (`ui-shots/players-<task>/`), opens them,
  and writes a short critique into its commit message or `docs/realism-log.md` (a new "Players look" section).
- **Browser and render work** goes through `flock /tmp/kangs-browser.lock <command>`; another track shares the machine.
  On this machine use `--level medium` (High does not draw under llvmpipe; see the audit).
- **Git.** Commits and pushes on `players-look` only. Never push `main` or `ui-ease`, never force push. Explicit `git add`
  paths. Commit trailers:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01TJcs3aM2BUb2S8MMdWg1LU`.
- Original work only (no third-party meshes or textures), and nothing new under `public/` that is not built from this
  repo's sources. Credits and AI-disclosure wording are not touched.

## Task 0: Capture tooling that works here (small, first)

Files: `scripts/contact-sheet.mjs`, `scripts/gym-harness.mjs`, new `scripts/players-shots.mjs`, `scripts/kit-topology.mjs`
(or a Python helper beside `scripts/build_players.py`).

- `contact-sheet.mjs --fast`: draw only the captured moments. Wrap `arena.look.render` so the harness's `until()` steps
  without drawing; the simulation, `updateLods` and `Math.random` draws stay the same. A full set at Medium dropped from
  hours to about 15 minutes in the audit.
- `players-shots.mjs`: the audit's live capture (Game day through `toGame`, the Auto camera at fixed moments, close
  cameras on the handler's face, body and feet, on the defender from the front, on a group and a visitor's face), with
  `--levels` and `--sizes desktop,phone`.
- `kit-topology`: the boundary-loop count per kit mesh in a GLB (welded at 2 mm), used by the Task 1 test and the
  report.
- Acceptance: `npm run sheets -- --fast --level medium --out ui-shots/t0` writes all 9 sheets in under 30 minutes here,
  with no cell marked `*`; on the M1, `--fast` and the default give pixel-identical sheets for `closeups` (diff ≤ 1 level
  per channel). `node scripts/players-shots.mjs --levels medium,low` writes the 56 captures. Trace identical (no game code
  changed).

## Task 1: A whole kit: no holes, no shards, a clean neckline

Files: `scripts/build_players.py` (geometry stage: the opening clip, buried-face removal, panel welding), `src/clothFit.js`
(drop workarounds that no longer apply: `trimOpenings` scrap filter, if empty), `public/models/players/*.glb` and
`maps/*` (rebuilt), `tests/players.test.js`, `tests/playerMaps.test.js`, `tests/clothFit.test.js`.

- Find where the extra boundaries come from (first suspects: panels clipped separately and not re-welded, faces dropped
  as "buried" along the side seams, slivers from `clip_openings`). Fix it in the build: weld the jersey and the shorts
  each into one manifold shell before the openings are cut, cut the neck, armholes, hems, waist and leg openings as clean
  loops, and close any remaining loop shorter than 0.2 units with a fan that follows the surface.
- Rebuild all three variants with `--bake` (`pip install xatlas fast-simplification --break-system-packages`; about
  6–8 minutes each, one at a time), then `node scripts/player_lods.mjs`. The UV layout changes, so the maps and
  `manifest.json` uvHash are regenerated together.
- Tests first: per variant, the jersey has exactly 4 boundary loops and the shorts exactly 3 (welded at 2 mm), each
  longer than 0.2 units; LOD1 has the same counts; triangles per player stay under the 15k cap, and the kit's triangles
  stay within ±10% of now; the existing uvHash, tangent and finger-clearance tests stay green.
- Acceptance: the `closeups` rows "jersey trim, shorts hem, legs" and both "defender up close" rows, and the live
  `visitor-face` and `defender-front` captures, show no skin through the shorts, no white shards and a single clean
  V-neck binding, at Medium here and at High on the M1 if available. `aa.png` is unchanged in character. Trace identical
  (same bones). Perf: same draw calls; triangles ±2%.
- If the cloud weld cannot close the side seams without distorting the cloth, use the Houdini fallback (coordinator
  task H1).

## Task 2: Feet and legs: team socks, shoe colourways, a sole you can see

Files: `src/materials.js` (shoe shader zones, sock band in the skin shader), `src/clothFit.js` (shoe zones from the rest
pose, the sock line per variant), `src/players.js` (`lookFor` / `lookKey`: `socks`, `shoe`; the colourway from the
team), `src/kits.js` (team sock and shoe colours, visitors from their school colours), `src/classicBatch.js` (Low: a sock
band and shoe colour on the instanced parts), tests.

- Socks: a crew sock drawn by the skin shader (no geometry) from the shoe collar to a line 0.12–0.16 units above the
  ankle, with a ribbed cuff (the existing triplanar bump), in team white, black or the team colour. Per player: crew,
  mid or ankle; about 1 in 6 wear a leg sleeve over it (that rule already exists).
- Shoes: zones computed once per variant in the rest pose (`shoeZones`: upper, toe box, heel counter, side panel,
  midsole, outsole), coloured in the shoe shader from a 4-colour colourway. Colourways follow the team: home in white,
  purple and gold, or black and purple; visitors in their school colours; at least 3 different colourways on a 10-man
  floor. The midsole gets a visible band; the outsole is gum or dark.
- Tests first: `lookFor` gives each of 3+ colourways and the 3 sock heights over 200 seeds; colourways for a visitor
  come only from that visitor's kit colours; `shoeZones` puts the heel counter behind the ankle and the midsole band
  0.01–0.03 units above the floor on every variant; the Low batch keeps one draw per body part.
- Acceptance: live `feet` and `defender-front` captures and the `locomotion` sheet show socks and coloured shoes; at the
  Auto camera the shoes no longer read as identical white blobs (the mean luminance difference between shoe pixels and the
  floor around them stays ≥ the before value, and the hue varies between teams). Draw calls unchanged at every level.
  Trace identical.

## Task 3: Heads: hair that reads as hair, believable skin, faces with variety

Files: `src/materials.js` (`hairMaterial`, `skinMaterial`, `faceTexture`), `src/players.js` (`SKIN_TONES`,
`CLASSIC_SKIN`, `HAIR_STYLES`, `HAIR_COLORS`, `lookFor`), `assets-src/players/cloudmesh/` (new hair shells),
`scripts/build_players.py` (new hair groups), GLBs and gear maps (rebuilt), tests.

- Hair material: the sheen and environment reflection bring near-black hair down to a dark value (it renders as grey
  today). Soften the hairline with a short gradient into the skin (in the hair shader from head-local height), and add
  strand detail so short styles read as hair, not plastic.
- Two new styles meshed in the cloud like the afro (`cloudmesh`, SDF clumps): a high-top fade and short twists, each
  ≤ 900 triangles, fitted 2–4 mm off the skull, with no faces inside it. The variety goes from 4 to 6 styles. (Houdini
  fallback: coordinator task H3.)
- Skin: re-grade `SKIN_TONES` toward measured skin values (hue 20–35°, less saturated than now) and keep the classic
  tones matched; slightly lower skin specular on the forehead and nose, a little higher on the cheeks; keep the wrap light.
- Face texture v2: fuller brows, an upper lid line and a hint of the eye's white at close range, eyes that look ahead
  (not down), lips with a darker line, and painted facial hair as a look option (stubble, goatee, moustache; about 1 in 4
  players). The face changes per person, as now.
- Tests first: `lookFor` facial hair rate 15–35% over 500 seeds and new styles both used; the face marks stay inside the
  head bounds (existing test) for the new parameters; new hair meshes ≤ 900 triangles each with 0 faces buried in the
  skull; the 15k cap holds for the worst look (afro + headband + both sleeves).
- Acceptance: `closeups` row "face and dribble hand" and the live `face-handler` and `visitor-face` captures: the hair is
  dark with a soft hairline, the skin is no longer red, and two players next to each other look like different people. A
  measured number: the mean hair luminance in the face crops drops by ≥ 30% from before. Draw calls unchanged; triangles
  per player ≤ cap; High downloads +≤ 5% (gear maps). Trace identical.

## Task 4: Readable at gym distance; variety; a better Low figure

Files: `src/materials.js` (a rim term in the kit and skin shaders per level), `src/kits.js` and `src/players.js` (visitor
wordmark and side panel; build variety), `src/classicBatch.js` and `players.js classicBody` (Low shapes), tests.

- Rim light: a view-dependent rim term on kit and skin (Medium and High; off on Low and on LOD1), tuned so the purple
  Kangs separate from the purple key and the stands. No extra light or pass.
- Visitors: a school wordmark across the chest in the plain lettering (`kitLettering` already prints the name and
  number) and a side panel in their second colour. The Kangs' kits stay as designed.
- Build variety: a per-person shoulder and arm girth within ±4%, applied as a scale that the IK reads (`rest()` measures
  bone lengths, so only girth axes are scaled), so three variants make about nine builds.
- Low: tapered limbs and a shaped torso for the classic figure (capsules and lathe shapes), skin-coloured hands, a hair
  cap in the person's hair colour and team socks, still one instanced mesh per body part.
- Tests first: rim term off on Low and LOD1; the visitor wordmark appears only for visitors and fits the decal box;
  build scales stay within ±4% and leave bone lengths untouched; Low still draws one mesh per part (draw count
  unchanged) and its triangles grow ≤ 20k a frame.
- Acceptance: on the `broadcast` sheet and the live Auto captures (desktop and phone), a mask-based measure: the
  luminance contrast between Kangs player pixels and a 6-pixel ring around them rises by ≥ 25% from before. Low close-up
  `defender-front` reads as a person in a kit. Perf: no new draw calls at any level; Medium frame time within the run's
  spread. Trace identical (Low's trace records instance matrices: unchanged if the parts keep their transforms; any
  change is listed).

## Task 5: Poses that respect the body (motion version 4 gate)

Files: `src/basketball.js` (`MOTION_VERSION` 4: the same positions as v3, plus a flag the pose reads), `src/arena/pose.js`
(pass the play's version to `animateAthlete`), `src/motion.js` (self-collision, stance, dribble clearance, foot roll),
`tests/golden.test.js`, `docs/motion/qa-baseline.json`, `tests/motion.test.js`.

- Freeze version 3 first (see the global constraints); then version 4 is version 3's movement, and the body fixes apply
  only when the play's version is ≥ 4 (and on the title and idle gym, listed).
- Hands out of the head and torso: after the arm targets are set, a target inside a sphere round the head (radius 0.15
  units from the head bone) or a capsule round the torso is pushed out along the shortest way, before the arm IK. The
  on-ball high hand keeps its reach toward the man.
- Defensive stance: knees track over the feet (a small toe-out with the hip abduction), the stance about 1.2–1.4 × the
  shoulder width and the hips lower rather than the knees wider.
- Dribble clearance: the ball keeps ≥ 0.02 units from the thigh and shin capsules. The dribble side pushes out from the
  near leg when the swing would cross it (in `motion.js dribbleWrist` for v4 and the moves' `stage.js`).
- Foot roll: late in stance the heel lifts and the foot pivots on the ball of the foot (the shoe's toe point from
  `clothFit`). The toe point stays planted (world drift ≤ 0.01 units through stance), and the ankle carries the
  rotation. No new bones.
- Tests first: over the golden body scenes and 200 seeded v4 plays, wrist-to-head distance ≥ 0.15 units and no hand
  inside the torso capsule; knee-over-foot angle ≤ 15°; ball-to-leg clearance ≥ 0.02 units; toe drift ≤ 0.01 units.
  v1–v3 golden clips and bodies unchanged; new v4 body scenes added.
- Acceptance: `defense` and `closeups` sheets (defender rows) show the high hand out in front of the face and knees over
  the feet; the dribble rows show the ball beside the leg; the `locomotion` sprint shows heels coming up. `motion:qa`
  passes with v4. `npm run trace -- --v 2` and `--v 3 --compare ui-shots/trace-v3.json` identical. Perf: within spread
  (the checks are a few vector operations per player).

## Task 6: Body language with the ball and after the play (motion version 4)

Files: `src/moves/*.js` (crossovers, between, behind: body tracks), `src/moves/check.js` (new measures),
`src/arena/playback.js` and `src/arena/pose.js` (in a v4 play, the handler performs the move `ballsim.js` chose, through
`moves/stage.js`), `src/ballsim.js` (expose the move's timing to the pose; no change to where the ball goes for v3),
`src/reactions.js` (bigger, longer, team reactions), `src/arena/idle.js` (run back with limited acceleration), tests.

- Moves with a body: in the crossover, between-the-legs and behind-the-back, the hips drop 6–10 cm, the handler pushes
  off sideways with the outside foot, the shoulders dip toward the new side, the off arm guards, and the eyes stay up.
  This shows on the title (deliberate, listed) and, for v4 plays, in games whenever `ballsim.js` picks a change of hands.
- Reactions that read at the Auto camera: after a make, the nearest one or two teammates jog to the scorer for a high
  five or a chest bump (two-player performances placed so the bodies do not overlap: `motion.js SPACE`). The beaten
  defender's hands on hips and the miss's head shake are larger and held about 0.8 s. A dunk gets the flex plus a
  teammate. This is v4 only, in the time the play already has after it is resolved. The UI and score-reveal timing do
  not change (existing tests).
- Between plays: the run back accelerates (about 4–6 m/s²) and brakes instead of starting at full speed (`idle.js`).
  There is no play version here; the change is deliberate and its trace differences are limited to idle frames.
- Tests first: `moves:check` gains pelvis drop ≥ 0.06 units, a lateral step ≥ 0.15 units and a shoulder dip for the three
  moves (the test fails on today's data); in v4 plays where `ballsim.js` picks a move, the handler's hand is within reach
  of the ball through it (`motion:qa` ball-to-hand, unchanged limits); `reactionsFor` assigns the high five to a teammate
  within 4 units, and two-player performances keep the bodies ≥ `SPACE.contest` apart; idle run-back acceleration
  ≤ 6 m/s².
- Acceptance: `moves:sheet --move crossover`, `--move betweenLegs` and `--move behindBack` after sheets show the dip,
  the push and the shoulder; the `reactions` sheet's rows read at sheet scale; a live Auto capture after a made basket
  shows the high five. `motion:qa` passes (v1–v3 bit-identical, v4 within every cap). Trace `--v 2` and `--v 3`
  identical. Perf: the move sampling and the extra performances are per frame for at most 3 players; frame time within
  spread.

## Order and review

Tasks 0 → 1 → 2 → 3 → 4 are look work on the model, materials and textures; none changes motion, and each is reviewable
on its own with identical traces. Task 5 brings in the version 4 gate; Task 6 builds on it. Each task ends with its
before/after sheets, its tests, the perf line against `players-before-cloud`, and one commit (or a few small ones) on
`players-look`, pushed.

## Coordinator tasks (Houdini 22 Apprentice on the user's Mac, OBJ export)

None is needed to start: the cloud pipeline covers Tasks 1–4. These are fallbacks or stretch work. Each uses
`~/coding/kangs-assets/houdini/build_players.py` and `kangs_players.hipnc` (the repo copies are
`assets-src/players/houdini/`) and exports one OBJ per variant (`kangs_guard.obj`, `kangs_forward.obj`,
`kangs_center.obj`) with the same named primitive groups as now (`core arm_L arm_R jersey shorts shoes hair_buzz
hair_crop hair_afro hair_rows headband sleeve_arm sleeve_leg`, plus any new group below), in metres, y up, +z forward,
feet at y = 0. Copy, do not move, into `assets-src/players/houdini/export/`, and report md5s.

- **H1 (fallback for Task 1): closed kit shells.** Re-export with `jersey` and `shorts` each one connected, manifold,
  closed shell (0 boundary edges after a 2 mm weld) and the side seams welded. Face counts within ±10% of now (jersey
  about 3,000, shorts about 2,600 faces per variant). No change to `body_shapes.json`, so the bake still lines up.
- **H2 (stretch for Task 3): neck and trapezius.** In `body_shapes.json`, a trapezius pad from the neck base to the
  acromion that raises the shoulder line about 12 mm, and the neck radius 65 → 72 mm entering behind the jaw (the
  heads plan's landmark). Rebuild all three variants; `core` grows by at most 300 faces; head groups unchanged. A full
  re-bake follows in the cloud.
- **H3 (fallback for Task 3's hair): two hair shells,** only if the cloud meshes look blobby. Groups `hair_fade` (a high
  top fade: about 25 mm on top, faded to skin at the sides and back below the temple line) and `hair_twists` (short
  twists, 30–40 clumps about 12 mm across, 25–35 mm long), each ≤ 900 triangles, closed, 2–4 mm off the skull of each
  variant, nothing inside the skull, hairline matching the existing styles at the forehead and over the ears.
