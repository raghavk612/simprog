# Verification — rebuild

- `npm test`: 14 passing tests, including 50 complete seeded campaigns. Covers published-data integrity, correct average calculation, resource and roster limits, eligible rotations, training/recovery, timeout cap, deterministic save/resume, box score totals, standings balance and one-season termination.
- Championship is reachable: 45/50 Rookie campaigns won with the tested preparation policy. This is a reachability test, not an estimate of human difficulty.
- Production build succeeds. Vite reports a non-blocking large-bundle warning for the Three.js renderer; compressed application JS is approximately 175 KB.
- Browser: coach creation, difficulty selection, four-step first-use tour, training, assistant hire, conversation, scouting, timeout, 64-possession complete game, postgame breakdown, rename, recruit, kit change, sources and credit dialogs verified.
- All five external model types loaded. No browser runtime errors in tested flows.
- Saved season survived reload with its record, roster edits and resources intact.
- Responsive checks: 390×844 viewport had document width 390 with no horizontal page overflow; 1440×1000 dashboard checked visually. Roster tables scroll inside their container.
- Production preview verified separately from Vite development mode.
- Service-worker cache is implemented, but server-off reload was not supported in the tested embedded browser. Use the included locally served build as the reliable offline presentation fallback. Do not claim offline cache support for every browser.

The 3D action is a stylized visualization of the possession model, not a full basketball physics or officiating simulation. Real source data is a dated 2025–26 snapshot with daily refresh attempts, not an official real-time feed. Real player averages cover only reported games. State progression and background standings are explicitly simulated.

## Arena presentation and action update

- Eight shot families (catch-and-shoot three, pull-up, stepback, driving layup, floater, hook, dunk, pick-and-roll finish), with recorded steals, blocks, rebounds and assisted baskets. Procedural joint animation follows the saved outcome; this is a stylized simulation, not a full basketball physics engine.
- Tests sample 15 seeded matches for shot/outcome diversity and scoring consistency, verify finite bounded poses, score resolution timing, save validation and speed-independent simulation outcomes.
- Browser checks: title arena renders behind the menu; live court fills the play area; scoreboard, coaching controls and 1×/2×/4× controls work. Checked 1280×720 desktop and 390×844 phone layouts; no horizontal overflow on phone.
- Isolated QA save import succeeds. Final possession finishes before the result dialog appears. Postgame decision-model numbers are collapsed by default.
