# Verification — rebuild

- `npm test`: 19 passing tests, including 150 complete seeded campaigns (50 per level). Covers KingCo 2026–27 schedule integrity for all three levels (18/17/12 games, null scores for upcoming games, saves that validate with them, estimates that fall back to the 2025–26 scoring average), a real roster for every scheduled opponent, opponent rosters and real-name play-by-play, ESPN-style stat lines that add up to the score, per-game leaders that never show zero, resource and roster limits, eligible rotations, training/recovery, timeout cap, deterministic save/resume, box score totals, standings balance and one-season termination.
- Championship is reachable on every level. Over 300 seeded seasons per level with the tested preparation policy: C Team · Rookie 92% titles, Junior Varsity · All-Star 41%, Varsity · Hall of Fame 31%. This is a reachability and ordering check, not an estimate of human difficulty.
- Production build succeeds. Vite reports a non-blocking large-bundle warning for the Three.js renderer; compressed application JS is approximately 175 KB.
- Browser: coach creation, difficulty selection, four-step first-use tour, training, assistant hire, conversation, scouting, timeout, 64-possession complete game, postgame breakdown, rename, recruit, kit change, sources and credit dialogs verified.
- All five external model types loaded. No browser runtime errors in tested flows.
- Saved season survived reload with its record, roster edits and resources intact.
- Responsive checks: 390×844 viewport had document width 390 with no horizontal page overflow; 1440×1000 dashboard checked visually. Roster tables scroll inside their container.
- Production preview verified separately from Vite development mode.
- Service-worker cache is implemented, but server-off reload was not supported in the tested embedded browser. Use the included locally served build as the reliable offline presentation fallback. Do not claim offline cache support for every browser.

The 3D action is a stylized visualization of the possession model, not a full basketball physics or officiating simulation. Real source data is a dated snapshot of the 2026–27 schedules (no scores yet) and the latest published 2025–26 rosters, with daily refresh attempts, not an official real-time feed. Real player averages cover only reported games. State progression and background standings are explicitly simulated.

## Arena presentation and action update

- Eight shot families (catch-and-shoot three, pull-up, stepback, driving layup, floater, hook, dunk, pick-and-roll finish), with recorded steals, blocks, rebounds and assisted baskets. Procedural joint animation follows the saved outcome; this is a stylized simulation, not a full basketball physics engine.
- Tests sample 15 seeded matches for shot/outcome diversity and scoring consistency, verify finite bounded poses, score resolution timing, save validation and speed-independent simulation outcomes.
- Browser checks: title arena renders behind the menu; live court fills the play area; scoreboard, coaching controls and 1×/2×/4× controls work. Checked 1280×720 desktop and 390×844 phone layouts; no horizontal overflow on phone.
- Isolated QA save import succeeds. Final possession finishes before the result dialog appears. Postgame decision-model numbers are collapsed by default.

## Accessibility, sound and language update

- `npm test`: 44 passing tests. The original engine and action tests are unchanged. New tests cover settings validation, the colour-correction matrices (greys unchanged, confusable colours separated), shortcut conflicts, sound handling with no audio device, and language: all seven languages must define exactly the same keys and `{{placeholders}}` as English, every key used by the code must exist, every engine error must have a translation, and language detection and fallback behave.
- Translated play-by-play and decision trail: the engine still writes the same English text and the same random draws. A comparison of the old and new commentary code over 1,536 generated plays found no differences, and a test rebuilds the English text from the stored records across four full simulated seasons and requires an exact match. Saves without the new optional fields still validate; malformed or hostile values in them are rejected.
- Browser checks (Vite development server and the production build): settings dialog on desktop and at phone width; all accessibility options applied and persisted; text size 180 % in Hindi at 375 px wide with no horizontal overflow; high contrast, simplified interface and colour correction; shortcut use, rebinding, conflict and reserved-key messages; Escape cancelling a key capture without closing the dialog; playback speed measured at 7.3 s / 9.7 s / 14.4 s per play for 100 % / 75 % / 50 %; timing assist adding the 2.5 s pause (9.7 s vs 7.3 s per possession); every resolved play announced once to the live region; the Web Audio context created and running while playing; end-of-game result and journal in French and Japanese; language chunks loaded on demand in the production build and listed in the offline cache.
- Found and fixed during checking: a hidden table header that widened the roster page on phones; a top bar and grids that clipped or overflowed at large text sizes.
- Not verified: how it sounds and reads with real assistive technology (screen readers were not run); the audibility and pleasantness of the synthesized sounds were not judged by ear; the translations have not been reviewed by native speakers; no formal WCAG audit.
- Bundle size: main JS 199 KB gzip (previously 181 KB). Each additional language is a separate 14–17 KB gzip chunk fetched only when selected.
- Merged with the team's latest `main` (real rosters for three team levels, season plans, per-game stats, box scores, season leaders, game tracker, notification cards, icon sidebar). The new interface text was added to all seven languages (729 keys each, checked by tests), and a test fails if a position, grade or game type in `public/data/kangs.json` has no translation. After the merge: every screen and dialog was walked in all seven languages with no leaked placeholders or `undefined`; the live game, box score, tracker and notification cards checked in Spanish; phone width (375 px) checked on every screen with no horizontal overflow; long translated menu names wrap instead of clipping.

## Second merge with `main` (2026–27 season, roster viewer, skill drills)

- `npm test`: 47 passing tests (the engine tests from `main` plus the accessibility, language and narrative tests). The language tests now also scan `src/drills.js`, require the new run-time keys (handbook tabs, drill names, quiz questions, ratings, archetypes, tiers), and check that every error the interface can show has a translation. All seven languages define the same 977 keys.
- Ported into the new screens: the roster viewer and table, practice planner and skill drills (three-point, free-throw, close-out and recovery timing, rules quiz), score bug, five-camera selector, tabbed handbook, upcoming-game schedule, opponent-logo credit and player profile. All text is translated, including the 12 quiz questions. The handbook's key list follows the player's own key bindings.
- Keyboard: Watch live is now **W** (as in `main`), **Space** also plays the next possession, cameras are **1–5** and **H** opens the handbook; all twelve are rebindable and conflict-checked. Camera changes are announced.
- Drills: timing assist makes the timing windows wider and the marker slower; swish, rim, success and error sounds follow the sound settings.
- Checked in a browser (Vite development server): every screen without console errors; the Spanish quiz drill passed and failed; handbook tabs, profile and settings in Spanish; high contrast on the roster viewer and practice planner; 375 px wide at 180 % text in English, Spanish, French, Japanese and Hindi with no horizontal overflow (fixed: a pill, the starter label, small buttons, the handbook buttons and single-column grids that could widen the page).
- Not verified: the shot drill and live 3D camera changes were not driven end to end here (the browser pane throttles animation frames); screen readers were not run; the new translations have not been reviewed by native speakers.
- The locker-room note no longer claims that no official logo is used, because the Kangs logo is now shown on the court and in the interface.

## Bug and accessibility batch from `REMAINING-WORK.md` (B0–B7, B12, B13, B15)

- `npm test`: 49 passing tests. New engine tests cover `setStarter` (minutes follow the starter flag, a new starter takes the unassigned minutes, no changes mid-game) and `lineupIssues` (names, reasons, bench players without minutes ignored). The language tests cover the new lineup, tracker and tour strings in all seven languages.
- Checked in a browser at 1366×768: on Game day the control bar is fully in view (document height equals the window); after toggling a starter with the keyboard focus stays on the same checkbox and the page does not scroll; un-starting a player zeroes the minutes and the hero card agrees with the table; with an injured starter and one below the GPA line, Game day and Roster name them with the reason, tip-off is refused with the same message, and "Fix lineup" clears it; a drop-down choice made with the pointer blurs the field and one made with the keyboard keeps focus; the tour card sits beside the sidebar item it explains.
- Not covered by an automated test: the focus and scroll restore (it needs a browser), the live-court layout at other window sizes, and B7 on a phone.

## Judge demo

- `npm test`: 50 passing tests. A new engine test checks that `E.demoSeason` is repeatable, is a valid save in the middle of the season with no game in progress, still qualifies for the final run and can finish the season (`E.playTo`). The seed is chosen at run time (the first of 400 whose story fits: 4–5 wins at mid-season, then qualifying and winning with sensible preparation), so it survives a refresh of the schedule data; building it takes about 0.1 s.
- Checked in a browser: the title-screen button loads a 4–3 Junior Varsity season, the guide walks through eight pages, **J** and the button jump to 9–4 at the start of the final run, the player's own save is byte-identical afterwards, and leaving the demo returns to the title screen with "Continue" for the real season. English and Spanish guide text were read; the guide was not run through a full timed presentation.

## Balance pass (D1, D2, D4)

- `npm test`: 52 passing tests. New tests cover the diminishing returns (`E.growthRoom`, the skill ceiling, development coach, the decision trail reporting the real gain), one-on-one sessions being worth 1.8×, and `E.opponentRating` (a school keeps its rating, real results set it, the final run is 7 points tougher).
- `node scripts/balance.mjs 200` before and after: with sensible practice the title rate falls from 79 / 60 / 42 % to 58 / 35 / 23 % (C Team / JV / Varsity), and average skill after eight games falls from the 98 cap to about 89–90. No practice stays close to hopeless on JV and Varsity. The numbers depend on the simulation, not on real players, and are a design choice, not a prediction.
- Not done: D3 (token sinks) needs a design decision. D4 is only partly solved: a plan made only of one-on-one sessions still wins about half as often as whole-team practice.

## "Why that shot?" drawer

- A third drawer under Play-by-play and Box score shows how each factor (skill, energy, morale, chemistry, shot type, space, tactics) moved the chance of the latest resolved play, as signed numbers in percentage points with decorative bars, plus the player, the shot and its chance. The numbers are the existing `play.impacts` already used by the postgame analysis, so nothing in the simulation changed. It is a live region, translated into all seven languages, restyled for high contrast, and opening it closes the other two drawers.
- Checked in a browser with animation frames shimmed (the pane throttles them): after one possession the drawer showed "Jacoby Dickens · Catch-and-shoot three · 57 % chance" with seven factors. Not checked on a phone or with a screen reader.
