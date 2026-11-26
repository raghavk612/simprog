# Package E: navigation, title and the selected state (report)

Branch `ui-ease-e` (from `ui-ease` ee15a20). Plan: `docs/superpowers/plans/2026-11-26-ui-ease.md`, package E.
Findings from `docs/superpowers/reports/2026-11-26-ui-audit.md`: P1-2, P1-3, P1-4 (the shared phone bar), P1-5, P1-12,
P2-1, P2-6, plus R14 from the research report.

## What I built, per finding

**P1-12: one slot for the way forward.** `subnavGo()` in `src/ui/nav.js` now decides for every group: This week's pages
(Home, Prep, Game day) keep their own primary and get no slot; Team, Season and Shop pages get the week's next step at the
right end of `.subnav-end`; a Shop page during a break gets "Start the season" / "Back to the season" there instead. Two
exceptions: the roster keeps its own purple "Pick my best five" while `E.lineupIssues()` finds a problem, and the slot
never offers the page you are on (`E.nextStep(s).view === v`, e.g. the Journal once the season is over). The roster
toolbar no longer renders the next step itself (`roster.js`, D's file, see below), so the next step has one place on every
non-Home page. On a phone the slot is the docked bar (P1-4 hook below). The break foot's button on the last Shop tab is now
`secondary`: the purple one is the same button in the slot.

**P1-4 (shared hook): `.page-action`.** Styled in `src/theme.css`: a flex row in the flow on a desktop; at ≤ 620 px (and not
in the live game) a bar `position: fixed` just above the tab bar (`bottom: var(--tabh) + safe area`), full-width 48 px button,
any reason or status line under it in 13 px. `render()` measures the bar with a `ResizeObserver` into `--action-bar-h`; the
page's `.content` keeps that much room at its foot (`max()` with the coach card's `--coach-h`), and on phones `#toast` and the
judge demo's guide sit above it. The docked coach card (`tutorial.js` `place()`) now sits above the bar too, so a lesson never
covers the purple button. The shell's slot is wrapped in `.page-action`; A (Game day) and B (Prep) wrap theirs.

**P1-5 and R14: the strip on every phone page.** At ≤ 760 px the status strip is a second row under the tabs on every page
(it was hidden everywhere but Team and Home): "Game 2 of 17 · Record 1–0 · Program tokens 1,162". The prep-slots item is
hidden on phones (it is on Prep itself). The Shop's five tabs now fit a 390 px phone in English (`.sub-item` inline padding 9 px
there), and a row that still overflows (the break label plus five tabs, longer languages) shows a solid `‹` / `›` plate on the
side that has more tabs (`data-more` set in `keepNavTabInView`, kept current on scroll).

**P1-3: selected is not purple.** New tokens `--selected-bg`, `--selected-ink`, `--selected-line` in all three palettes
(dark = accent-soft fill, accent-ink line, normal ink; light the same idea; high contrast black fill, yellow line). Used by:
the top nav's active group (fill + 3 px underline), the phone tab bar's active tab (fill + 3 px top line), the live camera
buttons (both rule sets), the speed buttons, Help's chapter pills, the gear filters, the Real Kangs data level tabs, the locker
captain chips (`.lk-chip.picked`, which also lost two hex literals), and New season while its form is open. Settings'
choice cards already used this look. `tests/theme.test.js` fails if a selected-state selector gets `background: var(--accent)`.

**P1-2: title screen.** `.landing-visual` is `position: fixed` on desktop, so an open start form no longer leaves a grey band
over the gym (the phone layout keeps its picture at the top). `titleMenu()` in `src/title.js` (pure, tested): with a save,
Continue is primary; once New season opens the form, Continue renders `secondary` and "Take over the Kangs" is the only purple
button. The judge demo sits beside New season (two secondary buttons in one row) when a save exists, and leaves the links row
then. The form's open state lives in a module variable in `landing.js`, so a redraw (e.g. a language change) keeps it open.

**P2-1: plain headings.** Bracket card "Playoff bracket" (new key `bracket.title`; `hb.g.run` stays for Help), "League
table" (`journal.table`), timeout dialog "Huddle" / "Timeout" (`timeout.kicker` / `timeout.title`), Staff's card "Assistant
coach" (`office.buildStaff`), Real Kangs data's h1 matches its tab (`data.title`). All 7 locales, applied with
`scripts/i18n-set.mjs`; the JSON is `docs/superpowers/reports/i18n/ui-ease-e.json`.

**P2-6: touch targets.** Under `(pointer: coarse), (max-width: 620px)`: camera buttons, speed buttons and Help's pills are at
least 44 × 44 px; the roster's whole Start label is the hit area (44 px tall, 8 px side padding). Measured in the live game on a
390 px touch phone: every camera and speed button 44 × 44 or larger (before: camera 26–28 px tall, speed 38 × 34).

**check:ui.** `scripts/ui-check.mjs` now reports any screen with more than one visible, enabled, accent-filled button (the
acceptance check of P1-3), in the page or the open dialog. A `role="switch"` track is not counted.

`src/ui/README.md` has a short "The way forward" entry (the slot, `.page-action`, the selected tokens).

## Decisions beyond the plan (and the cost if wrong)

- **The phone bar is `position: fixed`, not `sticky`.** Sticky cannot leave its parent, so a primary inside Game day's rail
  (which starts below the fold) would never be visible; fixed works wherever A and B put `.page-action`. Cost: the page must
  reserve the bar's height, done by measuring it; if a page changes the bar's content without a render, the reserve lags until
  the next resize event (the `ResizeObserver` covers size changes).
- **The shell's slot is in `.subnav-end` and only becomes a bar on phones.** One element, two layouts, so there is never a
  hidden second primary. Cost: between 621 and 760 px the slot stays in the sub-row (second row with the strip), not docked.
- **The roster's slot is empty while the lineup has a problem**, matching what the roster showed before (Best five as the
  primary, no next step). Cost: with both a press conference pending and an injured starter, the roster page has no route
  to the press room except the tab bar.
- **Phones drop the prep-slots item from the strip** to fit game, record and tokens at 390 px. Cost: Home on a phone no
  longer shows "Prep slots 3" (Prep shows its own count).
- **Last Shop tab's foot button became secondary** instead of being removed (keeps the walk-through's symmetry). Cost: the
  same action appears twice on that page (once purple in the slot).
- **The scroll cue is a solid ‹ › plate, not a fade**: `tests/theme.test.js` forbids gradients. Cost: on the Jerseys tab during
  a break the ‹ plate covers the start of the "Preseason" label while the row is scrolled.
- **Timeout dialog kicker became "Huddle"** so the heading "Timeout" is not said twice.
- **Switches stay accent-filled** (Settings): an on/off track is not a button, so check:ui ignores `role="switch"`.

## Left out

- R14 in the live game: the strip is hidden there (the score bug holds the game state); the research report asks for record
  and tokens during the live game too. Not done: the live game's top bar is A's area and has no room on a phone.
- Prep's "In plan" rows (P1-3) and the Game day / Prep halves of P1-4: packages B and A (they wrap their primaries in
  `.page-action`; the bar styling here applies as soon as they do).
- Home's own next-step bar is not a `.page-action` (B's file); it is already above the fold on a phone.
- Out of scope per the rulings: R2, R10, R11's motion toggle, R12, R15, P2-2, P2-3, P2-5, P2-9 to P2-12.

## Tests added

- `tests/nav.test.js`: "the way forward has one slot…": `subnavGo` for every group (week null; team, season, shop 'next';
  the roster empty with a lineup problem; the slot never offers its own page; during a break Shop 'break', Season 'next').
- `tests/title.test.js`: `titleMenu` (no save, save, save with the form open).
- `tests/theme.test.js`: the selected tokens exist, and no selected-state rule in the three stylesheets fills with
  `--accent`.
- `npm test`: 374 pass, 0 fail (the known CPU-timing flakes in playsim/clothFit failed once each under load from the other
  packages' browsers and passed on re-run). `npm run build` and `npm run format:check` green.

## Screenshots looked at

- `npm run check:ui -- --shots` (all 128, after the last change): desktop dark/light and phone dark/light, mid and pre saves.
  Looked at closely: desktop dark/light recruit, roster, season, bracket, standings, data, gear, locker; phone light pre roster,
  standings, staff, locker (break label + ‹ › cue); phone dark mid roster, game, practice, gear, season, recruit; the start form
  desktop dark mid, desktop light pre, phone dark mid. Baseline copies were kept in `ui-shots/base/` for comparison.
- `ui-shots/ui-ease-e/title-{desk-dark,desk-light,phone-dark}-save.png`: the title with a save and the form closed.
- Final `check:ui` run: "no problems found", including the new one-purple-button check on all 128 captures.
- `ui-shots/ui-ease-e/live-*.png`: Playwright against `npm run dev` (`ui-shots/ui-ease-e/live.mjs`), desktop and 390 px touch
  phone, dark and light: after Watch live, then after Courtside + 2×. Exactly one purple button (Pause game); the selected
  camera and speed show the soft fill and the line.

## Files touched that belong to other packages

- `src/ui/screens/roster.js` (D): the toolbar no longer renders `nextStepButton()` (the shell's slot does); "Pick my best
  five" is primary when the lineup needs fixing, else secondary. Removed the unused import. About 6 lines.
- `src/ui/screens/season.js` (D): the bracket card's h2 uses `t('bracket.title')`, and the then-unused `names = stages()` in
  `bracket()` went. 2 lines.
- `src/ui/tutorial.js` (no owner): the docked coach card sits above a fixed `.page-action`. 4 lines.
- Shared: `src/style.css` (selected states, title layout), `src/theme.css`, the 7 locale files, `scripts/ui-check.mjs`.
