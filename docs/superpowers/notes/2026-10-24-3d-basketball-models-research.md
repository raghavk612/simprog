# Task 4 research spike: animated 3D basketball player models for the Three.js game

Date: 2026-10-24. Read-only spike; no repository files were edited. The only things written are this report and scratch downloads in the session scratchpad.

Evidence labels used throughout:
- VERIFIED = read on the source page or measured from a downloaded file.
- UNVERIFIED = secondary source only, or I could not open the source.
- Network caveat: the sandbox proxy blocked quaternius.com, itch.io, kenney.nl and poly.pizza for direct downloads (only raw.githubusercontent.com worked). I could read those pages through the fetch tool but could not inspect the real Quaternius or Kenney zips. Exact file names inside the zips are therefore UNVERIFIED and must be checked at download time.

---

## 1. Bottom line

- No free, redistributable source I found ships a complete basketball clip set (dribble, jump shot, layup, dunk, pass, defensive slide) on a skinned character. The only way to get the whole set for free is to build it from CMU mocap.
- Cleanest legal path: CC0 character plus CC0 locomotion library, with the basketball arm poses kept procedural. Rig-level arm overrides reuse the existing `pose.arms` math.
- Mixamo is the best quality and the easiest to retarget, but its terms forbid distributing the raw files. A public GitHub repo plus GitHub Pages is exactly that, so it is a license risk. I could not verify that Mixamo even has basketball clips.
- Recommended primary: Quaternius Universal Base Characters plus Universal Animation Library, both CC0.
- Recommended backup and upgrade path: CMU mocap basketball clips baked onto the same rig. This is real dribble and shoot motion with clear terms, but it is the most Blender work.
- Day-1 pipeline validation: use the CC0 RobotExpressive.glb (464 KB, verified downloadable) while the real art is prepared.

---

## 2. Candidate-by-candidate findings

### 2.1 Mixamo (Adobe), https://www.mixamo.com

- **Contents:** auto-rigged humanoids (a few dozen) and roughly 2,500 animations on a standard `mixamorig:` skeleton. Output is FBX only. Convert to GLB through Blender (File > Export > glTF, NLA Tracks mode) or gltf-transform/FBX2glTF. (Cinevva guide, Sept 2026.)
- **Basketball category:** UNVERIFIED. Mixamo needs an Adobe login and the animation API is token-gated, so I could not enumerate it. Searches found no listing of Mixamo basketball clip names. The only hint is a Reallusion forum user who matched a ball to "basic Mixamo dribble movement". The CC0/other-source assumption "Mixamo has Dribble / Jump Shot / Layup" must be checked by a human logged into Mixamo.
- **Status 2026:** still working per Cinevva (Sept 2026), free with an Adobe ID. Enterprise and Federated IDs, and China-country accounts, are blocked. Adobe's FAQ was last updated in 2021, and the library "hasn't been meaningfully expanded in years". The Adobe community forum has 2025 outage and "login broken" threads. Treat it as legacy and do not build a pipeline that depends on re-downloading.
- **License (Adobe community FAQ, https://community.adobe.com/t5/mixamo-discussions/mixamo-faq-licensing-royalties-ownership-eula-and-tos/m-p/13234775, page dated 2022):**
  - "Video Games" and "DLC or Addon Content for Games" are listed under "YES, you can create...".
  - "really the only thing you can't do is distribute the raw character and animation files."
  - Under "NO": "Any type of free distribution of character or animation raw files".
  - Engine templates, asset packs and asset-store packages that distribute the raw files are prohibited.
  - "You may not distribute the files to customers or non-team members however."
  - Credit is optional.
- **Public repo and GitHub Pages:** a committed `.glb` or `.fbx` in a public repo is a free distribution of raw files. Serving the GLB as a static file also lets anyone download it. This is not safe to rely on. The usual defence ("embedded in a shipped game") is contestable for a browser game where the file is directly fetchable. Treat Mixamo as unsafe for this repo unless the team accepts the risk or legal signs off.
- **Rig compatibility:** `mixamorig:Hips`, `Spine`, `Spine1`, `Spine2`, `LeftArm`, `LeftForeArm`, and so on. Measured in the three.js sample files: Soldier.glb, Xbot.glb and Michelle.glb all use `mixamorig:*` (66 to 68 nodes).
- **Retargeting:** onto the Quaternius rig, use `THREE.SkeletonUtils.retargetClip` with a bone-name map, or retarget in Blender. Both are well trodden.
- **Per-player jersey:** Mixamo characters usually have one body material. Splitting jersey faces needs Blender.

### 2.2 Quaternius packs

All pages read through the fetch tool.

**Universal Animation Library (UAL)**
- URL: https://quaternius.itch.io/universal-animation-library (also https://quaternius.com/packs/universalanimationlibrary.html).
- Contents:
  - 120+ animations on a universal humanoid rig.
  - Locomotion in 8 directions, jog, sprint, push, crawl, swim, sit, death, combat, gun actions, emotes.
  - The page does not mention basketball, dribble, jump shot or layup.
- Tiers:
  - Standard: free, 15 MB, 45 animations.
  - Pro: pay $9.99 or more, 41 MB, all 120+, FBX and GLB.
  - Source: pay $14.99 or more, 46 MB, adds `.blend`.
- Root motion: two variants (full root motion and disabled). v3.0 (16 June 2026) added root motion to all locomotion. UAL 2 lists v2.0 with the same 16/6/2026 date, so version labels across the two pages are inconsistent.
- Standard-tier animation names: UNVERIFIED for UAL 1. Download the Standard zip and list the clips before paying.
- Rig: "universal humanoid rig"; the page says it is "compatible with other common rigs, such as Mixamo". Same naming scheme as Quaternius modular outfits and base characters.
- Character mesh included: the page does not say. Use Universal Base Characters for the mesh.
- License (page text): Creative Commons Zero v1.0 Universal, "Free to use in personal, educational and commercial projects."
- Polycount: not applicable (animation-only).

**Universal Animation Library 2**
- URL: https://quaternius.itch.io/universal-animation-library-2
- 110+ animations: behaviour, locomotion, combat, zombie, fishing, idles and emotes, melee, farming, parkour-style.
- Free Standard set (42 animations, names listed on the page): CHEST_OPEN, CLIMB_UP_1M, COUGHING, HARVEST, PLANT_SEED, WAVE, KNOCKBACK, IDLE_POSE_ARMS, IDLE_CARRY, IDLE_LANTERN, IDLE_RAIL, IDLE_RAIL_CALL, IDLE_SHIELD_BREAK, IDLE_SHIELD, IDLE_TALKING_PHONE, LAYFACEUP, MELEE_HOOK, MELEE_HOOK_REC, MELEE_JUMP_LAND, NINJUMP_JUMP, NINJUMP_LAND, NINJUMP_SLASH, NINJUMP_SPIN, NINJUMP_SPIN_REC, SLIDE, SLIDE_LOOP, OVERHAND_THROW, SWORD_DASH, SWORD_REGULAR_A, SWORD_REGULAR_A_REC, SWORD_REGULAR_A_COMBO, SWORD_REGULAR_A_COMBOB, WALK_CARRY, WALK_IDLE, ZOMBIE_SCRATCH, ZOMBIE_WALK_FWD.
- Useful for basketball: OVERHAND_THROW (could stand in for a pass), SLIDE and SLIDE_LOOP (possible defensive slide stand-in, but it is a ground slide, check visually), NINJUMP_JUMP and NINJUMP_LAND (jump and land).
- No basketball content. CC0, same rig as UAL 1.

**Universal Base Characters**
- URL: https://quaternius.itch.io/universal-base-characters
- 6 base bodies: Superhero, Regular and Teen proportions, each male and female. 20 hairstyles.
- About 13k triangles on average.
- Humanoid rig; "Compatible with the Universal Animation Library".
- Standard zip 122 MB, Source zip 600 MB (paid $19.99 or more). Formats for Standard are not stated on the page (GLB expected; check).
- CC0.
- Materials: Source includes shaders for eye and skin colours. The page does not mention separate clothing materials. Jersey and shorts almost certainly need a Blender material split (see Section 4).
- "Teen" proportions are a good fit for high-school players.

**Ultimate Animated Character Pack**
- URL: https://quaternius.com/packs/ultimatedanimatedcharacter.html (Nov 2019).
- 52 models, "animated and textured", FBX, OBJ and Blend. Reportedly around 17 clips per character (Cinevva: "Casual Female... 17 clips"), such as idle, walk, run, jump, punch, death. Names UNVERIFIED.
- License: the pack page says CC0 and "free to use in personal and commercial projects". Cinevva's 2026 guide instead claims a "Quaternius Asset Licence (QAL v1.0)" now applies "going forward", which allows commercial use but forbids reselling or redistributing the assets as a standalone pack. I could not confirm QAL on any Quaternius page. Re-check the licence file inside whichever zip you actually download, and keep a copy in `public/licenses/`.
- Lower-poly option if 13k triangles is too heavy. Different rig from UAL.

**RobotExpressive (Quaternius-derived, in the three.js repo)**
- Measured: 463,988 bytes. Clips: Dance, Death, Idle, Jump, No, Punch, Running, Sitting, Standing, ThumbsUp, Walking, WalkJump, Wave, Yes. 3 materials (Grey, Main, Black). Rig is not Mixamo.
- Licence (README quoted): "Model by Tomás Laulhé... CC0 1.0. Modifications by Don McCurdy..."
- URL (verified 200): https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/models/gltf/RobotExpressive/RobotExpressive.glb
- Robot look, so use it only to build the pipeline.

### 2.3 Kenney (CC0)

- Animated Characters 1: https://kenney.nl/assets/animated-characters-1. CC0, version 1.0, 05/11/2019, tagged zombie/survivor. Formats and clip list were not shown on the page; Cinevva says FBX, glTF and others. Style: survivors/zombies. No basketball.
- Mini Characters: https://kenney.nl/assets/mini-characters. CC0, 2024, 25 files. The page lists "Animation" as a feature but names no clips. A Cinevva note says the GLB references an external `Textures/colormap.png`; another Cinevva note says Blocky and Mini Characters are unanimated. Conflicting, UNVERIFIED.
- Licence text, from the Kenney licence already in this repo (`public/models/LICENSE-Kenney.txt`): "License: (Creative Commons Zero, CC0)... This content is free to use in personal, educational and commercial projects. Support us by crediting Kenney or www.kenney.nl (this is not mandatory)".
- Tinting is easy (flat colormap), but the style is blocky and there are no basketball clips. Not recommended unless a cartoon look is wanted.

### 2.4 three.js example models

Measured by parsing the GLB JSON from the r180 tag.

| File | Size | Clips | Rig | Provenance and licence |
|---|---|---|---|---|
| Soldier.glb | 2.16 MB | Idle, Run, TPose, Walk | `mixamorig:` (68 nodes), 2 skins | Example page says "(model from mixamo.com)". Mixamo terms apply. No separate licence file found. |
| Xbot.glb | 2.93 MB | agree, headShake, idle, run, sad_pose, sneak_pose, walk | `mixamorig:` (70 nodes) | Same: "model from mixamo.com". |
| Michelle.glb | 3.28 MB | SambaDance, TPose | `mixamorig:` (67 nodes) | Mixamo-sourced (inferred from rig and name). |
| RobotExpressive.glb | 0.46 MB | 14 clips (above) | custom | CC0 per README (quoted above). |

- The three.js repo is MIT for code. I found no per-asset licence for Soldier, Xbot or Michelle. Treat them as Mixamo-terms assets and do not copy them into this repo's `public/`.
- None have basketball clips.

### 2.5 Sketchfab (downloadable rigged basketball players)

Sketchfab download needs a login and the API token, so file contents are UNVERIFIED for every row.

| Model | Licence | Detail |
|---|---|---|
| Basketball Character 3D Model for Games, by KidBi-Gaming (https://sketchfab.com/3d-models/basketball-character-3d-model-for-games-18d6d21893624853a9ada4ff28d55d66) | CC BY 4.0 | 2.8k tris; tagged rigged, t-pose, animation; whether animation clips exist is not stated; separate body-part meshes. 89 downloads. |
| basketball animation, by voltyfine (https://sketchfab.com/3d-models/basketball-animation-5b40a318db984c5fa79ef33e4fb3cdaa) | CC BY 4.0 | 65k tris, downloadable, one baked animation (published 8 Nov 2022). Unlikely to be a reusable rig. |
| Low Poly Basketball Player Dribble Animation, by chroma3d (https://sketchfab.com/3d-models/low-poly-basketball-player-dribble-animation-a4afa841b7224206a1d60ed0c7b0932d) | Paid "royalty free" (price not shown) | 3.2k tris, 25-bone Mixamo-compatible rig, one dribble clip (66 frames at 24 fps), glTF/FBX/blend. Page carries a NoAI notice. Cheap way to get a rigged player with a real dribble, but you must read the royalty-free terms for public-repo use. |
| Basketball player low poly [idle], by xwhn (https://sketchfab.com/3d-models/basketball-player-low-poly-idle-animation-46bd815907fe4ddca50667e98c0a7a81) | not stated | 6.6k tris, one idle clip. |
| T-Pose Rigged Kevin Durant / Brittney Griner / etc. (3dpassion.net) | Paid | 101k tris. Real NBA/WNBA player likenesses; purchase only. Do not use. |

CC-BY means attribution is required (add a credits line) and the files can be redistributed with credit. The free CC-BY models give a body at best, not a full move set.

### 2.6 Ready Player Me and other avatar systems (2026)

- Ready Player Me shut down on 31 Jan 2026 after Netflix acquired it (announced 19 Dec 2025). Previously exported GLBs still work but anything served from RPM servers does not (Avatar SDK blog, https://avatarsdk.com/blog/2026/08/31/avatar-platforms-2026-whos-alive-whos-gone/ , author discloses they sell the competing MetaPerson).
- Also gone per that source: Union Avatars (offline since July 2026) and Spatial (closure announced July 2026). Still active as of Aug 2026: MetaPerson, Avaturn, Genies, MetaHuman, Character Creator (Reallusion), VRoid Studio. Terms for redistributing exported avatars in a public repo were not checked, and most of these are photoreal or anime rather than a stylized sports figure. Not recommended.

### 2.7 itch.io, OpenGameArt, Poly Pizza, paid packs

- itch.io free "basketball" 3D tags (checked two listings): only balls, courts and arcade machines. No player rigs or animations. "Dunkmaster Darius" (R1games1) unclear.
- OpenGameArt "basketball player" (https://opengameart.org/content/basketball-player, juanmotor, CC-BY 3.0 and CC-BY-SA 3.0): two 2D PNG sprites (gasol_botando.png, gasol_lanzando.png). Not 3D. It also looks like a real player's likeness.
- Poly Pizza: search returned nothing useful (UNVERIFIED).
- Fab "Basketball" by avo animo-mocap (https://www.fab.com/listings/b13b7b06-8c0f-435e-88df-0b616c15e468): 167 mocap clips, FBX, Mecanim humanoid. Covers locomotion, triple-threat, crossover/behind-back/between-legs, chest/bounce/overhead passes, defensive stances, steals, blocks, jump shots, layups, dunks, floaters, hook, fade-away, free throws, celebration, jump ball. This is the best basketball-specific set I found, but it is paid and the licence field was not shown ("Select a license"; "Allows usage with AI: No"). Standard marketplace terms normally forbid putting raw assets in a public repo. UNVERIFIED, but assume it blocks public commit.
- Unity Asset Store "Basketball Avatars Actions" (Sports-Actions): $70, Unity EULA "Extension Asset". Same redistribution problem. Not usable in a public repo.
- MoCap Online lists basketball packs (per their own blog); I could not open their basketball page. Commercial licence; public repo redistribution not confirmed.

### 2.8 CMU mocap (the free path to real basketball motion)

- Source: http://mocap.cs.cmu.edu/ . Licence text (VERIFIED on the home page): "This data is free for use in research projects. You may include this data in commercially-sold products, but you may not resell this data directly, even in converted form." The cgspeed BVH conversion adds (quoted via the cmubvh README): "CMU places no restrictions on the use of the original dataset, and I (Bruce) place no additional restrictions on the use of this particular BVH conversion."
- Basketball content (secondary evidence): the cmubvh README indexes "Dribble, shoot basketball" at subject 06, "Nursery rhymes, basketball, bending" at subject 26, and "Basketball" in the 102-111 range. A KIT Motion Database mirror tags CMU "Basketball" as motion #1113. A Unity basketball game (gcaastro1/basketball-game, PRs #3 and #4) imports 69 CMU basketball clips and names them `basketball_forward_dribble_06_02`, `06_04`, `06_05` ("window 0.88-2.63 s... exactly two bounces"), `06_08_Mirror`, `signals_27_06`, `signals_32_07`, plus jump shot, layup, free throw. That is the best proof that CMU covers dribble, jump shot, layup and free throw. Dunk, pass, defensive slide and block coverage is UNVERIFIED. I could not enumerate the exact CMU clip list because the CMU search pages block crawlers.
- Quality: raw, long, non-looping, non-game-ready captures on a CMU skeleton (about 31 bones, not Mixamo). They need cutting, loop-finding, foot-cleanup and retargeting in Blender. Estimate 3 to 5 days for 8 to 10 usable clips.
- Redistribution reading: committing baked clips to a public repo is not "reselling", and CMU says commercial inclusion is fine. Add a credit line anyway ("Data from the CMU Graphics Lab Motion Capture Database").
- Where to get BVH: https://github.com/Shriinivas/cmubvh (no licence file; relies on the cgspeed statement) and the cgspeed conversions (the Google Sites page failed to load for me).

---

## 3. Comparison table

| Option | Basketball clips | Format | Size | Licence for public repo | Per-player jersey tint | Rig |
|---|---|---|---|---|---|---|
| Quaternius Universal Base Characters + UAL | No (locomotion, slide, throw, jump, emotes) | GLB/FBX | ~13k tris/char; zips 122 MB + 41 MB (we ship ~2 MB) | CC0, yes | Needs Blender material split | Universal humanoid, Mixamo-compatible |
| CMU mocap (baked to the same rig) | Dribble, shoot, layup, free throw (verified indirectly) | BVH to GLB | small once baked | Permitted for products; no direct resale; credit | n/a (clips only) | CMU skeleton; retarget |
| Mixamo character + clips | UNVERIFIED | FBX to GLB | ~2-3 MB each | No: raw-file distribution forbidden | Needs Blender split | mixamorig |
| Fab "Basketball" (167 clips) | Yes, full set | FBX | not stated | Probably no (paid, terms not shown) | Own character needed | Mecanim humanoid |
| Quaternius Ultimate Animated Character Pack | No | FBX/OBJ/Blend | low poly | CC0 per pack page; QAL claim unverified | Separate flat materials likely | Own rig, not UAL |
| Kenney Animated Characters | No | FBX/glTF | small | CC0 | Easy | Own rig |
| three.js Soldier/Xbot | No | GLB | 2-3 MB | Mixamo terms | Hard | mixamorig |
| Sketchfab CC-BY free models | Not confirmed | GLB | 2.8k to 65k tris | CC BY with credit | Varies | Varies |
| Ready Player Me | n/a | n/a | n/a | Platform closed 31 Jan 2026 | n/a | n/a |

---

## 4. Integration assessment for this codebase

### 4.1 What the code does today (read from `src/arena.js`)

- `build()` makes 10 people with `this.player(i, colour)`; they are added to `this.people` and posed every frame in `posePlayer(player, pose, t, ease)`.
- The pose contract from `sampleClip` (src/basketball.js) is: `x, y, z, yaw, run (0..1), arms`. `arms` values in use: `dribble`, `shoot`, `block`, `rebound`, `hook`, `defend`, `screen`, `pass`, `run`, `relax` (and none). `y` is the jump height.
- Each person is a `THREE.Group` whose `userData` holds: `legs[]`, `arms[]` (with `.userData.elbow`), `jersey` (a material whose `.color` is set per team), `number` (a plane whose `.material.map` is a canvas texture), `nameplate`, `identity`. `setIdentity()` re-colours the jersey and re-draws the number and name textures.
- Everything is blended with an `ease` factor, a shared `gait` clock (so a clip restart never pops), `from` snapshots between clips, and honours pause, `speed` and `prefers-reduced-motion`.
- `GLTFLoader` is already imported and used for Kenney furniture in `importModels()` (`public/models/*.glb`). Three is `^0.180.0` (r180 installed), `SkeletonUtils` (`clone`, `retarget`, `retargetClip`), `DRACOLoader`, and `libs/meshopt_decoder.module.js` are all in `node_modules/three/examples/jsm`.
- `scripts/offline.mjs` precaches every file in `dist/` through a service worker (`cache.addAll`). Currently `dist` is about 2.4 MB. A missing or oversize asset would fail service-worker install, so any new GLB must exist in `public/` and stay small. The GitHub Actions workflow deploys `dist` to Pages from a public repo, so assets must live in the repo (or be fetched in CI from a private source).

### 4.2 Proposed design (works for any rig above)

1. **Asset**: one `public/models/player.glb` containing the skinned mesh plus all clips, compressed with `gltf-transform optimize --compress meshopt --texture-compress webp`. Load it once with `GLTFLoader` (set the meshopt decoder), inside `try/catch`.
2. **Clone 10 times**: `SkeletonUtils.clone(gltf.scene)`. This rebinds skeletons, but materials and geometry stay shared by reference. For per-team jersey colour, clone the jersey material once per team (2 materials) and assign the right one; clone per player only if numbers are baked into the jersey texture.
3. **Team tint**: in Blender, give the jersey and shorts their own material slot (e.g. `Jersey`, `Shorts`). At runtime set `.color` from `setIdentity`'s `bg`/`fg`, as the code does today for `userData.jersey`. If the jersey texture has detail, use white base-colour so `.color` multiplies cleanly.
4. **Number and name**: keep the existing `textTexture()` and `userData.number` / `userData.nameplate` planes, but parent them to the Spine2 bone (the back plane) instead of the group, so they follow torso lean. This reuses all current `setIdentity` code with no change. The alternative of painting the number into a per-player jersey texture costs 10 extra 512 px textures and is worse.
5. **Keep the `userData` contract**: the rig builder sets `userData.jersey`, `.number`, `.nameplate`, and a new `.rig = {mixer, actions, bones}`. `posePlayer` gets a branch: if `u.rig`, drive the mixer, else run the old procedural code. This keeps the fallback trivial.
6. **Driving clips from the pose data**:
   - Locomotion: blend idle, jog and sprint by `pose.run`. Use `action.setEffectiveWeight` for a 1-D blend, and scale `timeScale` by the speed and `run`. Crossfade over about 0.15 to 0.25 s using `crossFadeTo`.
   - Airborne: when `pose.y > ~0.05`, fade to a jump pose.
   - Upper body: split each clip into upper-body and lower-body clips at load (filter `clip.tracks` by bone name prefix), then play the upper-body layer separately for `dribble`, `shoot`/`block`/`rebound`/`hook`, `pass`, `defend`, `screen`. three.js has no built-in bone mask, so this track-filter trick is needed.
   - For states with no clip (all of them on the primary option), after `mixer.update()` apply Euler offsets to shoulder and elbow bones using the same `x/z/elbow` numbers as `posePlayer` (an axis-mapping pass per rig, about a day of tuning).
   - Time: drive `mixer.update(dt)` from the same `dt` and pause/speed logic that updates `this.gait`; when paused use `dt=0`; when `!this.motion` (reduced motion) call `mixer.setTime(0)` for a static pose.
7. **Fallback**: build the procedural figures first (as today). When `player.glb` loads, swap each person's visuals; if loading or parsing fails, or `WebGLRenderer` skinning fails, log once and keep the procedural figures. Do not block game start on the load.

### 4.3 Effort estimate

| Work item | Days |
|---|---|
| Loader, clone, mixer wiring, locomotion blend, tint, number plane, fallback, pause/speed/reduced-motion handling | 1.5 to 2 |
| Blender: material split, optional decimation, merge selected UAL clips, rename, export, compress | 1 |
| Procedural upper-body overrides (dribble, shoot, pass, defend, block, rebound, hook, screen) on the new bones | 1 to 1.5 |
| Visual QA (broadcast camera, close follow cam, 10 players), regression pass, licence/credits files | 1 |
| **Total, primary option** | **about 5 to 6** |
| Backup (CMU clips): cut, clean, retarget, loop 8 to 10 clips, wire as upper-body layers | +3 to 5 |

### 4.4 Performance

- 10 skinned characters is light. At about 13k triangles each that is 130k skinned triangles, and the existing shadow-casting `DirectionalLight` (2048 map) draws them twice. A high-school sim on an integrated GPU should handle this, but the safer budget is 5k to 8k triangles per character (decimate or use the Teen body, drop hair strands). That is 50k to 80k skinned triangles.
- Mixer cost for 10 skeletons of about 65 bones is well under 1 ms per frame on CPU. Three uses bone textures for skinning, so there is no 64-bone uniform limit.
- Draw calls: expect about 2 to 4 per character (body, hair, eyes) plus 2 decal planes. Merge hair and body into one mesh where possible.
- Keep `renderer.setPixelRatio(min(dpr,2))` as is. Test on a throttled laptop (Chrome 4x CPU slowdown) and consider turning off shadows for skinned meshes if the frame time exceeds budget.

### 4.5 File size budget

- `player.glb` (mesh plus about 12 to 16 clips, meshopt-compressed, 512 to 1024 px WebP textures): target 1.5 to 2.5 MB. Hard cap 3 MB.
- Current `dist` is 2.4 MB, so the offline precache would land around 5 MB. Acceptable, but every byte also goes into the service-worker cache and its install must not fail.
- Verify with `npm run build` and `ls -la dist/models`. Whether GitHub Pages gzips `.glb` is UNVERIFIED, so rely on meshopt compression inside the file rather than HTTP compression.

### 4.6 Licensing hygiene (any option)

- Add the licence text beside the asset, as the repo already does for Kenney (`public/models/LICENSE-Kenney.txt`, `public/licenses/`). For CC0 add a `LICENSE-Quaternius.txt`; for CMU add the acknowledgement; for CC BY add attribution.
- Do not commit Mixamo or marketplace files (Fab, Unity Asset Store) to the public repo.

---

## 5. Recommendation

### Primary: Quaternius Universal Base Characters + Universal Animation Library (CC0), with procedural basketball arm poses

Why: the only complete, clean-licence, rig-matched pair, with explicit CC0 text. It is committable to the public repo and servable on GitHub Pages, the rig is retargeting-ready, and the existing per-frame arm maths can be reused so we still get dribble, shoot, pass, defend and rebound arm poses without any basketball mocap. The character looks like a normal teenager rather than a robot.

Exact files to download:
1. https://quaternius.itch.io/universal-base-characters. Standard zip (122 MB). Take the Teen or Regular proportion male GLB (or the glTF/FBX if no GLB), plus a hairstyle. UNVERIFIED which file names it contains.
2. https://quaternius.itch.io/universal-animation-library. Pro tier ($9.99 or more, 41 MB, all 120+ clips, GLB). Pick the "root motion disabled" variant. The free Standard (45 clips, 15 MB) may be enough: list its clip names first; you need idle, jog, sprint, jump, an 8-direction strafe or side-step (for defence), and a throw.
3. Optional: https://quaternius.itch.io/universal-animation-library-2 (Standard, free) for `OVERHAND_THROW`, `SLIDE`, `NINJUMP_JUMP`, `NINJUMP_LAND`, `IDLE_*`. Same rig.
4. The CC0 licence file from each zip, saved to `public/licenses/` or beside the GLB.
5. Day-1 pipeline testing only (not for shipping): https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/models/gltf/RobotExpressive/RobotExpressive.glb (verified, 463,988 bytes, CC0 per its README).

### Backup and upgrade path: CMU mocap basketball clips baked onto the same Quaternius rig

Why: the only free source of real dribble, jump shot, layup and free throw motion with permissive terms ("You may include this data in commercially-sold products, but you may not resell this data directly, even in converted form"). It is also independent of the Quaternius clip set, so if the procedural arms look poor this is the fix.

Exact files to download:
1. CMU subject 06 ("Dribble, shoot basketball"), subject 26, and the 102 to 111 range ("Basketball") as BVH from https://github.com/Shriinivas/cmubvh (folders `Sequence-001-009/06`, `Sequence-020-029/26`, `Sequence-102-111/102`) or the cgspeed conversion. Candidate clip IDs named by an independent Unity project: 06_02 (forward dribble), 06_04, 06_05 (two clean bounces at 0.88 to 2.63 s), 06_08 (mirror for left hand), 27_06 and 32_07 (signals/idle), and the jump-shot, layup and free-throw takes in the 102 range. Check the actual contents before committing to the plan.
2. Blender with the "Retarget BVH" add-on (or Auto-Rig Pro) to map onto the Quaternius skeleton.
3. Add the CMU acknowledgement to the credits.

### Not recommended for this repo
- Mixamo (raw-file redistribution ban), Fab "Basketball" 167-clip pack and Unity Asset Store packs (marketplace terms; best clip set but cannot go in a public repo), Ready Player Me (shut down), real-player Sketchfab models (likeness, paid).
- If the team later wants the premium look, the right way is to buy the Fab pack and build the GLB privately at deploy time (for example a GitHub Actions step that pulls it from a private release asset or secret store), keeping the repo free of the raw files. That is a larger change to the deploy workflow and is out of scope here.

---

## 6. Unverified items to check before committing to the plan

1. Whether Mixamo has any basketball clips (needs an Adobe login).
2. Clip names inside the UAL Standard (free) zip, and exact file names inside the Universal Base Characters zip.
3. Whether Universal Base Characters has separable jersey/shorts materials (assume it does not).
4. Whether Quaternius really moved to a "QAL v1.0" licence (Cinevva claim) or still uses CC0 (Quaternius pages say CC0 as of 2026).
5. The exact list of CMU basketball clips and whether dunk, pass and block exist.
6. Fab "Basketball" licence terms and price; Sketchfab free models' actual clip contents.
7. Whether Kenney Mini Characters ships with animations.
8. Whether GitHub Pages gzips `.glb`.
