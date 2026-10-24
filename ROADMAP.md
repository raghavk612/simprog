# KANGS · Road to the Championship: Roadmap & Open Work

_Last updated: 2026-10-24. This file is a to-do list only: nothing below has been built yet unless it says **Live**._

Live game: https://raghavk612.github.io/simprog/

---

## 0. What's live right now (for context)

- 2026–27 KingCo schedules for Varsity (18), JV (17) and C-Team (12) with times, home/away and venues; unplayed games show **Upcoming** (no invented scores). Kangs rosters are the **2025–26** lists (pinned by policy).
- Opponent mascot logos (13 schools) on Program HQ, the live score bug, the 3D gym scoreboard and the Real Kangs data page; initials crest fallback.
- How to Play handbook (8 tabs), body text white; first-person **PLAYER VIEW** label in Player view / Auto camera.
- Practice planner with skill drills (3-pt shooting, free throws, timing, rules quiz), Auto/Wide/Courtside/Follow/Player cameras, 2K-style roster viewer, LED scoreboard, difficulty picker (C Team · Rookie / Junior Varsity · All-Star / Varsity · Hall of Fame).

---

## 1. Approved design, waiting to be built

Full spec: [`docs/superpowers/specs/2026-10-24-events-captain-locker-press-design.md`](docs/superpowers/specs/2026-10-24-events-captain-locker-press-design.md)

Decisions already made: events ≈ 1 in 3 games · press conference after every game (skippable) · captain "noticeable but balanced".

| Feature | Summary | Main files |
|---|---|---|
| **Mid-season random events** | Animated pop-up card between games with 2–3 choices, trade-offs shown up front. ~14 events: walk-on tryout, transfer inquiry, rival recruiter, bench player wants minutes, frustrated starter, locker-room feud, grades slump, finals week, booster donation, flu, ankle tweak, social-media flap, rivalry hype, captain's meeting. Seeded, logged to the decision trail; none before game 2, never back-to-back. | new `src/events.js`, `src/engine.js`, `src/main.js` |
| **Team captain** | "Name captain" on the Roster hero card; **C** badge in roster, profile, box score, 3D nameplate. +2 chemistry/week when eligible and morale ≥ 60; softens bad event outcomes by 25%; changing captain costs morale/chemistry; captain-only events. | `src/engine.js`, `src/main.js`, `src/arena.js` (nameplate) |
| **Locker room: 3D jerseys** | Remove the jersey-number color picker. Show 3 rotating NBA-style 3D tank-top jerseys (Home / Away / Midnight) filling the panel; click or ← → + Enter to select the kit; reduced-motion = static; WebGL fallback to the old buttons. | new `src/jerseys.js`, `locker()` in `src/main.js` |
| **Post-game press conference** | 3–5 context-aware questions after each game (win/loss, margin, top scorer, next opponent, streak, final run). Answers set next-game modifiers (chemistry, morale, defense, opponent "bulletin board" rating, fans). Skip = small fan dip. Effects shown as chips on Program HQ. | new `src/press.js`, `startMatch`/`possession`/`finish` in `src/engine.js`, `src/main.js` |

Testing plan: unit tests (event eligibility/seeded frequency, effect bounds, captain costs, press selection + modifier clamping, save compatibility, full seasons still finish) + Playwright checks of each new screen at 1440×900 and 390×844.

---

## 2. Known bugs (from the 2026-10-24 playtest audit)

Full audit with repro steps and screenshots: [`docs/superpowers/notes/2026-10-24-playtest-audit-and-ideas.md`](docs/superpowers/notes/2026-10-24-playtest-audit-and-ideas.md)

| # | Sev | Bug | Where |
|---|---|---|---|
| B0 | High (UX) | Live-game control bar (System, Tempo, Watch live, Next play, Timeout) sits **below the fold** on 1366×768 / 1440×900 laptops since the arena was made taller. Option: a compact live layout that fits one screen (keep the tall arena as an option). | `src/style.css` `.live-match .game-layout` |
| B1 | High (a11y) | Keyboard focus jumps to `<body>` after every action (full `innerHTML` re-render). Restore focus + scroll after `render()`. | `src/main.js` `render()` |
| B2 | Med | Roster: hero-card "Starter" checkbox and table checkbox desync; un-starting leaves minutes > 0. | `src/main.js` change handler (`data-starter`) |
| B3 | Med | Tutorial arrow always points at the last nav item; no backdrop/focus; step 4 says "state bracket" for C/JV. | `renderTutorial()` |
| B4 | Med | Releasing the player chosen as training group makes every drill "fail" ("Choose a player"). Reset `selected='all'`. | `src/main.js` `selected` |
| B5 | Med | Game day shows no warning for an ineligible starter; tip-off error doesn't name the player. Add per-row chips + "Fix lineup". | `game()`, `E.validateLineup` |
| B6 | Med | "Watch live" stalls while the System/Tempo `<select>` keeps focus (button still says "Pause game"). | auto-play `setInterval` in `src/main.js` |
| B7 | Low | Handbook Controls tab on phones: the 1–5 key row overlaps its text. | `.ctl-row` CSS |
| B8 | Low | Phone: nav grid + header + tracker use ~560 px before content. Sticky bottom tab bar / compact tracker. | CSS ≤620px |
| B9 | Low | Phone Program HQ metrics grid misaligned. | `.metrics` CSS |
| B10 | Low | Landing visual 4 px wider than a 390 px viewport. | `.landing-visual` |
| B11 | Low | Native `confirm()` dialogs (replace save, release, import); use the styled `<dialog>`. | `src/main.js` |
| B12 | Low | Error toasts overlap the tracker and persist across views; dismiss on navigation. | `notify()` |
| B13 | Low | Drill `setTimeout`s aren't cleared on modal close → console TypeError. | `src/drills.js` cleanup |
| B14 | Low | Export JSON can approach the 2 MB import limit after a long varsity season (pretty-printed). | export/import in `src/main.js` |
| B15 | Low | After an early elimination the tracker says e.g. "30 / 30 · 2 LEFT" and the ending never says who knocked you out. | `tracker()`, endscreen |
| B16 | Low | The 3D LED board shows the *previous* final on Game day before tip-off; label it FINAL or reset to pregame. | `src/scoreboard.js` data |

Other known visual issues:
- The visiting team's 3D jersey nameplates still read **"VISITORS"** (the HUD shows the real name).
- In live games the HTML score bug covers most of the 3D scoreboard; consider moving the 3D board to the back wall or shrinking the bug.
- Redmond and Skyline logos (dark green) are low-contrast on dark purple backgrounds; add a light halo/backplate.
- Player view before tip-off can sit behind another player's head (idle subject); offset the eye or pick a clear subject.
- The Film Room replay still uses the old score strip, not the new score bug.

---

## 3. Balance issues (engine)

Headless results, 200 seasons each: with **no practice** JV and Varsity win the title **0%**; with perfect practice C 95% · JV 64% · Varsity 32%.

- **D1** Team skill hits the 98 cap in ~5 weeks (no diminishing returns). Scale gains by remaining headroom or cap by class.
- **D2** Opponent strength ignores the real opponent (`rating = 68 + week-based`). Seed it from real results/records (now that 2026–27 games are unplayed: use 2025–26 results or KingCo standings).
- **D3** Tokens are never scarce (~1,480 after 3 games, and practice no longer costs tokens). Add sinks (travel, equipment, staff upkeep, boosters) or tie income to fans.
- **D4** "Training group" (one player vs whole team) costs the same; whole team is always optimal.
- **D5** GPA/energy decay makes the auto lineup illegal repeatedly; good pressure, but it needs UI (see B5).

---

## 4. UX quick wins (each < 1 hour)

1. Restore focus + scroll after re-render (B1).
2. Eligibility chips on Game day / Roster + one-click "Fix lineup" (B5).
3. Single source of truth for starter checkboxes (B2).
4. Tutorial highlights the real nav item, dims the rest, uses the right run name (B3).
5. Reset training group when the roster changes (B4).
6. Tip-off preview: opponent style (after scouting), average energy/chemistry, timeouts left.
7. Styled confirm dialogs (B11).
8. Phone: sticky bottom nav, compact tracker, fix handbook key row and metrics grid (B7–B9).
9. `aria-live` score announcements; `aria-pressed` on speed/tactic buttons.
10. Raise the 10–12 px uppercase text floor to 12–13 px; add A+/A− text size.
11. "Skip to content" link.
12. Program HQ "What should I do now?" nudge (e.g., "2 slots left, scout Bothell").
13. "Copy season code" (seed + difficulty) for presenters.
14. "How the model works" panel (shot-probability factors) reachable from Game day.

---

## 5. Brainstormed features (not yet approved)

Effort: S < 1 day · M 1–3 days · L 1 week+.

| # | Idea | Pitch | Effort |
|---|---|---|---|
| 1 | **Judge / demo mode** | Title-screen Demo button loads a mid-season save; hotkey to jump to the next elimination game; 3-minute guided overlay for the FBLA presentation. | S |
| 2 | **Season awards + report card** | MVP, Most Improved, Defensive POY, coach grade, "decisions that mattered", downloadable PNG card. | S–M |
| 3 | **Playoff bracket view** | The final 4-game run drawn as a bracket that fills in as you win. | S–M |
| 4 | **Balance pass** | Real opponent strength, diminishing skill returns, token sinks (D1–D3). | S |
| 5 | **Coach's inbox / news ticker** | _Partly covered by the approved events spec._ Weekly headlines and messages. | M |
| 6 | **Rivalry weeks** | Flag real rivals; extra fans/tokens and bigger morale swings; trash-talk headlines. | S–M |
| 7 | **Sound design** | Crowd ambience, whistle, swish/rim, buzzer, volume slider (WebAudio, no assets). | S–M |
| 8 | **Accessibility pack** | Text size slider, high-contrast and color-blind palettes, reduce-3D toggle, dyslexia-friendly font, screen-reader score announcements. | M |
| 9 | **Graphics quality / low-spec mode** | Auto-detect low fps → drop shadows/pixel ratio/crowd; Low/Med/High toggle (school laptops/Chromebooks). | S |
| 10 | **Halftime / quarter adjustments** | Pause at quarters with a stat comparison and 2–3 suggested adjustments. | M |
| 11 | **Recruiting mini-game** | Watch a short scrimmage to reveal hidden traits before signing; fixed budget. | M |
| 12 | **Player development arcs** | Skill sparklines, potential/ceiling, breakout/slump tags. | M |
| 13 | **Multi-season dynasty** | Seniors graduate, freshmen arrive, program rating carries over (save schema change). | L |
| 14 | **Achievements** | Local badges (Perfect Drill, Undefeated Regular Season, Beat the Rival, Varsity Title…). | S |
| 15 | **"Why that shot?" panel** | Live factor bars (skill, energy, chemistry, tactics) from data the engine already stores. | S |
| 16 | **Broadcast highlights + Player of the Game** | Auto-queue the top 3 plays after the buzzer with lower-thirds and a POG card. | M |
| 17 | **Challenge codes / hot-seat duel** | Share a seed ("same season, who does better?"); optional two-coach hot-seat. | M / L |
| 18 | **Budget & boosters** | Ticket revenue, sponsors, travel/equipment costs so tokens matter. | M |
| 19 | **Academic calendar** | Finals week / report-card events that hit GPA unless study hall was scheduled. | S |
| 20 | **Printable season report** | One-page PDF/PNG with record, leaders, standings and decision trail. | S |

**Recommended order (impact ÷ effort):**
1. Bug + accessibility batch (B0, B1, B2, B5, B6)
2. Judge/demo mode
3. Balance pass
4. Season awards + report card + Player of the Game
5. Playoff bracket view
6. "Why that shot?" panel
7. Sound pack
8. Events + rivalry weeks (events already specced in §1)

---

## 6. Animated 3D player models (research done, not started)

Full report: [`docs/superpowers/notes/2026-10-24-3d-basketball-models-research.md`](docs/superpowers/notes/2026-10-24-3d-basketball-models-research.md)

- No free model has a full basketball move set.
- **Recommended:** Quaternius Universal Base Characters + Universal Animation Library (**CC0**, safe for a public repo): idle/jog/sprint/jump/slide/throw; keep our procedural dribble/shoot/pass/defend arm poses on top. ~5–6 days. Keep a `player.glb` ≤ 2.5 MB (the offline cache precaches everything).
- **Upgrade/backup:** CMU motion-capture basketball clips (dribble, jump shot, layup, free throw) retargeted in Blender (+3–5 days).
- **Avoid in the public repo:** Mixamo raw files (license forbids redistribution), paid Fab/Unreal packs. Ready Player Me shut down (Jan 2026).
- Keep the current procedural figures as the fallback if the GLB fails to load.

---

## 7. Data & maintenance notes

- **Rosters are pinned to 2025–26** (team decision). When KingCo publishes 2026–27 rosters and you want them: run `python3 scripts/refresh-data.py --update-rosters`, check Malhar Pawar's level/number, update tests/README if he moves.
- The daily GitHub Action refreshes schedules/scores from KingCo; if refreshed data fails tests, it falls back to the committed `public/data/kangs.json` (deploys never block).
- The refresh script prints a stderr note when it ignores a published roster because of the pin; it does not affect the game.
- Test gaps to fill later: no unit tests for `src/logos.js` name→logo mapping or the first-person HUD logic; dropped assertions for Hazen/Arlington/Eastlake presence; the "no unused opponents" test fails if KingCo removes a game (the CI fallback keeps the site up).
- A failed opponent-logo load isn't retried until reload (crest shows instead).
- Logo credit: "Opponent mascot logos supplied by the project team for identification; marks belong to their schools" (Credits + `docs/sources.md`).
