# src/ui — the interface

`src/main.js` starts the app and connects page events to these files. The simulation is in `src/engine.js`,
the 3D gym in `src/arena.js`, the text in `src/i18n/locales/` (all 7 locales must have the same keys).

## How a page works

Every page is a function that returns an HTML string, built from the save (`state`). `render()` in `shell.js`
redraws the whole page; there are no per-element event listeners. Buttons say what they do with attributes:

- `data-view="roster"` opens that page (`go()` in `shell.js`).
- `data-action="recruit"` runs that entry of `ACTIONS` or `SEASON_ACTIONS` in `actions.js`.

To change the season: change `state` (normally through an `E.*` engine function), then `save()` and `render()`.
A `SEASON_ACTIONS` entry gets that save, redraw and sound for free.

Markup is written with `html` templates (`markup.js`). Line breaks and the indent after them are dropped, so
write templates over as many lines as you like. Put text from the save or the data through `esc()`.

## Where things live

| File                 | What                                                                          |
| -------------------- | ----------------------------------------------------------------------------- |
| `store.js`           | `state`, `data`, `view` and their setters, `save()`, the live-game `ui` flags |
| `page.js`            | `#app`, `#modal`, the 3D `arena`                                              |
| `markup.js`          | `html`, `esc`, `btn`, `header`, icons, small text helpers                     |
| `nav.js`             | routes (`NAV`) and their tabs, what a Shop page shows during a break          |
| `shell.js`           | `PAGES`, top bar, `render()`, `go()`, camera buttons                          |
| `renderKeep.js`      | what `render()` keeps from the DOM: open drawers, tables' side scroll         |
| `actions.js`         | what every `data-action` button and form field does                           |
| `keyboard.js`        | shortcut keys                                                                 |
| `screens/home.js`    | Home: the next step and the week's timeline                                   |
| `screens/prep.js`    | Prep: picking the week and running the drills (data: `src/prepPlan.js`)       |
| `screens/game.js`    | Game day page (before tip-off, live, replays)                                 |
| `playback.js`        | the live game: possessions, Watch live, timeouts, quarter breaks, replays     |
| `screens/results.js` | the result dialog after a game, and its "What changed" (`src/recap.js`)       |
| `postgame.js`        | press room and coach's inbox                                                  |
| `screens/roster.js`  | Team: lineup, full stats, player profile                                      |
| `screens/breaks.js`  | Shop: Tryouts, Staff, Skill tree, Gear                                        |
| `screens/locker.js`  | Shop: Locker room, 3D jerseys, captain                                        |
| `screens/season.js`  | Season tab: journal, bracket, standings, data, report card                    |
| `screens/landing.js` | title screen, starting and continuing a season                                |
| `lessons.js`         | the assistant coach's lessons as data (`LESSONS`), progress, levels; no DOM   |
| `tutorial.js`        | shows the lessons: cards, ring, Got it / Hide tips / Show me, holding play    |
| `demo.js`            | the judge demo (`DEMO_VIEWS`)                                                 |
| `handbook.js`        | Help                                                                          |
| `dialogs.js`         | the dialog, confirm, Settings, credits                                        |
| `toast.js`           | notifications                                                                 |
| `files.js`           | export and import of the season file                                          |
| `avatar.js`          | player portraits                                                              |

## Adding things

- **A page:** write `myPage()` in `screens/`, add it to `PAGES` (`shell.js`) and to a group in `NAV` (`nav.js`), and add
  `nav.<route>` to every locale. The lessons and the judge demo name pages by route, so check
  `LESSONS` (`lessons.js`) and `DEMO_VIEWS` when renaming one. `tests/nav.test.js` checks all of this.
- **A button:** `btn(t('my.label'), 'my-action', 'primary')`, then add `'my-action'` to `ACTIONS` (or to
  `SEASON_ACTIONS` if it changes the season) in `actions.js`. Keep existing `data-action` names; tests and the
  lessons use them.
- **Text:** `t('my.key')`, with the key added to all 7 locale files.
- **The way forward:** a screen has one purple button. Pages without their own get the week's next step in one slot,
  the end of the row under the top bar (`subnavGo` in `nav.js` decides which pages). A page with its own primary wraps it
  in `<div class="page-action">` (the button, its disabled reason, at most one short status line; one per page): in the
  flow on a desktop, a bar docked above the tab bar on a phone. A selected tab, filter or toggle uses the
  `--selected-*` tokens in `theme.css`, never the purple fill.

Run `npm test`, and `npm run format` before committing.

## The assistant coach's lessons

Nine short chapters (one to three steps each) and a few one-time tips, each opening the first time its moment comes:
week 1, tip-off, a timeout worth calling, the first quarter break, game speed, the press room, each Shop tab, the
midseason and playoff breaks. They are data in `lessons.js` (`start`, and per step `on`, `done`, the ring `spot` and the
glowing `act`); `tutorial.js` shows them and nothing on the page is ever locked. A step closes when the coach does the
real thing anywhere, and a step already done is skipped. The level (Lessons, Tips only, Off) is a preference in
`settings.js` (Settings > Game, and the start form's question); progress is in `localStorage` under `kangs-lessons-v1`,
and Help's Lessons tab replays any of them. A new feature should ship with its own lesson or tip: add it to `LESSONS`,
add `tutorial.c.<chapter>.<step>` (or `tutorial.tip.<id>`) and `tutorial.name.<chapter>` to every locale.
