# FBLA 2026–27 alignment

Reference: [Computer Game & Simulation Programming guidelines, updated August 2026](https://greektrack-fbla-public.s3.us-east-1.amazonaws.com/files/1/High%20School%20Competitive%20Events%20Resources/Individual%20Guidelines/Presentation%20Events/Computer-Game-Simulation-Programming.pdf).

The topic asks for a high-school team championship simulation involving recruiting, development, resources, morale, challenges and strategic leadership. This build follows that through a single-season Kangs campaign.

| Rubric area | Demonstrable implementation |
| --- | --- |
| Topic alignment | Recruiting, practice tradeoffs, eligibility, fatigue, injuries, conversations, budget and state elimination |
| Rules / outcomes / challenge | In-game handbook, validated rotations, three difficulty levels (C Team · Rookie, Junior Varsity · All-Star, Varsity · Hall of Fame), qualification and championship/end states |
| Innovation | Real published season reimagined through a transparent decision model; recorded shot scenes explain coaching effects |
| Technical implementation | Three.js assets, seeded simulation, source-refresh pipeline, validated saves, offline cache and automated tests |
| Graphics / consistency / visual-audio design | One set theme built on the real logo purple ("Gym at night", flat graphite with scoreboard amber) with a designed light mode, 3D gym, imported models, numbered jerseys, responsive screens, adjustable synthesized sound and an accessibility settings panel (colour-vision correction, contrast, motion, text size, seven languages) |
| Title / UX rationale / navigation / controls | Coach entry, a real first game taught by the assistant coach in short lessons that can be replayed from Help, one weekly path (prepare, play, postgame) with four tabs (This week, Team, Season, Shop) for looking things up, keyboard controls, explicit costs and unavailable states |
| Presentation | Team demonstrates the decisions and explains the engine; software does not substitute for delivery or Q&A |

Presentation preparation: rehearse within the published setup/presentation/Q&A timings (3/7/3 minutes). Prepare an offline copy, verify venue-device requirements, and check state/district variations. Do not rely on judges opening links. Keep the local source and asset ledger available for explanations.

## Suggested demonstration

1. Enter a coach name and show the 3D gym.
2. Contrast a public roster fact with a clearly labeled simulated attribute.
3. Use study hall or recovery to make an athlete available, and adjust the rotation.
4. On Prep, study film on an opponent; explain the token/time tradeoff.
5. Call a timeout and change tactics during live play.
6. Open a postgame shot replay and show probability contributions.
7. Show the single-season state path, source timestamps, and credits.

## Design rationale

Every week runs the same path: prepare, play, postgame. Home shows only the next step, worked out by the engine, and a grey timeline of the steps after it, so a coach never has to choose where to start. The prep screen holds all three weekly picks in one list. Recruiting, staff, the skill tree, gear and jerseys live in the Shop tab, open at any time; three breaks (preseason, midseason and before the playoffs) stop the season to walk through it, which gives the season a shape. Four tabs (This week, Team, Season, Shop) stay available. The assistant coach teaches in nine short chapters of one to three steps, each opening the first time its moment comes (the first week, tip-off, a timeout worth calling, the first quarter break, each Shop tab), plus one-time tips. Nothing is locked while a lesson is up: a step closes when the coach does the real thing, so the rules are learned by playing rather than read. One question at the start ("Have you coached a KANGS season before?") and a Settings choice (Lessons, Tips only, Off) set how much help appears, and Help's Lessons tab replays any lesson. Large scene areas establish the basketball setting while conventional HTML controls retain keyboard access and legibility. Anything on the 3D gym stays dark in both colour modes, as a broadcast overlay would. All resource costs appear before a decision. Source facts and game-only attributes are separated to keep the real-school connection honest. Replays expose model contributions instead of pretending that a simulation proves real-world causation.
