# Package C — The Shop: report

Branch `ui-ease-c` (from `ui-ease`). Findings: P1-9 + R4, P1-11, R9, P2-8. Strings for all 7 locales are in
`docs/superpowers/reports/i18n/ui-ease-c.json` (re-apply with `node scripts/i18n-set.mjs` after a locale conflict).

## What I built

### P1-9 + R4: Tryouts compare with the team

- New pure module `src/shopFit.js` (no DOM, so it is tested in node):
  - `startersOf(s)`: the chosen starters, or the five best by OVR before a lineup is set.
  - `prospectFit(s, p)`: the prospect's OVR from `E.ratings` (the number the Team page shows, and the same number he
    keeps once signed), his rank by OVR among the current players, and the starter he would have to beat: the weakest
    starter at his position, or the weakest starter of all when nobody in the five plays it.
  - `fitLine(s, p)`: one line, e.g. "Bench: −5 vs Sreehari Thachoth, starting Guard · #8 of 13 by OVR" or
    "Would start: +2 over Ryan Darwazeh, starting Forward · #3 of 13 by OVR". The sign is always written (+, −, ±), and
    "Would start" / "Bench" is a word, so the green colour of a starting line is never the only signal.
  - `teamNeeds(s)` / `needsLine(s)`: the weakest starter (name, position, OVR) and the rating the five are lowest in on
    average (e.g. Interior defense 73).
- `recruit()` in `src/ui/screens/breaks.js`:
  - the needs line sits right under the roster-spots toolbar, above the cards (`.team-needs`);
  - each card shows the OVR as a big number in the top-right corner using the roster's own `.sq-ovr` class (plus
    `.recruit-ovr` with an "OVR" caption), then the comparison line under the name;
  - Skill stays in the detail chips, and one chip is added: the prospect's value in the team's weakest rating (e.g.
    "INS D 71"), so the needs line can be acted on from the card.
- Help › Rotation now explains OVR once (`hb.r.ovr`): overall rating, worked out from Skill and position, same scale on
  the Team page and the tryout cards.

### P1-11: Dismiss assistant is confirmed

`SEASON_ACTIONS.dismiss` (`src/ui/actions.js`) now awaits `confirmDialog(dismissText(state), { yes: 'Dismiss
assistant', danger: true })` and returns `false` on Cancel (no save, no sound, no toast). The text names the loss:
"Dismiss your Development specialist? You lose the 300 tokens you paid: there is no refund." Checked in Chrome:
Cancel keeps the assistant, confirming dismisses.

### R9: every refused Sign / Scout / Hire / Buy / Unlock says why and what is missing

- New string `shop.needTokens`: "Need 40 more tokens · you have 25" (`shortText(s, cost)` in `shopFit.js`), used by
  Tryouts (Sign, Scout), Staff (Hire), Program upgrades (Buy), Gear (Buy) and the Skill tree (Unlock). The
  `.need-tokens` class stays on these lines, so the assistant coach's "where to earn tokens" tip still finds them.
- Tryouts used to grey out Sign and Scout with no reason for a live game or a finished season, and did not disable them
  at all for an unanswered inbox (the click then failed with an error toast). Now one `shopBlocked()` reason (season
  over / finish the game / answer the inbox) applies to every Shop card, and Sign says "Roster full" under the button
  when the roster is at `ROSTER_MAX` (the toolbar keeps the longer "Release a player on the Team page" fix).
- Scout's own reason appears under Scout only when it differs from Sign's; when Sign already says "you have 40", Scout
  says only "Need 20 more tokens". Both buttons point at their reason with `aria-describedby`.
- Staff: the hired card no longer prints "Hired" a second time under the "✓ Hired" button.

### P2-8: Gear

- `E.buyGear(s, key, wearer)` (engine): with a player id, the item is equipped on that player when that slot is
  empty; a filled slot is never changed; an unknown id is refused before any tokens are spent. Without an id it
  behaves as before. The Gear page passes the shown player (`SEASON_ACTIONS['gear-buy']`).
- The button says "Buy and equip · 180 tokens" when the shown player's slot is free, "Buy · 260 tokens" when not, so
  the coach knows before clicking. The toast shows the engine's newest log line, which is now "Equipped Court Pro
  shoes on Karter Martin", with the −180 tokens chip (no change to `toast.js`).
- The empty slot's hint is "Buy or pick an owned item in the shop." (was "Choose an owned item below").
- `.gear-display` is 96 px tall (was 155) and the item art 88 px (was 140), so more of the shop fits on a screen.

Buy and equip is now 4 clicks from Home (Shop → Gear → choose player → Buy), was 5.

## Decisions beyond the plan (and what each costs if wrong)

1. **Comparison target = weakest starter at the prospect's position** (falling back to the weakest starter overall).
   The plan says "the current player at that position"; with two starting Guards I picked the one he would replace.
   If wrong: the line reads pessimistically for a strong position (it never compares with the best Guard). One
   function in `shopFit.js` to change.
2. **OVR and rank use base ratings (`E.ratings`), not gear-boosted Skill**, because that is what the Team page shows.
   If wrong: a starter wearing +2 shoes plays slightly better than his OVR suggests; the line could say "would start"
   by one point when he would not in a game.
3. **"Pinned" means always at the top of the page, not CSS `position: sticky`**: a sticky line would fight package E's
   sticky top bar and phone `.page-action` bar. If judges expect it to stay on screen while scrolling the six cards on
   a phone, it needs a sticky rule once E's bars land.
4. **A sixth chip for the team's weakest rating on each card.** Not in the plan; it turns the needs line into
   something a card answers. Cost: card chips wrap to two rows on desktop (they did already with three on phone).
5. **Token reason as "Need N more tokens · you have M"** (new key `shop.needTokens`), not the research's longer "win
   games to earn more" fix on every card: the coach's one-time tip already says where tokens come from, and repeating
   it on 6–10 cards per page breaks "say a thing once". `office.needTokens` is kept because Prep (package B) uses it.
6. **Shop refusal for an unanswered inbox now disables Sign/Scout** (the engine already refused). Behaviour change for
   the better, but a lesson or demo step that clicks Sign while the inbox is open would now find a disabled button
   (none does today: `lessons.js` and `demo.js` do not).
7. **Auto-equip lives in the engine (`buyGear`'s optional third argument), not in `actions.js`,** so it is tested in
   node and is atomic with the purchase. `engine.js` is shared; the hunk is local to `buyGear`.

## Left out, and why

- R4's "do the same for staff and gear effects on the current five": out of the package's listed scope (P1-9 + R4 for
  tryouts); the gear stat strip already shows the shown player's effective Skill/Energy/Morale.
- P2-9 (locker copy for touch, unlock goals under locked kits): out of scope by ruling.
- Gear: the owned card still shows both an "Equipped" pill and a disabled "✓ Equipped" button (said twice); not in
  P2-8's fix list, left for a later pass.
- The assistant coach's Tryouts lesson card covers the new needs line on desktop and phone until "Got it" (seen in
  `ui-shots/desktop-dark-mid-recruit.png`). The card's position belongs to `tutorial.js`, not this package.
- The phone tryout card is still about 500 px tall (the 150 px 3D jersey stage); not in the audit's fix.
- On a 390 px phone the Gear shop is two narrow columns, so "Buy and equip · 180 tokens" wraps to three lines inside
  the button. Readable, but a shorter phone label (or one column) would look better; left for package E's phone pass.
- `gear.bought` ("added to inventory. Choose a player and equip it.") was already unused before this package; left as
  it is.

## Tests added

- `tests/shop.test.js` (new, 9 tests): the tryout's OVR equals the roster's and stays the same once signed; the
  comparison picks the weakest starter at the position and `starts` only when the difference is positive; the
  fallback to the weakest starter of all; the rank; `startersOf` (chosen five, or five best by OVR); `teamNeeds`
  (weakest starter, lowest average rating) and its empty roster case; the two lines' content (name, signed
  difference, rank, rating name, no raw placeholders); `tokenShort` / `shortText`; the dismiss text names the assistant
  and the cost.
- `tests/gear.test.js` (+3): buying for a player with that slot empty equips it (and the newest log line is the
  equip); a filled slot is never changed, buying without a player only stocks the inventory, an unknown player is
  refused before paying; the Gear page's button reads "Buy and equip" only when the shown player's slot is free.
- `tests/skillsView.test.js`: the token reason expectation now uses `shop.needTokens` with the coach's balance.

`npm test`: 383 pass. Under the machine's load (five worktrees, load average ~11) two timing tests failed once each and
passed when re-run alone: `tests/clothFit.test.js` (the known flake) and `tests/playsim.test.js` "a play is worked out
once, in a few milliseconds". Neither touches the Shop. `npm run build` and `npm run format:check` are green.

## Screenshots looked at

`npm run check:ui -- --shots --only=mid` and `--only=pre` (with the `graphics: 'low'` patch, reverted before
committing): no problems found (contrast, overflow, script errors) on all 13 pages × desktop/phone × dark/light × both
saves. Looked at `desktop-dark-mid-recruit`, `phone-dark-mid-recruit`, `desktop-dark-pre-recruit` (the preseason break:
"Next: Staff" and "Start the season" unchanged).

`check:ui` cannot build the states this package changes (few tokens, a hired assistant, the dismiss dialog, a
purchase), so a Playwright script (`ui-shots/c/shop-shots.mjs`, git-ignored, run under the browser lock, lessons
off) captured desktop dark, desktop light and phone dark for:
- Tryouts with 40 tokens (both reasons), with a full roster ("Roster full" + scout reason), with 1,000 tokens;
- Staff with 40 tokens (every Hire/Buy reason), with an assistant hired, the dismiss confirmation, after dismissing;
- Skill tree and Gear with 40 tokens; Gear with 1,000 tokens before and after Buy (slot filled, toast "Equipped … on
  Karter Martin", the other footwear now reads "Buy · 260 tokens");
- Jerseys (unchanged).

The script also asserts that Cancel keeps the assistant, confirming dismisses, and Buy fills the slot: no errors.

## Files touched that belong to other packages or are shared

- `src/engine.js` (shared; package A owns only `startMatch`): `buyGear` gains an optional `wearer` argument.
- `src/ui/handbook.js` (no package owns it): one `<p>` for `hb.r.ovr` in the Rotation tab.
- `src/style.css`, `src/theme.css` (shared): `.gear-display`/`.gear-art` sizes; a new block at the end of `theme.css`
  for `.team-needs`, `.recruit-ovr`, `.recruit-fit`.
- `src/ui/actions.js` (shared): `dismiss` and `gear-buy` entries, and one import.
- `src/gearView.js`, `src/skillsView.js` (draw the Gear and Skill tree tabs): the token reason and the Buy label.
- Locale files (shared): keys listed in the JSON above. `office.needTokens` is unchanged (Prep uses it).
