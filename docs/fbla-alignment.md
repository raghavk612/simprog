# FBLA 2026–27 alignment

Reference: [Computer Game & Simulation Programming guidelines, updated August 2026](https://greektrack-fbla-public.s3.us-east-1.amazonaws.com/files/1/High%20School%20Competitive%20Events%20Resources/Individual%20Guidelines/Presentation%20Events/Computer-Game-Simulation-Programming.pdf).

The topic asks for a high-school team championship simulation involving recruiting, development, resources, morale, challenges and strategic leadership. This build follows that through a single-season Kangs campaign.

| Rubric area | Demonstrable implementation |
| --- | --- |
| Topic alignment | Recruiting, practice tradeoffs, eligibility, fatigue, injuries, conversations, budget and state elimination |
| Rules / outcomes / challenge | In-game handbook, validated rotations, three difficulty levels (C Team, Junior Varsity, Varsity), qualification and championship/end states |
| Innovation | Real published season reimagined through a transparent decision model; recorded shot scenes explain coaching effects |
| Technical implementation | Three.js assets, seeded simulation, source-refresh pipeline, validated saves, offline cache and automated tests |
| Graphics / consistency / visual-audio design | Purple-white identity, 3D gym, imported models, numbered jerseys, responsive screens and optional audio |
| Title / UX rationale / navigation / controls | Coach entry, persistent navigation, first-run arrows, keyboard controls, explicit costs and unavailable states |
| Presentation | Team demonstrates the decisions and explains the engine; software does not substitute for delivery or Q&A |

Presentation preparation: rehearse within the published setup/presentation/Q&A timings (3/7/3 minutes). Prepare an offline copy, verify venue-device requirements, and check state/district variations. Do not rely on judges opening links. Keep the local source and asset ledger available for explanations.

## Suggested demonstration

1. Enter a coach name and show the 3D gym.
2. Contrast a public roster fact with a clearly labeled simulated attribute.
3. Use study hall or recovery to make an athlete available, and adjust the rotation.
4. Scout an opponent; explain the token/time tradeoff.
5. Call a timeout and change tactics during live play.
6. Open a postgame shot replay and show probability contributions.
7. Show the single-season state path, source timestamps, and credits.

## Design rationale

A persistent program sidebar makes frequently repeated coaching actions predictable. Large scene areas establish the basketball setting while conventional HTML controls retain keyboard access and legibility. All resource costs appear before a decision. Source facts and game-only attributes are separated to keep the real-school connection honest. Replays expose model contributions instead of pretending that a simulation proves real-world causation.
