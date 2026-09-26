# Road to the Championship

FBLA 2026–27 Computer Game & Simulation Programming. Topic: *Road to the Championship*.

## Play
- **Online:** https://raghavk612.github.io/simprog/

- **Offline (use this at competition):** open `dist/road-to-the-championship-offline.html` in Chrome, Edge or Safari. No internet needed.
- `dist/road-to-the-championship.html` is the version published as a Claude artifact. It has no `<html>`/`<head>` wrapper because the host adds one.

## Project layout
| Path | What it is |
|---|---|
| `src/engine.js` | Game logic: players, season, practice, possession-by-possession sim, playoffs, endings. No DOM access. |
| `src/events.js` | The 22 off-court challenges and their effects |
| `src/media.js` | Web Audio sound effects, SVG crests/icons, 7-segment scoreboard, Canvas court |
| `src/ui.js` | Screens, input, accessibility, save/load |
| `src/styles.css` | Design tokens and styles |
| `build.py` | Combines `src/` into the two HTML files in `dist/` |
| `tests/e2e.py` | Plays full seasons through the UI (desktop + phone) and screenshots each screen |
| `tests/keyboard.py` | Keyboard-only and screen-reader checks |
| `tests/balance.py` | Simulates hundreds of seasons per difficulty and prints ending rates |
| `design-spec.md` | Rubric-to-feature map, design tokens, user journey, test results |

## Rebuild after editing
```
python3 build.py
```

## Run the tests
The tests need Python Playwright (`pip install playwright && playwright install chromium`). First change the `URL` / `goto` path at the top of each test file to point at your `dist/road-to-the-championship-offline.html`.
```
python3 tests/e2e.py
python3 tests/keyboard.py
python3 tests/balance.py 150
```
