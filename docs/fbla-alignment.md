# FBLA alignment review — Road to the Championship

Reviewed against the [2026–27 Computer Game & Simulation Programming guidelines](https://greektrack-fbla-public.s3.us-east-1.amazonaws.com/files/1/High%20School%20Competitive%20Events%20Resources/Individual%20Guidelines/Presentation%20Events/Computer-Game-Simulation-Programming.pdf), updated August 2026. Topic: page 1; game expectations: pages 4–6; rating sheet: pages 7–8.

The game now follows **one complete season**. Longer-term development happens across its practice weeks through athlete growth, chemistry, academic eligibility and upgrades. There is no multi-season requirement in the supplied topic. Removing career progression implements the creators’ chosen scope.

| Rubric area / maximum | Current project evidence | What to demonstrate |
|---|---|---|
| Topic / 15 | Recruitment, practice, budget, morale, challenges and a State bracket within one season | Connect a practice choice and a resource trade-off to playoff readiness |
| Rules / 5 | In-game rulebook, weekly tracker, first-entry tutorial | Open the rulebook and show the four-step weekly cycle |
| Challenge and outcomes / 5 | Seven outcome labels, three difficulties, deterministic balance checks | Explain both a championship and an unsuccessful ending |
| Creativity / 5 | “What if, Coach?” compares alternate coaching decisions | Change one tactic and compare the resulting score margin and energy |
| Technical implementation / 5 | Seeded possession engine, opponent tactics, copied-state replay isolation | Explain why a replay cannot modify the live season |
| Relevant graphics / 5 | Basketball, hoop/net, trophy, jerseys and practice equipment; live court | Identify SVG, CSS and Canvas responsibilities |
| Consistent assets / 5 | Shared navy/orange illustration system, school-color jerseys | Move between title, practice and game screens |
| Visual/audio design / 5 | Clear controls, vector detail, generated crowd and sound effects | Explain feedback and reduced-motion/sound controls |
| Title / 5 | Direct start, school setup, rules, credits and instant replay demo | Start without needing a verbal walkthrough |
| UX rationale / 5 | Onboarding, keyboard focus, contrast/text controls, phone layout | Show a keyboard action and an accessibility setting |
| Navigation/enjoyment / 5 | Hub tabs, resumable local saves, editable player names | Rename a player and return to the current task |
| Controls / 5 | Practice presets, tactics, substitutions, quarter skipping | Make a live coaching adjustment |

These are implementation observations, **not awarded points**. The remaining 40 of the 110 possible points concern presentation delivery, questions and event protocols. All three creators still need to demonstrate and explain their work. The supplied event uses 3 minutes for setup, 7 for presentation and 3 for questions. Judges must not click links or scan QR codes; demonstrate the game on your device. A working offline copy is available.

## Distinctive aspect: learn from a decision

The film room is an interactive experiment, not an alternate score pasted over the result. Each branch starts from its own deep copy of the same pregame state, including roster, condition and RNG state. A uses the original starting tactics; B uses the player’s new pace, defense and attack. Both use automatic rotation handling and the same calm halftime talk. The real record, budget, injuries and random stream remain unchanged.

The comparison reports scores, period-by-period margins, made threes, rebounds and remaining energy. The title-screen exhibition lets a viewer understand the mechanic immediately; the postgame version connects the same idea to their own choices. One seeded experiment is illustrative, not a statistical proof that a tactic always wins. A future improvement would compare batches of seeds and show outcome distributions.

## Validation evidence

`node tests/season.test.cjs` passed. Across 60 seeds per policy/difficulty, the stronger policy won State in 50 Easy, 23 Medium and 6 Hard runs. The naive policy won in 15 Easy runs and none of the Medium/Hard sample. All 360 runs terminated within a single season and at most 14 games. These are automated-policy results, not predicted human win rates.

Regression checks also passed for identical-strategy replay equivalence, repeatability, restoring the original live object and every saved field, error-path restoration, and non-destructive migration of compatible first-season saves.

Browser checks covered a full played matchup, the postgame replay, the exhibition’s working tactical controls, credits, player-name validation and persistence. Desktop and narrow-phone layouts were inspected. Full historical Python suites have not been rerun; obsolete career-only tests are archived.

## Sources and ownership

The in-game **Credits & sources** screen names Ajisth Sareen, Raghav Krishnan and Malhar Pawar; lists the researched basketball references, event PDF and RNG references; and identifies font designers and licenses. Permanent Marker is Apache 2.0; Atkinson Hyperlegible, Graduate and Barlow Condensed use SIL OFL. Art is inline project code and audio is synthesized. Codex development assistance is disclosed. No stock photos or sampled audio were added.
