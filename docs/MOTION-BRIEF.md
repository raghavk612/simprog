# Motion overhaul brief

(Saved verbatim from the owner's brief, with the completion condition from the /goal message that followed it.)

You are the lead engineer on a long-running, fully autonomous MOTION overhaul of the KANGS basketball game (three.js 0.180, Vite, plain JS). Nobody is available to answer questions: decide, log the decision in docs/motion-log.md, and continue. A /goal message with the completion condition follows immediately after this one; keep working until it is met.

## SETUP (do first, then go straight into M0)
1. Save this entire brief as docs/MOTION-BRIEF.md.
2. Stay on the currently checked-out branch. Do NOT create a new branch; the realism work lives on it. Create a git tag `pre-motion` at the current commit (so the work can be rolled back) and record that commit hash in docs/motion-log.md. Never push, never merge, never touch main.
3. Commit the brief, then begin.

## MISSION
Make basketball motion feel real instead of linear, across four areas:
(1) how each player moves: acceleration, momentum, curved paths, plant-and-cut, speed that varies by player;
(2) how the ball moves and bounces;
(3) how players and ball interact: dribble hand contact, passes, catches, shots, rim and backboard, rebounds, steals;
(4) how all ten players move around each other on plays: spacing, screens, cuts, help and closeouts, box-outs, transition.

## CURRENT STATE (from an earlier audit; VERIFY in src/basketball.js, src/motion.js, src/arena/*, src/moves/*; line numbers drift)
- sampleClip is a pure function of (clip, time): authored waypoints, Catmull-Rom routes, a smoothstep speed curve (0.35*m0 + 0.65*smooth(m0)), analytic jumps. This is why motion reads as linear.
- Personal space is a 2D circle push-apart (keepApart), not predictive avoidance. The ball handler is pinned.
- The ball is analytic (fly/launch with gravity and floor bounces), is never parented to a hand, and "holder" is just the nearest player within 0.85. Positions were authored for an old 0.28-radius ball; the drawn ball is about 0.13. Pass arcs are sine lerps. Misses follow a scripted carom. Steals blend/teleport the ball.
- The ball-handling moves in src/moves (crossover, between the legs, behind the back, etc.) are used only on the title screen, never in games.
- A clip is 4.4 s and a possession is two clips. Motion version 2 already exists for off-ball movement; old events replay unchanged.

## UNITS AND REAL-WORLD TARGETS (approximate; 1 ft = 0.3306 scene units, so 1 unit is about 0.92 m; verify and tune by feel, and log your choices)
- Players: jog 3-4 m/s, run 5-6, sprint 7-9 (guards faster than centers by about 10-15%), defensive slide 3.5-4.5, backpedal 3-4. Acceleration from standstill 4-6 m/s^2, tapering with speed. Braking at a plant 6-9 m/s^2. Minimum turn radius grows with speed. Each player gets small seeded variation in top speed and acceleration by position.
- Ball: gravity 9.81 m/s^2. Dropped ball rebounds to about 70% of the drop height on hardwood (restitution about 0.83-0.87). Dribble cadence about 1.5-2.5 bounces/s, tied to speed. Shot flight about 0.8-1.3 s with about a 45-degree entry angle. Rim 10 ft high, 18 in diameter.

## HARD CONTRACTS (never break; verify with tests)
1. The engine decides, the 3D only shows. Never change outcome logic in src/engine.js.
2. sampleClip stays a pure deterministic function of (clip, time) from the caller's point of view. A stateful simulation is allowed ONLY as a deterministic per-clip precompute (fixed timestep, seeded RNG from clip data), cached and interpolated by sampleClip. Precompute must not cause a visible hitch (measure it), and the render loop must stay allocation-free.
3. Authored anchors are HARD constraints the simulation must hit: shooter's release moment and spot, the ball's arrival at the rim (about 0.86 of the clip), phase strings, resolved timing, who ends with the ball, rebound/landing spot, steal and block timing. Everything else may become physical. UI and score-reveal timing must be unchanged (tests).
4. Output shape of sampleClip stays compatible: actors[10] {x,y,z,yaw,run,arms}, index 0-4 home and 5-9 away, shooter is people[0]/people[5], plus ball, phase, bounce, shotHands, blockHands, resolved, flying, net. You may ADD fields.
5. Version gate: new behavior is motion version 3 for newly generated events. Events stored at older versions replay bit-identical (golden tests and npm run trace must still match for v1/v2). Optional: if the repo's "Judge demo" save has stored events judges will replay, upgrade them to v3 ONLY if outcomes, anchors, and phases are provably unchanged for every stored event; otherwise leave them.
6. Body interface, identity keys, settings (players classic|athletes, graphics auto|low|medium|high), Low fallback and text-play fallback, GLB/manifest consistency, save key, reduced-motion behavior, and offline operation all stay intact.
7. Performance: no regression above 2% on any scene at any quality level versus the pre-motion tag, measured back to back with the existing harness. Low must stay light.
8. Credits and AI-disclosure wording is mine. Do not touch it.

## PHASES (commit each separately; keep tests and build green at every commit)
M0 Baseline and instrumentation, no behavior change:
- Build `npm run motion:qa`. It runs over at least 500 seeded clips (all play families, outcomes, both teams) and checks: determinism, no NaN, per-player speed/acceleration/jerk caps, minimum pairwise distance (bodies never overlap except deliberate contact such as screens and box-outs), ball never teleports (bounded speed and acceleration), ball distance to hand while held, bounce restitution band, ball never below the floor or through rim/backboard, anchor and phase timing tolerances versus the baseline, and old-version bit-identical output.
- Build renderers that save: top-down court diagrams of every player's path colored by speed per play family, time-lapse frame strips, and ball height and ball-to-hand distance plots. Save BEFORE versions in docs/motion/before/ and record the baseline metrics.

M1 Movement model: velocity- and acceleration-limited locomotion with momentum, path following with speed-dependent turn limits, curved cuts, plant-and-cut with real braking, jab and pivot, different gaits per speed, per-player variation. Players should visibly accelerate out of stops and lean and brake into turns. Feed real velocity and acceleration to animateAthlete so stride, lean, and facing follow the motion (torso leads, then feet).

M2 Ball physics and possession: scale-correct ball (draw radius and physics radius agree); explicit possession state from the simulation instead of the nearest-player guess; ball held in or driven by the hand during hold phases and released at the right frame; real dribble (push down, bounce with restitution, return to hand, cadence tied to speed, ball kept on the side away from the defender); use the src/moves vocabulary (crossover, between the legs, behind the back) in games when a defender is tight; chest, bounce and lead passes that arrive at the receiver's hands at the right time and give on the catch; shot release from the hand with backspin, arcs that vary by distance; believable rim and backboard interaction for makes (swish, rattle, bank) and misses (clank, roll-out, long carom) that still end at the authored landing spot; loose-ball bounce and roll friction; rebounds secured into hands; steals as deflections, not teleports.

M3 Choreography: replace keepApart with predictive collision avoidance plus soft body contact; role-based spacing; continuous off-ball movement (drift, V-cuts, backdoor, curls); screens where the screener sets and holds, and the defender fights over, goes under, or switches; defenders with ball-you-man positioning, help-side sag and rotation, closeouts with chop steps, and human reaction lag (about 0.15-0.25 s) instead of perfect mirroring; box-outs; transition with fast-break lane fill and players arriving at different times. No two players should ever overlap or pass through each other.

M4 Integrate and tune: make sure the earlier finishes, passes, and reactions still look right with the new timing; tune everything by viewing the diagrams and frame strips; fix whatever the QA suite flags.

M5 Verify and document: AFTER renders in docs/motion/after/, before/after metrics table, perf harness, update README/docs, final report.

## SELF-VERIFICATION (you run unattended; you are your own reviewer)
You can view images. After each phase, open the top-down diagrams, frame strips, and ball plots and critique them honestly against this checklist, iterating until they pass or logging why not:
- No long straight segments with abrupt direction changes; paths curve naturally.
- Visible acceleration, cruising, and braking; no instant starts or stops.
- Cuts show a plant and a lean, not a sharp corner at constant speed.
- Spacing looks like real offense: players hold the arc and corners, nobody clumps, nobody overlaps.
- Screens look like screens; defenders react late and sensibly.
- The ball never teleports; the hand and ball stay together while held; dribble rhythm matches running speed; shot arcs and rim interaction look natural.
Record each critique and fix in docs/motion-log.md.

## RULES
- After every phase: npm test, npm run build, npm run motion:qa, golden tests, and npm run trace (old versions must match) all pass; perf re-measured; images reviewed; then commit.
- If a phase gate fails 3 times, log the blocker in docs/OPEN-QUESTIONS.md and move on.
- Any improvement that costs more than the 2% perf limit for little visible gain: log it and revert.
- Fix small bugs you find (with a test). Log larger ones.

## FINAL REPORT (print when done)
1. Before/after QA metrics (speed, acceleration, jerk, minimum separation, path curvature, ball metrics, anchor timing) in one table.
2. Paths to the before/after diagrams, strips, and plots.
3. Perf table versus the pre-motion tag at High/Medium/Low, plus clip precompute cost.
4. Commits by phase, and what was skipped and why.
5. Remaining weaknesses ranked by visibility to judges.
6. Open questions and risks.

## Completion condition (/goal)
Every phase (M0 through M5) of docs/MOTION-BRIEF.md is complete and verified on the current branch: npm test passes; npm run build succeeds; npm run motion:qa passes on at least 500 seeded clips (determinism, no NaN, speed/acceleration/jerk caps, minimum player separation, ball never teleports and stays with the hand while held, dribble restitution in band, authored anchors and phase timing unchanged, old-version clips bit-identical); the golden tests and npm run trace match for v1/v2 events; a before/after QA metrics table is printed; top-down path diagrams, frame strips, and ball plots exist in docs/motion/ for every play family and have been viewed and critiqued against the checklist; the perf harness shows no regression above 2% versus the pre-motion tag measured back to back, with clip precompute cost logged; each phase is committed separately; docs/motion-log.md is updated; and the FINAL REPORT is printed. Do not stop to ask questions: decide, log, continue. If a phase gate fails 3 times, log it in docs/OPEN-QUESTIONS.md and move on. Do not push or merge.
