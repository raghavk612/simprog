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

| File | What |
| --- | --- |
| `store.js` | `state`, `data`, `view` and their setters, `save()`, the live-game `ui` flags |
| `page.js` | `#app`, `#modal`, the 3D `arena` |
| `markup.js` | `html`, `esc`, `btn`, `header`, icons, small text helpers |
| `shell.js` | routes (`NAV`, `PAGES`), top bar, `render()`, `go()`, camera buttons |
| `actions.js` | what every `data-action` button and form field does |
| `keyboard.js` | shortcut keys |
| `screens/home.js` | Home: the next step and the week's timeline |
| `screens/prep.js` | Prep: picking the week and running the drills |
| `screens/game.js` | Game day page (before tip-off, live, replays) |
| `playback.js` | the live game: possessions, Watch live, timeouts, quarter breaks, replays |
| `screens/results.js` | the result dialog after a game |
| `postgame.js` | press room and coach's inbox |
| `screens/roster.js` | Team: lineup, full stats, player profile |
| `screens/breaks.js` | break screens: Tryouts, Staff (and the unrouted skill tree) |
| `screens/locker.js` | break screen: Locker room, 3D jerseys, captain |
| `screens/season.js` | Season tab: journal, bracket, standings, data, report card |
| `screens/landing.js` | title screen, starting and continuing a season |
| `tutorial.js` | the guided first game (`BEATS`) |
| `demo.js` | the judge demo (`DEMO_VIEWS`) |
| `handbook.js` | Help |
| `dialogs.js` | the dialog, confirm, Settings, credits |
| `toast.js` | notifications |
| `files.js` | export and import of the season file |
| `avatar.js` | player portraits |

## Adding things

- **A page:** write `myPage()` in `screens/`, add it to `PAGES` and to a group in `NAV` (`shell.js`), and add
  `nav.<route>` to every locale. The tutorial and the judge demo open pages by route name, so check
  `BEATS` and `DEMO_VIEWS` when renaming one. `tests/nav.test.js` checks all of this.
- **A button:** `btn(t('my.label'), 'my-action', 'primary')`, then add `'my-action'` to `ACTIONS` (or to
  `SEASON_ACTIONS` if it changes the season) in `actions.js`. Keep existing `data-action` names; tests and the
  tutorial use them.
- **Text:** `t('my.key')`, with the key added to all 7 locale files.

Run `npm test`, and `npm run format` before committing.
