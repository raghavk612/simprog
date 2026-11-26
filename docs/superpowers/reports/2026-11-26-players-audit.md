# Players audit: look and motion (2026-11-26)

Audit for the request "also work on simultaneously improving the design of the players and their animations as well".
Branch `players-look` from `ui-ease` d8596d8. Read-only: nothing in `src/` changed. The plan built on it is
`docs/superpowers/plans/2026-11-26-players-look.md`.

## How the players are built (as found)

- **Bodies.** Three rigged glTF variants (`public/models/players/{guard,forward,center}.glb`, about 1 MB each), 17 bones
  that rest unrotated (pinned by tests). Each variant has these meshes: body (about 6,000 triangles), head (1,640), jersey
  (1,385–1,563), shorts (1,126–1,385), shoes (about 880 in 2 primitives, upper and sole), trim (the binding tube, 1,200),
  four hair styles (buzz 450, crop 540, rows 700, afro 1,340), headband, arm sleeve and leg sleeve. A `_lod1` copy of each
  mesh is drawn when a player is small on screen (`cast.js updateLods`, `graphics.js lodFor`).
- **Pipeline.** Body and head are signed-distance shapes from `assets-src/players/body_shapes.json`. They are meshed in
  Houdini (`assets-src/players/houdini/build_players.py`, `kangs_players.hipnc`; the user's Mac copy is under
  `~/coding/kangs-assets/houdini/`) and exported as OBJ with named groups (`core arm_L arm_R jersey shorts shoes hair_*
  headband sleeve_*`). Hands, sneakers and the afro are meshed in the cloud (`assets-src/players/cloudmesh`).
  `scripts/build_players.py` then runs geometry → three UV atlases (skin, kit, gear) → normal + AO bake from a
  high-detail SDF (`assets-src/players/bake`) → rig → GLB. `scripts/player_lods.mjs` writes the LOD1 meshes. The whole
  rebuild runs in this container after `pip install xatlas fast-simplification` (both are on PyPI here; numpy, scipy,
  scikit-image and Pillow are already installed). Each variant takes about 6–8 minutes. Houdini is needed only for a change
  to the body or head SDF.
- **Materials** (`src/materials.js`). Skin is a physical material with wrap light, pores, the painted face (a canvas
  texture projected from the head's rest pose, `faceTexture`), finger curl and fan, and per-pixel hiding of skin under the
  clothes (`src/clothFit.js`). The kit is one material for jersey and shorts, recoloured per team, with the lettering
  printed in the shader and a sway spring on the shorts. The shoes are one flat colour (`0xf4f4f4` for everyone) with
  clearcoat, plus a sole colour. Hair uses an anisotropic sheen. Baked normal + AO maps are used on Medium and High, and
  not on LOD1.
- **Look per person** (`src/players.js lookFor`). The look is hashed from the person: 4 hair styles, 6 hair colours
  (nearly all black), a headband (1 in 5), an arm sleeve (1 in 4), a leg sleeve (1 in 6), 7 skin tones, and small changes
  to the face. The variant and height come from position and roster height (±5% scale).
- **Per graphics level.** High and Medium draw the athletes with the broadcast look (`src/broadcast.js`). Lite (an Auto
  level) draws the athletes without the post effects. Low draws the classic primitive figures, instanced: one mesh per
  body part for all ten players (`src/classicBatch.js`).
- **Motion.** `sampleClip` (`src/basketball.js`) is pure and versioned. Version 3 (current) simulates each play once:
  `choreo.js` (intent), `playsim.js` (bodies with speed, acceleration, jerk and turn limits), `ballsim.js` (the ball). Old
  plays replay exactly (`tests/golden.test.js` clips, `motion:qa` frozen hashes, `npm run trace -- --v 2`). The body is
  posed per frame by `motion.js animateAthlete`: two-bone leg IK with the stride tied to distance, stances, lean and bank
  from the simulation's acceleration, arm presets and IK, head look. Performances on top come from `finishes.js`,
  `actions.js`, `reactions.js` and `src/moves` (the moves are used on the title only). This presentation layer is not
  versioned. Its golden "bodies" snapshot may be regenerated on purpose, and the trace then differs only where the change
  shows.

## How the pictures were made on this machine

The container renders WebGL with llvmpipe (software Vulkan), at about 1 frame per second at Medium. At High the in-game
captures came out black: the in-page `readPixels` and `drawImage` returned zeros, and a High frame took ~30 ms against
~1.5 s at Medium, so the High render was not drawing. The title screen at High did render. So:

- The sheets were made at **Medium** with a scratch copy of `scripts/contact-sheet.mjs` that skips drawing between the
  captured moments (the simulation still steps every 1/60 s; only the draw is skipped). A full set took about 15 minutes
  instead of hours. Task 0 of the plan puts that into the repo's scripts.
- For High, the reference is `docs/sheets/after/` (rendered on an M1 Pro during the realism pass). The model and motion
  have not changed since then.
- The live captures (Game day through the real UI, `toGame`, the Auto camera and close cameras on players) were made at
  Medium and Low, desktop 1440×900 and phone 390×844 at 2×.

Before images (git-ignored, full size): `ui-shots/players-before/` (sheets), `ui-shots/players-before/live/`,
`ui-shots/players-before/moves-*.png`, `ui-shots/players-before/motion/` (motion:render, 36 images; it matches
`docs/motion/after/` because the motion has not changed since M5). Crops kept in the repo as evidence:
`docs/players/before/*.jpg`.

## What a judge notices in five minutes, ranked by how visible it is

### 1. The kit is torn (every close-up and replay; on white kits even at sheet scale)

The jersey and shorts are broken into many pieces, not a few openings. Measured on the shipped GLBs, with boundary
loops welded at 2 mm (`jersey` should have 4: neck, two armholes, hem; `shorts` should have 3: waist and two legs):

| variant | jersey boundary loops | of them under 0.2 units | shorts boundary loops | of them under 0.2 units |
|---|---|---|---|---|
| guard | 21 | 13 (1.23 u of edge) | 24 | 15 (1.38 u) |
| forward | 30 | 14 (1.41 u) | 17 | 8 (0.86 u) |
| center | 29 | 16 (2.21 u) | 20 | 10 (0.92 u) |

The raw Houdini OBJ groups are closed (0 boundary edges), so the holes are made by the build
(`scripts/build_players.py`: the opening clip, buried-face removal and panel edges), not by Houdini. What a judge sees:

- white shards hanging from the shorts' hem and slits at the hip that show skin (`docs/players/before/kit-shorts-defender.jpg`,
  `defender-hand-face-shorts.jpg`);
- white marks and a slit at the purple shorts' side seam (`kit-hip-slit-dribble-clip.jpg`);
- a ragged V-neck with a doubled trim line and bare patches on the chest of the white jersey
  (`kit-neckline-face-visitor.jpg`).

This was logged as a known residual in `docs/OPEN-QUESTIONS.md` (4). A runtime cover was tried and reverted for cost. The
fix belongs in the build, and the build now runs in the cloud.

### 2. Feet: ten pairs of identical white slippers, no socks

Every player wears the same glossy white shoe (`players.js shoeMaterial(0xf4f4f4)`). The sole barely shows, and nobody
wears socks: the bare shin goes straight into the shoe (`shoes-no-socks.jpg`). At broadcast distance the feet are white
blobs. Up close the shoe reads as a slipper: no panels, no heel counter, no colour. Real teams wear matching team socks
and shoes in team colours.

### 3. Heads: a grey rubber cap of hair and a waxy, red-brown face

- Hair. The "rows", "crop" and "buzz" styles look like a grey-brown swim cap with a hard dark line at the hairline
  (`face-hair-home.jpg`, `kit-neckline-face-visitor.jpg`). The hair colour is near black (`0x161210`), so the anisotropic
  sheen and the environment light are washing it out. Four styles, and the hairline is the same on every player.
- Skin and face. The skin reads as a waxy, saturated red-brown. The painted face is flat: thin brows, small heavy-lidded
  eyes that look down, no facial hair on anyone. Every face seems to have the same mood (`face-closeup-sheet.jpg`).
- The neck looks long next to the trapezius in three-quarter views. This is a shape change (body SDF, Houdini).

### 4. Poses that break the body: a hand through the face, frog legs, the ball through the thigh

- The on-ball defender's high hand passes over his own face and forehead
  (`defender-hand-face-shorts.jpg`; `defense.jpg` 1.83–2.20 s; the front row of `closeups.png`). The target
  (`motion.js DEFEND.high`) is in chest space, and torso twist and lean carry it across the head. Nothing keeps a hand out
  of the head or torso.
- The on-ball and help stances squat with the knees flared out like a frog's (`defense.jpg` on-ball 1.46–2.20 s, help
  1.50–2.02 s). Width comes from abduction alone (`m.wide` 0.2), with no toe-out, so the knees do not track over the feet.
- On the dribble the ball passes through the thigh (`kit-hip-slit-dribble-clip.jpg`, third cell). `moves:check`
  measures the closest ball-to-body clearance on the title moves as 0.028 units for the crossover, **−0.022** for the
  between-the-legs (the ball inside the leg at 0.22 s) and −0.003 for the step-back jumper, and still prints "ok":
  check.js does not fail on a negative clearance, and nothing in the per-frame pose checks it in games.

### 5. Stiff body language with the ball and after the play

- The crossover moves the ball and leaves the body standing. The torso stays upright, the hips do not drop, there is no
  push step to the side, and the shoulders do not dip (`move-crossover.jpg`). In games it is worse: `ballsim.js` decides
  on a crossover, a between-the-legs or a behind-the-back against a tight defender, but the body never performs the move.
  `src/moves` is imported only by `arena/idle.js` (the title).
- Feet stay flat through the whole stance (the ankle keeps the sole level; there is no toe bone and no heel lift), so a
  run has no push-off.
- Reactions hardly show at game distance (`reactions.jpg`). The three's raised arm reads. Hands on hips, the head shake
  and the clap do not read at the Auto camera. No teammate goes to the scorer (no high five, no chest bump), and there are
  no players on the bench.
- Between plays (`arena/idle.js`) a player starts the run back at full speed (`v = min(5, d*2.2)`), a visible pop that
  version 3's acceleration limits do not cover.

### 6. Readability at gym distance

On Auto and on a phone the home team's purple kit stands on the purple key, the purple decal and in front of the purple
stands, with little light or dark contrast and no rim light. The white visitors read better than the Kangs
(`broadcast-medium-desktop.jpg`, `broadcast-medium-phone.jpg`). The faces are dark under the gym lights at this distance.

### 7. Low: toy figures

Low (and Auto when a weak laptop steps down) draws blocky figures: a box torso, a ball head with no features, box
shoes and box hands (`low-classic-close.jpg`). They read fine at gym distance (`low-classic-broadcast.jpg`), but in a
replay they look like a different game.

### 8. Variety and the opponent's kit

There are three body builds (variants), four hair styles, one shoe, no facial hair and no wrist or knee accessories
besides the sleeves. The visitors wear plain white with their school's trim and only a name and number: no wordmark, no
side panel. That is fine, but next to the Kangs' script jersey it looks unfinished.

### What already holds up (do not regress)

- Feet do not slide: the stride is tied to the distance travelled (`locomotion.jpg`). The sprint leans and reaches, the
  jog is short, the slide stays low.
- Shooting form (`jumpers.png`): the gather, the set point, the release and the follow-through read. Landings land on two
  feet.
- Finishes read as different moves (`finishes.png`), and passes have a step and a follow-through (`passes.png`).
- Version 3 movement (`motion/*.png`): curved paths, real starts and stops, the ball held until it is thrown.
- Lighting on the players at High (M1 `docs/sheets/after/closeups.jpg`) is good. Medium is flatter but fine.

## Performance on this machine

`node scripts/perf.mjs --label players-before-cloud --levels low,medium --configs laptop --repeat 1` (this container:
llvmpipe, 2 cores, so frame times are software-rendering times and only comparable with runs made here). Results:
`docs/perf/players-before-cloud.json` (23 minutes for the run):

| config / level | scene | frame median ms | p95 ms | draw calls | triangles |
|---|---|---|---|---|---|
| laptop/low | title | 166.1 | 227.0 | 118 | 0.02M |
| laptop/low | live | 176.4 | 231.4 | 169 | 0.03M |
| laptop/low | replay | 60.7 | 142.9 | 74 | 0.01M |
| laptop/medium | title | 733.1 | 811.0 | 343 | 0.61M |
| laptop/medium | live | 698.4 | 858.1 | 406 | 0.47M |
| laptop/medium | replay | 737.5 | 927.7 | 350 | 0.64M |

Downloads: Low 1.68 MB; Medium 9.84 MB (player maps 5.03, models 3.11). Main chunk 553 kB (206 kB gzip).

The draw calls and triangles match the M1's `docs/perf/after.json` exactly (Medium live 406 calls and 0.47 M; Low live
169 calls), so those counts can be compared across machines; frame time cannot. High could not be measured here (the
draw does not run, see above). On the M1, laptop/High live was 700 calls and 0.94 M triangles. Per athlete today: 8 draws
(body, head, jersey, shorts, shoes as 2 primitives, hair, trim) plus a headband or sleeve when worn, about 12.5–13.5k triangles
at LOD0.

The rule for the plan: draw calls per level may not go up (new looks go into existing materials and meshes, not new
meshes), triangles per player stay under the 15k cap in `tests/players.test.js`, and frame time here and the M1 numbers'
calls and triangles are compared back to back with this baseline.
