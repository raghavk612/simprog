# KANGS · Road to the Championship

A fresh Three.js basketball coaching game for one Lake Washington season. Purple-and-white 3D gym, imported cross-engine assets, published roster and schedule, and a deterministic management simulation.

**Creators:** Raghav Krishnan, Ajisth Sareen, Malhar Pawar.

## Play / develop

```sh
npm ci
npm run dev
npm test
npm run build
```

Open the URL Vite prints. Production files are in `dist/`; serve them over HTTP, not `file://`. Everything needed for gameplay is bundled locally. The production service worker caches the app after the first successful visit for offline replay. Export a season from the header to keep a portable save.

## Implemented

- Named coach and three difficulties that pick which real team you coach: **C Team** (the real C-Team), **Junior Varsity** (the real JV) or **Varsity**. One-time introductory tour, local saves and validated JSON import/export.
- Real 2025–26 rosters and completed schedules for all three levels from KingCo Athletics: Varsity 12 players / 30 games, JV 12 / 19, C-Team 13 / 18. Creator Malhar Pawar plays as #11 on the real JV roster.
- Real opponent rosters at the matching level for every opponent that publishes one, so the play-by-play names actual players; opponents without a published roster get clearly flagged fictional names.
- 15-player limit, fictional paid tryouts, release/rename, five starters, editable 160-minute rotation, eligibility checks.
- Training, recovery, study hall, bonding, weekly conversations, community fundraising, one assistant with differentiated bonuses.
- Individual energy, morale, skill, simulated GPA and health; team chemistry, fans, currency and preparation limits.
- Pregame scouting, possession-by-possession scoring, tactical changes, three timeout huddles, overtime, and ESPN-style box scores (MIN, PTS, FG, 3PT, REB, AST, STL, BLK, TO) with starters, bench and team totals.
- ESPN-style season leaders (Points, Assists, Rebounds, Blocks and Steals Per Game) and per-game columns on the roster and player profiles. Players who have not played show “—”, never 0.
- Decision trail, postgame recorded shot visualizations and transparent shot-probability contributions.
- A complete campaign over your team's real schedule, qualification gate, four-game elimination run (state run for Varsity, title run for JV and C-Team), ending recap, and simulated background standings.
- Three jersey kits, custom number colors, player-specific numbers and nameplates on stylized 3D players; the Kangs kangaroo logo at center court.
- Accessible rulebook and credits, rebindable keyboard shortcuts, responsive layouts.
- A Settings dialog with sound, accessibility and language options (see below), adapted from the EcoQuest project.

## Accessibility, sound and language

Open **Settings** from the top bar or press **O**. Choices apply immediately and are remembered in the browser.

- **Sound:** 14 synthesized basketball effects (no audio files) with a master volume, mute and an individual switch for each sound. Sound starts off.
- **Accessibility:** colour-vision correction (deuteranopia, protanopia, tritanopia), high contrast, reduced motion, screen shake and flash reduction, text size from 70 % to 180 %, three font styles, slower playback (50 % / 75 %), timing assist and a simplified interface. Your operating system's reduced-motion and contrast preferences are used on the first visit.
- **Screen readers and keyboards:** skip link, labelled controls, tabs and switches, focus moved to each new page, and every play and score announced as text. Nine rebindable shortcuts (Watch live/pause **P**, Next play **N**, Timeout **T**, cameras **1–3**, speed **S**, sound **M**, settings **O**).
- **Language:** English, Spanish, Chinese, French, Japanese, Italian and Hindi, including the play-by-play and decision trail. The browser's language is used first, and your choice is remembered.

How it works, what changed from EcoQuest and how to extend it: [docs/accessibility.md](docs/accessibility.md). The translations have not yet been reviewed by native speakers, and the interface has not had a formal accessibility audit.

## Real data versus simulation

`public/data/kangs.json` is a **dated snapshot**, not a live score feed. `scripts/refresh-data.py` reads the [KingCo Athletics Lake Washington boys basketball page](https://www.kingcoathletics.com/team/?schoolid=66&sportid=3), which embeds WPA Network team widgets, for the Varsity, JV and C-Team rosters and schedules. It also follows each opponent's school link to fetch that opponent's roster at the same level. Only games with a final score become playable matchups (the postponed Dec 17 game is excluded). KingCo publishes no individual statistics, so every player statistic in the game is simulated.

C-Team jersey numbers, heights and positions are not published; the game assigns jersey numbers and marks them with an asterisk on the Real Kangs Data page. Opponents with no published roster (out-of-state holiday tournament teams, Coeur d'Alene, Tulalip Heritage, Puyallup and Richland) get fictional names flagged `real: false`.

The Pages workflow refreshes daily and on deployments. It tries the newest season first and switches only when every level has a roster and nearly all posted games are final; until then it keeps 2025–26 (the 2026–27 schedules are posted but unplayed, and rosters are not out yet). A failed refresh keeps the repository snapshot and its timestamp. The browser checks the published snapshot every five minutes and has a manual refresh button. Existing campaigns keep their original data, so a refresh never rewrites a season in progress.

To rebuild from a saved extraction instead of the network: `python3 scripts/refresh-data.py --from-raw raw-2025-26.json` (an optional `opp-2025-26.txt` next to it supplies opponent rosters).

Skills, injuries, GPA, morale, tryout prospects, assistant roles, scouting profiles, simulated results, statistics and standings are fictional game data. No private student records or real athlete likenesses are used. This is an independent project, not school-endorsed.

## Season model

Each level plays its real completed schedule in published order. The last four games form an elimination run (state run for Varsity, title run for JV and C-Team); to qualify you need at least 46% wins before it (12 of 26 for Varsity, 7 of 15 for JV, 7 of 14 for C-Team). The run is a simulated bracket built from the published opponent order, not the real WIAA or KingCo tournament. There is no multi-year progression. Other opponents receive fictional background fixtures for the campaign standings.

## 3D assets / Unity

The center-court logo is the Lake Washington Kangs kangaroo mark (`public/images/kangs-logo.png`, white background removed so the court shows through), supplied by the creators. Kenney's CC0 Furniture Kit includes FBX, OBJ, DAE and GLB assets. Five model types are imported using Three.js GLTFLoader: bench, chair, table, cabinet and plant. The same pack can be imported into Unity using FBX. This project uses its browser-ready GLB files; it does **not** execute Unity scenes or prefabs.

The court, baskets/net lines, ball, spectators, stylized articulated players and jersey textures are original code-built geometry. The renderer uses shadow mapping, lighting, orbit controls and camera presets. HTML overlays provide accessible text, forms and keyboard interaction.

See [sources and licenses](docs/sources.md), [FBLA alignment](docs/fbla-alignment.md), and [verification](docs/verification.md).

### Watching a game

Use **Watch live**, **Next play**, or **Pause game** on the court HUD (or **P** / **N**). Choose **1× / 2× / 4×** viewing speed without changing outcomes; Settings adds a slower 50 % or 75 % playback. **Follow** tracks the action; **Wide** and **Courtside** provide alternate views. Expand **Play-by-play** or **Box score** for details. Recorded possessions in the season journal support replay and pause; postgame probability contributions are in the optional decision analysis.
