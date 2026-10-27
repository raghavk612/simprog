# Visual overhaul: 2K-style players and arena

Status: **Stages 0–2 done on the `visual-overhaul` branch** (not on the live site yet).

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

### In the game
- **Turning it on:** Settings › Accessibility › Graphics › **Player models** › "3D athletes (beta)". Low graphics always uses the classic figures.
- **Positions:** guards get the guard body, centers the center body, and everyone else the forward body.
- **Looks:** each player gets one of the four hair styles and colours, and may get a headband, a shooting sleeve or a leg sleeve. The choice comes from the player's id, so it is the same every game (`lookFor` in `src/players.js`). The team colour goes on the jersey and the shorts.
- **Code:** `src/players.js` (classic and athlete bodies) and `src/arena.js` (`setPlayers`, `styleBody`).
- **Budget:** about 13k visible triangles per player and 3 × 0.54 MB of models, loaded only when the setting is on. Stage 8 will trim this with lower-detail versions.

### Spline scenes
(to be added in Stage 4)
