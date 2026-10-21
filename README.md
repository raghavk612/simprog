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
- Accessible rulebook and credits, keyboard coaching controls, motion toggle, opt-in generated audio, responsive layouts.

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
