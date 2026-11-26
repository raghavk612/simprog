# Where the blank space comes from (measured 2026-11-26, branch ui-ease)

Measured with a copy of `scripts/ui-check.mjs` at 1440×900 and 1920×1080 on the midseason save (dark): the union of the
visible content boxes on each page, the page's content bottom, and the widest gap between items in the sub-tab bar.
Screenshots: `ui-shots/wide-dark-mid-*.png`, `ui-shots/desktop-dark-mid-*.png`.

| Cause | Evidence | Where in the code |
| --- | --- | --- |
| 1. The header is two flat rows of 14 px text. The sub-tab row has an empty middle on every page. | Gap between the last sub-tab and the status strip: 474–780 px at 1440, 954–1260 px at 1920 (all 13 pages). The top row also has an empty stretch between Shop and "Coach Taylor". | `src/ui/shell.js` `subnav()` (~105) and the top bar (~226); `.subnav`, `.nav-item` CSS. |
| 2. The page body stops at 1600 px but the header spans the screen, so wide screens get bare side margins that don't line up with the header. | At 1920 the content runs from 188 to 1732 px (188 px empty on each side); the header runs edge to edge. | `src/theme.css` ~1003, `.content { max-width: 1600px }`. |
| 3. Short pages leave the lower half empty. | Content bottom: Journal 532 px, Bracket 637, Prep 699, Skills 742 on a 900–1080 px screen; Journal has one result card at midseason. | Journal / Bracket / Prep / Skills render only their data, with no side rail or designed empty state. |
| 4. Uneven columns. | Gear: the loadout column ends at ~700 px while the shop grid runs to ~950; Journal's two cards have different heights. | `src/ui/screens/locker.js` / gear layout; season.js journal. |
| 5. Page headings are a plain title plus one grey line. | Every page: "Journal" + subtitle at 36 px, then content. No band, art or numbers. | `.page-heading` in `theme.css` (~1006). |

Not a cause: the live game and Home (the 3D gym fills the screen there).
