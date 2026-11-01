# Player heads that read as heads — plan

Spec: user request (2026-10-31/11-01): "use references from the internet to improve player face designs so it doesn't look like a squished sphere", approved to execute "all" of the research plan in `/home/claude/reports/Player head and face modeling.md` (read §"Prioritised implementation plan", steps 1–5 and 7 now; 6/8/9 as stretch).

Repo `/home/claude/simprog`, branch `heads` from `main` 29b0d4d. Pipeline: `assets-src/players/make_body_shapes.py` → `body_shapes.json` → Houdini (`assets-src/players/houdini/build_players.py`, run on the user's Mac via the Houdini MCP; scene `~/coding/kangs-assets/houdini/kangs_players.hipnc`, exports OBJ to `~/coding/kangs-assets/houdini/export`) → `scripts/build_players.py` (numpy rig → `public/models/players/<variant>.glb`) → `node scripts/player_lods.mjs`. `assets-src/players/preview_body.py` evaluates the same SDF in numpy (marching cubes) for tuning without Houdini.

## Global Constraints

- The head is defined in **absolute metres in a head-local frame** (origin midway between the ear canals, +y up, +z forward; parented to the `head` joint), and does **not** scale with player height (research: heads barely grow with stature). Per-variant variety comes from explicit head parameters, not from H.
- Target landmarks (mm, research table): crown +134; parietal half-breadth ±78 at ≈+40; temples ±58 at ≈+35 (brow line); eyes at ≈+27 (pupils ±33); zygomatic ±72 at ≈+10; subnasale ≈−27 (alae ±17–22); mouth ≈−50 (corners ±27); jaw corners ±52 at ≈−55; chin (menton) ≈−100, squared; ears +33…−33, 66 mm long, ~24 mm protrusion, behind the midline; head length ≈205 (glabella z≈+110, back z≈−95); neck r≈65→72 entering behind the jaw.
- Blend radii per join (research k table): head↔neck 35–58 mm; cranium↔jaw/muzzle 28–46; brow/cheekbone/chin/jaw-angle pads 9–18; eye sockets (smooth subtraction) 12–18; nose 7–14; ears 5–9. The body's global blend radius must no longer apply inside the face.
- The numpy preview and the Houdini VEX must evaluate the **same** SDF (one spec in body_shapes.json; tests compare them where possible).
- Garments/hair that offset `part_sdf("core")` (hair styles, headband) must still fit the new skull.
- Triangle budget: the head region stays ≈1,200–1,600 triangles in LOD0 (tests in tests/players.test.js cap a player at 15k).
- The painted face (src/materials.js `faceTexture`, projected using `info.face`/`info.faceSize` extras from scripts/build_players.py) must line up with the new geometry: eyes in the sockets, mouth on the mouth line.
- `npm test` + `npm run build` green; commit trailers as usual (Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com> / Claude-Session: https://claude.ai/code/session_01TJcs3aM2BUb2S8MMdWg1LU).

## Task H1: Head spec + numpy preview + renders (cloud only)

- Extend the shape spec with a `head` block: shapes in head-local metres with per-shape blend `k` and an `op` (`union` | `subtract`), plus optional Gaussian `bump` features; mirror flag; a few per-variant head parameters (e.g. jaw width, brow, nose width) for variety.
- Build the head from the research recipe: cranium ellipsoid ≈(78,100,102) mm with a forehead taper and flattened side planes; brow ridge; smax eye sockets under the brow; zygomatic/cheekbone pads; jaw (round-cone/box-like) narrowing to ±52 mm corners and a squared chin; muzzle; nose wedge pitched 20–30°; ears rotated back ~15°; neck round cone entering behind the jaw.
- `preview_body.py`: evaluate the head block exactly as the VEX will (document the formulas: IQ ellipsoid approx, round cone, polynomial smin/smax, Gaussian bump) and union it with the body at the neck with the head↔neck k.
- A cloud renderer (numpy sphere-tracing of the SDF, or marching cubes + a simple rasteriser) producing front / side / 3/4 / top renders of the head, plus small renders at 15, 25 and 35 px head height; compare against the landmark table (print measured landmarks from the mesh) and iterate until it reads as a male athlete's head, not a sphere.
- Python unit tests (pytest or a plain `python3 -m unittest` file under assets-src/players/tests) for: landmark positions within tolerance, head size independent of variant height, smin/smax behaviour.

## Task H2: Houdini port and export (needs the user's Houdini)

- Port the head block to `houdini/build_players.py` VEX (HEADER functions + `part_sdf` change), mesh the head sub-volume at 2–3 mm voxels (adaptivity 0) and reduce it separately to ≈1,200–1,500 triangles with feature preservation; keep the neck seam watertight with the body.
- Rebuild all three variants on the Mac, export OBJ, copy them into the repo (`assets-src/players/houdini/export`) and verify md5 (no delete permission on the Mac: copy, don't move).

## Task H3: Rig, LODs and face alignment

- `scripts/build_players.py`: rebuild the GLBs from the new OBJ; update the face extras (`face`, `faceSize`) from the new landmarks (eye line, mouth line); keep head skin weights clean (head bone above the jaw, neck blend).
- `node scripts/player_lods.mjs`; keep LOD1 for the head reasonable (head pixel threshold already prevents LOD1 at close range).
- `src/materials.js faceTexture`: re-place brows/eyes/nose/lips for the new proportions (dark almond eyes in the sockets, no full white sclera, thick brows, lips one value darker), plus painted ambient occlusion (sockets, under the nose, under the jaw) in the face texture; skin material F0≈0.028 (ior≈1.4), roughness 0.5–0.6 (keep the existing wrap lighting).
- tests/players.test.js still green (triangle caps, bone names); add a test that the face extras sit inside the head bounds.

## Task H4: Verify

- Browser: title screen, HQ, Game day Follow/Auto/Courtside, locker room; close-ups like the earlier face check; screenshots before/after.
