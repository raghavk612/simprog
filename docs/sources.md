# Sources and asset ledger

Research checked October 20–22, 2026. Exact data check time is in `public/data/kangs.json`.

| Source | Use | License / treatment |
| --- | --- | --- |
| [KingCo Athletics · Lake Washington boys basketball](https://www.kingcoathletics.com/team/?schoolid=66&sportid=3) (WPA Network team widgets) | Public Varsity, JV and C-Team rosters (numbers, names, heights, positions, grades), 2026–27 schedules (dates, times, venues, game types; final scores when published) and the latest published rosters (2025–26 until 2026–27 rosters are posted); opponent rosters at the same level via each opponent's team page | Factual public data; upcoming games carry no scores; C-Team numbers and missing opponent rosters filled by the game and flagged |
| [Lake Washington Boys Basketball](https://www.kangsbasketball.com/hs) | Program context | Reference only |
| [School program information](https://www.kangsbasketball.com/page/show/4151549-lake-washington-high-school) | Lake Washington / Kangs identity | Kangaroo logo supplied by the creators for center court; the sidebar keeps an original K monogram |
| [FBLA event](https://www.fbla.org/competitive-events/computer-game-simulation-programming/) | Event context | Reference only |
| [2026–27 guidelines](https://greektrack-fbla-public.s3.us-east-1.amazonaws.com/files/1/High%20School%20Competitive%20Events%20Resources/Individual%20Guidelines/Presentation%20Events/Computer-Game-Simulation-Programming.pdf) | Topic and rubric cross-check | Linked, not republished |
| [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) | Five imported GLB model types | CC0; bundled license in `public/models/LICENSE-Kenney.txt` |
| [NFHS basketball rules](https://www.nfhs.org/sports/basketball/rules) | Introductory rulebook context | Linked; no rulebook reproduced |
| [Three.js](https://threejs.org/) and [GLTFLoader docs](https://threejs.org/docs/#GLTFLoader) | Renderer, loaders, controls | MIT; copy in `public/licenses/Three-MIT.txt` |
| [Vite](https://vite.dev/) | Development / production build | MIT; copy in `public/licenses/Vite-MIT.txt` |
| [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed) by Jeremy Tribby | Display typography, labels and numbers | SIL OFL, locally bundled; `public/fonts/OFL-Barlow.txt` |
| [Barlow](https://fonts.google.com/specimen/Barlow) by Jeremy Tribby | UI and body typography | SIL OFL (same family license), locally bundled; `public/fonts/OFL-Barlow.txt` |

Original code generates the basketball, court, gym shell, hoop/net geometry, player characters, crowd, jersey graphics, and short opt-in sounds. The three named creators are credited in-game. OpenAI Codex coding assistance is disclosed in credits.

## Import pipeline

Downloaded `kenney_furniture-kit.zip` from the download link on Kenney's original asset page. Extracted `Models/GLTF format/{bench,chair,table,bookcaseClosedDoors,plantSmall1}.glb`. Files remain unchanged. Three.js loads and clones them into the gym, office and locker areas. Scale and placement change at runtime. No proprietary Unity Asset Store content is redistributed.

To bring future Unity-authored objects into this project, export meshes/materials to glTF/GLB with permission from their author. Place GLB files in `public/models/`, document provenance here, and load them through the existing loader. Unity C# components, scene logic, physics and proprietary shaders do not transfer through that export.
