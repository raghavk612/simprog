# KANGS · Road to the Championship: notes for agents

A Three.js basketball coaching game (vanilla JS, Vite, no framework). `README.md` describes the game;
`src/ui/README.md` says where every part of the interface lives and how a page, a button and a string are added.
Read that first for any interface change.

## Commands

```sh
npm run dev            # http://127.0.0.1:5173
npm test               # node --test, ~2 s; must stay green
npm run format         # Prettier over src, tests and scripts (format:check only reports)
npm run check:ui       # every page in Chrome, dark/light, desktop/phone: script errors, low contrast, overflow
npm run check:ui -- --shots   # same, plus a screenshot of each page in ui-shots/ to look at
node scripts/i18n-set.mjs changes.json   # set, add or delete (null) keys in all 7 locales at once
```

## Map

- `src/engine.js`: the season simulation (pure functions on the save `state`). Constants like `ROSTER_MAX`,
  `TIMEOUTS`, `SCOUT_COST`, `ECON` live here; use them instead of repeating numbers.
- `src/ui/`: the interface. `shell.js` `render()` rebuilds the whole page from `state` after every change, then
  restores focus, scroll and open `<details>`. Anything else held only in the DOM is lost on the next render.
- `src/arena.js` and friends: the 3D gym. `src/drills*.js`: practice mini-games.
- `src/i18n/locales/*.js`: every string, in 7 languages with identical keys (`tests/i18n.test.js` checks keys,
  placeholders and that keys built at run time exist).
- CSS loads in this order: `style.css` (layout), `theme.css` (colours, type and newer components),
  `a11y.css` (high contrast, text size, reduced motion). New colours are tokens from the top of `theme.css`, never
  hex literals, so light mode and high contrast keep working.

## Interface rules this project follows

- Each screen has one purple (`primary`) button: the way forward. Actions on cards (Sign, Hire, Scout, Buy) are
  `secondary`.
- Say a thing once. Headings are plain labels ("Coaching staff"), not slogans. A disabled button says why next to it.
- Never hard-code a colour or a pixel font size: use the tokens and `calc(Npx * var(--ts, 1) * var(--ls, 1))`.
- Check the light theme and a 390 px wide phone as well as the dark desktop view.

## Checking a change in the browser

`npm test` does not render anything. For interface work run `npm run check:ui` (it needs Google Chrome; it
starts its own server and builds its own saves), then look at the screenshots from `--shots` for the pages you
touched. The live game and the drills are not covered by it: check those by hand in `npm run dev`, through the UI
(title → Continue → the next-step button). The first-game walkthrough locks clicks outside its highlight, so start
a season with "Walk me through the first game" unticked when testing something else.
In `npm run dev` only, the backquote key (`` ` ``) toggles 64× playback, so a watched game takes about 30 s
(quarter breaks still stop it); production builds drop the shortcut.
