# Road to the Championship: Design Spec

FBLA Computer Game & Simulation Programming 2026–27 · Topic: *Road to the Championship*

## 1. Concept

You're the new head coach of a high school varsity basketball program on a **4-season contract**. Each season has 10 regular-season weeks plus up to 4 playoff rounds, and the goal is the state championship. Each week you plan practices, handle one off-court challenge, set the game plan, and coach the game live, with timeouts, substitutions and final-shot calls. Between seasons, seniors graduate, the rest of the roster ages and grows over the summer, and you rebuild through tryouts.

**Guiding question from the topic:** *How will strategic decision-making help your team overcome obstacles and achieve championship success?*
In this game, raw talent alone doesn't win the title. The state-final opponent is rated higher than any roster you can start with. You close the gap by developing players, keeping morale and chemistry high, managing the budget, scouting opponents, and picking counter-strategies. Over multiple seasons, long-term choices pay off: young high-potential players grow into stars, summer programs shape development, and winning raises program prestige, which attracts better recruits.

## 2. Rubric → feature map

| Rubric line | What the game does |
|---|---|
| Addresses all parts of the topic | Recruiting (tryouts + scouting, prestige-driven classes), player development (practice planner, summer programs), **long-term team development** (4-season career: graduation, aging, carryover), resources (budget, front-office upgrades, fundraisers, carryover between seasons), morale and chemistry, leadership (captain, team talks), unexpected challenges (22 events with delayed consequences), strategy (tempo, defense, focus, rotation, timeouts, substitutions, final-shot play) |
| Rules defined and in the game | Rulebook opens from any screen (`?` key or the Rules button) and covers goal, season, seasons and career, coaching the game, resources, drills, strategy matchups, injuries/eligibility, endings, controls and **sources** |
| Challenging but completable, several outcomes | 3 difficulties (Easy / Medium / Hard, chosen on the title screen); 6 season endings (State Champions/Perfect Season, Runner-Up, Final Four, Playoff Contender, Missed Playoffs with 2 variants, Program in Crisis) plus 5 career outcomes (Dynasty Builder, Championship Coach, Program Builder, Journeyman Coach, Contract Terminated), 8 season and 6 career achievements, and legacy grades |
| Innovation and creativity | Team identity drives the whole UI color theme; coach's whiteboard practice planner; the underdog tempo trade-off (slow games raise variance); opponent AI that adapts at halftime and calls timeouts to stop your runs; momentum system where timeouts "ice" a run; final-possession play-calling with live make-chance estimates; a seeded "presentation mode" that replays the exact same career |
| Tools and complexity | Vanilla HTML/CSS/JS in one offline file; Canvas 2D court drawn to real NFHS dimensions (84×50 ft, 19'9" arc); possession-by-possession simulation that you can interrupt at any moment; multi-season career model; seeded Mulberry32 PRNG; Web Audio synthesized sound effects, live crowd and an original step-sequenced soundtrack; SVG crests; WCAG contrast math for team colors; Playwright tests and a balance harness |
| Graphics consistent and on-topic | Subject vocabulary is used throughout: hardwood court surrounded by a crowd that reacts to your baskets, top-down player figures with real jersey numbers and varied skin tones, dribbling ball, 7-segment scoreboard with timeout lights, whiteboard, championship banners with title years |
| Title screen | Title screen offers a difficulty picker (Easy / Medium / Hard, with a one-line summary of what changes), Quick Start (play with no setup), New Season, Continue, How to Play, Settings, Credits |
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

Title (pick difficulty) → (Quick Start | Team Setup) → Tryouts (scout, sign) → **Weekly loop** ×10 [Practice → Challenge → Game Prep → Live Game (timeouts, subs, final-shot calls) → Recap] → Playoff bracket → Playoff loop ×≤4 → Season ending (legacy grade, chart, achievements) → **Offseason** (graduation, summer program, budget) → next season's tryouts … ×4 → Career summary (outcome, banners, legends, season table) → New career.

## 5. UX hard rules applied

- One primary CTA per screen, placed bottom-right of the working panel and labeled with a verb.
- Every state is covered: empty slots, disabled buttons with a reason, loading, and win/loss/injury feedback.
- Feedback loops close: every decision shows exactly what changed (delta chips).
- Destructive actions (new season over a save, quit) get in-page confirmation.

## 6. Testing evidence (for the Q&A)

**Automated browser tests (Playwright, headless Chromium):**
- Full 4-season career played through the real UI at desktop width (1366px), plus a season and an offseason at phone width (390px). Timeouts, substitutions and final-shot decisions all came up. 0 script errors.
- Every screen checked at 360px width: no horizontal scrolling.
- Keyboard-only run: menu → practice → challenge (number keys) → game (S to skip, T for a timeout) → timeout. Focus stays trapped in dialogs, and the screen-reader live region announces scores.

**Bugs the tests found and fixed:** a multi-season crash when grades dropped so far that fewer than 5 players were eligible (fixed with a summer grade reset and JV call-ups); later seasons being far too easy (fixed by making rivals improve every year and trimming budget carryover); players exhausting themselves under Manual rotation (fixed with an in-game warning).

**Balance harness:** 60 simulated 4-season careers per row. "Smart" means the bot buys upgrades, scouts, and picks the recommended counters. "Naive" means no scouting, a default game plan, and random choices. Numbers are the share of seasons that ended in a State title.

| Difficulty · policy | Season 1 | Season 2 | Season 3 | Season 4 |
|---|---|---|---|---|
| Easy · smart | 83% | 90% | 88% | 93% |
| Easy · naive | 25% | 33% | 28% | 27% |
| Medium · smart | 38% | 63% | 63% | 55% |
| Medium · naive | 0% | 8% | 5% | 2% |
| Hard · smart | 10% | 33% | 38% | 36% |
| Hard · naive | 0% | 0% | 0% | 0% |

Takeaway for judges: at Medium, strategy is the difference between a 0% and a 38% title rate in season 1. Building the program pays off in later seasons without making them automatic, which directly answers the topic question. All 6 season endings and all 5 career outcomes appear in play.
