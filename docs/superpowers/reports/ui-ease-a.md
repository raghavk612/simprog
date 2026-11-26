# Package A: Game day and the live game (ui-ease-a)

Branch `ui-ease-a`, from `ui-ease` at ee15a20. Findings: P0-1, P0-2, P1-4 (Game-day half), P1-7, P1-10, from
`docs/superpowers/reports/2026-11-26-ui-audit.md`, under the rulings in `docs/superpowers/plans/2026-11-26-ui-ease.md`.

## What was built

### P0-2: one way forward on Game day, and Tip off costs what it skips
- **Engine** (`src/engine.js`): `pressPending(s)` is the single test for "the press room is still waiting".
  `nextStep` now uses it (same behaviour as before). `startMatch` applies the press-skip penalty whenever it is true:
  fans −`PRESS_SKIP_FANS` (10), the `pressSkip` log line, and the press marked done. So Skip and Tip off now agree.
  `skipPress` in `src/press.js` uses the same constant.
- **`tipoffSkips(s)`** (pure, in the engine) returns `{ blocked, skips }`. `blocked` is `'inbox'`, `'issues'`,
  `'lineup'` or `null`. `skips` lists unused prep slots `{id:'slots', n}`, the press room `{id:'press', n:10}` and an
  open break `{id:'break', break}`.
- **Rail** (`src/ui/screens/game.js`, `tipoffAction`): when `nextStep` is not `tipoff`, the purple button is
  `nextStepButton('primary wide')`, the same button Home shows. Tip off becomes `secondary`, with one line under it,
  for example "Tipping off now skips 3 unused prep slots · the press room (fans −10)." When tip-off is the step, Tip
  off is the only primary and no line shows. When tip-off cannot happen (an inbox event, an illegal rotation, an
  ineligible starter), Tip off is disabled and the line gives the reason. For an ineligible starter it shows the same
  sentence the old notice did, so it is now said once. The primary, Tip off and the line sit in the shared
  `<div class="page-action">`.
- Checked in the browser (`ui-shots/ui-ease-a/flows.mjs`): Tip off with the press pending takes fans from 200 to 190
  and starts the game. The purple button opens the press room. Fix lineup turns Tip off back into the only primary.

### P1-7: readiness without opening a drawer
- At the top of the rail, `readyFacts` shows four rows:
  - **Strength:** "Kangs 74 · Redmond 77 (Strong)". This is the rotation's average skill against the opponent's
    strength, the same two numbers the shot model compares (`modelSnapshot`), so they share one scale.
  - **Rotation energy:** a number and a word (Fresh, Rested, Tired, Exhausted).
  - **Rotation morale:** a number and a word.
  - **Style:** the scouted style, or "Unscouted · Opponent film", which links to Prep while a slot is left.
- The five are now a real `<table class="five-table">` with jersey, name, OVR, and energy as a bar plus the number.
  A tired or exhausted starter's energy turns red with the word under it. The ineligible pill stays.
- The drawers keep the detail.
- `energyLevel` and `moraleLevel` were added to `src/teamLabels.js`: one set of thresholds, the same as `roster.js`'s
  private `energyWord` and `moraleWord`.

### P0-1: phone drawers no longer cover the top bar
- `body[data-view='game'] .court-panel { position: relative }` now applies at every width, not only at 761 px and up.
- On phones (≤ 760 px), before tip-off, the two drawers are an in-flow row above the gym (`order: -1`). They are
  `position: relative`, so an open drawer body still drops down under its own row.
- Shots: `phone-*-mid-game.png` from check:ui, and `ui-shots/ui-ease-a/phone-*-full.png`. The top bar is clear, with
  `drawersTop` 218 below `topbarBottom` 56.

### P1-4, Game-day half
- On phones the gym is a backdrop before tip-off, so it is 220 px tall (was 420 px).
- The way forward is in `.page-action`. Package E makes that a sticky bar.
- I checked with E's sticky rule injected (`gameday.mjs --sticky`; the rule is not committed). On 390×844, the
  primary's bottom is at 642–746 px in every state, above the tab bar at about 762 px. Without E's rule the primary
  sits at about 1,000 px, down from 1,075.

### P1-10: notifications in the live game
- `src/ui/toastHold.js` is new and pure. It holds `ToastHold`: `offer(item, live)` returns true when the card should
  show now and false when it waits. Errors and `opt.now` never wait. It keeps at most 3, which is what the stack shows.
  `release()` returns the waiting cards in order.
- `src/ui/toast.js`:
  - `notify` offers every card to the hold while `body.live-match` is set (the live game, its closing clip, or a
    replay).
  - A `MutationObserver` on the body class moves the non-error cards already on screen at tip-off into the hold, and
    releases the hold when live ends. That release puts the held cards over the result dialog.
  - `releaseToasts()` is exported, and `quarterBreak()` in `playback.js` calls it.
- The quarter-break adjustment's "applied" card is sent with `now: true` (see decisions).
- Placement during play: `body.live-match #toast` at `144px auto auto 24px` on desktop, which is the court's top-left
  under the score bug. On phones it sits at 96 px, under the drawer row. While a dialog is open on a phone, it moves
  to 8 px, over the score.
- The play-by-play drawer starts open on desktop (≥ 761 px). The audit suggested this. Once the coach closes it, or
  opens another drawer, it stays the way they left it. That choice is kept in `game.js`, not in the DOM.
- Checked by `ui-shots/ui-ease-a/live.mjs`. It tips off through the UI, watches at 64× through every break, and plays
  to the result.
  - At tip-off: one error card, no overlap with `.court-drawers`, `.top-tools`, `.bug2k` or any rail button, in all four
    runs (desktop and phone, dark and light). Before the change it overlapped all of them.
  - At the first quarter break: the held cards are released.
  - After Keep going: no overlaps.
  - At the final whistle: the Q4 card shows over the result dialog.

## Decisions beyond the plan, and what each costs if it is wrong

1. **Press penalty uses `nextStep`'s rule.** This includes "no press started for this week", which happens after a
   reload before the press room opened. If wrong: a coach who reloaded and never saw the press loses 10 fans. Home
   said "Talk to the press" and the skip line names the cost, so it is not silent.
2. **`playTo` (judge demo and its jump-ahead) marks each week's press done before tipping off**, so the demo season's
   fans and tokens are unchanged. If wrong: none for players. Without it the demo would lose 10 fans a game.
3. **When the step is `issues`, Game day's primary is the in-place "Fix lineup"** (`auto-lineup`, as before), not
   Home's "Fix the lineup", which goes to Team. If wrong: the two pages' buttons differ in label and destination, and
   auto-lineup picks the best eligible five rather than letting the coach choose.
4. **Tip off is disabled when it would fail.** Before, it was enabled and failed with an error toast.
5. **`.page-action` holds two buttons and a line**: the next step, Tip off and the skip line. The hook was specified
   as one primary, a reason and a status line. If wrong: E's sticky bar on a phone is about 150 px tall when the step
   is not tip-off.
6. **The Strength row compares the rotation's skill average to the opponent's strength, not OVR**, because those are
   the numbers the shot model uses. If wrong: "Kangs 74" sits above OVRs of 75–81 in the table, and a judge may read
   the two as the same measure.
7. **The pre-game gym is 220 px on phones.** If wrong: a smaller first view of the gym on Game day. The research's
   "avoid" table says a decorative hero must never push the primary below the fold.
8. **The quarter-break "adjustment applied" card shows at once** (`now: true`) instead of waiting. It answers the
   coach's own click, and waiting would hold it until the next break. If wrong: one card over the court for about 5 s
   in the free corner.
9. **On a phone, cards go over the score while a break dialog is open.** At 96 px they covered the dialog's title. If
   wrong: the score bug is hidden behind a card while the modal is up; it is inert then anyway.
10. **The play-by-play open state lives in `game.js` module state**, not in `store.js`, which package D owns. It
    survives `render()`. If wrong: it resets on a page reload, back to open.

## Left out, and why

- **The sticky styling of `.page-action`.** It is package E's. P1-4's phone acceptance depends on it; I verified it
  with E's rule injected.
- **The `tipoff` lesson** (`src/ui/lessons.js`, not mine) still rings and glows Tip off on a first visit to Game day,
  even when Tip off is secondary. For example, in preseason the coach card says "Tip it off" beside the purple "Open
  preseason". In the walkthrough's own flow (practice uses the slots, preseason deferred), tip-off is the step and the
  two agree. Whoever owns the lessons should decide whether the chapter waits for `nextStep === 'tipoff'`. That would
  cost the chapter's Watch-live steps for a coach who tips off early.
- **The scouting drawer** still repeats strength and style. The audit says to "leave the drawers for the detail".
- **An error card on a phone during play** can sit over an open drawer's body (the drawer row itself is clear).
  Errors are rare (no timeouts left, say).
- P2-2 (the "simulated outcome" disclaimer in the Game-day subtitle) is out of scope by ruling.

## Tests

- `tests/gameday.test.js` (new, 7 tests):
  - Tip off with the press pending equals Skip: fans −10, logged, press done.
  - No cost once the press is answered.
  - A never-started press counts as pending.
  - The skip list from state (preseason with 3 slots; press with 1 slot).
  - A clean week skips nothing and tip-off is the step.
  - Blocked by the inbox, an ineligible starter, or an illegal rotation.
  - The energy and morale thresholds.
- `tests/toastHold.test.js` (new, 4 tests):
  - Not live: shows.
  - Live: waits, except errors and `now`.
  - Release keeps the order, once.
  - At most 3 wait.
- `tests/i18n.test.js`: the run-time keys `game.skip.{pre,mid,playoff}`, `game.blocked.{inbox,lineup}`,
  `game.strengthLevel.*`, `rv.energy.*` and `rv.morale.*`.
- `npm test`: 382 pass.
  - Under load from the parallel packages, two timing tests failed once each: "motion version 3: a play is worked out
    once, in a few milliseconds" (`playsim`) and `clothFit`. Both pass on re-run.
  - The `playsim` one also fails on the untouched base under the same load, so it is CPU time, not this change.
- `npm run build` and `npm run format:check` were green before each commit.
- `npm run check:ui -- --shots` (all runs, graphics patched to low and reverted) found no problems.

## Screenshots looked at

- check:ui: `desktop-dark-mid-game`, `phone-dark-mid-game` (before and after), `phone-light-pre-game`.
- `ui-shots/ui-ease-a/`:
  - `desktop-{dark,light}-press`, `desktop-light-tired`, `desktop-dark-issues`.
  - `phone-dark-press-full`, `phone-light-press-full`, `phone-dark-issues-full`, `phone-dark-tired-sticky`.
  - `live-desktop-dark-tipoff` (before and after), `live-phone-dark-tipoff` (before), `live-phone-light-tipoff`.
  - `live-desktop-dark-resume`, `live-desktop-light-break`, `live-phone-dark-break`, `live-phone-light-break`.
  - `live-desktop-dark-result`.
- The scripts that made them are `gameday.mjs` (states: pre, press, clean, issues, tired; `--sticky`), `live.mjs`
  (`--end`) and `flows.mjs`, all in `ui-shots/ui-ease-a/` (git-ignored).

## Files touched outside package A's list

- `src/engine.js`: besides `startMatch`, I added `PRESS_SKIP_FANS`, `pressPending` and `tipoffSkips` beside
  `nextStep`. `nextStep` uses `pressPending` with no change in behaviour, and `playTo` gained one line.
- `src/press.js`: `skipPress` uses `PRESS_SKIP_FANS` (one line plus the import).
- `src/teamLabels.js`: new exports `energyLevel` and `moraleLevel`. Package D could use them for the energy-bar
  colour in place of `roster.js`'s private copies.
- `src/ui/playback.js`: `releaseToasts()` at the end of `quarterBreak()`, and `now: true` on the break-adjustment
  card.
- `src/ui/screens/home.js` (B's): not edited, only imported (`nextStepButton`).
- Shared: `src/theme.css` (a Game-day block, live `#toast` placement, and one rule moved out of the 761 px query),
  the 7 locale files (`docs/superpowers/reports/i18n/ui-ease-a.json`), and `tests/i18n.test.js`.
- `.page-action`: I added only `body[data-view='game'] .page-action { display: grid; gap: 8px; margin-top: 12px }`
  and the button margin inside it. E's sticky rule must keep a background so the bar is opaque.
