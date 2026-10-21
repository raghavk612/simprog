# Verification — rebuild

- `npm test`: 9 passing tests, including 50 complete seeded campaigns. Covers published-data integrity, correct average calculation, resource and roster limits, eligible rotations, training/recovery, timeout cap, deterministic save/resume, box score totals, standings balance and one-season termination.
- Championship is reachable: 48/50 Rookie campaigns won with the tested preparation policy. This is a reachability test, not an estimate of human difficulty.
- Production build succeeds. Vite reports a non-blocking large-bundle warning for the Three.js renderer; compressed application JS is approximately 175 KB.
- Browser: coach creation, difficulty selection, four-step first-use tour, training, assistant hire, conversation, scouting, timeout, 64-possession complete game, postgame breakdown, rename, recruit, kit change, sources and credit dialogs verified.
- All five external model types loaded. No browser runtime errors in tested flows.
- Saved season survived reload with its record, roster edits and resources intact.
- Responsive checks: 390×844 viewport had document width 390 with no horizontal page overflow; 1440×1000 dashboard checked visually. Roster tables scroll inside their container.
- Production preview verified separately from Vite development mode.
- Service-worker cache is implemented, but server-off reload was not supported in the tested embedded browser. Use the included locally served build as the reliable offline presentation fallback. Do not claim offline cache support for every browser.

The 3D action is a stylized visualization of the possession model, not a full basketball physics or officiating simulation. Real source data is a dated 2025–26 snapshot with daily refresh attempts, not an official real-time feed. Real player averages cover only reported games. State progression and background standings are explicitly simulated.
