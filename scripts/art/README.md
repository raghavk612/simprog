# UI art: Houdini models rendered with Three.js

The page-header and empty-state pictures, the token coin and the whistle in `public/images/ui/` were modelled
procedurally in Houdini 22 (scene `kangs-ui-props.hipnc`, kept with the OBJ exports in the art folder outside this repo:
`~/coding/kangs-assets/houdini/` on the team Mac). Houdini Apprentice watermarks its renders, so Houdini is used for
modelling only: each model is exported as OBJ with named primitive groups (`metal`, `accent`, `accent2`, `white`,
`dark`, `wood`, `ball`, `seam`, `chrome`, `paper`, `leather`) and rendered here with the game's own Three.js
(materials per group, room environment light, a purple rim light, a soft contact shadow, transparent background).

To re-render: put the OBJ files in `scripts/art/models/` (a job's model `url` is relative to `render.html`), make a
`renders/` folder, then from `scripts/art/` run `node render.mjs jobs.json` (each job's `out` is relative to where you
run it). It drives the installed Google Chrome through `playwright-core`, the repo's own dependency, as
`npm run check:ui` does, so nothing is downloaded. Then export the PNGs as AVIF + WebP at 1x/2x (see the sizes in
`docs/superpowers/reports/2026-11-26-game-nav-design.md`, "Custom graphics"). The hardwood band and grain tile are
procedural textures (numpy + Pillow).
