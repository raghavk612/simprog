# Game-nav: follow-ups left after the final review

Shipped to main at d5b9302 (2026-11-27). Every task passed its review and the final whole-branch review's fixes were re-reviewed clean. These are the known small items left, from the review ledger, for whoever touches these screens next.

## Parked after the final review

- Tip-off preview drawer shows tipoffPreview energy under "Rotation energy" — Ruling: real, minor, deferred; the pending modifiers are listed beside it; fix is readyFigures(state) — cost if wrong: one more mismatched figure in a collapsed drawer
- Prep at 1440: lesson card fallback overlaps ~25px of "Go to the game" — Ruling: real, minor, deferred; the card is dismissable and the button stays clickable — cost if wrong: a partly covered secondary button while a lesson is open

## Deferred minors

- (Task 1) HC season track played vs next both white
- (Task 1) new HC rules use #fff/#000 literals (matches a11y.css convention)
- (Task 1) crest-initials fallback 11px < 12px floor (aria-hidden)
- (Task 1) no test pins scorebug markup contract (tokens not a link, group label, GM aria-hidden)
- (Task 1) theme.css +457 lines
- (Task 1) Shop break tabs scroll at 1440 in French / 150% text; coach card over band's left end on Shop
- (Task 1) dead .sidebar selectors in a11y.css (~176, ~956); theme.css:189 legacy .nav-item.active * rule
- (Task 2) render downloads on the live game where it's hidden
- (Task 2) phone drops Prep's chips entirely
- (Task 2) viaWay entrance-suppress flag can stay set if the purple click doesn't redraw
- (Task 2) broad gradient whitelist in tests/theme.test.js
- (Task 2) remaining minors listed in task-2-review.md
- (Task 2) at 1280x800 the 5th starter and "Adjust rotation" scroll under the pinned Tip off block
- (Task 2) Prep energy chip vs Game day "Rotation energy" row can differ while a next-game energy modifier is pending (tipoffPreview omits it)
- (Task 2) "Adjust rotation" partly under the pinned rail foot at 1440 (rail scrolls)
- (Task 2) src/a11y.css:1252 #fff literal
- (Task 3) Standings table stays a capped inner scroll beside the rail (spec names only Gear/Journal)
- (Task 3) next opponent shown 3× on Journal (scorebug, strip, rail) and scores in strip + Results — spec-mandated vs "say a thing once"
- (Task 3) seasonStrip() returns unused result.index
- (Task 3) pctText lives in rail.js; belongs in lists.js
- (Task 4) stale HC comments; dark-mode white logo has no render (68KB PNG); Skills locker behind lesson card on phone; crest plates not made; check:art not run automatically — see task-4-review.md
- (Task 4) manual HC toggle still downloads CSS-hidden renders (settings changes don't re-render)
- (Task 5) NAV_BUTTONS test asserts little; lesson card placement ignores .ph-chips (Game day); startViewTransition promise ignored in goFromNav; rail is a scroll container (clips future overflow)
- (Task 5) fitGhost reads room height at the unshrunk size at large text

## Waiting on a product decision

- Journal shows the next opponent three times (scorebug NEXT chip, the season strip's NEXT card, the rail's Next game card).
