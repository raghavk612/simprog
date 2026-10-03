# Road to the Championship

Created by **Ajisth Sareen, Raghav Krishnan, and Malhar Pawar**.

A one-season high-school basketball coaching simulation for the FBLA 2026–27 Computer Game & Simulation Programming topic.

## Play

- [Play online](https://raghavk612.github.io/simprog/).
- Offline: open `dist/road-to-the-championship-offline.html` in a modern browser. Gameplay, illustrations, audio, credits and Decision Replay work without a network; typography falls back to system fonts.
- Start with Quick Start, or build a school and recruit your roster. Complete 10 regular-season games, qualify in the district top four, then win four playoff rounds to claim State. Each replay starts a fresh season.
- **What if, Coach?** Try the title-screen exhibition, or open Decision Replay after your own game. Compare two tactical branches from identical pregame conditions without altering your saved season.
- Click a player card to edit first and last names. Credits & sources are available from the title, gameplay toolbar and season ending.

## Build and checks

```sh
python3 build.py
node tests/season.test.cjs
```

The Node suite checks 360 complete one-season runs, first-season championship reachability on every difficulty, deterministic film experiments, live-state isolation (including failure recovery), and compatible save migration. No third-party test dependencies are needed.

Python Playwright scripts in `tests/` cover full UI seasons, keyboard control and overflow. They require Python Playwright and Chromium. These scripts were updated for the one-season flow; the current change was validated through browser interaction and the Node suite, not a full rerun of all Python suites. `tests/archive/` holds obsolete multi-season tests/results for history only.

## Files

| Path | Purpose |
|---|---|
| `src/engine.js` | Seeded simulation, recruitment, practice, season outcomes, isolated Decision Replay |
| `src/events.js` | Off-court challenges and consequences |
| `src/media.js` | Inline vector art, live Canvas court, synthesized audio |
| `src/ui.js` | Screens, player renaming, tour, local saves, credits |
| `src/styles.css` | Responsive layout, visual identity, accessibility styles |
| `build.py` | Standalone HTML and GitHub Pages entry point |
| `docs/fbla-alignment.md` | Rubric cross-reference, evidence, remaining presentation work |

Saves use `rtc-save-v5`. Compatible first-season v4 saves migrate without overwriting the old slot. Later multi-season saves remain stored separately and are not presented as one-season runs. The once-per-browser tutorial marker is unchanged.
