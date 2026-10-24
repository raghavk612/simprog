# Design: mid-season events, team captain, 3D locker-room jerseys, post-game press conferences

Date: 2026-10-24 · Status: approved in chat (decisions below), pending spec review

## Decisions (from the user)
- Events: about **1 in 3 games** (≈5–6 per 18-game season).
- Press conference: **after every game, skippable** (Skip = no bonuses, small fan dip).
- Captain: **noticeable but balanced**.
- Locker room: remove the jersey-number color picker; show **3 rotating NBA-style 3D jerseys** filling the panel.

## Goals / non-goals
- Goals: more meaningful decisions between games (FBLA: "strategic decision-making", "multiple outcomes"), visible feedback (trade-offs shown before choosing, results recorded in the decision trail and postgame ripples), deterministic per save seed.
- Non-goals: new currencies, multiplayer, voice/audio, changing the possession model beyond simple modifiers.

## Architecture
New pure modules (no DOM) so they can be unit-tested; UI stays in `src/main.js`; 3D jerseys in their own module.

| Unit | File | Purpose | Depends on |
|---|---|---|---|
| Event catalog + engine | `src/events.js` | Event definitions, eligibility, weighted seeded pick, `applyChoice` | engine helpers (`cap`, `log`, rng via seed) |
| Press conference | `src/press.js` | Question bank, context-aware question pick (3–5), answer effects → next-game modifiers | game result context |
| Next-game modifiers | `src/engine.js` | `s.nextMods` applied once at `startMatch`, consumed after the game | — |
| Captain | `src/engine.js` | `s.captain` (player id), `setCaptain`, weekly chemistry tick, event softening | — |
| Jersey showcase | `src/jerseys.js` | Small Three.js scene: 3 jersey meshes, rotation, click/keyboard selection | three |
| UI | `src/main.js`, `src/style.css` | Event pop-up card, press room modal, captain button/badges, locker layout | all of the above |

### State / save format (validSave must accept old saves: all new fields optional)
- `s.captain: number|null` — player id.
- `s.pendingEvent: {id, seedKey, options:[...]}|null` — an event waiting for a choice (persisted so reload re-shows it; actions are blocked until resolved, except navigation/rules).
- `s.eventLog: [{week, id, choice}]` (≤ 40), `s.eventsSeen: {id: count}` for repeat limits.
- `s.press: {week, questions:[{id, answer|null}], done:boolean}|null` — current press conference.
- `s.nextMods: {chem, morale, energy, offense, defense, oppRating, fans}` numbers (bounded, default 0), cleared after `finish()` of the next game.
- Bump `VERSION` only if needed; prefer optional fields so 2025–26/2026–27 saves still load.

## 1. Mid-season events
- **Trigger:** after a game result is finalized (when the player returns from the result screen / press conference), roll with the save's seeded RNG: base 33%, never twice in a row, none before game 2, none once the season is finished.
- **Catalog (≈14):** each `{id, title, icon, text(s), when(s), weight, options:[{label, detail, effects(s)}]}` where `effects` returns concrete deltas, shown on the button as chips (e.g. "+8 morale · −60 tokens"). Initial set:
  1. Walk-on tryout (recruitment): sign a fictional walk-on (adds to roster if <15; costs tokens) / pass.
  2. Transfer inquiry (recruitment): a fictional transfer wants in — accept (roster+1, chemistry −3) / decline.
  3. Rival recruiter courts your player: promise minutes (morale +, rotation constraint note) / let him decide (risk: morale −) / call the parents (tokens −, morale +).
  4. Bench player wants minutes (complaint; needs a player with minutes 0 and morale < 65): promise more minutes / explain the plan / ignore.
  5. Starter frustrated about shots (complaint): run plays for him (offense +, chemistry −) / team-first talk (chemistry +).
  6. Locker-room feud between two players (needs two low-morale players): team meeting (chemistry +, energy −) / bench both one game (morale −, chemistry +) / let captain handle it (needs captain; success scales with captain morale).
  7. Grades slump (GPA): mandatory study hall (GPA +, energy −) / tutoring (tokens −, GPA ++).
  8. Finals week: lighter practice (energy +, skill +0) / push through (skill +, GPA −).
  9. Booster donation: accept with strings (tokens +, morale −) / accept new uniforms (fans +) / decline.
  10. Flu going around: rest sick players (energy +, next-game offense −) / play through (risk injury).
  11. Minor ankle tweak (random player): rest a game (injury 1) / tape and play (energy −, small injury risk).
  12. Social-media controversy: address it (morale +, fans −) / stay quiet (fans −, morale −).
  13. Rivalry week hype: lean in (fans +, opponent next-game rating +) / keep it calm (no change).
  14. Captain call (needs captain): players-only meeting (chemistry + scaled by captain morale) / coach-led meeting.
- Effects use existing stats only: per-player or team `skill/energy/morale/gpa/injury`, `chemistry`, `tokens`, `fans`, roster add (fictional names, flagged `custom:true`), and `nextMods`.
- **Captain softening:** negative morale/chemistry effects are reduced by 25% when a captain exists with morale ≥ 70.
- **UI:** full-screen dim + card that slides/scales in (CSS animation; reduced-motion = fade), icon tile, title, story text, 2–3 option buttons with effect chips, keyboard 1–3, focus trapped. After choosing: result line + "Continue". Logged to decision trail and ripples (`s.ripples`) so postgame breakdown shows it.

## 2. Team captain
- `setCaptain(s, id)`: allowed when no live match; first pick free; changing later costs −4 morale for the old captain and −2 team chemistry; logged.
- Weekly effect (in `finish()` after each game): `chemistry += 2` if captain eligible (not injured, GPA ≥ 2) and morale ≥ 60; captain morale −3 after a loss by 15+ (pressure).
- Event softening (above) and captain-only events (#6 option, #14).
- UI: "Name captain" / "Captain ✓" on the Roster hero card; "C" badge in roster table, player profile, box score and the 3D jersey nameplate (`setIdentity` shows "C" next to the name); handbook Rotation tab mentions it.

## 3. Locker room jerseys
- Remove the "Jersey number color" `<input type="color" id="trim">` and its handler (keep `state.trim` default for old saves; no UI to change it).
- Replace the gym stage in the locker view with a **jersey showcase**: one canvas filling the left panel (same footprint as the current `locker-arena`), three jerseys side by side (Home purple, Away white, Midnight alternate), each slowly rotating (offset phases), subtle spotlight + floor reflection/shadow, hover lifts, selected one scaled up with a gold glow ring and label. Jersey mesh: NBA tank-top silhouette built procedurally (extruded `THREE.Shape` front/back panels with arm/neck cut-outs, slight curvature via vertex bend; or a lathe-based torso) with a canvas texture: "KANGS" wordmark, #11 (or the selected player's number), trim stripes on neck/arm holes; back shows the name "KANGS" and number.
- Interaction: click a jersey or ←/→ + Enter to select → `state.kit` updates (same action as today), toast confirms. Respects reduced motion (no rotation; static 3/4 view). Disposes renderer/geometry on view change.
- Performance: one renderer, ≤ 30k triangles, pixel ratio ≤ 2, pauses when the tab is hidden.

## 4. Post-game press conference
- **When:** after each game result (live or simulated), before the event roll. Shows as a "Press room" modal: reporter avatar initials, question text, 2–3 answer buttons with effect chips; progress dots; "Skip press" (fans −10, no mods).
- **Question pick (3–5):** context from the result: win/loss, margin (blowout ≥15 / close ≤5), top Kangs scorer (name + points), team rebounds/threes, next opponent name (if any), streak, elimination-run status. Bank of ≈20 templated questions with tags; pick 3 normally, 4 after close games/streaks, 5 in the final run.
- **Answer effects → `s.nextMods` (summed, clamped):**
  - Team-first / credit teammates → chemistry +2..+4.
  - Call out effort/defense → defense +2, morale −3.
  - Praise the top scorer → his morale +6, chemistry −1.
  - Confident / guarantee win → fans +15, opponent rating +2 (bulletin board).
  - Respect the opponent → opponent rating −1.
  - Deflect / no comment → nothing.
- **Applying mods:** at `startMatch`, apply `chem/morale/energy` once to state; `offense/defense/oppRating` are stored on `s.match.mods` and used in `possession()` (small additive terms to shot quality / opponent rating, each clamped to ±4). After `finish()`, `s.nextMods` resets. Next-game card on Program HQ shows active press effects as chips.

## Error handling
- All new state optional and validated (types, bounds, known ids). Unknown event/question ids in a save → dropped, game continues.
- If the jersey scene fails (no WebGL), fall back to the existing 2D kit buttons.
- Pending event/press blocks only game-advancing actions (start match, practice, recruit), never navigation, saves or rules.

## Testing
- Unit (node:test): event eligibility rules, seeded pick determinism, frequency ≈1/3 over many seeds (no back-to-back, none before game 2), every option's effects stay within stat caps, captain set/change costs and weekly tick, press question selection by context (counts 3/4/5), answer effects summing/clamping, `nextMods` applied once and cleared, validSave accepts old saves and rejects malformed new fields; full-season simulations still finish on all levels with events/press auto-resolved.
- Browser (Playwright, webapp-testing): event pop-up appears and resolves (desktop + 390px), keyboard 1–3, press conference flow + skip, captain badge visible in roster/profile/box score, locker room shows 3 rotating jerseys filling the panel and selecting changes the kit in the gym, no console errors.

## Delivery
Three parallel implementers in worktrees: (A) events + captain (`src/events.js`, engine, UI), (B) press conference (`src/press.js`, engine `nextMods` + possession hooks, UI), (C) locker-room jerseys (`src/jerseys.js`, locker view). A and B both touch `engine.js` (`finish`/`startMatch`) and the post-game flow in `main.js` → controller merges; B owns `nextMods` plumbing, A consumes it via effects. Task reviews, merge, final whole-branch review, push live.
