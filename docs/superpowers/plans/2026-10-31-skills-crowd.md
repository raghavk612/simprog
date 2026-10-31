# Fuller gym, dunks as a skill, and a skill tree — plan

Spec: the user's chat request (2026-10-31): "make the stadium have more people. there should be people behind each hoop. allow players to also dunk as a skill. in the team gear area add a skill tree so they unlock different moves along with the basic ones they already have."

Repo `/home/claude/simprog`, branch `skills-crowd` from `main` 3a7eb34.

## Global Constraints

- No new dependencies; match the repo's dense one-line code style.
- **i18n:** every user-facing string through `t()`/`tu()`; any key added to `src/i18n/locales/en.js` goes into all 7 locales (`en es fr hi it ja zh`) with the same placeholders, properly translated (`tests/i18n.test.js` enforces identical keys). Move names already exist as `shot.<kind>`; reuse them.
- **Saves:** old saves (no skill data) must still load (`validSave`) and play; new save fields are optional, validated strictly (hostile-save tests in `tests/hostile-saves.test.js` show the style), and survive export/import (`src/engine.js` export helpers).
- **Determinism:** the engine draws from the save's seeded RNG (`random(s)`); do not add `Math.random` to game logic.
- **Accessibility:** real buttons, visible focus, text alternatives for any icon-only state, locked/unlocked state in text (not colour alone); reduced motion respected for any animation.
- **Performance:** the crowd stays instanced (two InstancedMesh draws as now, or a small constant number more); no per-frame allocations.
- `npm test` and `npm run build` pass after every task. Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TJcs3aM2BUb2S8MMdWg1LU
  ```

## Task 1: A fuller gym with fans behind both baselines

Files: `src/arena.js` (`stands()` ~line 106 and anything it needs), tests only if a pure helper is extracted.

- Sideline stands: fewer empty seats (today ~20% of seats are randomly empty plus two aisles; make it ~5% empty, keep the aisles).
- New baseline bleachers behind **both** hoops (court ends at |x|≈14.2; the end walls are at |x|=19.5): a few rows rising away from the court, same look as the sidelines (risers, lit front rail, instanced seated fans facing the court — rotate the fans so they face the court). They must not overlap or hide anything that is already there: the hoop stanchions, the ball rack / ladder / cones props near a baseline, the coach's office corner (camera `office` looks at about [15.6,1,-13.2]), the locker-room area/jersey wall (camera `locker` looks at about [-15.5,1.4,-15]), the scorer's table and benches, and the wall signs. Move a small prop only if it is clearly free-standing decoration and there is no other way; say so in the report.
- Fans on all stands share the existing two instanced meshes (or one extra pair at most); the graphics levels still control them (`crowd` profile: 'full' | 'noshadow' | 'hidden').
- Check the broadcast/title/Follow/office/locker camera views in a browser for clipping or blocked views.

## Task 2: Skills engine (moves, unlocks, dunks)

Files: new `src/skills.js`, `src/engine.js` (play choice for the Kangs, unlock action, `validSave`, export), `src/basketball.js` only if `choosePlay` needs an allowed-moves parameter, new `tests/skills.test.js`.

- `src/skills.js` exports:
  - `BASIC_MOVES = ['catch','pullup','drive','floater','roll']` — the moves every team has.
  - `SKILL_TREE` — three branches, each an ordered list of nodes `{key, cost, requires}` (`requires` = the previous node in the branch, or null):
    - `shooter`: `corner` (150) → `stepback` (250) → `fadeaway` (350)
    - `slasher`: `euro` (150) → `dunk` (300) → `alley` (400)
    - `post`: `hook` (150) → `spin` (250)
  - `skillNode(key)`, `unlockedMoves(s)` (basic + `s.skills` that exist in the tree), `canUnlock(s,key)` → `{ok, reason}` with reasons `owned | locked | tokens | season | game | inbox` (mirror how gear blocks purchases: finished season, live game, pending inbox event, not enough tokens), and `validSkills(s)` (undefined OK; else array of unique tree keys whose prerequisites are also present).
- `engine.js`:
  - `unlockSkill(s,key)` spends `cost` tokens (like `buyGear`: does not use a preparation slot) and appends the key to `s.skills`; throws a clear error otherwise; logs it with a translatable key (`log(s,text,k,p)` pattern).
  - Play choice: for the Kangs only, the move bag is the tactic/pace bag filtered to `unlockedMoves(s)`; **"dunk as a skill"**: once `dunk` is unlocked it is also added to the steady (non-perimeter, non-fast) bag, and once `alley` is unlocked it is added to the fast bag if missing — so dunks happen in any non-perimeter game after the unlock. If filtering empties a bag, fall back to `BASIC_MOVES` ∩ the original bag, else `BASIC_MOVES`. Visitors are unchanged.
  - `validSave` accepts `skills` via `validSkills`; export/import keeps it.
- Tests first (RED then GREEN): tree shape and costs; `unlockedMoves` for a new save is exactly the basic five; `canUnlock` reasons; `unlockSkill` spends tokens, enforces prerequisites and the blocks; a season simulated with no unlocks never produces a Kangs play outside the basic moves; with `dunk` unlocked and steady pace, Kangs dunks occur over a season; visitors still use every move; `validSave` rejects unknown keys, duplicates, missing prerequisites, non-arrays; old saves without `skills` still validate. Keep existing tests green (adjust only tests that encoded "Kangs can do every move from the start", and say which).

## Task 3: Skill tree in Team Gear

Files: `src/gearView.js` (and/or a new `src/skillsView.js`), `src/main.js` (actions), `src/style.css` (appended block), all 7 locales.

- In the Team Gear view, below the loadout and above or beside the shop, a **Skill tree** card: a short intro ("Your players start with five basic moves. Unlock new moves with program tokens — each one adds plays your team can run in games."), the five basic moves shown as owned chips, then three branch columns (Shooter, Slasher, Post) with their nodes top-to-bottom joined by connector lines. Each node: move name (`shot.<kind>`), a one-line effect hint (e.g. "Adds dunks to every half-court game" for dunk; keep the others short, e.g. "Adds corner threes"), and state: Unlocked (✓ text), Unlock for N tokens (primary button), or Locked with the reason (needs <previous move> / not enough tokens / finish the game first / answer your inbox first / season over), reusing the existing locked styling (`.locked-action`, the locked stamp used by kits/achievements) so it matches the game.
- Action `skill-unlock` with `data-key`: calls `E.unlockSkill`, saves, plays the existing purchase sound, announces via `announce()`, shows a toast like gear purchases, re-renders, and keeps focus on the unlocked node.
- Phone layout: branches stack vertically; no horizontal page scroll at 360 px.
- New i18n keys in all 7 locales (translated): the card title, intro, branch names, basic-moves label, node hints, button/state labels, unlock toast/log line.
