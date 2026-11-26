# Package B report: the week (Prep, Home, results)

Branch `ui-ease-b`, from `ui-ease` (ee15a20). Plan: `docs/superpowers/plans/2026-11-26-ui-ease.md`, package B.

## What I built, per finding

**P1-6 (Prep: Run the week disabled with no reason; chips that don't say good or bad; the clinic has no description)**

- Under a disabled Run the week there is now a reason, linked with `aria-describedby`: "Add at least one session to the
  plan.", "Finish the game first." during a live game, or "The season is over." (`practice()` in
  `src/ui/screens/prep.js`, class `page-why`).
- Every effect is a chip from the press room's helper (`chipHtml` in `markup.js`), so costs are red with ▼ and gains
  green with ▲ in both themes, in one format. The numbers come from `planEffects(state, key)` (`src/prepPlan.js`), which
  includes the hired assistant's bonus and the Training facility, so the chip is what the session will do for this
  team (R5). Chemistry, which practices change but the old chips left out, is shown too.
- "Host a community clinic" has a description (`prep.clinicDesc`).
- The clinic's numbers and the film's cost were literals in two places; they are now engine constants (`E.CLINIC`,
  `E.FILM_COST`, `E.filmCost(s)`) used by both the engine and Prep.

**P1-3, Prep half (plan rows were purple buttons)**: a row in the plan keeps its button `secondary` ("✓ In plan ·
remove") and the row itself is highlighted: `.prep-row.on` uses a soft accent background and a 3 px accent bar on its
left edge. A full plan now shows exactly one purple button (Run the week).

**P1-4, Prep half (phone: the count and Run the week below the fold)**: Run the week, its reason and the count ("2 / 3
planned") are in the shared `<div class="page-action">` hook. On a phone (≤ 620 px) the three slot boxes are hidden
and the count is shown in that bar instead; on desktop the count is hidden because the slots say it. When there is a
reason, the count is left out (one line, not two). Package E styles `.page-action` as the bar. A sticky element can't
leave its parent, and on a phone Prep's side column (the bar's parent) sits below the whole list, so a sticky
`.page-action` alone would never be in view: on phones I make the side column itself sticky above the tab bar
(`.prep-grid > .prep-side`). Checked with E's planned rule added in my script: after one "Add to plan", Run the week is
at y 664–716 of 844 and the count reads "1 / 3 planned".

**R8 (one-click plans that never override the coach)**: "Suggested plan" and "Repeat last week" above the list.
Both call `fillPlan()`, which only adds to open slots, in order, skipping anything already picked or blocked; they never
replace a pick and never run the week. A button only appears when it would add something (so there is no disabled
button without a reason). "Repeat last week" reads last week's picks from the decision trail (`lastWeekPlan()`), so it
survives a reload. The suggestion (`suggestedPlan()`) ranks recovery for an injured or tired rotation, study hall for a
GPA under 2.3, film when it hasn't been watched and is affordable, a team dinner for chemistry under 55 or morale under
60, then shooting and defense.

**R5 for practice**: the chips above are each session's expected change, shown before running.

**P2-4 (Home timeline reads as a stepper with nothing done)**: a visible "After that" label now sits before the
timeline (left of it on desktop, above it on a phone), and the list is labelled by it.

**R7 (the result dialog ends with "What changed" and the one next step)**: after a game the dialog shows a short ranked
list: the three biggest OVR changes ("Name: OVR 70 → 73", plus "N more players' ratings changed"), new injuries ("is
hurt and misses the next game") and players back from one, the program tokens the game earned, and the move in the
standings ("#4 → #2 of 9"). Every line has a ▲/▼/• mark and words, not colour alone. Its primary button names the next
step ("Open the press room"); closing it runs the postgame as before. The list is `whatChanged(before, after)` over two
`weekSnapshot()`s (`src/recap.js`).

## Decisions beyond the plan (and what each costs if it is wrong)

1. **Chip format is the press room's ("+3 skill", "−10 energy"), not "Stat ±n".** The audit's acceptance line says
   "Stat ±n" but its fix and the plan say to use the press room's helper; the helper writes value first. I used it as it
   is, so Prep, the press room, the inbox and the tip-off preview read the same. If "Stat ±n" is wanted, it is one line in
   `chipHtml` and changes all of them at once (packages A and the press room would see it).
2. **The week's start is a snapshot held in memory, not in the save.** `noteWeek(state)` runs on Home, Prep and Tip off
   and keeps the first snapshot of each week for the current save object. Cost: after a page reload mid-week the
   baseline is taken after the reload, so practice done before it is not in the list; a result reopened from the journal
   after a reload shows no list. The alternative, a `weekStart` field in the save, touches save validation and the
   hostile-saves tests.
3. **Tokens line = the game's net income** (the budget line of the trail), not the change in the balance over the week.
   Otherwise a preseason or midseason Shop spree would show as "Program tokens −600" after a win. Cost: the clinic's
   +180 and the film's −50 are not in that line (they are on Prep's chips and in the practice result).
4. **The standings place is worked out in `src/recap.js` with the Standings page's sort (winning percentage, stable
   order).** Package D is rebuilding that table; if D changes the sort or tie-break, the recap's "#n" can disagree with
   the table. The fix is to export one ranking function and use it in both.
5. **Fill buttons are hidden, not disabled, when they would add nothing** (plan full, nothing to repeat in week 1, all
   suggestions taken). Cost: the buttons come and go; a coach looking for "Repeat last week" in week 1 won't find it.
6. **The header's "N of 3 slots left" is gone** (the slots, or on a phone the bar, say it). Say a thing once.
7. **The plan row highlight uses `var(--selected-bg, var(--accent-soft))` and `var(--selected-line, var(--accent))`.**
   Package E is adding the selected-state tokens; if E names them differently the fallbacks keep the row correct, but it
   won't follow E's tokens until the names are matched.
8. **On a phone the secondary "Go to the game" under Run the week is hidden**, so the sticky bar holds only the way
   forward; Game day is the sub-tab at the top of the same page. When no slot is open it is the primary and stays (it is
   inside `.page-action` then). Cost: one more reach to the top of the page for a coach who wants to skip Prep on a phone.
9. **Note for the coordinator / package E:** in this branch alone the stuck bar has no background (E's `.page-action`
   style gives it one). Game day may need the same parent-is-sticky treatment if its `.page-action` sits in a short
   column.
10. **Suggested plan thresholds** (energy under 40 or a rotation average under 65, GPA under 2.3, chemistry under 55,
    morale under 60) are my judgement, close to `E.playTo`'s own heuristic. Cost if wrong: a less useful suggestion; it
    never overrides a pick.

## Left out, and why

- The sticky phone bar itself: package E styles `.page-action`. I checked the Prep half of P1-4 by adding E's planned
  rule in my Playwright script only (see below); it is not in this branch.
- `office.fundraiseFx` (and the unused `office.listenFx` / `office.academicsFx`) are no longer shown, but
  `tests/i18n.test.js` lists them as run-time keys; deleting them means editing that list, so I left them.
- A "What changed" for results reopened after a reload (decision 2).
- A lesson or tip for "Suggested plan" / "Repeat last week" (`src/ui/README.md` asks new features to ship with one).
  The buttons explain themselves ("Fills open slots only. Your picks stay."); a tip is a small follow-up in `LESSONS`.
- The column alignment of the chips varies a little between rows on desktop, because "✓ In plan · remove" is wider
  than "Add to plan". It was the same before; not changed.

## Tests added

- `tests/prepPlan.test.js` (6): each pick's chips with staff and facility bonuses; the clinic's and film's chips match
  what the engine does; blocking (film done, clinic done, film unaffordable); `fillPlan` only fills open slots, keeps
  order, skips blocked/unknown keys and doesn't mutate the plan; last week's plan from the trail, in order; the
  suggestion's priorities.
- `tests/recap.test.js` (6): ranking (ratings, injuries, healed, tokens, standings); top three ratings and the count of
  the rest; players who joined or left aren't compared; the tokens fallback; no earlier place before the first game; a
  real week through the engine (practice raises OVR, tokens equal the budget line, the place is in range).

`npm test`: 383 pass, 0 fail (`npm run build` and `npm run format:check` clean). Under load from the five parallel
packages the timing tests (`playsim.test.js` "a play is worked out once, in a few milliseconds" and `clothFit.test.js`)
fail now and then, before and after my changes; they pass on a quiet run.

## Screenshots I looked at

- `npm run check:ui -- --shots --only=mid` (graphics patched to low, reverted): no problems.
  `desktop-dark-mid-practice`, `desktop-light-mid-practice`, `phone-dark-mid-practice`.
- `npm run check:ui -- --shots --only=mid` again after the last change: no problems; `desktop-light-mid-home`.
- `ui-shots/ui-ease-b/` from `ui-shots/ui-ease-b/shots-b.cjs` (git-ignored, with the screenshots) against `npm run dev`
  (Vite on its own port), lessons off, graphics low:
  - `{desk-dark,desk-light,phone-dark}-home`: the "After that" label.
  - `{…}-prep-empty` and `{…}-prep-repeat`: the fill buttons, chips, the reason line; after Repeat last week the plan is
    film, clinic, shooting lab in last week's order, three rows highlighted, one purple button.
  - `phone-dark-prep-added-sticky`: after one Add to plan, with E's planned `.page-action` rule injected: Run the week
    and "1 / 3 planned" in view above the tab bar.
  - `{desk-dark,desk-light,phone-dark}-result` and `-result-recap`: a real game played at 64× after two shooting labs
    and film. The list read: three players OVR +5, "9 more players' ratings changed", "Program tokens +162",
    "Standings: #1 of 13"; the button "Open the press room". No script errors. (No injury happened in this game; the
    injured and healed lines are covered by the tests only.)

## Files touched that belong to other packages or are shared

- `src/engine.js` (shared): `CLINIC`, `FILM_COST`, `filmCost()` and their use in `talk()` and `scout()`. No behaviour
  change.
- `src/ui/actions.js` (shared): `plan-suggest`, `plan-repeat`, and `noteWeek(state)` before tip-off in `start-match`
  (package A owns tip-off; one line).
- `src/theme.css` (shared): the Prep block, the Home timeline block, and a new "What changed" block at the end.
- `src/ui/README.md`: two table cells (same width, so the table doesn't reflow).
- Locales: `docs/superpowers/reports/i18n/ui-ease-b.json` is what I applied (adds `prep.*`, `recap.*`; deletes
  `prep.slots` and `practice.fxSkill/fxEnergy/fxMorale/fxGpa`).
