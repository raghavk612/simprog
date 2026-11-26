# ui-ease fix pass

The findings of the final review (`ui-ease-review.md`, ee15a20..aa37863), fixed on `ui-ease`, one commit per fix, each
pushed. `npm test` 431/431, `npm run build` and `npm run format:check` are clean, and `npm run check:ui -- --shots`
(all pages, run with `graphics: 'low'`, reverted before committing) reports no problems. Browser checks of the lessons,
Prep and Home, the side scroll, focus and the break foot ran in a Playwright script against `npm run dev`, with
screenshots in `ui-shots/ui-ease-fix/`. Every check passed.

## Important

| #   | Finding                                            | What was done                                                                                                                                                                                                                                                                                                               | Test / check                                                                                                                                            |
| --- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The phone's Game day bar was about 170 px tall     | `.page-action` holds only the purple button. A secondary Tip off and its skip line moved into the rail, in a new `.tipoff-action` wrapper. The desktop shows the same three items in the same order. When Tip off is the primary, its disabled reason stays in the bar.                                                     | Screenshots `phone-dark-mid-game` (the bar is one button tall) and `desktop-dark-mid-game` (looks the same as before)                                   |
| 2   | The tip-off lesson glowed a secondary Tip off      | Step `five` opens only when `E.nextStep(state).id === 'tipoff'`.                                                                                                                                                                                                                                                            | `tests/lessons.test.js`: "the tip-off card opens only when tip-off is the week's next step…" (failed first). Browser: `lesson-tipoff-not-next/next.png` |
| 3   | The Strength row read like player OVR              | The row is now "Team skill: Kangs 76 · Redmond 77 · Even". The plain word comes from `matchupLevel()` in `teamLabels.js`: "even" means within 2 points as shown, otherwise "favoured" or "underdog". `game.strengthShort` was deleted, and `game.odds.*` was added and listed as a run-time key.                            | `tests/gameday.test.js`: "the matchup word compares team skill on one scale…"                                                                           |
| 4   | The Tryouts coach card covered the team-needs line | The needs line and the cards are wrapped in `.tryouts`, and `SHOP_SPOT.recruit` points at that wrapper. On a desktop the card now sits above the list, over the page intro, and the needs line stays visible.                                                                                                               | Screenshot `desktop-dark-mid-recruit`                                                                                                                   |
| 5   | `render()` kept only `scrollY`                     | A new module, `src/ui/renderKeep.js`, is pure. It keys elements by class list and position (the open `<details>` now use it too) and saves and restores each `.table-wrap`'s `scrollLeft`. Package D's `scrollIntoView` workaround in the `sort` action was redundant and is removed. A row is added to `src/ui/README.md`. | `tests/renderKeep.test.js` (3 tests). Browser: the phone's Full stats keeps `scrollLeft` 180 after a row select, a Start tick and a sort                |

## Minor

- **Rested energy was `--score`, which is purple in the light theme.** It now uses `--good`, the same as fresh. The
  word is always printed beside the bar. Check: `desktop-light-mid-roster`.
- **A toast with an action waited for the break.** In `ToastHold.offer`, `opt.action` now counts as `now`. Test:
  `tests/toastHold.test.js` "a notification with a button (Hide tips' Undo) shows at once…".
- **Prep disagreed with Home.** A new helper, `prepPrimary()` in `prepPlan.js`, returns `run`, `game` or `step`. When
  another step comes first (the press room, a break, the lineup), that step is the purple button, built with Home's
  `nextStepButton`. Run the week becomes secondary, with "The week's next step comes first." under it (or its disabled
  reason). On a phone it sits at the foot of the list (`.prep-side.waits`), not in the bar. Test: `tests/prepPlan.test.js`
  "Prep's purple button is Home's next step…". Browser: for the press room pending, the preseason break and planning,
  on desktop and phone, Prep shows exactly one purple button and it matches Home. Shots: `prep-*.png`.
- **The phone gear button wrapped to three lines.** The button now says "Buy · N tokens". When the slot is free, the
  line "Equips on <name>" sits under it. Tighter card and button padding at 620 px and below keep the button on one
  line. `gear.buyEquip` was deleted and `gear.equipsOn` added. Test: `tests/gear.test.js` "the gear page says a purchase
  will be equipped…" (updated first). Check: `phone-dark-mid-gear`.
- **Focus after Dismiss assistant.** After the redraw, a `FOCUS_AFTER` entry in `actions.js` moves focus to the first
  Hire button that can be pressed, or else to the page heading. After Release, focus goes to the page heading. This is
  DOM-only, so it was checked in the browser. Before the fix focus fell to BODY; after it, it is on the Hire button.
- **Locales.** `office.fundraiseFx`, `office.listen`, `office.listenFx`, `office.academics` and `office.academicsFx` were
  unused and are deleted. The keep-list line is gone. The run-time list now names `recruit.{over,under}{Pos,Any}` and
  `lineup.{injured,gpa,tired}`, and pushes `rv.energy`, `rv.morale` and `rv.short` once each. A scan against `main`
  found no other key that this branch stopped using. The JSON is in `docs/superpowers/reports/i18n/ui-ease-fix.json`.
- **Duplicated helpers.** `energyLevel` and `moraleLevel` now live only in `teamLabels.js`. `lists.js` no longer
  defines them, and `roster.js` imports them. `energyBar()` is also in `teamLabels.js`, so Game day's starting five and
  Team colour energy the same way. Test: `tests/gameday.test.js` "one energy bar for Game day and Team…".
  `tests/lists.test.js` now imports `energyLevel` from `teamLabels.js`.
- **"Start the season" appeared twice on a phone.** The foot's copy has the class `.break-leave` and is hidden at
  620 px and below, where the docked bar right above it shows the same button. The desktop is unchanged. Browser: 1
  visible copy (`break-locker-phone.png`).
- **The recap kept its own standings ranking.** This was the five-minute change, so it was done: `standingsRank()`
  now reads `standingsRows()`. Test: `tests/recap.test.js` "the recap's place is the Standings page's place…" (failed
  first: 1 against 2).

## Left as they are

- **The recap snapshot lives only in memory.** A reload mid-week, or a demo round trip, loses the list. Fixing this
  would add a save field. The review found it acceptable for a judge session.
- **`.player-link` touch targets are under 44 px.** Fixing this is not trivial: raising the height inflates every
  box-score and Season data row, and enlarging the hit area overlaps the rows next to it.
- **The press penalty in the balance script.** `node scripts/balance.mjs` still runs (exit 0), and its numbers are
  unchanged.
- **The coach card on Tryouts.** It no longer covers the needs line, but on a 1440×900 desktop it sits over the page
  title and intro, because no placement beside or below the tall list fits on screen.
