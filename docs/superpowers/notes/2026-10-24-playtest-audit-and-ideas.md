# Task 5 — Playtest audit + brainstorm (read-only)

Build under test: `main` @ 59ee6eb, built to `/tmp/claude-0/audit-dist`, served on 127.0.0.1:4185. No repo file was edited (`git status` shows only the pre-existing untracked `docs/superpowers/`). Engine unit tests: 17/17 pass (`npm test`).
Screenshots: `/tmp/claude-0/audit/` (`d-*` = 1440x900, `m-*` = 390x844). Headless numbers come from `/tmp/claude-0/audit/sim.mjs` and `sim2.mjs` (200 seeded seasons per cell, engine only).

Test environment caveat: software WebGL on a 2-core box shared with other agents ran at roughly 1 fps, so animation-timing observations are not representative. Throttled requestAnimationFrame to ~6 fps for the interaction scripts. Console during all runs: no page errors from the game itself (the only `pageerror`, `Cannot read properties of null (reading 'style')` from `timingDrill.paint`, is an artifact of my rAF throttle: `cancelAnimationFrame` cannot cancel a setTimeout stand-in. The only real-world exposure is the unguarded drill timeouts noted in B13). Warnings were only the SwiftShader/ReadPixels GL messages.

Coverage: title; new game on C Team (rookie) incl. 4-step tutorial (JV and Varsity new-game runs timed out on the starved CPU, but all three difficulties were exercised via engine simulation and via saved JV/Varsity states); every sidebar view at 390 wide and the ones listed at 1440; Help/handbook (all 8 tabs), Credits; practice planner + three real drills (quiz, free-throw shot drill, timing drill); roster edits; live game flow from a seeded near-final save; finished-season saves (champion, eliminated). Anything not reached is flagged "not verified".

---

## 1. Bugs found

Severity: H = fix before judging, M = visible to a judge/user, L = polish.

| # | Sev | What | Repro | Evidence | Where |
|---|-----|------|-------|----------|-------|
| B0 | **H (UX)** | **Live-game control bar is below the fold on common laptop sizes.** In live mode the right rail is `position:absolute;bottom:0` inside a `.game-layout` that is taller than the viewport, so System / Tempo / Viewing speed / **Watch live / Next play / Timeout** are off-screen: bottom edge at 975 px on a 900 px viewport (1440x900), 843 px on 768 (1366x768, the standard school laptop), 821 px on 720. The player sees an arena, a score bug and a "Choose a play and watch the possession develop" line but no way to start a possession unless they scroll or know the W / Space / T hotkeys. The earlier build (`/tmp/claude-0/kshots/jv-live.png`) showed the bar inside the viewport, so this looks like a regression from the camera-bar + play-call strip added in the latest commit. | Game day -> Tip off (or load `save-nearend.json`) at 1366x768. `document.documentElement.scrollHeight` = 860 / 992 / 838 vs viewport 768 / 900 / 720. | `/tmp/claude-0/audit/d-live-1366.png`, `d-live-1440.png`, `d-live-1280.png`; measured: `auto:[799,843]` with `vh:768` | `src/style.css` `.live-match .game-layout` / `.court-panel` (make the live layout `height:calc(100dvh - 46px)` and let the arena flex to fill; stack camera bar + play-call + control bar in normal flow instead of absolute overlays). |
| B1 | H (a11y) | **Keyboard focus is thrown to `<body>` after every action.** Every click re-renders the whole app with `innerHTML`, so a keyboard user who presses Enter on a nav item, "Add to plan", "Build eligible rotation", "Sign", etc. loses their place and has to Tab from the top of the sidebar again. Also resets scroll in places (practice page jumped down after the drill modal closed). | Focus `Roster & rotation` with Tab, press Enter, read `document.activeElement` -> `BODY`. | Measured: `FOCUS after nav Enter -> BODY` | `src/main.js` `render()` (line ~112, `app.innerHTML=...`). Fix: before render remember `document.activeElement` by `data-action`/`data-view`/`data-id` (+ scrollY), re-focus the matching node after; or just re-focus the active nav item. |
| B2 | M | **Starter checkboxes desync.** The hero card "Starter" box and the table row box are two inputs for the same player; the `change` handler writes `p.starter` but never re-renders, so after toggling one the other still shows the old value. Unchecking a starter also leaves his minutes > 0, so tip-off fails with only "Select exactly five starters". | Roster page: uncheck hero "Starter" for the selected player -> table row still checked, state has 4 starters. | `d-roster-desync.png` (hero unchecked, row checked); measured `[False, True]` | `src/main.js` `document.addEventListener('change',...)`, the `data-starter` branch (line ~157): add `render()` and clear `minutes` when un-starting. |
| B3 | M | **Tutorial arrow always points at the bottom sidebar item ("Real Kangs data / 09")**, whatever the step. Step 1 says "choose your five starters" but the arrow is on the wrong nav item, and the card overlays real content (covers the Academic check-in card on step 3, the lower HQ area on step 1). No dimmed backdrop, no focus move, not reachable for screen readers. Step 4 says "state bracket" even for C Team / JV (their final run is a "title run"). | New game (any difficulty), step through 1-4. | `d-rookie-home-tut1.png`, `d-rookie-tut3.png` | `src/main.js` `renderTutorial()` (line ~116) + `.tutorial`/`.tutorial-arrow` CSS: position the arrow next to `[data-view=<step view>]`, use `plan().runName`. |
| B4 | M | **Stale practice target after releasing a player.** `selected` (training group) keeps the released player's id. The `<select>` falls back to "Whole team" visually, but `E.train(state,key,selected)` throws "Choose a player", so every drill you pass is reported as failed (`r.passed=false`) and the slot is not consumed - looks like the drill is broken. | Pick a single player in Practice planner -> Full profile -> Release -> Practice -> pass any drill. | Engine confirmed (`train(...,'<released id>')` -> "Choose a player", actions stay 3). UI path by code reading; not clicked through. | `src/main.js` `selected` global (line 7), `E.train(state,key,selected,...)` (line ~97). Reset `selected='all'` in release / when id not found. |
| B5 | M | **Game day gives no pre-tip-off warning for an illegal lineup.** "Ready for tip-off?" lists five starters at 32m with no sign that one is injured/exhausted/<2.0 GPA. The error appears only after clicking Tip off, and doesn't name the player. After every real game energy/GPA drop, so this will hit users often. | Load a save with an injured starter, Game day, Tip off. | `d-game-inelig.png`; toast text "An assigned player is injured, exhausted, or below the game's 2.0 GPA threshold." | `game()` lineup rows (main.js ~107) + `E.validateLineup` message in `src/engine.js`. Show a red "Injured / GPA 1.9 / Tired" chip per row, disable Tip off or offer "Fix lineup" (calls `autoLineup`), and name the player in the error. |
| B6 | M | **"Watch live" silently stalls when a `<select>` has focus.** The auto-play interval skips stepping while `document.activeElement` is SELECT/INPUT, and nothing re-blurs the tactic/tempo select after a change. Button still reads "Pause game". | Watch live, change System or Tempo, then do nothing. **Verified:** after Watch live + ArrowDown on System (change event fired, tactic -> zone), possession stayed at 63 for 20 consecutive 2-second polls while the button still read "Pause game" and `document.activeElement` was the SELECT. | `src/main.js` `setInterval` (line ~181) | Blur the select on `change`, or drop the activeElement guard (use `e.target` focus only while the dropdown is open). |
| B7 | L | **Handbook > Controls on a 390px phone: the "1 2 3 4 5" key row overlaps its description text.** | Open Help at 390 wide. | `m-rules.png` | `.ctl-row`/`.ctl-keys` CSS (`min-width:84px`, five kbd chips overflow); let the row wrap or stack key chips above text under 620px. |
| B8 | L | **Phone layout: nav grid + header + tracker take ~560 of 844 px before any content.** On Practice/Coach's office the actual controls start below the fold. | Any view at 390x844. | `m-view-practice.png`, `m-view-staff.png`, `m-view-game.png` | Collapse the 3x3 nav into a sticky bottom tab bar / hamburger on <620px; shrink the tracker to one line. |
| B9 | L | Phone Program HQ: the metrics grid is misaligned (CHEMISTRY/FANS columns indent differently from RECORD/TOKENS). | Home at 390 wide. | `m-view-home.png` | `.metrics>div{padding:0 23px}` + 2-col wrap at <=620px. |
| B10 | L | Landing at 390 wide: `.landing-visual` / title canvas right edge = 394px (4px past the viewport). No visible page scroll, but the "Continue saved season" button is also narrower than the primary button. | Title at 390. | automated overflow probe; `m-landing-saved.png` | `.landing-visual` width / `.wide` button margin. |
| B11 | L | **Native `confirm()` dialogs** are used for replacing a save, releasing a player and importing. They block the main thread (and the 3D loop), are unstyled, and Playwright/kiosk-style presenter machines may suppress them. | Start new game with a save; Release a player. | code | `main.js` lines ~152, 162, 166. Use the existing `<dialog>`. |
| B12 | L | Error toasts overlap the top-right tracker card and live ~6.5 s; stacked toasts from earlier errors persisted into the next screen ("Select exactly five starters" was still on screen after I fixed the lineup). | Roster -> trigger error -> go elsewhere. | `d-practice-planned.png` | dismiss toasts on view change. |
| B13 | L | Drill `setTimeout`s (`finish` after 700-900 ms, zone reset after 750 ms) are not cleared by the drill's cleanup; closing the modal inside that window runs them against a detached node (`$('.timing-bar')` null -> TypeError in console). Harmless for state, noisy. | Close the practice modal right after a timing-drill attempt. | code reading (partially seen via my rAF-throttle artifact) | `drills.js` cleanup closures: collect timeout ids. |
| B14 | L | Save/export size: pretty-printed full-season export is ~1.4 MB for 28 Varsity games (`JSON.stringify(s,null,2)`), the import guard is 2 MB. A 30-game Varsity season that ends in a title run is close. Event `plays[].impacts` are the bulk. | Export after a full Varsity season; re-import. | measured 1,384,406 chars (28 games, indented) vs `size>2e6` | `export` (no indent, or compress events older than N games) / raise limit. |
| B15 | L | **Season tracker is wrong after an early elimination.** An eliminated 26-2 Varsity team shows "30 / 30", "28 PLAYED", "2 LEFT" together; the ending copy ("The final whistle. Coach finished 26-2") never says *why* the season ended (lost the elimination game vs whom). A 26-2 team losing one win-or-go-home game feels harsh with no recap. | Load `save-lost.json` (`/tmp/claude-0/audit/`), Season journal. | `d-end-lost-season.png` | `tracker()` (main.js line 17-18): when `finished` and `done<n` show "ELIMINATED - game 28"; add the losing result as the first line of the journal and a "what went wrong" suggestion. |
| B16 | info | In my preview the console shows `The script has an unsupported MIME type ('text/html')` 4x: `sw.js` registration, because I built with `vite build` only. `npm run build` runs `scripts/offline.mjs` which generates `dist/sw.js`, so production is unaffected. Not a bug, noted so nobody chases it. | - | - | - |

### Balance / design findings (not code bugs, but judges will feel them)

Headless engine results (200 seasons per cell, auto-lineup bot, 64-possession games; "practice" = 3 perfect drills per week, rest when team energy < 60):

| Strategy | Difficulty | Title % | Win % | Avg margin |
|---|---|---|---|---|
| No practice | C Team (rookie) | 19 | 78 | +10.9 |
| No practice | JV (standard) | **0** | 46 | -1.1 |
| No practice | Varsity (elite) | **0** | 26 | -9.3 |
| Perfect practice | C Team | 95 | 99 | +30.5 |
| Perfect practice | JV | 64 | 92 | +20.1 |
| Perfect practice | Varsity | 32 | 89 | +17.5 |

- **D1. Skill snowballs to the cap in ~5 weeks.** Perfect shooting-lab x3/week took the JV team average skill 71.3 -> 98.0 (the cap) after 5 games (energy collapsed to ~4 but the cap was already hit). Progression has no diminishing returns, so by mid-season practice has nothing left to give and the game is decided. Fix: gain scaled by `(98-skill)/30`, or per-player caps by class/archetype.
- **D2. Opponent strength ignores the real opponent.** `opponent().rating = 68+(week%5)*2 (+7 postseason)`; the real final scores and records in `kangs.json` are shown but never used. Seeding rating from the real result (`against - points`, or the opponent's real record) would make "real data" actually matter and fix the C Team/JV difficulty curve.
- **D3. Tokens are not scarce.** +230/+160 per game vs sinks of 50 (scout), 150-375 (tryouts), 250-300 (assistant). After 3 games a no-spend coach already has 1,480. `plans[].cost` exists in the engine but is unused ("never bought"). Add sinks (travel, equipment, staff upkeep, boosters) or tie income to fans.
- **D4. "Training group" does nothing useful.** One player or whole team costs the same slot, so the optimum is always Whole team.
- **D5. No-lineup state is the player's normal state.** Because GPA/energy decay each game (`-0.07` GPA per game played; starters at 32 min are ineligible after ~11 games without study hall), the default autoLineup lineup becomes illegal repeatedly (see B5). That is a good mechanic (it forces study hall and rotation) but it needs UI surface, not toasts.
- **D6. Scores.** Average 64.3 - 68.3 per game vs real Lake Washington 60.3 ppg; plausible. Games are 64 possessions (no real quarters/clock; scoreboard fakes Q1-Q4 from possession count).
- Minor: LED board shows the *previous* final (e.g. BELLEVUE 67) on Game day while the page header names the *next* opponent (`d-game-inelig.png`, `m-view-game.png`); label it FINAL or blank it before tip-off.

## 2. UX fixes (quick wins, each under ~1 hour)

1. Restore focus + scroll after `render()` (B1). Biggest accessibility win for a rubric that scores UX/accessibility.
2. Per-row eligibility chips on Game day and Roster ("INJURED", "GPA 1.9", "TIRED"), plus a one-click "Fix lineup" and a toast that names the player (B5).
3. Make the starter checkboxes a single source of truth (B2); un-starting zeroes minutes.
4. Tutorial: highlight the actual nav item per step, dim the rest, and use the real run name per difficulty (B3).
5. Reset `selected='all'` whenever the roster changes (B4).
6. Tip-off preview card should say what to expect: opponent style hint (after scout), your team's average energy/chemistry, and "3 of 3 timeouts".
7. Replace `confirm()` with a styled `<dialog>` (B11) and add "Cancel" focus.
8. Phone: sticky bottom nav and a compact tracker (B8); fix the controls overlap (B7) and metrics grid (B9).
9. Add `aria-live` announcement for score changes during live play (the play-call line already is `aria-live`; the score bug is not) and `aria-pressed` is on cameras but not on speed/tactic.
10. Font floor: >60 CSS rules use 10-12 px uppercase text (eyebrows, table heads, chips). Raise the floor to 12-13 px; offer an A+/A- control.
11. A "Skip to content" link and visible focus ring on dark sidebar buttons (focus ring exists globally: `3px #a879e5`, good).
12. Show next-game opponent logo/record on Program HQ (task 2 already adds logos) and a one-line "What should I do now?" nudge (e.g. "2 slots left, Liberty is a perimeter team: scout it").
13. Export: offer "copy season code" (seed + difficulty + decisions hash) for presenters.
14. Credits/ethics: the AI-assistance line ("OpenAI Codex") is honest and good; add a short "How the model works" panel (shot probability factors) reachable from Game day. Judges ask this.

## 3. Live game flow (from seeded near-final save; throttled renderer)

Seeded from `/tmp/claude-0/audit/save-nearend.json` (JV, possession 61 of 64, 78-57).

- Camera bar (Auto / Wide / Courtside / Follow / Player view): all five buttons switch and the active class follows (`CAM active ['auto']` after the last click; `1`-`5` hotkeys map as documented). Player-view and Follow screenshots: `d-cam-player.png`, `d-cam-follow.png`.
- Timeout huddle: opens a focus-trapped `<dialog>`; choosing "Calm the team" decremented timeouts 3 -> 2 and closed cleanly (`d-timeout.png`).
- Space = Next play works (possession 61 -> 62).
- Watch live: starts and advances; **but stalls whenever the System/Tempo select keeps focus (B6, verified).**
- **Controls are below the fold at 1440x900 and 1366x768 (B0, verified with bounding boxes).**
- Visual: the DOM score bug at the top of the arena sits directly over the 3D LED scoreboard, so the viewer sees two scoreboards stacked (`d-live-play1.png`); the 3D board still shows the previous opponent's final during tip-off prep.
- Not verified: the final-whistle -> result modal -> endscreen path for a live-finished game (my run stalled at possession 63 because of B6 and the CPU budget). The finished states themselves render correctly from saves: champion (`d-end-champ-game.png`: "You brought it home.", record, tracker 19/19) and eliminated (`d-end-lost-season.png`; see B15).


## 4. Feature ideas (brainstorm)

Effort S = under a day, M = 1-3 days, L = a week+. Risk = chance it breaks something existing or eats presentation time.

| # | Idea | Pitch | Why it helps | Effort | Risk |
|---|------|-------|--------------|--------|------|
| 1 | **Judge / demo mode** | A "Demo" button on the title screen that loads a mid-season save, plus a hotkey to jump to "next elimination game" and a 3-minute guided script overlay. | Presentation (3/7/3 min) and Q&A; no rebuilding state on stage. | S | Low |
| 2 | **Season awards + report card** | End screen with MVP, Most Improved, Defensive Player, Coach grade, "decisions that mattered" list and a downloadable PNG card. | Fun, replay value, rubric: multiple outcomes, visual polish. | S-M | Low |
| 3 | **Playoff bracket view** | Season journal shows the final-run bracket (8/16 teams from real opponents) filling in as you win. | Topic ("road to the championship") made visible; UX clarity. | S-M | Low |
| 4 | **Balance pass: real opponent strength + diminishing returns** | Seed `rating` from the real result/record, scale skill gains by remaining headroom, add token sinks. | Rubric: challenging but completable; makes real data matter. | S | Med (needs re-sim; unit tests cover it) |
| 5 | **Coach's inbox / random events** | Weekly 2-3 choice events (parent complaint, rumor of transfer, sponsor offer, finals week) with morale/chemistry/token trade-offs and a news ticker. | Innovation, replayability, "strategic leadership" in the topic. | M | Low |
| 6 | **Rivalry weeks** | Flag the 1-2 real rivals on the schedule; rivalry games give extra fans/tokens but amplified morale swings, with trash-talk headlines. | Storylines from real data; fun. | S-M | Low |
| 7 | **Sound design** | Crowd ambience, whistle, swish/rim, buzzer, volume slider (all WebAudio, no assets); currently just one blip on a made basket and sound is off by default. | Rubric: graphics/audio consistency; atmosphere. | S-M | Low |
| 8 | **Accessibility pack** | Text-size slider, high-contrast and colour-blind-safe palettes, "reduce 3D" toggle, dyslexia-friendly font option, screen-reader score announcements. | Rubric: UX/accessibility; inclusive. | M | Low |
| 9 | **Graphics quality / low-spec mode** | Auto-detect low fps and drop shadows/pixel ratio/crowd; manual Low/Med/High. Presenters' school laptops and Chromebooks will struggle (render dt is capped at 0.05 s, so slow machines also slow the game). | Reliability during live demo. | S | Low |
| 10 | **Halftime / quarter adjustments** | Auto-pause at each quarter with a stat compare and 2-3 suggested adjustments (e.g. "their guards are hot: switch to pressure"). | Decisions with feedback inside a game; explains the engine. | M | Med |
| 11 | **Recruiting mini-game** | Replace the tryout list with a short scouting scrimmage where you watch 3 possessions and reveal hidden traits before signing; fix a fixed budget. | The topic explicitly names recruiting; currently it is the weakest system (buttons with 3 numbers). | M | Med |
| 12 | **Player development arcs** | Per-player skill sparkline, potential/ceiling, breakout/slump tags, "most improved" tracking. | Depth, story, awards fodder. | M | Low |
| 13 | **Multi-season dynasty** | Seniors graduate, new freshmen arrive, tokens/fans carry over, program rating persists. | Innovation, long-term replay; fits "program". | L | High (save schema v4, balance) |
| 14 | **Achievements** | Local badges (Perfect Drill, Undefeated Regular Season, Beat the Rival, Zero-Injury Season, Championship on Varsity) shown on the title screen. | Fun, replayability, cheap. | S | Low |
| 15 | **"Why that shot?" live clipboard** | During live play show the shot probability factor bars (skill, energy, chemistry, tactics) already stored in `impacts`. | Transparency; excellent for judge Q&A; teaches. | S | Low |
| 16 | **Broadcast highlights + Player of the Game** | After the buzzer auto-queue the top 3 plays (by shot chance swing) with lower-third graphics and a POG card. | Visual wow, uses existing replay system. | M | Low |
| 17 | **Challenge codes / hot-seat duel** | A seed code to share ("same season, who does better?") and an optional two-coach hot-seat mode where players alternate tactic picks. | Innovation; classroom fun. | M (codes) / L (duel) | Med |
| 18 | **Budget & boosters** | Ticket revenue from fans, sponsor deals, equipment/travel costs so tokens are a real constraint. | Rubric: resources; fixes D3. | M | Med |
| 19 | **Academic calendar** | Finals week/report-card events that hit GPA unless you scheduled study hall. | Ties the eligibility mechanic to a story. | S | Low |
| 20 | **Printable season report / share card** | One-page PDF or PNG with record, leaders, standings and decision trail. | Take-away for judges; easy to attach to the presentation. | S | Low |

## 5. Ranked top 8 (impact / effort)

1. **Bug + accessibility batch, starting with B0 (live controls below the fold), B1 (focus loss), B2, B5, B6** (ideas 8/9 light): S-M, highest rubric payoff (UX/accessibility/controls) and removes the flaws a judge will find in the first 2 minutes.
2. **Judge/demo mode** (idea 1): S; turns the 3/7/3 minute presentation from risky to rehearsed.
3. **Balance pass** (D1-D3 / idea 4): S; makes "challenging but completable" true on all three levels and makes the real data matter.
4. **Season awards + report card + Player of the Game** (ideas 2, 16 light, 20): S-M; gives the season a satisfying ending and a take-away.
5. **Playoff bracket view** (idea 3): S-M; makes the "road to the championship" literally visible.
6. **"Why that shot?" live clipboard** (idea 15): S; best Q&A asset and teaches the model on screen.
7. **Sound design pack** (idea 7): S-M; closes the audio gap in the rubric.
8. **Coach's inbox events + rivalry weeks** (ideas 5, 6): M; innovation and storytelling from the real schedule.

Next after those: recruiting mini-game (11), halftime adjustments (10), achievements (14); multi-season dynasty (13) only if time remains, because it changes the save schema.
