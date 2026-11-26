# Tutorial as short lessons: build report

Plan: `docs/superpowers/plans/2026-11-24-tutorial-lessons.md`. Design: "The KANGS tutorial as nine short chapters" in
`/home/claude/reports/Sports game tutorial design.md`. Branch `tutorial-lessons`, from main 76314b0.

## What was built

The 18-beat click-locked walkthrough is gone. In its place:

- **Nine chapters and five one-time tips**, as data in `src/ui/lessons.js` (no DOM): `week` (home bar, practice
  plan, run, plus a conditional retry after a missed drill), `tipoff` (eligibility, Watch live, the shot-chance card),
  `timeout` (opens on a symptom: a run of 6+ unanswered points, a starter below 45 energy from possession 6, or the
  fallback at possession 12; then one line in the huddle), `quarter` (one line in the quarter-break dialog), `speed`
  (after a quarter break, between plays), `press` (one line in the press room, then the tokens line at Home), `mid`,
  `playoff`, and one lesson per Shop tab (`shop:recruit` … `shop:locker`). Tips: `lineup`, `inbox`, `scout`, `drill`,
  `tokens`. Thresholds are exported constants (`RUN_POINTS`, `LOW_ENERGY`, `TIRED_FROM`, `FALLBACK_AT`).
- **The runtime**, `src/ui/tutorial.js`: one card at a time, ring on the subject, glow on the control, no click lock.
  A step closes on the real action wherever it happens; a step already done is skipped. Every card has Got it (Escape
  too), a smaller Hide tips (level → Off, toast with Undo that restores the level, the progress map and any lesson on
  screen or waiting), and Show me when the target is wholly out of view. In-game cards hold play; Watch live, Resume or
  Next play on the page answers the card and keeps the coach's choice; Got it / Escape restore the Watch-live state from
  before the card. Focus returns where it was. Shortcut keys wait only behind a card that holds the paused game.
  `coachTick` runs in a try/catch in the 100 ms loop; an error closes the card and logs once.
- **Setting** "Assistant coach tips" (Lessons / Tips only / Off) in Settings > Game, stored as a new preference in
  `src/settings.js` (`kangs_prefs`, normalised like the others).
- **Start form**: "Have you coached a KANGS season before?" with "No, show me as I go" / "Yes, just tips". It sets the
  level; `deferPre` only for No. Defaults to No until `week` and `tipoff` are both done or dismissed.
- **Progress** in `localStorage` `kangs-lessons-v1` (`done` / `dismissed` / `armed`), every access in try/catch, junk
  and unknown ids dropped. The old `kangs-three-tutorial-v3` flag is not read.
- **Help > Lessons** tab (last tab): every chapter and tip with its status and Replay. A Shop lesson replays at once on
  its tab (snapshot taken then, so an earlier purchase does not end it); any other is re-armed ("I'll show you at the
  next one") and Help closes.
- **Fixed**: arrow keys on Help's tabs opened Settings (`settingsDialog.js` listened to every `role="tab"` in the shared
  dialog; now only `[data-s-tab]`).
- Old tour leftovers removed: `blockOutsideSpotlight` and its listener, `BEATS`, skip dialog, `.tutorial.aimed`,
  `.coach-skip`, `.walk-check`, `tutorial.b.*`, `tutorial.next/finish/skip/skipAsk/skipYes/keep`, `flow.walk`.

## Files

New: `src/ui/lessons.js`, `tests/lessons.test.js`, `tests/tutorial.test.js`, this report.
Rewritten: `src/ui/tutorial.js`. Changed: `src/main.js`, `src/ui/keyboard.js`, `src/ui/actions.js`, `src/ui/demo.js`,
`src/ui/handbook.js`, `src/ui/screens/landing.js`, `src/ui/screens/prep.js` (`lastRun`), `src/ui/playback.js`
(`breakPending`), `src/ui/toast.js` (action button), `src/ui/screens/breaks.js`, `src/gearView.js`,
`src/skillsView.js` (`need-tokens` marker), `src/settings.js`, `src/settingsDialog.js`, `src/theme.css`,
`src/style.css`, `src/a11y.css`, all 7 locales, `tests/nav.test.js`, `tests/i18n.test.js`, `scripts/ui-check.mjs`,
`src/ui/README.md`, `docs/fbla-alignment.md`.

## Tests

`npm test`: 367 pass, 0 fail. `npm run build` and `npm run format:check` pass. `npm run check:ui -- --shots`: no
problems (run with `graphics: 'low'` patched in locally, reverted before commit). New tests cover: registry shape (every
step has `on`, `done`, a locale key; at most 3 regular steps), progress with throwing storage / corrupt JSON / junk,
the old flag ignored, the preference, level gating (armed at any level), replay (arm vs now), Hide tips + Undo data,
Got it status per step, Shop snapshots (purchase before the lesson does not end it; after does; leaving before shown
aborts), Shop lessons in `NAV.shop` order, the Watch-live helper, the question default, the timeout symptom detector on
synthetic matches, the week chapter's steps on a real season, the Help-tab arrow-key bug, no click lock in the source,
the guarded loop, no old-tour leftovers, the start form question, the Lessons tab and the setting, Escape / held keys,
and Show me's out-of-view rule. `tests/i18n.test.js` lists every runtime-built lesson key; `tests/nav.test.js` reads the
lessons module.

## Rulings beyond the plan (and the cost if wrong)

1. **The level is its own preference** (`kangs_prefs`), not part of the accessibility object, so "Reset accessibility"
   does not reset it. Unset means Lessons, so a player with an old save sees the Shop-tab lessons and tips once on
   first visits. Cost: a few one-line cards for veterans until they hide them.
2. **Rings no longer dim the page.** With no lock, the old 100vmax dark shadow suggested the page was blocked; the ring
   now pulses its border (still under reduced motion; a thicker static `--focus` outline in high contrast).
3. **Several lessons may wait at once; one card shows.** Break chapters come before the Shop lessons in `LESSONS`, so on
   a Shop page during a break the break's line opens first. Help lists in registry order (Shop tabs after the playoff
   break). Cost: Help's order differs from the design's numbering.
4. **Only `week` (week 1) and `tipoff` (first game) are tied to the first season**; timeout, quarter, speed and press
   open the first time they occur per profile. Cost: a coach who switches to Lessons mid-season meets them later.
5. **`tipoff`'s Watch step also closes after possession 3** if the coach steps manually, so the shot card is not
   blocked by an unanswered Watch card.
6. **The timeout card opens only between plays while a symptom holds**, and its reason is read when it opens (so the
   line is true). Not now, Escape on it, and playing on all count as done.
7. **The drill tip** fires on a missed drill the week chapter is not already covering: in a first season the second
   miss, at the Tips level the first. Cost: Tips-only players get it one miss earlier than "second missed drill".
8. **The tokens tip** finds a purchase greyed out for tokens through a `need-tokens` class added to the reason line in
   Tryouts, Staff, upgrades, Gear and the skill tree.
9. **Hide tips does not change `deferPre`** (the old Skip reset it in week 1). Cost: a coach who hides tips in week 1
   still has the preseason break after game 1.
10. **Answering "No, show me as I go" does not reset lessons already seen** (plan read literally). Cost: a returning
    player who answers No does not see finished chapters again unless replayed from Help.
11. **No lessons during the judge demo or on the title screen**; lessons under way stop there without a status.
12. **A dialog opened over a held card** (Settings, Help) keeps the game held when it closes; only Watch live / Resume /
    Next play count as playing on.
13. **A Shop lesson left before it was shown** stops without a status and begins again on the next visit.
14. **Phone layout**: a docked card that would cover an on-screen target (the live game's pinned control bar) sits just
    above it instead; Show me counts only targets hidden under the docked card or off screen. Notifications rise above
    a visible card on phones.
15. **Replay at once** closes any other open card and restarts a lesson of the same id already under way.
16. **Status names in Help**: dismissed reads "Skipped", armed reads "I'll show you at the next one".
17. **Kept lines keep their existing translations** (home, run, retry, five, watch, shot, the fallback timeout line,
    press room, staff, skills, gear). New lines in es, zh, fr, ja, it, hi are my translations and have not been read by
    native speakers.
18. **`ui-check` now also checks** the start form, Help's Lessons tab, Settings > Game and the coach card's contrast.

## Checked in the browser (`npm run dev`, low graphics, reduced motion, Chromium with SwiftShader)

Screenshots in `ui-shots/lessons/` (git-ignored). No script or console errors in any run.

- Desktop, mouse: start form default "No"; week chapter out of order (Prep from the tab row, one pick, plan card stays;
  plan filled → run card); a failed Study-hall quiz → retry card; passing the re-run closes it; scout tip; Go to the
  game → five, watch, shot card (holds, Space and T held, Watch live on the page answers it and stays on); timeout card
  on a run (and on another run at the possession-12 fallback); huddle line per symptom; quarter line; speed card
  (Escape restores Watch live); second half from a possession-30 save: later quarter breaks, result, press line, tokens
  card, every Shop tab's lesson, a purchase ending the Staff lesson.
- Desktop, keyboard only: start form, Prep tab, three picks, Tab to Got it (focus returns to the last control), Hide
  tips and Undo, Escape, `?` then ArrowLeft to Lessons (Settings no longer opens), Replay Quarter breaks (armed, toast),
  Replay Staff after a hire (opens at once).
- Midseason and playoff breaks from built saves: both mid steps, the stakes line, ended by leaving the break.
- Tips level ("Yes, just tips"): no chapters, preseason first; lineup, inbox and tokens tips from built saves.
- 390 px phone: week cards, tip-off five (Show me shown), watch, shot (answered by playing on), timeout (Not now
  restores Watch live), quarter, speed (card above the control bar), press, tokens, Shop lessons.
- Light theme (desktop and phone), high contrast (static 3 px ring): week cards and the start form.
- `npm run check:ui -- --shots`: every page plus the new dialogs, dark/light, desktop/phone: no problems.

Not checked: one uninterrupted first game played keyboard-only from tip-off to the press room (the live part was driven
by clicks; keyboard checks covered week, tip-off, Help, Replay, Hide/Undo); screen-reader output (only that `announce()`
is called and cards are `role="status"`); forced-colors mode; High graphics (stalls under software rendering here); the
3D drill variants (only the 2D Study-hall quiz was played); a real (not built) midseason break.

## Concerns

- The first-game walkthrough script stalled once at the second quarter break: my script's backquote presses were
  swallowed while a card held the keys (correct behaviour), leaving the game at 1x. I covered the second half from a
  built mid-game save instead.
- The shot card has no spot (as before) and docks over the bottom of the control bar on desktop while it holds play.
- Timeout thresholds are starting values, untuned by playtesting.
- Pre-existing, not from this branch: in high contrast the active top tab ("This week") renders as a white block with
  no visible label.
- Translations of new lines need a native-speaker pass.
