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
