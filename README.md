# KANGS · Road to the Championship

A fresh Three.js basketball coaching game for one Lake Washington season. Purple-and-white 3D gym, imported cross-engine assets, published roster and schedule, and a deterministic management simulation.

**Creators:** Ajisth Sareen, Raghav Krishnan, Malhar Pawar.

## Play / develop

```sh
npm ci
npm run dev
npm test
npm run build
```

Open the URL Vite prints. Production files are in `dist/`; serve them over HTTP, not `file://`. Everything needed for gameplay is bundled locally. The production service worker caches the app after the first successful visit for offline replay. Export a season from the header to keep a portable save.

## Implemented

- Named coach, three difficulties, one-time introductory tour, local saves and validated JSON import/export.
- 14 sourced public roster entries, all 30 published 2025–26 matchups, actual reference results and reported-game individual scoring averages.
- 15-player limit, fictional paid tryouts, release/rename, five starters, editable 160-minute rotation, eligibility checks.
- Training, recovery, study hall, bonding, weekly conversations, community fundraising, one assistant with differentiated bonuses.
- Individual energy, morale, skill, simulated GPA and health; team chemistry, fans, currency and preparation limits.
- Pregame scouting, possession-by-possession scoring, tactical changes, three timeout huddles, overtime, live simulated box scores.
- Decision trail, postgame recorded shot visualizations and transparent shot-probability contributions.
- A complete 30-game campaign, qualification gate, elimination state run, ending recap, and simulated background standings.
- Three jersey kits, custom number colors, player-specific numbers and nameplates on stylized 3D players.
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

`public/data/kangs.json` is a **dated historical snapshot**, not a live official score feed. `scripts/refresh-data.py` retrieves the public FinalScoreTV roster, schedule and available player point records. Missing individual records remain missing. Individual PPG means the average over **reported games only**, never an invented season average. Team PPG uses all 30 published results.

The Pages workflow checks the source daily and on deployments. A failed refresh retains the repository snapshot and its original timestamp. The browser checks the published snapshot every five minutes and has a manual refresh button. Existing campaigns preserve their original data so a source refresh cannot rewrite a user's season.

Skills, injuries, GPA, morale, tryout prospects, assistant roles, scouting profiles, results and standings are fictional game data. No private student records, official logos or real athlete likenesses are used. This is an independent project, not school-endorsed.

## Season model

The first 20 published opponents are regular-season fixtures; the next six form the district stretch. Twelve wins after game 26 qualify for a four-game elimination state run. The final published matchup is an **alternate championship final** in the simulation, not a claim about the real WIAA tournament. There is no multi-year progression. Other opponents receive fictional background fixtures for the campaign standings.

## 3D assets / Unity

Kenney's CC0 Furniture Kit includes FBX, OBJ, DAE and GLB assets. Five model types are imported using Three.js GLTFLoader: bench, chair, table, cabinet and plant. The same pack can be imported into Unity using FBX. This project uses its browser-ready GLB files; it does **not** execute Unity scenes or prefabs.

The court, baskets/net lines, ball, spectators, stylized articulated players and jersey textures are original code-built geometry. The renderer uses shadow mapping, lighting, orbit controls and camera presets. HTML overlays provide accessible text, forms and keyboard interaction.

See [sources and licenses](docs/sources.md), [FBLA alignment](docs/fbla-alignment.md), and [verification](docs/verification.md).

### Watching a game

Use **Watch live**, **Next play**, or **Pause game** on the court HUD (or **P** / **N**). Choose **1× / 2× / 4×** viewing speed without changing outcomes; Settings adds a slower 50 % or 75 % playback. **Follow** tracks the action; **Wide** and **Courtside** provide alternate views. Expand **Play-by-play** or **Box score** for details. Recorded possessions in the season journal support replay and pause; postgame probability contributions are in the optional decision analysis.
