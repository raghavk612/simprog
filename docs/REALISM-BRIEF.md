# Realism brief (owner's instructions, saved verbatim in substance)

Work on a branch. You are the lead engineer on a long-running, fully autonomous improvement of the KANGS
basketball game in this repo (three.js 0.180, Vite, plain JS). Nobody is available to answer questions. When you
hit a decision, make the best call, log it in docs/realism-log.md, and continue. Ship in phases, and keep the game
building and passing tests at every commit.

## Mission

The game is an FBLA Computer Game & Simulation Programming entry (2026-27 topic: "Road to the Championship").
Judges see (1) the title screen, (2) Auto-camera broadcast games, (3) replay close-ups, (4) orbit zoom, in a
3-minute demo. Make the basketball players look and move substantially more realistic, and make the code faster
and cleaner, without breaking anything that works. Quality bar: a judge should not be able to tell at a glance
that this is a student project.

## Current state (from a prior read-only audit; verify every claim and line number, since they drift)

- Default bodies are skinned glTF "athletes" (17-bone rig, 3 variants guard/forward/center). Low quality uses a
  crude primitive "classic" body.
- No AnimationMixer and no clips. All motion is per-frame math: sampleClip (src/basketball.js) gives
  deterministic positions per (play, time), and animateAthlete (src/motion.js) does procedural stances, two-bone
  leg/arm IK, and damped easing.
- Weakest motion: every finish except the jump shot (layup, euro, floater, hook, spin, dunk, roll, putback) is one
  static arm preset plus a generic leg tuck. Passes are lerped arcs with no body motion. Steals have no reach. No
  celebrations, dejection, huddles, or free-throw routines. One run cycle for all speeds, no start/stop or
  plant-cut. Defenders have "airplane" arms. Off-ball players wiggle on sine waves.
- Weakest visuals: no anti-aliasing when the broadcast look is on (composer target has no MSAA, no FXAA/SMAA).
  Visitors are always orange. Skin tone and face follow body slot, not person. Rendered height comes from position
  class, not roster height. Trim and hems look ragged up close, shorts are rigid shells, hands are rigid mitts.
- Performance (M1 Pro, High): about 2.4M triangles per frame across several passes. The crowd is 950k of the 1.09M
  scene triangles and casts shadows on High. Players are only 135k. All athlete meshes have frustumCulled=false.
  motion.js has about 46 per-frame allocations. The ball trail re-runs sampleClip 8x per frame. Auto-quality can
  only step down once, so a weak device ends at Medium (still athletes, bloom, grade, crowd). A High session
  downloads about 15.8 MB of player assets (lossless PNG). Main JS chunk is 1.12 MB (333 kB gzip).
- src/arena.js is a 1,904-line file that owns renderer, lights, players, loop, and cameras.
- Dead code: PLAYER_STYLES in players.js. src/moves is used only on the title screen.
  docs/visual-overhaul/README.md is outdated.

## Decisions already made (do not re-litigate; flag in the final report if one proves wrong)

- Art direction: stylized-broadcast realism. Believable weight, balance, and basketball technique. Not photoreal
  skin or faces.
- Approach: procedural motion, no rig swap. Do NOT use Mixamo. Any new external asset must be CC0 or original and
  recorded in docs/sources.md. Prefer zero new external assets.
- The Houdini/Python bake pipeline (assets-src/players, scripts/build_players.py, scripts/player_lods.mjs) is
  permitted. The Houdini script reads /Users/raghav/coding/kangs-assets; check whether it exists on this machine.
  If not, work around it or modify the GLBs with the Python/Node scripts from the repo, and log it.
- School logos, the locked-stamp image, and all existing assets are cleared and attributed.
- Credits and AI-disclosure wording is handled by the owner. Do not edit it.
- Extra bones (clavicle, toe, twist) only if a specific, demonstrated defect cannot be solved without them, and only
  after checking every bone-name consumer (motion.js, drills3d.js, first-person head). Default is no.
- Target hardware: a mid-range school laptop or Chromebook-class integrated GPU. Performance must not regress
  anywhere and should improve on Medium/Low.
- Classic/Low body stays as the fallback and gets a basic upgrade (planted feet, less sine-wave motion). Lower
  priority.
- Old saves and replays must keep working. If you change what sampleClip returns, gate the new behavior behind a
  versioned field so events without it replay exactly as before.

## Hard contracts (never break; verify with tests)

1. The engine decides, the 3D only shows. Animation never changes an outcome. Do not modify the outcome logic in
   src/engine.js (makePlay/possession).
2. sampleClip stays a pure, deterministic function of (clip, time). actors[10] shape {x,y,z,yaw,run,arms} with
   index 0-4 home, 5-9 away; shooter is people[0]/people[5]. The ball, phase, bounce, shotHands, blockHands,
   resolved, flying, and net fields keep their meaning.
3. Body interface: BODY_PARTS and validBody in players.js, bones by name, setLettering/setLod/setDetail/height/key,
   attachBody. Identity: player.userData.{slot,person,identity,plate}; cast() matches by identity.split('|')[0].
4. Settings players:'classic'|'athletes' and graphics auto|low|medium|high. Low must work with no models, and
   WebGL failure must degrade to text play (arena.failed).
5. GLB extras and maps/manifest.json uvHash stay consistent (tests/playerMaps.test.js).
6. Save key kangs-three-season-v2 and the stored event shape stay backward compatible.
7. Reduced-motion behavior still works.
8. The game works fully offline and the service worker precache still works.

## Self-verification

View the screenshots and contact sheets and critique them against the realism checklist: weight and balance, no
airplane arms, hands gripping the ball, feet planted, no limb clipping through torso or ball, believable jump arcs
and landings, readable silhouettes at broadcast distance, clean trim and hems up close, no aliasing. Iterate on
failures, and record critique and fix in docs/realism-log.md. A phase is done when tests pass, measurements are
re-run, and the image review passes.

## Process

- **Phase 0 (baseline, no behavior changes):** npm install and npm test; a repeatable measurement harness in
  scripts/ (frame time median/p95, draw calls, triangles, JS heap, bytes downloaded at High/Medium/Low during a
  live possession, on the title screen and in a replay close-up) saved to docs/perf-baseline.md; a golden-pose
  test (sampleClip and animateAthlete outputs for seeded plays at fixed times); a contact-sheet script (each
  finish type, pass, defensive stance, run speed, close-up) with "before" sheets under docs/.
- **Phase 1 (cheap, high-visibility wins), each committed separately:** anti-aliasing in the composer path;
  defensive arms and other static presets; visitors in the opponent's colours, skin tone, face and height
  following the person; dead code and outdated docs.
- **Phase 2 (motion):** locomotion (idle, walk, jog, sprint, backpedal, slide, lean, start/stop, plant-and-cut,
  stride tied to distance, idle variety); distinct finishes (layup, euro, floater, hook, spin, dunk, alley-oop,
  roll, putback); passes, steals, rebounds, blocks and contests; purposeful off-ball and defensive movement behind
  a versioned field; reactions (celebration, dejection, huddle, free-throw routine, high-fives); animation
  principles throughout.
- **Phase 3 (visuals):** trim and hems, shorts and jersey drape, hands and grip; lighting and materials at
  close-up and orbit-zoom distances.
- **Phase 4 (efficiency):** crowd shadows and cost; redundant passes; athlete frustum culling; per-frame
  allocations; ball-trail sampling; block-sampling recursion; multi-step auto-quality with recovery; player-map
  compression or lazy loading by level; main-chunk splitting.
- **Phase 5 (code quality):** split src/arena.js into cohesive modules as a behavior-preserving refactor; comments
  on the contracts; tests for new behavior; README and docs; refreshed "after" sheets and perf numbers.

## Rules

- After every phase: npm test green, npm run build succeeds, measurements re-run, screenshots reviewed, commit.
- If an improvement costs more than about 10% frame time on Medium for little visible gain, drop it.
- If a phase gate fails 3 times, log the blocker in docs/OPEN-QUESTIONS.md and move on.
- Fix small bugs you find (with a test). Log larger ones.
- Keep docs/realism-log.md: what changed, why, measured effect, image critiques.

## Final report

1. Before/after table for frame time, draw calls, triangles, bytes downloaded, and main chunk size at
   High/Medium/Low.
2. Contact-sheet paths showing before/after for each motion category and the close-up shots.
3. Commits by phase, and anything intentionally skipped with the reason.
4. Remaining weaknesses ranked by visibility to judges.
5. Open questions and risks for the owner.
