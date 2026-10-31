# Title screen rebuild — plan

Spec: the user's request in chat (2026-10-31), recorded here as the binding list:

1. **3D athletes in the title gym** — broadcast lighting, a slow camera drift around the court, and a hero player dribbling up close.
2. **Scoreboard** — show the next real opponent (with its logo) and the record when continuing, instead of "KANGS vs GUEST".
3. **Entrance animation** — the title and menu slide in; pressing Start flies the camera into the gym.
4. **Difficulty** — keep the dropdown, but each option shows only the level name ("C Team", "Junior Varsity (JV)", "Varsity"), no description after it, in all 7 locales.
5. **Season code** — folded behind a small "Have a season code?" link.
6. **Returning players** — when a save exists, "Continue season" is the big primary button with "New season" below it.
7. **Phone** — the gym is a real picture at the top, and the links sit in one row.
8. Make it feel like a real game's title screen (research: `/home/claude/reports/Sports game title screen design.md`).

Repo: `/home/claude/simprog` (Vite + Three.js r180), branch `title-screen` from `main` 0068f55.

## Global Constraints

- No new dependencies. Match the repo's dense one-line code style (see `src/main.js`, `src/arena.js`).
- **i18n:** every user-facing string goes through `t()`/`tu()`. Any key added to `src/i18n/locales/en.js` is added to all 7 locales (`en es fr hi it ja zh`) with the same placeholders; `tests/i18n.test.js` enforces identical keys.
- **Reduced motion:** when `getA11y().reducedMotion` is on (html class `a11y-reduced-motion`, `arena.motion===false`) or the OS asks for it, there is no camera drift, no fly-in and no entrance animation; the screen is usable immediately and Start goes straight in.
- **Nothing invented on the board:** the scoreboard shows only real schedule, logo and record data.
- **Accessibility:** real `<button>`/`<details>`/`<label>` elements; visible focus; the first heading keeps `tabindex="-1"`; DOM order = visual order = tab order.
- **Do not change** other views' behaviour, the save format, or the start-form submit semantics (validation, code parsing, replace-save confirm).
- `npm test` and `npm run build` pass after every task.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TJcs3aM2BUb2S8MMdWg1LU
  ```

## Task 1: Difficulty options show the level name only

Files: `src/i18n/locales/{en,es,fr,hi,it,ja,zh}.js`, `tests/i18n.test.js`.

- Write a failing test in `tests/i18n.test.js`: for every locale, each of `difficulty.rookie|standard|elite` is a non-empty string that contains no `·` and no ` - ` description (i.e. it is just the level name).
- Then edit each locale's `difficulty:{…}` line to keep only the text before ` · ` (trim). Example en: `{rookie:'C Team',standard:'Junior Varsity (JV)',elite:'Varsity'}`. Japanese/Chinese use the same rule (text before the `·`, trimmed, including a full-width bracket if present).
- `difficulty.*` is only used by the landing dropdown (`src/main.js` `landing()`); confirm with grep and change nothing else.

## Task 2: Pure title helpers (`src/title.js`)

Files: new `src/title.js`, new `tests/title.test.js`.

Exports (pure, no DOM, no Three):

- `titleMatchup(state, data, difficulty='standard')` → `{opponent, game, games, wins, losses, date, continuing}`.
  - With a save that is not finished: `opponent = state.schedule[state.week].opponent`, `game = state.week+1`, `games = state.schedule.length`, `wins/losses` from the save, `date` from that schedule row, `continuing: true`.
  - Finished save: the last result's opponent, `game = games`, `continuing: true`.
  - No save: the first game of `E.teamFor(data, difficulty).games` (import from `./engine.js`), record 0–0, `continuing: false`. If no games, `opponent: null`.
- `titleCamera(time)` → `{position:[x,y,z], target:[x,y,z]}`: a slow broadcast-jib sweep along the near sideline (a full orbit would leave the gym, whose walls are at |x|=19.5, |z|=16). Period `SWEEP = 60` s (exported): the azimuth swings smoothly (`sin`) between −40° and +40° around the +z axis, at horizontal distance 13 from the target (phones get the wider lens from the arena's existing tall-aspect FOV, not a longer distance), height gently between 3.2 and 4.6. Target `(HERO.x*.5, 1.2, HERO.z*.5)` so the hero (Task 4, `HERO = {x:-4.2, z:2.6}`, also exported) stays in frame. Bounds at all times: `z > 9.6` (behind the near sideline), `|x| < 18`, `z < 15`, `2.5 < y < 5`. `titleCamera(0)` equals `titleCamera(SWEEP)` (periodic).
- `flyIn(u, from)` → `{position, target}` easing (smoothstep) from `from` (a titleCamera result) at `u=0` to the broadcast-style end shot `END = {position:[0,7.5,15.5], target:[0,1,0]}` at `u=1`; clamps `u` to [0,1].

Tests cover: next opponent from a mid-season save; finished save; no save uses the difficulty's first real game (build a tiny `data` fixture with `levels.jv.games`); `titleCamera` bounds sampled over a full sweep; periodicity; `flyIn` endpoints and clamping.

## Task 3: Scoreboard shows the record before tip-off

Files: `src/scoreboard.js`, `tests/scoreboard.test.js`.

- Failing test first: `scoreboardData(s)` for a save with no live match, not finished, `wins:5, losses:2`, and `standings[opponent] = {w:3,l:4}` returns `pre:true`, `away` = board name of the next opponent, `statLabel:'RECORD'`, `statHome:'5-2'`, `statAway:'3-4'`. Without a standings row for the opponent, `statAway:'–'`. Live/final boards keep `TEAM REB` (existing tests stay green).
- Implement in `scoreboardData` only (the drawing code already renders `statLabel/statHome/statAway`; check `drawScoreboard` handles a 3-character value like `5-2` without overflow — shrink the font there if it clips).

## Task 4: Title camera, hero dribbler and fly-in in the arena

Files: `src/arena.js` (and `tests/` only if a pure piece is added).

- New view mode `'title'` in `Arena.setView`. While `mode==='title'` and there is no `event`:
  - Camera: if `this.motion`, every frame `titleCamera(this.time)` sets `camera.position` and `controls.target` (orbit controls disabled in this mode); otherwise a fixed `titleCamera(12)` framing.
  - Hero: `people[2]` (the idle dribbler) stands at `HERO` facing the camera's side and dribbles (existing idle `arms:'dribble'` path). The other players keep the idle warm-up spots. Only the target spot of `people[2]` changes in title mode; other modes are untouched.
  - Depth of field: when the broadcast look is active (`this.look?.active`), focus on the hero with a gentle aperture (≈1.4) via the existing `this.look.setDof(point, aperture, dt)`.
- `setTitlePaused(bool)`: while paused in title mode the camera holds its current framing and the players hold still (the idle clock and gait stop advancing for the title idle only); unpausing resumes smoothly from where it stopped. Needed for WCAG 2.2.2 (a moving background longer than 5 s needs a pause control).
- `flyIn(ms=900)` returns a Promise: resolves immediately when `!this.motion` or not in title mode; otherwise animates `flyIn(u, start)` from `src/title.js` over `ms` and resolves at the end (also resolve if the arena is cleared/remounted mid-way).
- `src/main.js`: the landing uses `arena.setView('title')` instead of `'broadcast'` (in `go()` and on first render), and the arena shows a real preview save on the title screen: when `state` is null, `arena.update(preview)` where `preview = E.createGame(data,'Coach',difficulty,1)` for the dropdown's current difficulty (rebuilt when the dropdown changes). The preview is never saved. When a save exists, `arena.update(state)` as today. This makes the board show the real next opponent and logo (Task 3 adds the record).

## Task 5: Title screen markup and behaviour

Files: `src/main.js` (`landing()`, the action handler, the start-form submit), `src/i18n/locales/*.js`.

Layout (DOM order):

1. Brand row (logo, school, program, badge) — unchanged content.
2. Title lockup: eyebrow tagline, `<h1 tabindex="-1">`, intro paragraph.
3. **With a save:** a "next game" card (`.title-next`) showing — as text only, with **no logo image** (the user asked for team logos next to team names only in the Season Journal bracket; on the title screen the logo appears on the 3D scoreboard) — `game N of M · vs Opponent`, and the record `W–L`, all from `titleMatchup`. Then the big primary button `Continue season` (`data-action="continue"`, class `primary launch`). Then a secondary `New season` button (`data-action="new-season-form"`, `aria-expanded`, `aria-controls="start-form"`) that reveals the start form (hidden by default with the `hidden` attribute; focus moves to `#coach` when revealed).
   **Without a save:** the start form is shown directly and `Start season` is the primary button.
4. Start form: coach name, difficulty select (names only), then `<details class="code-toggle"><summary>Have a season code?</summary> …existing code label, input and hint… </details>`, then the submit button. Keep the existing ids (`coach`, `difficulty`, `code`, `code-hint`) so the submit handler keeps working; if the code field is invalid, open the `<details>` before focusing it.
5. Links row: How to play, Credits, Import, Demo, Settings (existing actions), plus a small **Pause background / Play background** toggle (`data-action="title-pause"`, `aria-pressed`) that calls `arena.setTitlePaused()`. It starts pressed (paused) when reduced motion is on. (Research: WCAG 2.2.2 and Xbox Accessibility Guideline 117 require a way to stop a moving background behind menu text.)
6. The gym stage (`stage('title-arena')`) and footer.

Behaviour:

- Changing the difficulty select (no save) rebuilds the arena preview (Task 4) so the board shows that level's first real opponent.
- Start / Continue: if motion is on, add class `leaving` to `.landing`, `await arena.flyIn(900)` and then continue with the existing logic (create game / go home). With reduced motion, no wait. Never run twice on double click.
- The entrance animation can be skipped: the first keydown or pointerdown on the landing adds class `entered` to `.landing`, which ends the animation immediately (content at its final state).
- New i18n keys in all 7 locales: `landing.pauseBg` ("Pause background"), `landing.playBg` ("Play background"), `landing.newSeason` ("New season"), `landing.continueSeason` ("Continue season"), `landing.nextGame` ("Game {n} of {total}"), `landing.vs` ("vs {team}"), `landing.record` ("Record {w}–{l}"), `code.toggle` ("Have a season code?"). Translate each properly (es, fr, hi, it, ja, zh).

## Task 6: Title screen styling, entrance animation and phone layout

Files: `src/style.css` (append a clearly marked `/* Title screen (2026-10 rebuild) */` block at the end so it wins over the older layered rules).

- Desktop (≥ 900px): full-bleed live gym behind everything (as today) with a stronger left-to-right dark gradient for legibility, a subtle vignette and thin letterbox bars (top/bottom ≈ 4vh, dark) for the broadcast feel. Menu column on the left, max-width ≈ 420px. Title in the display font, italic heavy, uppercase-feeling. Primary button large (≥ 56px tall), full column width, with a gold/purple accent bar and a clear focus/hover state (scale ≤ 1.02 and a glow). `.title-next` card: dark glass panel, opponent logo 40px, condensed text.
- Entrance: brand, eyebrow, h1, intro, next card, buttons/form, links fade+slide in from 24px left, 450–600ms `cubic-bezier(.2,.7,.2,1)`, staggered 70ms, whole sequence ≤ 1.2 s; only `transform` and `opacity` animate. `.landing.entered` shows everything at its final state at once. `.landing.leaving` fades/slides the UI out in 400ms. Under `.a11y-reduced-motion` and `@media (prefers-reduced-motion: reduce)` none of this runs (content visible immediately).
- Use `min-height:100dvh` (with the existing `svh` as fallback) and `env(safe-area-inset-*)` padding on the landing.
- Phone (≤ 620px): the gym is a real picture at the top (normal flow, `aspect-ratio: 16/10`, full opacity, no gradient wash over the middle of it, small bottom fade only), then the title (smaller), the menu, and the links in one row (`flex-wrap:nowrap`, small text, evenly spaced; horizontal scroll inside the row only if it cannot fit — the page itself must never scroll horizontally at 360px).
- Keep text contrast ≥ 4.5:1 on the gradient, and keep `--ts`/`--ls` text scaling multipliers on every font size, matching existing rules.

## Task 7: Browser check (controller)

Playwright (swiftshader, Medium graphics) against `npx vite preview --port 4173`: screenshots at 1440×900 and 390×844, with and without a save, with reduced motion on; check no horizontal scroll at 360px, tab order, the code `<details>`, Continue/New season, the board text (next opponent, record), and that Start reaches the home view.
