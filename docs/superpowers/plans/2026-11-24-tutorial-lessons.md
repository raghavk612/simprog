# Tutorial as short lessons — plan

Spec: user request 2026-11-23 ("reference nba 2k and fc 26/27 and other sports games and do /deep-research to find and
implement the best tutorial"). Evidence and the recommended design: `/home/claude/reports/Sports game tutorial design.md`
(also in the claude.ai project as `claude/sports-game-tutorial-research.md`). Its section "The KANGS tutorial as nine short
chapters" is the binding design; this plan says how to build it. Where they differ, the report wins unless a ruling below
says otherwise.

Repo `/home/claude/simprog`, branch `tutorial-lessons` from main 76314b0. Read `CLAUDE.md` and `src/ui/README.md` first.

## Global Constraints

- The first game still counts (learn in the real season). No separate sandbox.
- No click lock: remove `blockOutsideSpotlight` (and its listener). The ring/glow stay; the page stays usable. A step closes
  when the player does the real action wherever they do it; a step whose action is already done is skipped, never shown.
- At most 3 steps per chapter. Nothing advances on a timer. In-game cards pause play while open (`hold`/`letGo` as now).
- Every card: **Got it** (dismiss this chapter, mark `dismissed`) and a smaller **Hide tips** (level → Off, toast with Undo).
  Escape = Got it. Shortcut keys are held only while a card with a button is up during a paused game.
- One setting, `Assistant coach tips`: `lessons` | `tips` | `off`, in Settings (Game section) via `src/settings.js`
  (normalized and persisted like the other preferences). `lessons`: chapters + one-time tips; `tips`: one-time tips and the
  game's own suggestions only; `off`: nothing extra.
- Start form: the "Walk me through the first game" checkbox becomes the question "Have you coached a KANGS season before?"
  with "No, show me as I go" / "Yes, just tips". It sets the level (`lessons` / `tips`). `deferPre` (preseason break after
  game 1) only for "No".
- Progress: `localStorage` key `kangs-lessons-v1` = `{ [chapterId|tipId]: 'done' | 'dismissed' | 'armed' }`, every access
  in try/catch; the game must work with storage throwing or holding corrupt JSON. The old `kangs-three-tutorial-v3` flag
  is no longer read for gating.
- Help gets a **Lessons** tab (`src/ui/handbook.js`): every chapter and tip with its status and a **Replay** button.
  Replay of a Shop-tab lesson opens it at once on that tab; replay of a moment lesson re-arms it ("I'll show you at the next
  one"), closes Help. No season restart.
- Accessibility: card `role="status"` + `announce()`; a **Show me** button when the target is off-screen (scroll into view,
  move focus to it); reduced motion: ring does not pulse or animate; high contrast: ring uses a high-contrast token outline;
  390 px phone: card docked at the bottom with `--coach-h`. Lines are 1–2 short sentences, plain words.
- Strings: all 7 locales via `node scripts/i18n-set.mjs` (`tutorial.c.<chapter>.<step>`, `tutorial.tip.<id>`, the setting,
  the question, the Lessons tab, buttons); delete keys that are no longer used (`tutorial.b.*` that went, `tutorial.skipAsk`,
  `tutorial.skipYes`, `flow.walk` if unused). `tests/i18n.test.js` must list keys built at run time.
- UI rules (CLAUDE.md): one primary button per screen; tokens not hex; `calc(Npx * var(--ts, 1) * var(--ls, 1))`; light
  theme and 390 px phone checked.
- `npm test`, `npm run build`, `npm run format:check` green. Commit trailers:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` /
  `Claude-Session: https://claude.ai/code/session_01TJcs3aM2BUb2S8MMdWg1LU`. Explicit `git add` paths. Do not merge, do not
  push main, never force push. **After every commit, `git push -u origin tutorial-lessons`** (the container can be
  replaced at any time; an earlier build of this plan was lost that way). One browser at a time. On this machine
  `npm run check:ui` hangs at High graphics (also on main): run it with `graphics: 'low'` patched into its accessibility
  seed locally (around line 134 of `scripts/ui-check.mjs`) and revert the patch before committing.

## Chapters (ids, triggers, steps)

1. `week` — Home, week 1 of a new season, level lessons. Steps: home bar (the weekly loop and the one forward button);
   practice plan full (pick+fill merged; shooting suggested); run practice. Conditional `retry` step only after a missed
   drill (credit a re-run done before the card shows). Drop `toGame`. Ends when practice has run or the coach goes to the game.
2. `tipoff` — Game view, no match yet, first game. Steps: eligibility (`five`), tip off + Watch (`watch`), the shot-chance
   card on a resolved home shot (`shot`, text unchanged).
3. `timeout` — live game, a symptom: opponent run of ≥ 6 unanswered points, or a starter's energy low (not in the first
   possessions after tip-off, when nobody can be tired yet); fallback at possession 12. Step 1: the reason + the button,
   with **Not now**; step 2: one inline line in the huddle saying which message to pick (the huddle already says what each
   changes), or skip if declined. Thresholds are exported constants, tuneable.
4. `quarter` — first quarter-break dialog: one inline line pointing at the suggestion's reason.
5. `speed` — first return to play after the quarter break: speed controls and that quarter breaks stop the game. It waits
   for the current play to end so it never pauses the game before the quarter-break dialog opens.
6. `press` — first press room: answers carry into the next game; back home, tokens earned and where to spend them (Shop).
7. `shop:recruit`, `shop:staff`, `shop:skills`, `shop:gear`, `shop:locker` — first visit to each Shop tab (in a break or
   not), one line each; ends on Got it, on leaving the page after it was shown, or on the first purchase/action on that tab
   **after the lesson started** (the lesson snapshots the tab's action count when it starts, so Replay and the judge demo's
   purchases do not end it unseen). Break "Next: tab" buttons keep the order.
8. `mid` — midseason break opens: record and tokens since preseason, where staff/gear/moves show in results; what changes
   after the break.
9. `playoff` — playoff break opens: the stakes; last chance to strengthen the team.

One-time tips (`lessons` and `tips` levels; fire once per profile, logged in the Lessons tab, placed by the control):
lineup issue, first inbox event, first scouting step, second missed drill, first purchase disabled for lack of tokens (add
where tokens are earned). Each matches a state `E.nextStep()` or the page already detects.

## Rulings carried from the first build and its review (binding)

- Progress has a third status, `armed`, for a replayed lesson waiting for its moment; `allowed()` shows an armed lesson at
  any level. Hide tips turns armed lessons into `dismissed`; Undo restores the whole map and the level, and lessons that
  were on screen or in progress come back too.
- Got it on a lesson's last regular step (or the conditional step after it) counts as `done`; on an earlier step,
  `dismissed`. Not now on the timeout card counts as `done`.
- The start question defaults to "No, show me as I go" until the week and tipoff chapters are both done or dismissed. The
  old `kangs-three-tutorial-v3` flag does not change that default (it was written as soon as the old tour began).
- Show me appears only when the thing pointed at is wholly out of view (above, below, or under the docked phone card).
- Playing on from a card that holds the game (the coach presses Watch live / Resume / Next play on the page) answers the
  card like Got it, and the coach's own Watch-live choice stands; only Got it / Escape restores the Watch-live state from
  before the card. Put this decision in a pure, tested helper.
- `coachTick` runs inside a try/catch in the 100 ms loop (`src/main.js`) so a failing lesson check can never stop Watch
  live; on an exception, close the card and log once.
- Closing a card returns focus to where it was before the card (or the control it pointed at), not the page body.
- Escape closes a card even while focus is in a select on the live game's bar (but a dialog's Escape still belongs to the
  dialog).
- Keep the pure parts (registry, progress store, gating, replay, snapshots, timeout symptoms, the Watch-live helper, the
  question default) in `src/ui/lessons.js` with no DOM, and the runtime in `src/ui/tutorial.js`.
- Known older bug to fix with a test: arrow keys on Help's tabs opened Settings instead of moving between tabs (blocks
  reaching the Lessons tab by keyboard).
- Remove leftovers of the old 18-beat tour: `blockOutsideSpotlight`, the old beat CSS (`.tutorial.aimed` etc.), unused
  strings, a duplicated old-flag string.

## Tasks

- T1 Model: chapter/tip registry (pure, no DOM, importable by tests), progress store, setting, triggers. Tests first:
  registry shape (every step has `on`, `done`, a locale key; ≤ 3 steps), progress store with storage throwing and corrupt
  JSON, level gating, replay re-arming, Shop snapshots, the Watch-live helper, the question default, the timeout symptom
  detector on synthetic match states.
- T2 Runtime: rewrite `src/ui/tutorial.js` on the registry (no lock, Got it / Hide tips / Escape / Show me, skip done
  steps, hold during live game), keyboard.js and main wiring, start form question, Settings control, Help Lessons tab.
- T3 Strings (7 locales) and CSS (ring under reduced motion / high contrast, card buttons), README/docs updates
  (`src/ui/README.md`; `docs/fbla-alignment.md` where it says the Shop opens only at breaks).
- T4 Verify: `npm test`, build, format; `check:ui --shots` (start form, Help Lessons tab, Settings) dark/light/phone;
  in `npm run dev` play the first game with level lessons with the mouse and once keyboard-only, doing steps out of order;
  Replay of a Shop lesson after a purchase on that tab; Watch live pressed on a held card; screenshots of each chapter card
  including the live-game cards on a 390 px phone, in `ui-shots/lessons/`; report.
