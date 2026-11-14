# Players that hold up close and at game distance — plan

Spec: user request 2026-11-12/13 ("make the 3d player look better still"), answers: polish our own models (no imported meshes),
balance game distance and close-ups, "do whatever is recommended" = baked normal + AO maps from a high-detail SDF, plus real
hands, a sneaker shape and a clumpy afro; reference real models/anatomy. Evidence:
`docs/superpowers/notes/2026-11-12-player-detail-references.md` (anthropometry, hands, sneakers, folds, hair),
`.superpowers/players-detail-runtime-survey.md` (runtime facts), `.superpowers/players-detail-bake-proto.md` (baker prototype,
commit bc0d3e1: xatlas atlas + tangent-space normal + SDF AO, median 0.45° normal error in three r180).

Repo `/home/claude/simprog`, branch `players-detail` from main e99883c. Houdini on the user's Mac is optional for this plan:
new shapes are meshed in the cloud (numpy SDF → marching cubes → decimation) so work does not wait on the Mac.

## Global Constraints

- Original work only: no third-party meshes or textures. References inform proportions and detail.
- Triangle cap: worst look (afro + headband + both sleeves) < 15,000 per player at LOD0 (`tests/players.test.js`); LOD1 ratio
  stays 0.2–0.45. Pay for new geometry by removing buried faces (short-hair caps inside the skull etc.) and, if needed, body
  triangles the normal map now carries.
- Bone names unchanged (17, pinned by tests). Hands stay weighted to `wrist_<side>`; no finger bones.
- Fingers must not intersect the ball in dribble/hold/shoot: the hand-on-ball target is the wrist at ball radius .13 + .07
  (`src/motion.js` ~437). Keep curled finger tips within that clearance (test it) or retune the offset with a test.
- Maps: per variant, one RGBA texture per atlas — normal in RGB (OpenGL/+Y, glTF convention), AO in A — atlases
  skin (2048² High / 1024² Medium), kit 1024², gear 1024²; 8 px padding; shipped as separate files under
  `public/models/players/maps/` (not embedded: the Node tests parse GLBs without image decoding), `flipY=false`, `NoColorSpace`.
  GLB carries TEXCOORD_0 (u, 1−v) and TANGENT from the bake. Maps on Medium and High only (Low already uses classic players), as
  a live toggle on the materials (bodies are not rebuilt on a level change); off on the LOD1 mesh (its welded seams smear UVs).
- Existing shader patches (wrap light, pores, mesh perforation, face and jersey-print projection) keep working; the AO in alpha
  needs a small `aomap_fragment` patch. Tune `aoMapIntensity` against GTAO (High) and the painted face AO.
- `npm test`, `npm run build`, the Python suites (`assets-src/players/tests`, `assets-src/players/bake/tests`) green.
  Commit trailers: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` /
  `Claude-Session: https://claude.ai/code/session_01TJcs3aM2BUb2S8MMdWg1LU`. Explicit `git add` paths. One browser at a time.

## Task D1: New shapes, meshed in the cloud (parallel with D2)

Files: new `assets-src/players/cloudmesh/` (SDF parts, marching cubes, decimation, tests), `scripts/build_players.py`
(`hand_parts` replaced by the cloud hand; shoes and afro groups replaced; buried faces dropped).
- Hands: anatomical (hand length .112 H, palm breadth .45 of hand length, finger segments 22/15/10 % of hand length, thumb
  opposed), four separate fingers with real gaps and knuckles, relaxed curl index 20/25/10° → little 35/40/15° (MCP/PIP/DIP),
  defined as SDF capsules so the baker can bake them; ≈600–800 tris per hand; tips inside the ball clearance (test).
- Sneakers: basketball shoe silhouette from the references — heel stack ≈30 mm, forefoot ≈20 mm, heel lift, toe spring ≈10 mm,
  mid-top collar, separate midsole band (sole material) and upper; ≤ the current shoe budget; same per-variant foot placement.
- Afro: union of 25–60 clumps with low-frequency radius noise (asymmetric), clean hairline over the ears/forehead as now;
  ≤ current afro triangles; short styles keep their shape but lose the buried cap faces.
- Each new part provides its SDF to the baker (`sdf_hi` hook) and a mesh in the OBJ convention build_players.py expects.
- Tests: triangle counts per part, watertight/manifold, finger clearance, sneaker dimensions, afro silhouette irregularity.

## Task D2: Production detail functions (parallel with D1)

Files: `assets-src/players/bake/detail.py`, `sdf_hi.py`, tests.
- Skin (what is seen): deltoid/biceps/triceps/forearm separations, subtle forearm veins, knee and elbow, calf/quad lines,
  collarbone, neck tendons, knuckles and nails on the new hands (via D1's hand SDF hook).
- Kit: jersey folds that read as cloth (armhole drape, side-seam pull, waist gathering where tucked/loose, not regular ribbing),
  double-stitched hems and collar binding, side panels; shorts waistband gathers, leg-opening folds, side seam; sleeves compression
  ribs; headband terry ribs.
- Gear: sneaker panels, eyestay, laces, toe-box perforations, midsole texture, outsole tread edge; afro curl texture (coarse
  clumps + fine curl), short-hair strand direction, waves, cornrow braids.
- Bake on the current geometry for iteration; renders per area (before/after/SDF reference) and an art check by eye.

## Task D3: Integrate (after D1 + D2)

- Pipeline order in `scripts/build_players.py`: geometry (OBJ + D1 parts − buried faces) → unwrap (3 atlases) → bake → rig →
  GLB with TEXCOORD_0 (u,1−v) and TANGENT (carried through `clip_openings`, not recomputed); stop overwriting garment UVs with
  cylinder UVs; headband normals averaged before the bake. Maps written as PNG (RGBA) per variant/atlas/level.
- `node scripts/player_lods.mjs` keeps working; LOD1 renders without maps.
- Runtime (`src/players.js`, `src/materials.js`, `src/graphics.js`, `src/arena.js`, `src/drills3d.js`): load maps per variant once
  (shared by every player of that variant), set normalMap/aoMap (alpha) on skin/kit/gear materials, live toggle by graphics
  level, dispose with the template; drills pass the level.
- Tests: GLB has TANGENT + UVs in range for every primitive; map files exist for each variant/atlas; triangle cap; finger
  clearance; materials get maps on Medium/High and none on LOD1.

## Task D4: Verify and review

- Browser: title screen, live game (Follow / Auto / Courtside), locker room, drills; close-ups and game distance; before/after
  sheets; frame time sanity (High vs Medium) on the swiftshader box as a relative check only.
- Independent final review of the branch; then ask the user before merging.
