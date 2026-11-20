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

## Phase 1: cheap, high-visibility wins

### 1.1 Black flashes (NaN normals)

See phase 0. Committed on its own: `kPerturb` guards zero derivatives; `tests/materials.test.js`.

### 1.2 Anti-aliasing in the broadcast look

The canvas has MSAA, but with the broadcast look everything is drawn into the composer's half-float targets, which had
none, and no FXAA/SMAA pass: every edge stair-stepped (docs/sheets/before/aa.png). Three options measured on the built
game (frame median, ms; one run each, the same build):

| | laptop High live | laptop Medium live | retina High live | retina Medium live |
|---|---|---|---|---|
| none | 11.1 | 6.3 | 22.1 | 9.4 |
| 4× MSAA on the composer targets | 15.0 (+35%) | 8.9 (+41%) | 32.4 (+47%) | 14.2 (+51%) |
| FXAA after the output pass | 11.0 | 6.5 | 21.8 | 9.1 |
| SMAA after the output pass | 10.8 | 6.5 | 22.6 | 9.6 |

MSAA resolves on every post pass and would break the 10% rule. **Decision: SMAA on High and Medium.** Critique of the 1:1
crops (scratch comparison, 2× nearest): without AA the three-point arc, the lane lines and every silhouette stair-step;
FXAA smooths them but visibly softens the jersey numbers and the "WASHINGTON" lettering on the apron; SMAA gives clean
lines with the lettering still sharp. Its search and area textures are embedded in three's SMAAPass, so it works offline.
Low already uses the canvas MSAA (no composer).

### 1.3 Defensive stance (no more airplane arms)

Every defender held both arms straight out to the side at shoulder height (a fixed Euler preset), on every defender at
once. Replaced in `motion.js` by hand targets placed with the existing arm IK (`DEFEND`, `defendArm`), sized by each
body's arm length: on the ball, the hand on the ball's side low and out front tracing the dribble (it drifts toward the
ball and works on a quick beat), the other up at face height in the passing lane; in help, both hands in front at the hips
just outside the shoulders ("pistols"); elbows down. The blend between the two follows the distance to the ball (on-ball
inside 2.0 units, help beyond 3.2), eased, and the hands ease between targets, so nothing snaps when a defender's role
changes. The contest preset's second arm goes up beside the first instead of out wide. The classic (Low) figure gets the
same idea in its Euler preset (one hand up, one low, both in front).

Iteration: the first help stance still flared the arms wide (hands 0.22 outside the shoulder line, elbows pointed out);
the second pulls the hands in to just outside the shoulders at hip height with the elbows down and back. The low hand's
drift toward the ball now applies only on the ball (in help it pushed one hand out). Critique of the crops: the help
defenders read as engaged and balanced, the on-ball defender (from behind, close-up row) shows the classic one-up
one-down stance. `tests/motion.test.js` pins the geometry for the guard and the center. Golden bodies regenerated on
purpose (the defender scenes); golden clips unchanged.

### 1.4 Visitors in their colours; skin, face, body and height follow the person

- **Colours.** Every visitor wore `#db7536` orange. There are no school colours in the data, but there is a logo for each
  of the 13 opponents (supplied by the team, cleared). `scripts/team-colors.mjs` reads them (a small PNG decoder over
  zlib, no new dependency) and writes `src/teamColors.js`: the dominant saturated hue and a second colour. **Decision:**
  colours from the schools' own logos rather than from memory (a wrong guess would be worse than orange). `visitorKit`
  (`src/kits.js`) dresses them in that colour with white or dark lettering; when it would be mistaken for the Kangs' kit
  (CIE76 ΔE under 42: Bothell's royal blue and North Creek's indigo against the purple, Issaquah's purple) they wear road
  whites lettered in their colour; a school with no logo gets a classic colour picked by its name. Tested against every
  opponent and every Kangs kit (distance and a 3:1 lettering contrast).
- **Skin, face, hair.** Skin tone and the face's variations came from the body slot (`i % 7`), so a player changed skin
  when he was drawn in another slot. They are now part of `lookFor(seed)` (with the hair), and the seed is the roster id
  for the Kangs and the name for visitors (`personSeed`; visitor ids are only their slot). The classic figure recolours
  its skin (`setSkin`) from a matched lighter palette (`CLASSIC_SKIN`): the athletes' tones are tuned for the skin shader.
- **Bug fixed: everyone was a forward in live play.** A play's lineup carries only id, name and number, so `setIdentity`
  lost the position and every Kangs player became the forward body during games. `rosterRecord` (`identities.js`) fills
  in position and height from the roster.
- **Height.** The variant follows the position unless the roster height is more than 3 in from that model, then the
  model nearest it; the player is scaled to his height within ±5% (`bodyFor`). **Decision:** not more than 5%, because the
  play puts the ball at a fixed height at the jump shot's release and a smaller body could not reach it; for the same
  reason the ball a player holds and his shot hands are drawn scaled about his feet (presentation only, the play's ball is
  untouched), and the stride is measured in his body's units so feet stay planted. Visitors (no heights on their rosters)
  get a variant and a height within 2 in of it from their name.

Critique (broadcast, close-up and title captures): Bothell in road whites with royal-blue lettering reads as a real road
kit and is never confused with the Kangs; Redmond in green on the title; the Kangs' guards (5'10"-6'0") stand visibly
shorter than the 6'5" forward. Low: the classic figures keep lighter tones, their heads read dark from behind only
because of the hair cap. Golden clips and bodies unchanged (scale 1 in the golden scenes).

### 1.5 Dead code and outdated docs

Removed `PLAYER_STYLES` (players.js, never used), `disposeAthleteTemplates` (players.js, never called) and `moveById`
(moves/index.js, never called). `docs/visual-overhaul/README.md` said the overhaul was half done on a branch and its audit
described primitive players as current: it now says it is done and merged, points to where today's players, motion and
look live, and labels the audit as history. Found but left alone (outside the 3D work, or in the engine, which this pass
does not touch): unused exports `drillName` (drills.js), `questionText` (press.js), `pairTeamLogos` (teamLabels.js),
`interrupt` (a11y.js) and `KIT_UNLOCKS` (engine.js).

### Phase 1 gate

`npm test` 300 passing, `npm run build` succeeds, golden clips unchanged. Measurements and the "after Phase 1" image
review: see the Phase 1 perf run below.

## Phase 2: motion

### 2.1 Locomotion

One stride pattern served every speed (half the cycle planted, half swinging) and the stride grew to 1.5 units at a
sprint, which put the planted foot out of the leg's reach at both ends of the stance: measured with a guard driven at
constant speeds, the planted foot slid 28% of the body's travel at a walk and about 35% at a run. Now (`motion.js`):

- `gaitFor(speed)`: stride up to 2 units at a sprint; a **duty factor** (the part of the cycle a foot is planted) from
  0.62 at a walk (both feet down in between) to 0.32 at a sprint (a flight phase with both feet up); heel lift, pelvis
  bob, arm swing and elbow bend (loose at a walk, a 90° pump at a sprint) and forward lean all follow speed.
- `fitGait`: a planted foot can only be as far from the hip as the leg reaches at the hip's height (no toes to roll
  over), so running shortens the stance (more flight) and walking takes quicker, shorter steps for each body.
- `gaitBob`: the pelvis vaults over the planted leg at a walk and sinks into the stance and rises through the flight at a
  run.
- The pelvis twist turned each leg's plane with it, which pushed a planted foot sideways (0.05 units over a stance):
  foot targets are now taken from the twisted hip in the pelvis's frame.
- Acceleration lean (into a start, back on a stop), banking into turns (more the faster he runs), the stride fading into
  the standing stance as he slows (no snap when he stops), a weight shift that is not a pure sine, and breathing that
  deepens after a hard run.

Measured after (mid-stance, guard and center): under 1% of the travel at a walk, 1–3% at a run; the last tenth of a
sprint stance (toe-off at full extension) reaches about 9%, invisible at broadcast distance. Pinned by
`tests/motion.test.js` (under 5% at 1.2, 3, 5 and 7 units/s for the guard and the center). Golden bodies regenerated on
purpose (every scene moves differently); golden clips unchanged. Image check (locomotion sheet): the defender's run in
the drive row is long and low with bent, pumping arms; the off-ball cutter's jog is shorter and upright.

### 2.2 Refactor: blockPlan (behaviour-preserving)

Everything about a block that does not depend on the moment (the contact, the swat, the scramble's winner and loser and
where they meet the ball, the putback's timing, the blocker's hand) moved out of `sampleClip` into `blockPlan(c,
release)`, cached per play and release point (a jump shooter's release follows his feet until he is set, so it is part of
the key); the "same play unblocked" sample it needs is cached per play. `sampleClip` now runs that recursion and the
40-step bisection once per play instead of every frame: 23 µs per block sample against 16 µs for a plain one (it was
more than double). Golden clips identical (162 plays × 23 moments). It also gives the finishes (2.3) the putback's
timing and winner without repeating the arithmetic.

### 2.3 Finishes

Every finish except the jump shots was the same jump with one static arm preset and a generic leg tuck. New
`src/finishes.js`: each finish authored in the shooter's frame in seconds from his release (which the play's
`shotTiming` places), mirrored for a left-handed finish (the hand away from the defender), and fed through the existing
`ctx.perform` path (world-space hand targets with palm normals, elbow poles and wrist flex), plus body cues (lean, side,
a pelvis drop for the gather and the landing), named leg shapes in the air (`AIR_LEGS` in motion.js), a turn added to the
facing and, for the euro and the dunk, where he is drawn. **Decision:** finishes are presentation only and leave
`sampleClip` untouched, so no version field is needed for them: the held ball is drawn on the finish's path, blended in
from the play's dribble at the gather and landed exactly on the play's release point at the release, and the flight that
follows is the play's own (the test holds it to within 0.09 units and never more than 0.25 a frame).

- **Layup:** two hands secure it at the hip on the gather, a dip to load, the knee on the shooting side drives up, the
  ball comes up under the shooting hand to full extension, the off arm comes off to shield; the follow-through holds on
  the way down, the landing is absorbed.
- **Euro step:** the layup with a long step to one side on the gather and a second one back across (the body leans into
  each).
- **Floater:** upright, two hands to the forehead, a soft one-hand push released high.
- **Hook:** turns side-on (the off shoulder to the rim), the off arm up to shield, the ball swept from the hip out and over
  the head.
- **Spin move:** a full turn on the gather with the ball at the chest, into the layup. **Decision:** the first version
  spun and then turned into the hook, but gather to take-off is only 0.45 s, too short for both (the keyframes ran
  backwards and the ball jumped 0.5 units in a frame).
- **Dunk / alley-oop:** a two-foot power load, the ball cocked behind the head with both hands (caught overhead on the
  lob), thrown down; he is drawn 0.28 higher than the play's jump so his hands reach over the rim, both hands go to the
  front of the rim and he hangs 0.18 s, then falls under gravity from there and absorbs the landing. A blocked dunk never
  hangs (the test caught a crash there: the dunk had no follow-through for that case).
- **Roll:** a two-hand power layup off two feet. **Putback:** the winner of the loose ball (from `blockPlan`) dips to
  gather and goes straight up off two feet.

Critique of the finishes sheet (crops at full size): the layup reads at once (pocket, knee drive, full extension, held
follow-through); the dunk's load and the hang on the rim are clear from the sideline; the hook turns the chest to the
camera with the ball low at the hip, then both arms up at the release. Weak spots left: the gather steps are not
choreographed (the gait carries him in, so the take-off foot is not always the one opposite the knee drive), and the
alley-oop's lob is not a real pass (the play has none).

### 2.4 Passes, catches, steals, rebounds, contests

New `src/actions.js`, the same presentation-only performance path as the finishes:

- **Pass:** the passer leans and turns into it; once the ball leaves, both hands follow through toward the receiver (arms
  long, thumbs turned down); the dunk's outlet is a two-hand overhead throw. **Catch:** the receiver's hands come up to
  give a target and meet the ball before it arrives (until then the passer held a static "chest pass" preset and the
  receiver's hands only found the ball once it was in reach).
- **Steal:** the defender lunges (lean 0.32, dip) and pokes the near hand at the ball; the player he took it from
  straightens and turns to chase instead of dropping into a defensive stance.
- **Rebound:** a box-out (low, hands wide at the hips) as the shot comes off the rim, then a two-hand rise to the ball with
  a small hop and the knees tucked.
- **Contest:** instead of both arms held straight up for 1.5 s, the on-ball defender's hand nearest the shot rises over
  the last 0.35 s to a point in the shot's path just short of the ball (a contest, not a foul) at the moment a block
  would meet it, the other hand up beside it, and both come down as he lands; the help defender's is smaller. A block
  keeps its own swat (basketball.js blockHands).

Critique (passes and defense sheets): the outlet passer's overhead follow-through and the steal's lunge read at once; the
contest now has a beat (hand up as the shooter gathers, full reach in the air with him); the rebounder visibly boxes out,
then goes up for it with both hands. Bugs caught by the new tests and fixed before committing: the passer's action was
still emitted at zero weight for the rest of the play, and the contest's rise was timed in clip fractions where seconds
were meant (it started 0.8 s early).

### 2.5 Off-ball movement, behind a motion version

The off-ball offense drifted the whole play on a slow sine around its spots (never still, never going anywhere: it turned
out to be a half-cycle drift rather than a fast wiggle), and the defenders shadowed that drift. This is decided by
`sampleClip`, so it is gated: **`MOTION_VERSION = 2`** (basketball.js), stamped by the engine on every new play as `v`
(`makePlay`; no random draw and no effect on the outcome; `validSave` accepts it and rejects anything but a small
integer). A play without `v` (every play recorded before) samples exactly as before (golden clips, 162 plays × 23
moments, unchanged); version-2 plays have their own new snapshot section.

Version 2 (`offBallV2`): each off-ball player holds an athletic stance at his spot and moves at a moment of the play with
an ease-in-out move between holds: the cutter's hard basket cut off a plant and curl to the dunker spot; the wing filling
the corner as the drive comes, then crashing the weak-side board after the shot; the slot's jab in and pop out wider for
an outlet, then to the free-throw line on the shot; a safety (when the play does not use him) stepping along the arc and
getting back toward half court as the shot goes up. They watch the ball. The defenders take their guard spots on these
moves, so help and recovery follow; on the catch-and-shoot the shooter's man sags into help and closes out as the ball
swings to his man (a sprint, then chopping steps). Tests: holds and bursts, version 1 never still, version 2 still over
40% of the play, the closeout.

Critique (broadcast sheet): the floor reads as spaced with players set rather than milling; the crash after the shot pulls
bodies to the rim the way a real possession ends. Stills cannot show the burst of the cut; the test checks it (four times
the ground covered mid-cut than at its start).

### 2.6 Reactions

New `src/reactions.js`: after a play is decided, a fist pump (a basket, a block), the arm raised and held (a three), a
flex with both fists and eyes up (a dunk), the passer clapping (an assisted basket), the beaten defender with hands on
hips and eyes down, a missed shooter shaking his head. Each is a short performance that eases in and out, kept by player
rather than slot (bodies are re-ordered between plays), applied only when nothing else moves his arms, so it plays over
his jog back. **Decision:** no free-throw routine (the game has no fouls, so no free throws) and no 3D huddle (timeouts
pause the gym under a dialog); both logged as not applicable rather than invented. The reactions sheet now uses close
follow cameras (the far fixed ones made the reactions too small to judge). Image review of the new reactions sheet is
still to do (see "Where this pass stopped").

## Where this pass stopped (usage limit)

_History: the pass resumed from here and finished every item below (Phases 3–5 follow)._

Done and committed: Phase 0 (harness, golden poses, sheets, baseline), Phase 1 (NaN black flashes, SMAA, defensive
stance, visitor colours and person-driven bodies, dead code and docs), Phase 2 items 2.1–2.6 (locomotion, blockPlan
refactor, finishes, passes/catches/steals/rebounds/contests, off-ball motion version 2, reactions). Tests: 308 passing,
build green.

Not done yet:
- Phase 2 gate: re-run `node scripts/perf.mjs --label phase2`, review the reactions sheet, regenerate all sheets.
- Phase 3 (trim and hems, shorts drape, hands and grip, close-up lighting), Phase 4 (crowd shadows and impostors, pass
  reduction, athlete frustum culling, motion.js allocations, ball-trail sampling, multi-step auto quality, map
  compression or lazy loading, chunk splitting), Phase 5 (arena.js split, docs, "after" sheets under docs/sheets/after,
  after numbers in docs/perf-baseline.md, the final report).
- Known costs to recover in Phase 4: SMAA (+3–9% on High/Medium), player-map downloads up 2 MB since all three variants
  are now used.

### Phase 2 gate

Tests 308 passing, build green, golden clips for unversioned plays unchanged. Reactions sheet reviewed: the three's raised
arm holds clearly; the beaten defender's hands on hips read; the dunker's flex was blocked by the finish (its
performance outlived its own fade) and now plays on the run back (fixed in its own commit). Measured (`phase2` against
`before`, frame median): High +2–6%, Medium +6–10%, Low within ±15% of a 1.3–2.7 ms frame (noise at that size). Of that,
SMAA (phase 1) is 3–9% and the new motion about 0.2 ms; Phase 4 has to pay it back with interest.

## Phase 3: visuals

### 3.1 Bindings and skin through the clothes

Up close (chest camera, 1.1 units): the white binding round the neck and armholes was a thick tube with a zig-zag edge
that kinked into flaps at the shoulders and broke into segments where it dipped under the jersey; skin showed through the
arm sleeve at the elbow and its top edge, and through the shorts at the hips. No Houdini source here, so new
`src/clothFit.js` works on the loaded meshes once per variant (about 60 ms each at load, cached on the template; the far
mesh shares the near mesh's vertices and gets copies):

- **Skin under the clothes** (`kCover`): a short ray out along each skin vertex's normal must hit the jersey, shorts or a
  sleeve lying over it and facing the same way, away from any opening (judged from the binding tube, which runs round
  every opening); the skin shader (`materials.js`, `cover`) does not draw skin wholly under clothing the player wears
  (sleeves are switched per player). Only torso and thigh skin can be under the kit: in the rest pose the hands hang
  beside the shorts with their palms toward them, which a first version marked as covered (a hole in the forearm).
- **The binding**: welded within 1.5 mm (its panels meet with gaps) and Taubin-smoothed, which relaxes the kinks without
  shrinking it, and pushed out 2 cm instead of 1 so it rides on the jersey (pushed out 1.2 cm) instead of dipping under
  it. Tried and dropped, with the reason: painting the binding flat from a per-vertex distance (sawtoothed on the
  jersey's coarse triangles); finding the openings from the meshes' topology (their edges split into 5 to 16 fragments
  per jersey); plain Laplacian smoothing (it shrank the tube into the jersey); smoothing the sleeves' rims (their inner and
  outer shells pulled against each other and the rim got worse).

Critique (close-ups): a continuous binding with a clean V at the neck and all the way round the armholes, no flaps; the
road whites' blue binding reads like a real kit; no skin through the sleeve or at the hips. Still visible: the binding is
a little faceted, and the sleeve's top rim still zig-zags slightly against the shoulder (a modelling fix).

### 3.2 Hands and grip

The hand is a rigid mesh on the wrist with no finger joints (17-bone rig), so it hung as a flat, spread mitt in every
situation. **Decision:** no new bones (the brief's default); the skin shader curls the fingers instead: `handFit`
(clothFit.js) finds each wrist's bone, the knuckle line about 45% of the way from the wrist to the fingertips and the
fingers' length; the vertex shader (`materials.js`, `hands`) turns the vertices below the knuckle line toward the palm
about its front-back axis, more toward the tips (a smooth arc, like three joints bending together), before skinning.
`animateAthlete` sets each hand's grip every frame: relaxed 0.35, open on defence, spread on the dribble, wrapped round a
ball he holds (0.42), or as a performance says (a fist for a fist pump or a flex, flat for a clap). Critique (hand
close-ups): a relaxed hand now has naturally bent fingers; at the release the guide hand's fingers wrap the ball's side.
Not possible without finger joints: separate fingers (a thumb that opposes, a pointing finger).

### 3.3 Shorts that move

The shorts were rigid shells. The kit material now sways the shorts' lower half (`materials.js`, `sway`): nothing at the
waistband, all of it at the hem, by a damped spring (`motion.js`, about 1.9 Hz, lightly damped) pushed by the body's
acceleration, so they lag a start, swing on a stop or a cut and flutter on a landing. The jersey's tucked-in lower edge
lies inside the same range and moves with them (they share the material), so the waistband never parts.

### 3.4 Close-up lighting and materials

Reviewed at the replay camera and the orbit-zoom distances (closeups sheet): skin, kit sheen and the glossy floor hold up;
the face is a painted stylized face, which suits the art direction; depth of field on the replay camera pulls focus to
the ball in flight as designed. Nothing changed here. Remaining close-up weaknesses (for the final report): the sleeve's
top rim zig-zags slightly, the binding is a little faceted, fingers cannot separate.

### Phase 3 gate

Tests 310 passing, build green. Images reviewed above.

## Phase 4: efficiency

### 4.1 The crowd

- **Lighter fans:** 1,708 triangles each (14×10 spheres, 7-sided capsules for figures a few dozen pixels tall) down to
  659 with the same silhouette. Measured (laptop): triangles per frame High 2.44 M → 1.27 M, Medium 1.22 M → 0.64 M;
  frame median −5 to −10%. No difference visible at broadcast or title distance (1:1 crop and title compared).
- **Crowd shadows off on High:** measured no change with the broadcast look, because its key light's shadow frustum
  covers only the court; kept (`crowd: 'noshadow'`) because it does save the stands' shadow pass when High runs with the
  classic players, where the plain gym's sun covers the stands.

### 4.2 Render passes

- **GTAO reading the main depth instead of its own normal pass** (tried, reverted): draw calls −30% and triangles −40% on
  High, but the frame was no faster on the laptop window and 9–10% slower at retina resolution (rebuilding normals from
  the 32-bit depth costs more per pixel than the geometry pass it saves on this GPU). The rule is no regression anywhere,
  so the separate pass stays. Found on the way: three r180's GTAOPass throws if given a depth texture in its constructor
  (it reads a normal target only built without one); worked around while testing (build, then `setGBuffer`).
- The mirror (half resolution, reflected layer only) and the shadow map (once per frame) were already lean; left.

### 4.3 CPU per frame

- **Allocations (refactor, behaviour-preserving):** the arm IK cloned vectors for every hand of every player every frame
  (`motion.js` had 46 allocation sites); it now uses module scratch vectors (and `solveArm` returns a reused result).
  World-to-local conversions refreshed every bone's matrix (`updateMatrixWorld`) where the player's own was enough.
  Proven exact: with the old ball handling restored, the golden bodies match bit for bit.
- **Bug fixed on the way:** the hand-on-ball IK added to the Arena's own `ball.position` (passed by reference) and turned
  it into the holder's chest space. The second hand's target was garbage (two-handed holds lost the left hand) and every
  player animated after him that frame (head turn, defensive stance) read a wrong ball. It works on a copy now; the guide
  hand on a shot, which now really reaches the ball, rests 2 cm further out so its fingers stay on the surface (the hands
  test caught it). Golden bodies regenerated on purpose.
- **Frustum culling:** athletes were never culled (`frustumCulled = false`, because a skinned mesh's bounds are the bind
  pose's). Each mesh now has a fixed sphere round the whole body (centre at 55% of the height, radius 85%: arms raised,
  a jump's tucked legs), so players off screen in the close and first-person shots are skipped.
- **Ball trail:** it re-ran `sampleClip` 8 times a frame while the ball flew; `flightPath(clip)` (basketball.js) is the
  same parabola in closed form, cached per play (matches `sampleClip` to 1e-6 in the test).
- (Earlier, 2.2: a block no longer re-runs the whole play and a bisection inside `sampleClip` every frame.)

### 4.4 Auto quality: a ladder with recovery

Auto measured once and could step down once (High → Medium), so a weak laptop stayed on Medium with bloom, depth of
field and the crowd. Now (`graphics.js autoStep`, `Arena.measure`) every two seconds of frames decide: slower than about
28 fps steps down a ladder High → Medium → **Lite** → Low; three windows in a row faster than about 50 fps step back up;
a step up that turns out slow is undone and not tried again. **Decision:** Lite is a new auto-only step (not in the
Settings menu, which keeps auto/low/medium/high): the athletes and the broadcast lighting stay, the crowd, bloom, depth of
field, mirror, AO and detail maps go, the canvas is 1× and the shadow map 512. So the costly extras go before the
athletes do. Measured (frame median, live possession): laptop Medium 5.9 ms → Lite 4.6 ms; retina Medium 9.1 → Lite
5.0 ms. The practice drills use the same ladder. Tests: the ladder, recovery, the lock after a failed step up.

### 4.5 Player maps by level

The maps are lossless PNG (tangent normal in RGB, AO in alpha). **Decision:** no KTX2/Basis or WebP/AVIF re-encode. There
is no encoder in the repo; macOS `sips` cannot write WebP, and its AVIF path applies colour management, chroma
subsampling and premultiplied alpha, any of which corrupts a normal map with AO in its alpha. Instead Medium gets
half-size copies of the kit and gear atlases (the skin already had its 1k copy): `scripts/player-maps-small.mjs`
averages 2×2 on the raw bytes (data, not colour) and writes RGBA PNG with per-row adaptive filters. Kit 790–813 kB →
343–349 kB, gear 1,397–1,412 kB → 507–513 kB per variant. `mapFile` picks them on Medium; `AthleteMaps.use` now keeps one
size of every atlas (it freed only the other skin); `loadAthletes(level)` prefetches the size the level shows (it fetched
the 1024 atlases whatever the level). The service worker still caches maps on first use. Close-ups on Medium checked: no
visible loss. High is unchanged (its 2k skin is what the replay close-ups need).

### 4.6 The main chunk

The practice drills' 3D scenes (`drillscenes.js`, `drills3d.js`) now load when a drill first opens (`drills.js`,
a dynamic import; closing the drill before it arrives cancels it; a failed import or WebGL falls back to the 2D drill as
before). Rollup now emits the entry (`index`, 516 kB), a shared chunk with three.js and the gym (`players`, 647 kB) and the
drills (57 kB, deferred). **Honest accounting:** the first visit needs `index` + `players`: 1,163 kB raw / 363 kB gzip,
against 1,217 kB / 383 kB for this same code unsplit (−55 kB, −5%); against the baseline's 1,120 kB the first load is
larger, because Phases 1–4 added code (finishes, actions, reactions, cloth fit, team colours). **Decision:** the moves
library and the post-processing stay in the first load: the title needs both on its first frame (a deferred import would
show the gym without its look for a moment during the fly-in).

### 4.7 Medium: bloom

Measured each Medium pass at retina (frame median, title/live): bloom 0.8–1.0 ms (about 10%), grade 0.1 ms, SMAA
0.2–0.3 ms. Bloom at half resolution saved nothing measurable (its cost is the number of passes and target switches, not
their size). With its threshold at 2.2 it only lights the truss light banks, which the broadcast angles hardly show: the
Medium broadcast frames with and without it are indistinguishable. **Decision (the 10% rule):** bloom stays on High and
is off on Medium. Medium now (before → after): retina title 9.0 → 8.0 ms, live 8.9 → 8.2, replay 10.1 → 8.9; laptop
title 6.5 → 5.5, live 6.1 → 5.6, replay 6.8 → 6.2.

### 4.8 Low: the classic figures, instanced

Profiled on Low (laptop, live possession): the ten classic figures were about 200 of the 322 draw calls and 44% of the
frame. `src/classicBatch.js` now draws them as one instanced mesh per body part for all ten players (17 instanced meshes);
the textured number, nameplate and captain badge each player keeps stay as they are. The figures and the body interface
are untouched (`classicBody`, the parts and pivots the Arena poses, `attachBody`); their own meshes move to a layer no
camera renders, and every frame each part's world matrix and colour are copied into its instance. A part the figure
hides (the head in Player view, a headband this player does not wear) is drawn at zero scale. Shadows and the court
mirror see the instances. When there are no shadows (Low), players outside the camera's view take no slot, as when each
figure was culled on its own; with shadows on (the classic players on High or Medium) every player is drawn, because one
just out of shot still throws a shadow into it. Low live: 2.5 → 1.8 ms, 322 → 169 draw calls. Tests: one slot per
classic player, matrices and colours copied, hidden parts at zero scale, other bodies skipped, camera culling.

**Basic upgrade for Low (the brief's 1.x item, done here):** the classic figure's legs swung on a fixed sine of time, so
its feet slid at any speed but one and its arms swung with the same-side leg. It now strides on the distance it covers
(`motion.js footAt`, the athletes' gait), faded in with speed, arms against the legs.

Also: a finish's keyframes and timings are built once per play kind instead of every frame (`finishes.js keysFor`,
`finishTimes`); a test checks the frames are the same whatever ran before.

### 4.9 Low, Player view replay: not recovered, within noise

The one scene that is not faster than the baseline: Low's first-person replay, 1.3 → 1.4 ms on the laptop window
(retina 1.6 → 1.6). A recheck of the baseline commit in a separate worktree measured 1.3 / 1.4 ms, so the difference is
0.1 ms, the size of this harness's run-to-run spread at that frame time. Where it comes from: Phase 2's motion (finishes,
passes, reactions, the off-ball version) runs for all ten players whatever the view, and at 1.3 ms the CPU is most of the
frame (`phase1` 1.4, `phase2` 1.5 for this scene); the instancing then took it back to 1.4. Tried: culling and compacting
the instances to the figures in view (kept, it costs nothing), caching the finish keyframes (kept). **Decision:** accepted
and logged rather than cutting motion out of view (that would make what a player is doing depend on the camera, and a
cut back to the broadcast angle would show it).

### Phase 4 gate

Tests 316 passing, build green, golden clips for unversioned plays unchanged. `phase4` against `before` (frame median):
High −5 to −8% on the laptop window, −0 to +1% at retina (within noise); Medium −7 to −14%; Low title and live −28 to
−32%, Low Player-view replay +0.1 ms (4.9). Downloads: Medium 13.3 → 10.1 MB (−24%), High 15.8 → 17.8 MB (+13%, the
two extra player variants Phase 1 put on court; see OPEN-QUESTIONS), Low unchanged. Main chunk 1,120 → 518 kB.

## Phase 5: code quality

### 5.1 Proof for refactors: a state trace

Rendered sheets differ 0.8–4% of pixels between two identical runs (GPU, asset load order), so they cannot prove a
refactor exact. `scripts/arena-trace.mjs` (`npm run trace`) records what the pixels are drawn from instead: every object
under each player, the ball, trail, nets, camera, the director's shot and every instance matrix, hashed per frame, while
stepping the gym at a fixed 1/60 s through the title, five plays (every finish family, a block, a steal, reactions), each
camera mode and a replay, at High with the athletes and Low with the classic figures (9,280 frames). The gym never runs a
frame on its own and the random numbers restart when stepping begins, so two runs match exactly; a 0.0001 change to one
reaction's lean is caught on the frames it plays.

### 5.2 arena.js split (behaviour-preserving)

`src/arena.js` was one 2,071-line class. It keeps the setup, graphics level, auto quality, scoreboard and the frame loop
(349 lines); the rest moved verbatim into `src/arena/` by concern: gym (building), cast (bodies and identities), playback
(a possession), pose (one player's pose), ball, idle (between plays, the title show), cameras. **Decision:** the modules
are plain method objects added to `Arena.prototype` (a name defined twice throws), not separate classes: every field and
call stays exactly as it was, which is what made a provably exact split possible; each module's header says what it
covers and what it reads or leaves on the Arena. `frame()` became `playFrame`, `idleFrame` and `cameraFrame`, and
`playFrame` lost `resolvePlay` and `placePlayBall` (260 → 150 lines). The trace is identical on all 9,280 frames after
each step; tests, build and `check:ui` green. A test checks every module's methods are on the class once.

### 5.3 Contracts and docs

`sampleClip`'s contract (pure, deterministic, ten actors, unversioned clips unchanged) is written where it is defined;
the motion version, body interface and cloth fit already had theirs. README: a section on how the 3D gym is built and how
to check it (perf, sheets, trace, golden poses). CLAUDE.md: the gym's map and commands. `docs/OPEN-QUESTIONS.md`: the
decisions left to the owners and the known risks.

### 5.4 After sheets

`docs/sheets/after/` (same cameras, moments and sizes as before). Against the before set: no skin through the sleeve or
shorts; defenders in a stance with hands in front instead of airplane arms; finishes that read as different moves (the
hook's one arm, the euro's side step, the dunk hanging on the rim); passes with a step and follow-through; reactions after
the play; strides that change with speed; visitors in their own colours; no stair-stepped edges (aa.png). Still weak: the
armhole trim reads thick at replay close-up range, and the close-up defender's high hand rests by his head.

### 5.5 After numbers

Measured back to back with the baseline commit in one session (`docs/perf-baseline.md`, After): Medium −6 to −13%,
Low title/live −20 to −28%, High −4 to −5% at the laptop window and 0 to +2% at retina (within run spread), Low
Player-view replay +0.2 ms (4.9). Downloads Medium −24%, High +13%, Low +2%. Main chunk 1,120 → 519 kB.

### Phase 5 gate

Tests 317 passing, build green, `check:ui` clean, golden clips for unversioned plays unchanged, trace identical across
the refactor commits.

## Polish pass (branch polish-pass, off realism-pass)

Five flaws from the final report, the contact sheets refreshed and critiqued, the Auto ladder checked under CPU
throttling. Tooling for close looks: a fixed camera on a bone of the paused title player (scratch script; the close-up
sheet for the result). Houdini (`hython`) is not installed here; the in-repo player pipeline's sources are present
(`assets-src/players/houdini/export/*.obj`) but its Python packages (numpy, scipy, scikit-image, xatlas,
fast-simplification) are not, and any change to the meshes' triangles changes the UV layout and needs a full re-bake of
every map. So each fix below is tried at load time or in the shader first.

### P1. The binding: thin and clean (was thick and lumpy)

Cause: the binding is a 5-sided tube about 9 mm in radius swept along each opening (`scripts/build_players.py add_trim`).
The shader's `inflate` pushed every vertex 2 cm along its own normal, which on a tube points all the way round it: the
tube swelled to about 6 cm across instead of lifting off the body, and its facets and the jersey's edge showed as lumps
and slivers. Fix (runtime): `clothFit.js trimPush` gives each binding vertex the outward normal of the nearest torso or
thigh skin (not a hand: in the rest pose the hands hang beside the shorts, palms in) as `kPush`, and the binding is lifted
1.4 cm along it (`materials.js push`), just past the jersey's 1.2 cm, at its modelled width. Found on the way:

- The hem's binding hung below the shorts as a loose hoop once it was thin: the shorts sway on a spring (3.3) and the
  binding did not. It now shares the shorts' sway uniforms (weighted by height, so the neck and armholes stay put).
- The build also swept tubes along a few short open edges where the kit's panels meet with gaps: crumpled scraps 2 to
  16 cm across (the real openings are 26 cm and more), one of them the white "Y" on the hip in the close-ups. As
  "openings" they kept the skin near them drawn. `trimOpenings` finds the pieces (welded within 2 mm) and the scraps under
  20 cm are no longer drawn.
- Those gaps are holes in the kit 2 to 6 cm across, too wide to weld at load without distorting the cloth. Tried: hiding
  the skin under the holes too and drawing the kit double-sided, so a slit showed the inside of the shorts. It looked
  better up close but cost 1–3% of a High frame (measured back to back), against the goal of no regression; single-sided,
  hiding that skin showed the floor through the body. **Decision:** reverted (P7); the skin near the holes stays drawn as
  before, so the slit shows skin as it did before this pass, without the white scrap over it.

Critique (close-ups, 1:1): the armhole and neck binding is a thin, even white edge with no lumps or slivers; the hem
binding stays on the hem as the shorts swing. Still visible: the binding loop is slightly polygonal at half a metre (a ring
every ~6 cm along the tube; finer rings need a rebuild and re-bake), and a slit at the shorts' side seam opens when the hip
flexes hard (the hole is in the mesh; through it the thigh shows). Both logged in OPEN-QUESTIONS.
Tests: the push points out from the body, the scraps are gone, the far mesh shares the result. Trace identical.

### P2. The on-ball defender's high hand contests instead of resting by his head

Measured in the page (chest space, the drive's on-ball defender at 0.6–1.4 s): the high hand was 56 cm in front of the
chest at head height, so it did reach forward, but the elbow sat 17 cm outside the shoulder at shoulder height (a chicken
wing) with the forearm upright: from behind it read as a hand raised by the head. The close-up camera was behind him
because the sheet placed it by his direction of travel, and a defender backpedals. Fix: the high hand reaches further out
at the man (`DEFEND.high` 0.72 → 0.84 of the arm's length, narrower) with its elbow under it and toward him
(`DEFEND.pole.high`); the elbow is now 4 cm outside the shoulder, the hand 61 cm out. The sheet camera can be placed by
the way a player faces (`face`), and the close-ups have a front view of the same moments; the original back view stays
for the before/after comparison. Golden bodies: the four scenes with an on-ball defender changed (deliberately), no clip.
Trace: only the High athlete scenes differ, from the frames where an on-ball defender is in his stance; the title and Low
are identical.

### P3. Fingers spread

The hands have separate fingers but no finger bones; the skin shader curled them (3.2). It now also fans them apart
(`materials.js kFan`, per hand `kSpread`, 0 together to 1 wide): below the knuckle line, each point moves away from the
hand's centre line across its width, more toward the tips, before the curl. **Decision:** no new bones (the brief's
default) and no per-finger rig: the fan reads as spread fingers at every camera distance the game uses. `motion.js` sets
the spread with the grip: wide on defence, a little on the dribble, together when relaxed, round the ball or in a fist; a
performance can ask for it (`spread`): the catch's target hands, the contest's hand in the shot's path, the rebound's
reach, the steal's poke, the blocker's swat. Close-up at 3×: the defender's high hand shows clear gaps between straight
fingers; the low hand stays natural. Tests: spread on defence and for a target, none relaxed or in a fist, the high
elbow under the hand. Trace identical (a uniform, no bone moves).

### P4. The sleeve's top edge: straight (was a zig-zag)

Measured: the sleeves' own rims are flat within 3–5 mm all the way round (one notch per sleeve, 4–8 cm low in one
direction); the zig-zag was the skin. Skin under a sleeve was hidden per vertex (a ray from the skin had to find the
sleeve), so at the rim the hidden area ended along the skin's triangle edges and the skin poked through the sleeve in
drips as the arm bent. Fix: each sleeve has a plane at each end in the bind pose (`clothFit.js sleeveRims`: the top at
the lowest point of its top rim, the bottom at the highest point of its bottom rim, which also removes the notch); the
sleeve is drawn only between them (`materials.js cut`) and every skin vertex of the limb the sleeve follows is marked,
hidden per pixel between the same planes, 3 mm inside (`kArmRim`, `kLegRim`). The limbs hang straight in the bind pose,
so a plane is a straight cut across the limb, and it moves with it. **Decision:** the sleeve is up to 4 cm shorter at
the top (8 cm for the forward's leg sleeve, whose rim dips most) so it is whole all the way round. The leg sleeve gets
its own material for its planes. Close-up at 3× (the gather): a straight black edge across the upper arm, no skin
through it. Tests: the planes sit at the rims and keep most of the sleeve; only the right arm's and left leg's skin is
marked. Trace identical (shader and attributes only).

### P5. The putback row frames the rim

The row followed the player at 4.6 units, aimed at 1.05: with a 43° lens that sees up to about 2.9, so the rim (3.28)
and the ball's flight were off the top of every cell. The putback is taken from where he won the loose ball, about 6
units from the rim (the play's own geometry, unchanged). The sheet's fixed camera can now frame an extra point with the
subject (`include`); the putback row holds him and the rim, side-on to the line between them, 7.2 units off, aimed at
1.7. A first try at 9.5 units put the camera behind the baseline (the side-on spots were outside the gym), small and
behind a defender; at 7.2 it fits inside. Critique: the gather and rise mid-frame, the ball's arc, and the ball through
the net in the last cell. Sheet tooling only; nothing in the game changed.

### P6. Auto quality on emulated weak hardware

The owner has no other hardware, so weak hardware is emulated (`scripts/auto-ladder.mjs`, `npm run ladder`): the built
game on Auto in a 1366×768 window at 1× (a school laptop's screen), real frames (not stepped), the live possession playing
over and over, 15 s normal, 45 s under load, 60 s after it. The load is Chrome's own CPU throttling (CDP
`Emulation.setCPUThrottlingRate`).

- **CPU throttling alone, 4× and 6×: Auto stays on High, correctly.** This machine still draws High at about 80 fps
  under 4× and 50 fps under 6×, above the 28 fps step-down line: the frame is mostly GPU work, which CDP cannot slow.
- **With a slower GPU as well** (`--gpu`: each frame's render is synced and timed and the page waits (rate − 1) times as
  long, so the extra cost scales with what the level draws, as on a weak device):

| load | steps under load (time after the load starts) | at the floor | after the load is gone |
|---|---|---|---|
| 4× CPU, 4× GPU | High → Medium (3.5 s) → Lite (6.7 s) → Low (9.4 s) | Low, 48 fps | Lite (3 s), Medium (8 s), High (14 s) |
| 6× CPU, 6× GPU | High → Medium (5.7 s) → Lite (9.5 s) → Low (13.5 s) | Low, 26 fps | Lite (3.5 s), Medium (8 s), High (14 s) |
| 3× CPU, 3× GPU | High → Medium → Lite | Lite, 34 fps | Medium, High (11 s) |
| 2× CPU, 2× GPU | High → Medium after a borderline window, back to High under the same load (49 fps) | High | High |

  One step per measured window (about 2 s of frames), three fast windows per step back up, as designed. (The frame rate
  printed at a level change lags it: it is the median of the last 240 frames.)
- **Fixed on the way:** a step up that proved slow locked Auto out of stepping up for the rest of the session. A device
  that tried a step during a passing load (a warm-up, a video in another tab) would stay on a lower level after the load
  had gone. The lock now lasts 30 windows (about a minute): long enough that two levels never flicker, short enough to
  recover (`graphics.js LOCK_WINDOWS`; the test covers lock, hold and retry). In the 4× and 6× runs Low never reached the
  50 fps "fast" line under load, so no step up was tried there; the re-run after the change gives the same timeline.

### P7. Sheets refreshed and critiqued

`docs/sheets/after/` closeups, finishes, defense and locomotion re-rendered (same cameras, plus the close-ups' new
front view of the defender; same formats and sizes). Each was opened and checked against the checklist at sheet scale
and in 2–3× crops of the moments that matter:

- **Weight and balance:** takeoffs load the legs and land on two feet; the sprint leans and reaches, the jog is short,
  the defensive slide stays wide and low; planted feet do not slide. Pass.
- **No airplane arms:** none in any defense row; help defenders' hands low in front, on-ball one high one low; the high
  hand now reaches out at the man with the elbow under it (P2). Pass.
- **Hands gripping or contesting the ball:** the gather holds the ball between both hands at the chest; the contest's
  hand rises into the shot's path, spread (P3); the block hand meets the ball; the rebounder rises with two open hands.
  Pass.
- **No clipping through torso or ball:** none seen at 2× in the finishes, contests or the block. Pass.
- **Clean trim and hems:** the binding is a thin even edge at the neck, armholes and hems (P1); the sleeve's top edge is
  straight (P4). Not fully: a slit at the shorts' side seam opens when the hip flexes hard (a hole in the kit mesh from the
  build; the thigh shows through it, as before this pass), and the binding loop shows corners at half a metre. Logged.
- **No aliasing:** edges are smoothed (SMAA, 1.2) in the 1:1 crops; no stair-stepping on the lines or the figures. Pass.

Sheet-only flaws noticed (not the game): the last rebound cell is blocked by a player crossing near the camera, and the
original defender close-up is from behind (kept for the before/after comparison; the front view was added).

### P8. Performance against the start of the branch

Measured back to back in one session, the branch's starting commit (677e2a5, in a worktree) then this branch, three runs
each. The first full run had High 1–3% slower; the double-sided kit (P1) was the measurable part (single-sided measured
+0–2%), so it was reverted with the skin hiding that needed it. After the revert, High measured 0–1% (0.1 ms, the
harness's resolution); the High runs are `polish-*-hi.json` (double-sided), `exp-single.json`, `polish-*-hi2.json`
(after the revert). The final full run is `docs/perf/polish-before.json` / `polish-after.json`: every scene within −1% to
+1% (the table in the
final summary). The binding is about 240 triangles lighter per player (no scraps); nothing else in the polish draws more.
