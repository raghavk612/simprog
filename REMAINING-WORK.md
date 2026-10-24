# Remaining work & ideas: KANGS · Road to the Championship

_Last updated: 2026-10-24. Live site: https://raghavk612.github.io/simprog/_

This file collects **everything that is still to do**: the designed-but-not-built features, known bugs, balance issues, quick UX wins, and the full brainstorm list. Nothing listed here is implemented yet unless it says so.

---

## 0a. Done on the `accessablity` / `remaining-work` branches

- Settings dialog with sound (14 synthesized effects, per-sound switches), accessibility (colour-vision correction, high contrast, reduced motion, text size 70–180 %, fonts, slower playback, timing assist, simplified interface) and language (English, Spanish, Chinese, French, Japanese, Italian, Hindi), plus rebindable shortcuts. See `docs/accessibility.md`.
- Quick wins 9, 10 and 11 below (score announcements, text-size control, skip link).
- The bugs marked ✅ in section 2.

## 0. What's already live (for context)

- **2026–27 KingCo schedule.** Varsity 18, JV 17, C-Team 12 games. Unplayed games show as "Upcoming", and no scores are ever invented.
  - Kangs rosters are **pinned to 2025–26** on purpose. To switch to the new rosters once KingCo posts them, run `python3 scripts/refresh-data.py --update-rosters`.
  - Opponent rosters include Hazen, Arlington, Eastlake and Newport.
- **Opponent mascot logos** (13 schools) appear on the Program HQ card, the live score bug, the 3D gym scoreboard and the Real Kangs data page. The initials crest is the fallback.
- **How to Play** handbook body text is white, laid out as 8 tabs with key-cap icons.
- **First-person label** ("PLAYER VIEW · #11 Name · Position") shows in Player view and in the first-person shots of the Auto camera.
- Earlier work, all live:
  - Skill drills that unlock practice sessions.
  - Auto/TV camera.
  - 2K-style roster viewer and score bug.
  - Real LW-style LED scoreboard with the kangaroo logo.
  - NFHS court lines.
  - Smooth play animation.
  - Notification cards.
  - Difficulty pairing "C Team · Rookie / Junior Varsity · All-Star / Varsity · Hall of Fame".
  - "Always Rising" slogan.

---

## 1. Built from the spec (rivalry-week events intentionally left out)

Full spec: [`docs/superpowers/specs/2026-10-24-events-captain-locker-press-design.md`](docs/superpowers/specs/2026-10-24-events-captain-locker-press-design.md)

Decisions already made:
- Events happen in roughly 1 of every 3 games.
- The press conference runs after every game and is skippable.
- The captain's effect is balanced.

| Feature | Summary |
|---|---|
| **Mid-season random events** | Animated pop-up card between games with 2–3 choices. Each choice shows its trade-off (e.g. "+8 morale · −60 tokens"). About 14 events: walk-on, transfer, rival recruiter, bench player wants minutes, frustrated starter, locker-room feud, grades slump, finals week, booster donation, flu, ankle tweak, social-media controversy, rivalry hype, captain meeting. Seeded, never two in a row, none before game 2, logged to the decision trail. |
| **Team captain** | "Name captain" on the Roster card, with a C badge everywhere (roster, profile, box score, 3D nameplate). +2 chemistry/week when healthy and morale ≥ 60. Softens bad events by 25%. Changing captain costs morale. Captain-only events. |
| **Locker room 3D jerseys** | Remove the jersey-number color picker. Three NBA-style 3D tank tops (Home, Away, Midnight) rotate and fill the panel; click or use ←/→ + Enter to pick the kit. Falls back to 2D buttons without WebGL. |
| **Post-game press conference** | 3–5 context-aware questions (win/loss, close game, top scorer, next opponent, final run). Answers set modifiers for the next game: chemistry, defense, morale, fans, and opponent "bulletin board" toughness. Skip = no bonus, −10 fans. |

Planned delivery: three parallel workstreams (events + captain / press / jerseys), each with unit tests and Playwright checks.

---

## 2. Known bugs (from the 2026-10-24 playtest audit)

Severity: **H** = fix before judging, **M** = visible to a judge/user, **L** = polish. Full detail and repro steps: [`docs/superpowers/notes/2026-10-24-playtest-audit-and-ideas.md`](docs/superpowers/notes/2026-10-24-playtest-audit-and-ideas.md)

| # | Sev | Bug | Fix idea |
|---|---|---|---|
| B0 | H (UX) | ✅ **Fixed:** the court now takes the height left after the control bar, so the controls stay in view (`src/style.css`, live-match block). ~~**Live-game control bar sits below the fold on laptop screens** (1366×768 / 1440×900). This is a side effect of the intentionally taller arena.~~ | Offer a compact live layout: arena height `calc(100dvh − header − controls)`, with the controls in normal flow. |
| B1 | H (a11y) | ✅ **Fixed:** focus (by its `data-*` attributes, with its position among duplicates) and scroll are restored after every `render()`; a new page still moves focus to its heading. ~~**Keyboard focus jumps to `<body>` after every click**, because the whole app re-renders.~~ | Remember the focused element (by `data-action`/`data-view`/`data-id`) and the scroll position, and restore them after `render()`. |
| B2 | M | ✅ **Fixed:** `E.setStarter` zeroes minutes when a starter is removed, gives a new starter the unassigned minutes, and the page re-renders so the card and table agree. ~~Roster "Starter" checkboxes (hero card vs table) desync. Un-starting keeps minutes > 0.~~ | Re-render on change, and zero minutes when un-starting. |
| B3 | M | ✅ **Fixed:** each tour step points at its own sidebar item, which is outlined; the last step no longer mentions a state bracket. ~~Tutorial arrow always points at the last nav item, has no backdrop, and says "state bracket" on C Team/JV.~~ | Point at the step's nav item and use `plan().runName`. |
| B4 | M | ✅ **Fixed:** the training group falls back to "whole team" when that player is no longer on the roster. ~~After releasing a player who was the training target, every drill "fails" with "Choose a player".~~ | Reset `selected='all'` when the roster changes. |
| B5 | M | ✅ **Fixed:** `E.lineupIssues` names who cannot play and why; chips on Game day, a notice on both pages, a "Fix lineup" button, and the tip-off message names the players. ~~Game day gives no warning for an ineligible starter (injured / tired / GPA < 2.0), and the error doesn't name the player.~~ | Per-row eligibility chips, a "Fix lineup" button, and name the player in the error. |
| B6 | M | ✅ **Fixed:** a pointer user's choice blurs the drop-down; for a keyboard user "Watch live" resumes after 4 idle seconds. ~~"Watch live" stalls while the System/Tempo dropdown keeps focus.~~ | Blur the select on change. |
| B7 | L | ✅ **Fixed:** key caps wrap and the description sits below them under 620 px. ~~Handbook → Controls on a phone: the 1–5 key row overlaps its text.~~ | Wrap or stack the key chips below 620px. |
| B8 | L | Phone: nav grid, header and tracker use about 560 of 844 px before content starts. | Sticky bottom tab bar and a compact tracker. |
| B9 | L | Phone Program HQ metrics grid is misaligned. | Fix padding / use a 2-column grid. |
| B10 | L | Title screen at 390px: the visual is 4px wider than the viewport. | Fix the width. |
| B11 | L | Native `confirm()` dialogs (replace save, release, import). | Use the styled `<dialog>`. |
| B12 | L | ✅ **Fixed:** error notifications are removed when the page changes. ~~Error toasts linger into the next screen and overlap the tracker.~~ | Dismiss on view change. |
| B13 | L | ✅ **Fixed:** drill timeouts are tracked and cleared with the drill. ~~Drill `setTimeout`s aren't cleared when the modal closes (console noise).~~ | Track the timeout ids in the cleanup. |
| B14 | L | Season export is about 1.4 MB, close to the 2 MB import limit. | Export without indentation and compact old events. |
| B15 | L | ✅ **Fixed:** the tracker says "Eliminated" and "Season ended after game N". ~~After an early elimination the tracker shows "30/30 · 2 left" and doesn't say why the season ended.~~ | Show "ELIMINATED – game N" and the losing result. |
| — | L | ✅ **Fixed:** before tip-off the board names the next opponent at 0-0 with TIP-OFF under the clock. ~~3D LED board shows the previous game's final while Game day names the next opponent.~~ | Blank it or label it FINAL before tip-off. |
| — | L | ✅ **Fixed:** visitors wear the opponent roster's names and numbers (the school name when the roster is fictional), and the Kangs captain has a small gold C on the plate. ~~Visiting players' 3D nameplates read "VISITORS".~~ The HUD shows real names. | Pass opponent identities into `setIdentity`. |
| — | L | ✅ **Fixed:** the eye sits further forward, keeps 0.6 from every other body, and the subject's own head is hidden in first person. ~~Pre-game Player view can sit the camera inside a nearby player's head.~~ | Nudge the eye forward / hide the subject's head mesh in first person. |
| — | L | Redmond and Skyline (dark green) logos are low-contrast on dark purple. | Add a light outline / glow behind logos. |

---

## 3. Balance findings (engine)

Measured with `node scripts/balance.mjs 200` (200 seeded seasons per cell; title rate in %). "Before" is the original model, "after" is the current one.

| Strategy | C Team (before → after) | JV (before → after) | Varsity (before → after) |
|---|---|---|---|
| No practice | 11 → 6 | 0 → 0 | 0 → 0 |
| Sensible practice (recover when tired, study when grades slip, else dinner or shooting) | 79 → 58 | 60 → 35 | 42 → 23 |
| Same, with a perfect drill each time | 79 → 60 | 51 → 44 | 36 → 25 |
| One-on-one shooting with the weakest starters | – → 29 | – → 18 | – → 7 |

- ✅ **D1 (done) Skill snowballs to the 98 cap in about 5 weeks.** Now each session's gain is scaled by the room below the ceiling (`E.growthRoom`: full gain at 58 or below, 10 % at the top), so a good practice plan ends the season around 92–98 instead of hitting 98 by game 8. Original note: Fix: scale gains by remaining headroom `(98−skill)/30`, or use per-player ceilings.
- ✅ **D2 (done) Opponent strength ignores the real opponent.** `E.opponentRating`: each school keeps its own standing (about ±4.5 around 72), and once Lake Washington's real result against it is published that result sets it. Original note: It's `68 + (week%5)·2`. Fix: seed it from real records/results, which also makes the real data matter.
- **D3 (not done, needs a design decision) Tokens are never scarce** (about 1,480 after 3 games with no spending). Fix: add sinks (travel, equipment, staff upkeep, boosters) or tie income to fans.
- ◐ **D4 (partly done) "Training group: one player"** was never worth it versus Whole team. One-on-one sessions now give 1.8× the skill, morale, grade and energy gains and only tire that player, but whole-team practice is still the efficient default (a one-player plan wins about half as often in simulation). Making it competitive would need either a much larger multiplier or heavier whole-team costs.
- **D5 Eligibility decay** (energy/GPA) is a good mechanic, but it needs UI (see B5).
- **D6** Scores average about 64–68, which is plausible against the real 60 ppg.

---

## 4. UX quick wins (each under ~1 hour)

1. Restore focus and scroll after re-render (B1).
2. Eligibility chips plus a "Fix lineup" button (B5).
3. A single source of truth for starter checkboxes (B2).
4. Tutorial highlights the real nav item and dims the rest (B3).
5. Reset the training target when the roster changes (B4).
6. A tip-off preview card: opponent style (after scouting), average energy/chemistry, timeouts.
7. Styled confirm dialog instead of `confirm()` (B11).
8. Phone: sticky bottom nav and a compact tracker; fix the controls overlap and the metrics grid (B7–B9).
9. `aria-live` score announcements during live play, and `aria-pressed` on the speed/tactic buttons.
10. Raise the font floor (many 10–12px labels) and add an A+/A− text-size control.
11. A "Skip to content" link.
12. A "What should I do now?" nudge on Program HQ.
13. A "Copy season code" (seed + difficulty) for presenters.
14. A "How the model works" panel (shot probability factors) reachable from Game day.

---

## 5. Brainstorm: remaining feature ideas

Effort: **S** < 1 day, **M** 1–3 days, **L** a week+. Ideas already covered by Section 1 are marked ✱.

| # | Idea | Pitch | Effort |
|---|---|---|---|
| 1 | ✅ **Done:** **Judge / demo mode** | Title-screen "Demo" loads a mid-season save, with a hotkey to jump to the next elimination game and a 3-minute guided overlay for the FBLA presentation. | S |
| 2 | ✅ **Done (Player of the Game too; the highlight replays are not):** **Season awards + report card** | MVP, Most Improved, Defensive Player, coach grade, "decisions that mattered", downloadable PNG. | S–M |
| 3 | ✅ **Done:** **Playoff bracket view** | The final run shown as a bracket that fills in as you win. | S–M |
| 4 | **Balance pass** | Real opponent strength, diminishing returns, token sinks (Section 3). | S |
| 5 | ✅ **Done:** ✱ Coach's inbox / random events | Covered by the mid-season events spec. | M |
| 6 | **Rivalry weeks** | Flag real rivals on the schedule: extra fans/tokens and bigger morale swings, with headlines. | S–M |
| 7 | ✅ **Done (accessibility branch):** **Sound design** | Crowd, whistle, swish/rim, buzzer and a volume slider (WebAudio, no assets). | S–M |
| 8 | ✅ **Done (accessibility branch):** **Accessibility pack** | Text size, high-contrast and color-blind palettes, "reduce 3D", dyslexia-friendly font, screen-reader scores. | M |
| 9 | ✅ **Done:** **Graphics quality / low-spec mode** | Auto-detect low fps and drop shadows, crowd and pixel ratio; manual Low/Med/High. | S |
| 10 | **Halftime / quarter adjustments** | Pause each quarter with a stat comparison and 2–3 suggested adjustments. | M |
| 11 | **Recruiting mini-game** | Watch a short scouting scrimmage to reveal hidden traits before signing. | M |
| 12 | **Player development arcs** | Skill sparklines, ceilings, breakout/slump tags. | M |
| 13 | **Multi-season dynasty** | Seniors graduate, freshmen arrive, tokens/fans carry over. Changes the save schema. | L |
| 14 | **Achievements** | Perfect Drill, Undefeated Regular Season, Beat the Rival, Zero-Injury Season, Varsity Champion. | S |
| 15 | ✅ **Done:** **"Why that shot?" live panel** | Show shot-probability factor bars (skill, energy, chemistry, tactics) during live play. Great for Q&A. | S |
| 16 | **Broadcast highlights + Player of the Game** | Auto-replay the top 3 plays with lower-third graphics and a POG card. | M |
| 17 | **Challenge codes / hot-seat duel** | Share a seed ("same season, who does better?") or alternate tactic picks with two coaches. | M / L |
| 18 | **Budget & boosters** | Ticket revenue, sponsors, equipment/travel costs so tokens matter. | M |
| 19 | **Academic calendar** | Finals week / report-card events that hit GPA unless study hall was scheduled. | S |
| 20 | **Printable season report** | One-page PDF/PNG with record, leaders, standings and decision trail. | S |
| 21 | ✅ **Done:** ✱ Team captain | Covered by the spec. | S–M |
| 22 | ✅ **Done:** ✱ 3D locker-room jerseys | Covered by the spec. | M |
| 23 | ✅ **Done:** ✱ Post-game press conference | Covered by the spec. | M |
| 24 | **Animated 3D player models** | See Section 6. | L |

**Recommended order (impact ÷ effort):**
1. Bug + accessibility batch (B0, B1, B2, B5, B6).
2. Judge/demo mode.
3. Balance pass.
4. Season awards + report card + Player of the Game.
5. Playoff bracket.
6. "Why that shot?" panel.
7. Sound pack.
8. Events + rivalry weeks (spec).

---

## 6. Animated 3D basketball player models (research done, not built)

Full report: [`docs/superpowers/notes/2026-10-24-3d-basketball-models-research.md`](docs/superpowers/notes/2026-10-24-3d-basketball-models-research.md)

- **Recommended:** Quaternius Universal Base Characters + Universal Animation Library. Both are **CC0**, so they're OK for a public repo, and they cover idle/jog/sprint/jump/slide/throw. Dribble, shoot, pass and defend arm poses stay procedural, layered on the bones.
  - **Estimate:** about 5–6 days, which includes a Blender jersey-material split, `SkeletonUtils.clone` ×10, and number/name planes on the spine.
- **Upgrade/backup:** CMU motion-capture basketball clips (dribble, jump shot, layup) retargeted in Blender, about another 3–5 days. Their terms allow use in products but not resale.
- **Avoid:**
  - Mixamo: its terms forbid distributing the raw files, which a public repo does.
  - Ready Player Me: it shut down in Jan 2026.
  - Paid packs: they can't be committed to a public repo.
- **Budget:** keep `player.glb` around 1.5–2.5 MB (the offline cache precaches everything). Keep the procedural figures as the fallback.

---

## 7. Tech debt / deferred review notes

- Data refresh prints a "kept by policy" note even when `--update-rosters` replaced a level.
- The data test's "no unused opponents" check fails if KingCo removes a game. The deploy then falls back to the committed data, so this is non-fatal but needs a test tweak.
- No unit tests for `src/logos.js` name mapping or the first-person HUD key logic.
- A failed logo load isn't retried during the session; the initials crest shows instead.
- `replayOpp` (first-person HUD in replays) is never reset. It's unreachable today but worth cleaning up.
- `src/main.js` is a large single-line-per-function file. Splitting views into modules would make parallel work and merges easier.

---

## Repo map (where things live)

| Area | File |
|---|---|
| UI, views, routing | `src/main.js`, `src/style.css` |
| Season/sim engine, saves | `src/engine.js` (tests: `tests/engine.test.js`) |
| 3D gym, cameras, players | `src/arena.js` |
| Play animation | `src/basketball.js` |
| Practice skill drills | `src/drills.js` |
| Gym LED scoreboard | `src/scoreboard.js` |
| Opponent logos | `src/logos.js`, `public/images/opponents/` |
| Real data (KingCo) | `public/data/kangs.json`, `scripts/refresh-data.py` (runs daily in `.github/workflows/pages.yml`) |
| Specs / plans / notes | `docs/superpowers/` |

Run locally: `npm install && npm run dev` · tests: `npm test` · build: `npm run build`.
