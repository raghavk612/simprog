# Road to the Championship: Design Spec

FBLA Computer Game & Simulation Programming 2026–27 · Topic: *Road to the Championship*

## 1. Concept

You're the first-year head coach of a high school varsity basketball program. You have one season (10 regular-season weeks plus up to 4 playoff rounds) to win the state championship. Each week you plan practices, handle one off-court challenge, set the game plan, and coach the game live.

**Guiding question from the topic:** *How will strategic decision-making help your team overcome obstacles and achieve championship success?*
In this game, raw talent alone doesn't win the title. The state-final opponent is rated higher than any roster you can start with. You close the gap by developing players, keeping morale and chemistry high, managing the budget, scouting opponents, and picking counter-strategies.

## 2. Rubric → feature map

| Rubric line | What the game does |
|---|---|
| Addresses all parts of the topic | Recruiting (tryouts + scouting), player development (practice planner), resources (budget, front-office upgrades, fundraisers), morale and chemistry, unexpected challenges (22 events with delayed consequences), strategy (tempo, defense, focus, rotation, halftime talk) |
| Rules defined and in the game | Rulebook opens from any screen (`?` key or the Rules button) and covers goal, season, resources, drills, strategy matchups, injuries/eligibility, outcomes, controls |
| Challenging but completable, several outcomes | 3 difficulties; 6 endings (State Champions/Perfect Season, Runner-Up, Final Four, Playoff Contender, Missed Playoffs with 2 variants, Program in Crisis) plus 8 achievements and a legacy grade |
| Innovation and creativity | Team identity drives the whole UI color theme; coach's whiteboard practice planner; the underdog tempo trade-off (slow games raise variance); opponent AI that adapts at halftime; a seeded "presentation mode" that replays the exact same season |
| Tools and complexity | Vanilla HTML/CSS/JS in one offline file; Canvas 2D court drawn to real NFHS dimensions (84×50 ft, 19'9" arc); possession-based simulation; seeded Mulberry32 PRNG; Web Audio synthesized sound; SVG crests; WCAG contrast math for team colors; Playwright tests and a balance harness |
| Graphics consistent and on-topic | Subject vocabulary is used throughout: hardwood court, 7-segment scoreboard, whiteboard, championship banners, jersey-number badges |
| Title screen | Title screen offers Quick Start (play with no setup), New Season, Continue, How to Play, Settings, Credits |
| UX design, accessibility | Keyboard support everywhere, visible focus, number-key choices, screen-reader live play-by-play, reduced motion, text size, high-contrast and color-blind modes, shapes and text used alongside color, autosave |
| Controls intuitive | One primary action per screen, a stepper for the weekly loop, disabled buttons that say why, previews before you commit |

## 3. Style (OilOil guide)

**Family:** hybrid. The **playful** family sets energy and saturation (the audience is students). **Brand-driven** means the player's chosen school colors become `--team` and `--team-2`. Dashboard surfaces borrow a **data-viz** motif. The look is deliberately *not* rounded-everything: athletic signage uses tight 4–8px radii.

| Token | Value |
|---|---|
| Ground (light) | `#EDF0F2` painted cinderblock · surface `#FFFFFF` · ink `#17202B` · muted `#4A5563` |
| Ground (dark) | `#0F141A` · surface `#18202A` · ink `#E8EDF2` |
| Hardwood | `#D9A566` / `#C68D4E` |
| Scoreboard | `#0E1116` with LED amber `#FFB31A` |
| Whiteboard | `#FBFCFD` with marker blue `#1E56B8` and marker red `#C8352B` |
| Semantic | good `#19804A` · warn `#B8741A` · bad `#C2372D` (a color-blind mode swaps these to blue/orange) |
| Display type | **Graduate** (collegiate block, used sparingly for titles and scores) |
| Body type | **Atkinson Hyperlegible** (made by the Braille Institute for low-vision legibility) |
| Data/labels | **Barlow Condensed** with tabular numbers |
| Handwriting | **Permanent Marker**, used only on the whiteboard |
| Radius | 4 / 8 px; pills only on status chips |
| Spacing | 4px base: 4 / 8 / 12 / 16 / 24 / 32 |
| Container | border on light surfaces; the scoreboard and whiteboard are physical objects with elevation |
| Motion | purposeful only (ball arc, score tick, banner raise); all of it turns off with reduced motion |

## 4. User journey

Title → (Quick Start | Team Setup) → Tryouts (scout, sign) → **Weekly loop** ×10 [Practice → Challenge → Game Prep → Live Game (timeouts each quarter) → Recap] → Playoff bracket → Playoff loop ×≤4 → Ending (legacy grade, chart, achievements) → Play again.

## 5. UX hard rules applied

- One primary CTA per screen, placed bottom-right of the working panel and labeled with a verb.
- Every state is covered: empty slots, disabled buttons with a reason, loading, and win/loss/injury feedback.
- Feedback loops close: every decision shows exactly what changed (delta chips).
- Destructive actions (new season over a save, quit) get in-page confirmation.

## 6. Testing evidence (for the Q&A)

**Automated browser tests (Playwright, headless Chromium):**
- Full seasons played through the real UI at desktop (1366px) and phone (390px) widths: 0 script errors, no horizontal scrolling.
- Keyboard-only run: menu → practice → challenge (number keys) → game (S to skip) → timeout. Focus stays trapped in dialogs, and the screen-reader live region announces scores.

**Balance harness:** 150 simulated seasons per row. "Smart" means the bot buys upgrades, scouts, and picks the recommended counters. "Naive" means no scouting, a default game plan, and random choices.

| Difficulty · policy | Won State | Missed playoffs | Win % |
|---|---|---|---|
| Rookie · smart | 85% | 0% | 94% |
| Rookie · naive | 25% | 5% | 78% |
| Varsity · smart | 43% | 2% | 82% |
| Varsity · naive | 0% | 50% | 52% |
| Legend · smart | 13% | 19% | 65% |
| Legend · naive | 0% | 88% | 36% |

Takeaway for judges: at Varsity, strategy is the difference between a 0% and a 43% title rate, which directly answers the topic question. All six endings appear in play.
