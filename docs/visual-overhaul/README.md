# Visual overhaul: 2K-style players and arena

Status: **Stages 0–4 done on the `visual-overhaul` branch** (not on the live site yet).

Restore point: branch `backup/pre-2k-overhaul` (commit `c9342d1`, the version live on Oct 25, 2026). To roll back, run `git checkout backup/pre-2k-overhaul` or reset `main` to it. All overhaul work happens on the `visual-overhaul` branch and reaches `main` (and the live site) one approved stage at a time.

Gameplay logic is out of scope. `src/engine.js`, `src/basketball.js` (play choice, clips, commentary) and every rule stay as they are. Only the presentation layer changes: `src/arena.js` (player builder, pose animation, lights, renderer, camera), `src/graphics.js` (quality levels) and new asset files.

## 1. Audit

### Engine and how players are drawn
- **Stack:** Three.js r180 bundled with Vite 7. The game is web-only, desktop and phone (from 390 px wide), hosted on GitHub Pages.
- **Renderers:** one `WebGLRenderer` for the gym (`src/arena.js`, class `Arena`). Small separate renderers run the locker-room jerseys (`src/jerseys.js`) and the 3D practice drills (`src/drills3d.js`, `src/drillscenes.js`).
- **Players** (`Arena.player()` in `src/arena.js`) are built from primitives, with no imported models:
  - **Body:** cylinder torso, capsule arms and legs, sphere head, half-sphere hair, box shorts and box shoes.
  - **Decals:** the number and the back nameplate are canvas textures on flat planes, plus a gold "C" badge for the captain.
  - **Materials:** `MeshStandardMaterial` with roughness 0.68 on everything, and 5 skin tones that cycle by slot. There are no normal maps and no skin, cloth or hair shading.
- **Rig:** there is no skeleton. Hip, knee, shoulder and elbow are `THREE.Group` pivots, swung procedurally with sine waves on one stride/dribble clock. There is no foot IK.
- **Movement:** positions come from the 3.6-second play clips in `src/basketball.js` (`sampleClip`). The engine decides the play; the arena only draws it.
- **Ball:** a sphere with three torus "seams", no normal map.

### Asset pipeline
- `GLTFLoader` is already in use, loading 5 Kenney CC0 `.glb` props from `public/models` (80 KB in total). No DRACO, meshopt or KTX2 decoders are set up yet.
- Vite copies `public/` into `dist/`.
- `scripts/offline.mjs` precaches **every** file in `dist/` for offline play, so large models and textures add to the first load and to the offline cache.
- Current sizes: `dist/` is 3.9 MB and the main JS bundle is 985 KB.

### Lighting and rendering
- **Lights:**
  - one hemisphere light;
  - one shadow-casting directional "sun" (2048 px PCF soft shadow map);
  - three overhead spotlights;
  - two point lights (a purple fill and the office desk).
- **Output:** ACES filmic tone mapping (exposure 0.95), sRGB output and fog.
- **Missing:** there is no environment map and no post-processing pass (no SSAO, bloom, depth of field or colour grade).
- **Court:** a 4096 × 2560 canvas-painted texture (maple planks, NFHS lines, centre logo) on a `MeshStandardMaterial` with roughness 0.36. It has no reflections.

### Cameras
- `PerspectiveCamera` with a 43° field of view, plus `OrbitControls` (with damping, no panning).
- Presets: Auto (follows plays), Wide/broadcast, Courtside, Follow, Player view (first person), and Locker and Office views.

### Performance limits already in the code (`src/graphics.js`)
- Quality levels are Low, Medium, High and Auto.
- After a warm-up, Auto measures about 2 seconds of frames and drops one level if the median frame is slower than about 28 fps.

| Level | Pixel ratio cap | Shadow map | Crowd |
|---|---|---|---|
| Low | 1 | off | hidden |
| Medium | 1.5 | 1024 px | no shadows |
| High | 2 | 2048 px | full |

- Reduced-motion settings are honoured.

### Proposed budget for the new assets
- **Player mesh:** high is 8–12k triangles, low is 2.5–4k, with 2 materials (body and kit). That keeps the 10 players at about 100–120k triangles on High.
- **Skeleton:** up to about 65 bones (Mixamo-compatible).
- **Textures:** 1024² atlases on High and 512² on Low, compressed with KTX2/Basis. Normal maps get their own budget.
- **Download:** about 3 MB for all player assets together, loaded after the first frame so the title screen stays fast.
- **Post effects:**
  - High: SSAO/GTAO, bloom, colour grade, depth of field on replays and free throws, planar floor reflection.
  - Medium: bloom, colour grade and contact-shadow blobs.
  - Low: today's renderer.

## 2. Tools

| Tool | Status in this session | What to install |
|---|---|---|
| Houdini MCP | **Not connected.** It isn't in the Claude connector directory. | Community server (e.g. eetumartola/houdini-mcp). It runs **on your computer** next to an open Houdini session and needs Houdini 19+ and Python 3.10+. Check your Houdini licence allows glTF/FBX export (the free Apprentice edition limits exports; Indie or higher is the safe choice). |
| Spline MCP | **Not connected.** | Official hosted server: add `https://mcp.spline.design/mcp` as a custom connector and sign in with your Spline account (or use the Spline desktop app's built-in MCP). Every tool call counts against your Spline plan's daily allowance. |

Notes:
- This session runs in the cloud. A local Houdini MCP will only be reachable here if it shows up through the linked computer. If it doesn't, run the Houdini stages from Claude Desktop or Claude Code on the computer that has Houdini.
- Spline exports to three.js code, a hosted viewer, or GLB from the editor. Its real-time reflections and depth of field do **not** carry over into a GLB. The game will use Spline for the arena models, materials and lighting layout, and rebuild reflections, bloom and depth of field in Three.js. Embedding the Spline runtime would add a second 3D engine, and the game won't do that.

## 3. Staged plan

| Stage | What | Tools | Done when |
|---|---|---|---|
| 0 | Swappable player renderer: the current figures become "Classic". The new model loads behind it, with a fallback to Classic if it fails to load or on Low. | code only | Classic looks identical and the new slot is ready |
| 1 | Base athletic body (7.5–8 heads tall, height/shoulder/mass parameters) and guard/forward/center variants, imported and rendering | Houdini (or free fallback) | 10 players render with the current animation |
| 2 | Jersey, shorts, shoes, 3+ hairstyles, headband and sleeve options | Houdini | Kit colours, numbers and names still follow the locker room |
| 3 | Skin (wrap-light subsurface, normal map, sweat sheen), mesh-fabric cloth, glossy shoes, pebbled ball | Three.js shaders + CC0 textures | Side-by-side screenshots approved |
| 4 | Court, arena lights, reflections, contact shadows, ambient occlusion, bloom, warm broadcast grade | Spline + Three.js post-processing | High, Medium and Low all hold their frame rate |
| 5 | Rig and animation polish: weight shifts, dribble stance, foot planting (IK), easing | Mixamo/CC0 clips + code | No foot sliding in the replays |
| 6 | Broadcast camera: low sideline angle, smooth follow, depth of field on replays and free throws | code | Camera presets reviewed |
| 8 | Performance pass and quality settings (your list has no 7; the numbering is kept) | code | Phone test passes at 30 fps or more on Medium |

## 4. Free sources where the tools above can't make something
- **Rigged bodies:** MakeHuman / MPFB2 for Blender (CC0 output), or Mixamo characters (free with an Adobe account, royalty-free in games).
- **Animations:** Mixamo (dribble, run, jump shot, defensive stance), Quaternius Universal Animation Library (CC0).
- **Textures:** ambientCG and Poly Haven (CC0) for fabric, leather, wood and skin-pore detail maps. Poly Haven HDRIs (CC0) for an indoor-arena environment map.

## 5. Scene and file links

### Houdini (Stage 1: base body and guard / forward / center)
| File | What it is |
|---|---|
| `assets-src/players/houdini/kangs_players.hipnc` | The Houdini scene (Apprentice). In `/obj`, `kangs_body` is the base body; its **Kangs body** tab has Height, Shoulder width, Muscle mass, Blend radius, voxel size and triangle targets. `kangs_guard`, `kangs_forward` and `kangs_center` are the variants. |
| `assets-src/players/houdini/build_players.py` | Rebuilds that scene from scratch and exports OBJ. Run it in Houdini's Python Shell: `exec(open('<path>/build_players.py').read())` (set `ASSETS` at the top to where `body_shapes.json` lives). |
| `assets-src/players/body_shapes.json` | The body itself: ellipsoids and tapered capsules as fractions of height, the joints, and the three variants. Generated by `make_body_shapes.py`. |
| `assets-src/players/preview_body.py` | A quick preview of the same shapes without Houdini (numpy + scikit-image), for tuning proportions. |
| `assets-src/players/houdini/export/*.obj` | Houdini's exports (mesh, UVs, part groups). |
| `scripts/build_players.py` | Adds the skeleton and skin weights and writes `public/models/players/<variant>.glb` (Apprentice cannot export glTF/FBX). Run `python3 scripts/build_players.py` after re-exporting from Houdini. |

On Raghav's Mac the working copies live in `~/coding/kangs-assets/` (Houdini reads and writes there).

### Houdini (Stage 2: clothing and hair)
Each variant in `kangs_players.hipnc` also builds clothing and hair as offsets of its own body, so they fit every size:
- **Clothing:** `jersey` (loose tank top with deep armholes, a scoop neck, and folds at the waist and straps), `shorts` (baggy, with a gathered waistband and soft folds) and `shoes` (high-tops with a flat sole).
- **Hair:** `hair_buzz`, `hair_crop`, `hair_afro` and `hair_rows` (cornrows).
- **Options:** `headband`, `sleeve_arm` (right arm) and `sleeve_leg` (left leg).

Each piece is a Volume Wrangle (`sdf_<piece>`) whose code is in `GARMENT_VEX` in `build_players.py`. The **Clothing/hair detail** parameter scales their triangle budgets.

`scripts/build_players.py` copies each piece's skin weights from the nearest skin, so it moves with the body, and gives it tiling UVs for the fabric textures in Stage 3.

### Materials (Stage 3), in `src/materials.js`
- **Fine detail:** small tiling height maps are generated in code at start-up (skin pores, perforated jersey mesh, pebbled leather, hair strands), so there are no texture downloads. The shader applies them as bump detail with triplanar mapping on the rest pose, so they stay glued to a moving body, and fades them out with distance so they never shimmer.
- **Skin:** physical material with wrap lighting (a soft subsurface look, reddish where light bleeds round the edge), pores and a slight sweat sheen (clearcoat). There are seven skin tones.
- **Faces:** brows, eyes, nose and lips are painted straight onto the head in the skin shader, projected from the front, so they are lit exactly like the skin and hide with the head in Player view.
- **Clothing:**
  - Jersey and shorts: cloth sheen and the athletic mesh, with geometric folds from Houdini.
  - Sleeves and headband: smoother compression fabric.
  - Lettering: the number and name are drawn outlined in the team's text colour, on decals bent to the curve of the chest and back.
- **Shoes:** glossy leather-like upper and a matte rubber sole.
- **Hair:** an anisotropic highlight that runs round the head, plus fine strands.
- **Ball:** with the athletes it is real size (24 cm) in pebbled leather. Near the floor it is drawn lower by the size difference, so dribbles still touch the wood; the ball's game position is unchanged. Classic keeps the original ball.
- **Shorts at the crotch:** the panel follows the pelvis, not one thigh, so the shorts stay closed on a stride. Feet are left out of the body mesh because the shoes cover them.
- **Previewing models:** `preview-players.html` (run `npx vite`, then open `/preview-players.html?pose=1`) shows the four looks side by side; `cam=` and `fov=` move the camera.

### In the game
- **Turning it on:** Settings › Accessibility › Graphics › **Player models** › "3D athletes (beta)". Low graphics always uses the classic figures.
- **Positions:** guards get the guard body, centers the center body, and everyone else the forward body.
- **Looks:** each player gets one of the four hair styles and colours, and may get a headband, a shooting sleeve or a leg sleeve. The choice comes from the player's id, so it is the same every game (`lookFor` in `src/players.js`). The team colour goes on the jersey and the shorts.
- **Code:** `src/players.js` (classic and athlete bodies) and `src/arena.js` (`setPlayers`, `styleBody`).
- **Budget:** about 13k visible triangles per player and 3 × 0.54 MB of models, loaded only when the setting is on. Stage 8 will trim this with lower-detail versions.

### Spline (Stage 4: arena lighting and camera angles)
- **Scene:** [Kangs Arena – Broadcast Lighting](https://app.spline.design/file/22b369ab-471f-43d1-8a65-6dc71fe2f9ee), in the raghavk612 Spline account. It is at real scale (1 m = 50 units, the court's long axis on x, centre at the origin, like the game). It holds:
  - the court and the arena deck;
  - two lighting trusses with 10 light banks;
  - the overhead key light, 6 truss spotlights and 2 cool rim lights;
  - 5 broadcast cameras (`Cam Broadcast Low`, `Cam Wide`, `Cam Baseline`, `Cam Replay Close`, `Cam Free Throw`), each with a `… Target` empty it looks at;
  - player stand-ins for scale.
- **How the game uses it:** `src/broadcastRig.js` holds the rig's values copied from that scene, plus the conversion to game units. To change the rig, edit it in Spline and ask Claude to read the scene back into that file. Spline's own reflections and depth of field can't be exported to three.js, so the game rebuilds them (below).
- **Spline limits:** the Spline account is on the free plan (20 MCP actions a day). The screenshot tool returned blank frames over MCP, so open the link above to see the scene.

### Broadcast look in the game (`src/broadcast.js`)
- **When it's on:** with the 3D athletes on Medium or High graphics. On Low, or with Classic players, it is switched off completely, so the classic gym is untouched.
- **Lighting:** the Spline rig, i.e. the overhead key with soft shadows, the truss spotlights (6 on High, 3 on Medium) and the cool rim lights from behind the baselines. The truss and its glowing light banks are visible.
- **Image-based light:** a neutral room environment (PMREM) for believable highlights on skin, shoes and the ball.
- **Court:** satin varnish (clearcoat) over the painted maple. On High it also gets real-time reflections of the players and lights (a planar mirror at half resolution), softly blurred and stronger at low angles.
- **Contact shadows:** soft pools under every player and the ball, fading as they leave the floor.
- **Post-processing:**
  - High: ambient occlusion (GTAO).
  - Medium and High: bloom on the brightest emissive parts only (threshold 2.2, so the lit floor never washes out), then a warm broadcast grade (warm white balance, a touch more saturation, soft vignette), then tone mapping.
  - The post buffers use 32-bit depth.
- **Tuning notes:**
  - Bloom with a low threshold veiled the whole floor.
  - A glossy clearcoat mirrored the key light as a glare blob, so the floor is satin.
  - Contact shadows blend in linear light before tone mapping, so they are drawn wider and darker than they would be with plain rendering.
- **Testing:** set `window.__kangsLook = {...}` before the page loads to switch parts off, e.g. `{noPost:true}`, `{f:{bloom:false}}`, `{spot:0}`, `{clearcoat:0}`.

### Animation polish (Stage 5: `src/motion.js`)
- **Scope:** the 3D athletes only. The plays still decide where every player stands and which way he faces; this layer only bends the joints. Classic players keep their old animation.
- **Foot planting:**
  - A two-bone leg IK (`solveLeg`) keeps the planted foot on the floor.
  - The stride advances with the distance the player actually travels, not with a clock, so feet don't skate. Stride length grows with speed (`strideFor`).
  - The swing foot lifts and reaches ahead (`footAt`). Strides follow the direction of travel, so a defensive slide becomes a side shuffle instead of feet stepping forward.
- **Stances:**
  - An athletic crouch at rest, a lower crouch while dribbling, and a wide, low defensive stance.
  - Knees tuck in the air for shots, rebounds and blocks.
- **Weight:**
  - A slow side-to-side weight shift when standing.
  - When running: a hip bob, hip and shoulder counter-twist, and a torso lean that grows with speed.
- **Arms and head:**
  - Relaxed arms swing opposite the legs.
  - The dribble hand pumps in time with the ball's bounce.
  - The head turns toward the ball, limited to about ±60°.
- **Easing:** every channel eases with exponential smoothing, so poses blend instead of snapping. Pausing a replay freezes it.
- **Reduced motion:** players hold a still stance instead.
- **Tests:** `tests/motion.test.js` checks that the IK places the ankle exactly on its target and never bends a knee backwards, and that planted feet move back exactly as far as the body moves forward.

### Broadcast cameras and depth of field (Stage 6: `src/director.js`, `src/dof.js`)
- **When it's on:** with the 3D athletes on Medium or High graphics, in the **Auto** and **Follow** camera modes during plays and replays. Wide, Courtside, Player view and the Classic look keep their old cameras. With reduced motion, the old camera stays.
- **Angles:** taken from the Spline rig's cameras (`RIG.cameras` in `src/broadcastRig.js`). They are authored for the Kangs attacking the right-hand basket. The director mirrors them along the court for the visitors and keeps the sideline cameras on the broadcast side.

  | Angle | Lens (16:9) | When | Depth of field |
  |---|---|---|---|
  | `wide` | 30° | start of every possession | none |
  | `track` | 22°, long lens | the build-up, following the ball handler | replays only, gentle (far stands and front row) |
  | `freeThrow` | 46° | jump shots (catch-and-shoot, pull-ups, step-backs and their variations), carried to wherever the shooter is | focus on the shooter |
  | `replayClose` | 40° | the finish in replays | focus on the shooter, then the ball in flight |
  | `baseline` | 22° | visitors' drives, hooks and dunks | none |
  | `player` | — | Kangs' drives, hooks and dunks (the existing first-person view) | none |

- **Changes from the Spline rig (made in code, not in Spline):**
  - The sideline camera is moved in over the front row and aimed a little low, so it clears the courtside fans and the action stays above the camera buttons and caption.
  - The shooter's camera sits a little further back and higher, aiming mostly at the shooter.
- **Movement:**
  - Cameras move on critically damped springs (SmoothDamp), so they are smooth at any frame rate.
  - They look slightly ahead of the ball handler's motion.
  - They *cut* between angles a director would cut between (to and from the close, baseline and first-person shots) and glide otherwise.
  - The lens zooms smoothly between angles.
- **Depth of field** (`src/dof.js`):
  - It reuses the depth from the main render, so it needs no extra scene pass.
  - A half-resolution, 32-tap golden-angle disc blur whose size follows each pixel's circle of confusion, then a full-resolution blend.
  - Background samples are kept from bleeding over sharper foreground edges.
  - It eases in and out, and is switched off (zero cost) whenever no close angle or replay needs it.
  - To test without it: `window.__kangsLook = {noDof: true}`.
- **Tests:** `tests/director.test.js` checks the angle choice, that the rig is the source, the mirroring and broadcast-side rule, that the shooter's camera stays behind the shooter, and spring smoothness at 30/60/144 fps.

### Performance pass (Stage 8)
Measured in the game-day view with the same scene each time: every render pass counted, including shadows, the court mirror, the main view and post-processing. The frame times come from the test machine's software renderer, so only the draw-call and triangle columns compare to a real computer.

| Graphics | Players | Draw calls before → after | Triangles per frame before → after |
|---|---|---|---|
| High | Classic | 588 (unchanged) | 159k (unchanged) |
| Medium | Athletes | 415 → 415 | 323k → **151k** |
| High | Athletes | 1,058 → **740** | 949k → **298k** |

What changed:
- **One skeleton per player:**
  - The cloned models gave each of a player's 8 meshes its own copy of the skeleton.
  - That meant 8 bone updates and 8 bone textures per player every frame (161 bone textures in all).
  - Now each player has one. Textures in memory went from 233 to 92.
- **Far-distance player meshes (LOD):**
  - `npm run players:lods` (`scripts/player_lods.mjs`, using meshoptimizer) adds a simplified copy of every player mesh, about 33% of the triangles, to the `.glb` files. Run it again after `scripts/build_players.py`.
  - It reuses the same vertices and skin, so each file grows by only about 37 KB.
  - A player switches to it when he is less than about 22% of the screen height tall (back above 25%, so nobody flickers at the threshold). So the Wide and sideline cameras draw far players with about a third of the triangles, and close-ups use the full mesh.
- **Shadows once per frame:** the shadow map used to be redrawn by every scene render (mirror, main view, AO normals). It is now drawn once per frame.
- **The court mirror (High)** only draws what can show in the floor: players, ball, hoops and the light rig, not the stands, walls or crowd.
- **Depth of field** costs nothing outside replays and the close angles (Stage 6).

What each graphics level turns on with the 3D athletes:

| | Low | Medium | High |
|---|---|---|---|
| Player models | Classic | Athletes (far LOD) | Athletes (far LOD) |
| Pixel ratio cap | 1× | 1.5× (max 2.4 MP) | 2× (max 3.7 MP) |
| Sun shadows | off | 1024 | 2048 |
| Crowd | hidden | no shadows | shadows |
| Spotlights | 3 (gym) | 3 | 6 |
| Court reflections | — | — | yes (half resolution, filtered) |
| Ambient occlusion (GTAO) | — | — | yes |
| Bloom, grade, contact shadows | — | yes | yes |
| Depth of field | — | replays and close angles | replays and close angles |

**Real-GPU result (Mac, Chrome, full-screen Retina 3484×1644 at 2×, High with the athletes):** 56 fps, 18.0 ms typical frame, 22.0 ms at the 95th percentile, 442 draw calls, 514k triangles. Auto kept High.
- The cost was mostly pixels, so High and Medium now have a **pixel budget** (`MAX_PIXELS` in `src/graphics.js`): 3.7 million pixels on High and 2.4 million on Medium.
- That canvas now renders at 1.6×. Normal-sized windows keep 2×, and the ratio never drops below 1×.

**Auto** starts at High, times about two seconds of frames, and drops one level if the typical frame is slower than about 28 fps.

**Real-GPU check:** open the game with `?perf` at the end of the address, for example `http://localhost:8000/?perf`. A small panel in the bottom-right corner shows:
- frames per second, the typical frame time and the 95th-percentile frame time
- draw calls and triangles per frame
- the graphics level, player models, pixel ratio and canvas size
- the current camera angle, and whether depth of field is on

The same numbers are in `window.__kangsPerf`.

Not done, because the gain looked small for the work:
- The High-only AO pass still re-draws the stands.
- The arena's crowd and bleachers were not merged into fewer meshes.

### Refinement pass (after launch)
**Clothing:**
- The Houdini recipe (`assets-src/players/houdini/build_players.py`, saved scene `kangs_players.hipnc`) now builds the jersey and shorts as **hollow layers**. Their inner wall sits about 4 mm inside the skin, instead of a solid block containing the body.
- The rig script (`scripts/build_players.py`) then:
  - cuts the neckline, armholes, hems and waistband exactly along smooth shapes (`opening_shapes`, `clip_openings`)
  - drops the hidden inner wall (`inside_body`) and the skin under the kit (`covered_body`), so nothing pokes through
  - adds a **trim** band round every opening (`add_trim`), drawn in the team's lettering colour
- In the shader, clothing is pushed about 1 cm off the skin (`inflate` in `src/materials.js`), and the decals move out with it.

**Jersey design:** the Kangs' 3D players wear the locker-room design of whichever kit is chosen (`kitLettering` in `src/players.js`, same layout and colours as `src/jerseys.js`):
- front: "Lake" in script, the number, then "Washington" in script
- back: the player's name and a big number
- trim: round the neck, armholes and hems in the kit's trim colour

Visitors keep a plain number and name, with white trim.

**Hands and face:**
- The rig script builds modelled hands (`hand_parts`: palm, four fingers curled together, thumb) to replace the thin paddle.
- Faces are repainted at real proportions (`faceTexture`): eyes with iris and highlight, brows, nose shading, lips, cheek and jaw shading, and stubble on some players.

**Arms in play** (`src/motion.js`, athletes only):
- Every play situation has its own eased arm pose:
  - jump shot: set point and follow-through
  - hook: the off arm shields
  - block: one hand high
  - rebound: elbows soft
  - defence: active hands, one high and one low
  - chest pass
  - screen: arms crossed
  - dribble: off arm guarding
- The ball handler's hands reach the ball with two-bone arm IK (`solveArm`): one hand on top while dribbling, both while holding and shooting. When the ball leaves, they ease off into the follow-through.

**Jumps:**
- Jump shooters keep their legs long, with the toes pointed.
- On drives and dunks, the lead knee drives up.
- Blocks and rebounds tuck both knees.

**Rebuilding:**
1. Run the Houdini script (or open the saved scene and render the three `export_obj` nodes).
2. Copy the OBJs into `assets-src/players/houdini/export/`.
3. Run `python3 scripts/build_players.py`, then `npm run players:lods`.
