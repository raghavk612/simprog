# Package D: Team and Season (ui-ease-d)

Plan: `docs/superpowers/plans/2026-11-26-ui-ease.md`, package D. Findings: P1-1, P1-8 and P2-7 in
`docs/superpowers/reports/2026-11-26-ui-audit.md`; R3, R6, R11 and the "avoid" table in the sports game menu research.

## What was built

**P1-1: locked achievements can be read** (`src/style.css`, the LOCKED stamp block). The full-card stamp and the 32 %
opacity are gone. A 72×38 px stamp sits in the top-right corner, as on the jersey kits, and the locked row keeps
88 px of right padding so no text runs under it. Goal text and progress ("1 / 13") are drawn in their normal ink in
both themes. The "Locked" word is visually hidden but now reaches screen readers. Before, `visibility: hidden` hid it
from them too.

**P1-8: standings are a real table** (`standingsView()` in `src/ui/screens/season.js`). The columns are
# · Team · W · L · Pct · GB. Each short column name has its full name for screen readers and on hover ("Wins",
"Games behind the leader"). Team names are row headers (`<th scope="row">`). Teams with the same record share a
place: six 1–0 teams are all "1", and the next team is "7". This answers the audit's "no tiebreak shown". The
coached team's row says "Kangs (you)", is bold, has the `--accent-soft` background and a 4 px `--accent-ink` bar on
its first cell, so high contrast (where `--accent-soft` is black) still marks it. Pct is written ".750" / "1.000"
in the reader's number format, and "—" for a team that has not played. Achievements stay on the page, as ruled.
Ranking, shared places and GB come from `standingsRows()` in `src/ui/lists.js`.

**R6 + P2-7: sortable Full stats and Season data, kept across redraws.**
- `sorts` and `setSort()` in `src/ui/store.js` hold `{ key, dir }` per table (`stats`, `data`). The `sort` action in
  `actions.js` sets it and redraws. Nothing about the sort is read from the DOM, so a redraw, opening and closing a
  profile, selecting a row or leaving the page and coming back all keep it (checked in the browser, below).
- Every column header except the Start checkbox is a `<button>` filling the `<th>` (44 px tall). The sorted column has
  `aria-sort` and a ▲/▼ mark. A first click sorts numbers highest first and names A to Z; a second click reverses.
  Ties keep the roster's order. Focus stays on the header after the redraw: `data-key` is already one of
  `render()`'s focus keys.
- Full stats: the team leader in each column (OVR, the five ratings, energy, PPG to BPG) is bold. PPG is no longer bold
  in every row. Class year sorts freshman to senior.
- The ◀ ▶ arrows and the arrow keys on the player card step through the sorted order, not the roster order.
- On a phone the table scrolls sideways, and `render()` resets that scroll. The `sort` action therefore scrolls the
  clicked header back into view (`scrollIntoView({ inline: 'nearest' })`), so PPG and its ▼ stay on screen.
- Season data: #, Player, Position, Height (in inches, so 6' 4" is above 5' 11") and Grade.

**P2-7 roster cards** (`squadCard`, `roster()` in `src/ui/screens/roster.js`):
- The energy bar takes its word's colour, with the same thresholds as `energyWord`, now `energyLevel()` in
  `lists.js`: fresh `--good`, rested `--score`, tired and exhausted `--bad`. The word is printed after the number
  ("Energy 74 · Rested"), so the colour is never the only signal (R11). The Full stats energy bar has the same colours,
  with the number beside it.
- The captain pill is now a `secondary small` button. With a captain it reads "Captain: X". Without one it reads
  "No captain yet · Name captain". Either way it opens Full stats on that player's card and moves the focus to Name
  captain. With no captain, the suggested player is the best eligible player (by OVR) with morale 70 or more, the level
  at which a captain calms the locker room (`captainPick()`).
- The toolbar shows the starters' position balance, e.g. "Starters: 4 G · 1 F" (`positionBalance()`).

**R3: a player's profile from more names** (the ruling's scope):
- The live game's box score: each name is a button that opens the profile (`boxTable()` in `src/ui/screens/game.js`).
  The dialog pauses the gym, and Watch live waits while it is open (existing behaviour). Closing returns to the game
  with the box score drawer still open.
- Season data: on the level being coached, every name still on the roster opens that player's profile. Players are
  matched by `originalName`, so a renamed player still links.
- The leaders card already linked. Standings is team-level, and tryouts are not on the roster, so neither applies.

**R11 for eligibility:** every ineligible row and card already gives the reason in words ("Injured", "Ineligible",
"Exhausted") beside the dimmed look, so it was left as it is.

## Decisions beyond the plan

| Decision | Cost if wrong |
| --- | --- |
| The result dialog's box score keeps plain names. Only the live box score links (`links` defaults to `compact`). A profile opened from the dialog would replace the result dialog (`show()` swaps the content), and that dialog's close starts the postgame. | The result dialog's names are not clickable; R3 there would need a "back to result" path in `dialogs.js`. |
| Standings columns are # · Team · W · L · Pct · GB, without the audit's Streak. The save stores only W–L per opponent, not game-by-game results for the simulated teams, so no streak can be computed for them. | One column the audit asked for is missing. Adding it means storing per-round results for every team in `updateStandings` (engine, plus a save check). |
| Level records share a place (1, 1, …, 7) instead of a made-up tiebreak. | Some players may expect a unique ordering. The order inside a tie is the table's own: the coached team first, then the original order. |
| The "Locked" pill is visually hidden (still read by screen readers). The corner stamp alone shows the state on screen, rather than stamp and pill both saying LOCKED. The audit said "keep `.ach-state` visible". | If a judge reads the stamp image as decoration, the word is only there for screen readers. One CSS rule brings the pill back. |
| The captain control is a `secondary small` button, not a pill, because it is an action and the project's buttons look like buttons. | The toolbar has one more button-looking control. |
| Pure helpers live in a new `src/ui/lists.js` (no DOM, no store). `store.js` cannot be loaded in node: it imports `toast.js` → `markup.js`, which reads `import.meta.env.BASE_URL`. So the sort state sits in `store.js` as the plan asks, and its behaviour is tested through the pure `nextSort`/`sortRows`, plus a source check that the screens read `sorts.*` and never look for the sort in the DOM. | The "survives a render" test is part behavioural (the same sort gives the same order on every draw) and part a source check, not a real `render()` in a DOM. The browser check below covers the rest. |
| One sort per table, shared by Season data's three levels; not saved with the season. | Switching level keeps the same column sorted, which is likely what a reader wants. |
| The energy colour for "rested" is `--score`, as the audit said. In the light theme that token is purple. | In light mode, rested bars are purple rather than amber. The word beside them says it either way. |

## Left out

- Streak column (see above).
- The bold leader barely shows in OVR and the five grade columns, because those cells are already bold (OVR 800,
  grades 700). It shows clearly in energy and PPG to BPG. Leaders are compared as shown, so equal grades or an equal
  "18.0" are all bold. Making it show in the bold columns means lightening their normal weight, which changes the
  table's look, so I left it.
- Out of scope by ruling: R2, R10, R11's title-screen motion toggle, R12, R15, P2-2, P2-3, P2-5, P2-9 to P2-12.
- P2-6 touch targets of the inline name links (`.leader-link` / `.player-link`, `min-height: 0`) belong to package E.

## Tests added

- `tests/lists.test.js` (13 tests): `nextSort` (first click by column kind, reversing), `sortRows` (direction, stable
  ties, case-free names, no mutation, no sort = roster order), the sort as data gives the same order on every draw, the
  screens read `sorts.*` from the store and never the DOM, `ariaSort`, `energyLevel` thresholds, `standingsRows` (rank by
  Pct then wins, shared places, GB, the coached team marked, no Pct before a game), `captainPick`,
  `positionBalance`, `columnLeaders`, `yearRank` / `heightInches`, `sortHead` markup (`aria-sort` only on the sorted
  column).
- `tests/i18n.test.js`: the run-time keys `journal.col.*`, `rv.energy.*`, `rv.short.*`.

`npm test`: 384 pass, 0 fail. Two known timing flakes each failed once under machine load and passed when
re-run alone: `clothFit` and "motion version 3: a play is worked out once, in a few milliseconds". Neither is this
package's code. `npm run build` and `npm run format:check` pass.

## Screenshots looked at

- `npm run check:ui -- --shots --only=mid` (all 13 pages, desktop and phone, dark and light): no problems. I looked
  at roster, standings, data, bracket and season in desktop dark, desktop light and phone (dark and light), with the
  baseline in `ui-shots/base/` for comparison. Bracket and season are unchanged.
- `ui-shots/ui-ease-d/check.mjs`, a Playwright script against the Vite dev server (the same server as `npm run dev`;
  backquote 64× playback for the live game). 41 checks, all PASS, in desktop dark, desktop light and phone dark:
  - the captain button opens Full stats with the focus on Name captain;
  - a PPG click sorts, sets `aria-sort="descending"` and keeps the focus on the header;
  - the sort survives selecting a row, opening and closing a profile, and going to Home and back;
  - a second click reverses;
  - Season data sorts by height and 12 names open profiles;
  - live game: box score names are buttons, one opens the profile, and closing it returns to the game with the box
    score drawer still open.
  Screenshots: `*-fullstats.png`, `*-fullstats-ppg.png`, `*-data-height.png`, `live-boxscore.png`,
  `live-profile.png`, and `phone-ppg-viewport.png` from `probe.mjs` (the phone sideways-scroll fix).

## Files touched that belong to other packages

- `src/ui/screens/game.js` (package A): only `boxTable()`, the box score markup this package owns. It gains a
  `links` parameter (default `compact`), and the name cell becomes a button when it is set. No call site changed.
- `src/style.css`, `src/theme.css`, `src/ui/actions.js`, locale files: the shared files, with local hunks. `theme.css`
  has one block after `.standings-grid .fit-scroll` (sortable headers, the standings table, energy colours). It does
  not touch the tokens at the top, which are package E's.
- `src/ui/lists.js` is new.
- Strings: `docs/superpowers/reports/i18n/ui-ease-d.json` (`roster.balance`, `journal.you`, `journal.col.*`).

## Concerns for the coordinator

- `render()` (`shell.js`, package E) restores the window's scroll but not the sideways scroll inside a `.table-wrap`.
  I worked around it for sort clicks only. On a phone, ticking Start or selecting a row in a table scrolled sideways
  still jumps it back to the first columns. A general fix belongs in `render()`: remember `scrollLeft` per
  `.table-wrap`, the way open `<details>` are remembered.
- Closing any dialog sets `arena.paused = false` (`main.js`). Opening a profile from the live box score while the
  game is paused by hand, then closing it, therefore resumes the game. That was already true of the model panel. Not
  changed.
- A full-page phone screenshot once showed the "Skip to main content" link mid-page after a sort click. The
  viewport probe found the focus on the header and the link at `top: -100px`, so it looks like a capture artefact,
  not a focus bug.
