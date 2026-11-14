# Ball-handling moves ("set pieces")

A move is a short piece of a player's body language with the ball: a crossover, a between-the-legs, a spin move. Moves
are data plus physics (`core.js`), mirrored for either hand, chained at random by a `Routine` (`routine.js`), and played
through the same animation code as everything else (`../motion.js` takes a move's pose as `ctx.perform`; `stage.js` puts
it on a player in the world). The title screen's dribbler plays a Routine; a play's ball handler can use the same moves.

| File | What it holds |
|---|---|
| `core.js` | Frames, interpolation (`track`), ball physics (`freeFlight`), mirroring, `prepare` / `sample`, the plain dribble |
| `routine.js` | `Routine`: walk-up entrance, weighted shuffle, plain dribbles in between |
| `check.js` | `analyse(move)`: the numbers that say whether a move can look right (the tests hold every move to them) |
| `stage.js` | Frame -> world (the player's root, targets for `motion.js`) |
| `context.js` | Context points a move can need (`rim`, `feeder`) |
| `index.js` | The library (`MOVES`) |
| `crossovers.js`, `between.js`, `behind.js`, `fakes.js` | Ball-handling moves (`family: 'handle'`) |
| `spin.js`, `waist.js`, `finger.js`, `jumper.js` | Showtime moves (`family: 'show'`, weighted up on the title screen) |

## Seeing a move

```sh
node scripts/moves-sheet.mjs --move crossover                          # every 0.05 s from front, left, top
node scripts/moves-sheet.mjs --move crossover --hand L --every 0.03 --cams front,low,top --out /tmp/x.png
node scripts/moves-sheet.mjs --move stepbackJumper --ctx title --cams wide,front
node scripts/moves-sheet.mjs --routine 7 --to 12 --every 0.3 --cams front --follow
```

It prints the move's measurements first (`check.js`), then renders a contact sheet (rows: moments, columns: cameras) to
`ui-shots/moves/`. Cameras: `front`, `title` (about how the title screen sees him), `left` (his left side), `right`,
`back`, `top`, `low` (knee height), `tall` (room above his head), `wide`; `b-<camera>` (e.g. `b-front`) turns with him
(a move that faces him somewhere else); with `--ctx title`, `rim` looks close at the ring. `--file <family>` loads one
family file on its own. `npm run moves:check` prints every move's numbers. Open `/preview-moves.html?live=1` in
`npm run dev` to watch a routine play.

## Space

- **Base frame**: origin on the floor under the player where the move starts, **+z the way he faces, +x his LEFT**, +y up.
  Game units: 1 ft = 0.33 (the guard is 2.07 tall; his shoulders are at about 1.52 and his hips at 0.90 in the dribbling
  crouch; shoulder to wrist is 0.65 with the arm straight).
- **Body frame**: the base frame moved by the body track (offset `x, y, z` and turn `yaw`). Hands and held balls are in the
  body frame by default (they turn and travel with him); feet, bounces and `from`/`to` points are in the base frame.
- Ball heights are ball-centre heights in the plays' convention: **0.3 is touching the floor** (`BALL.floor`). The drawn
  ball (radius 0.13) is lowered near the floor automatically.
- Write every move for the **right hand starting** (ball at his right hip, `x < 0`). The Routine mirrors it for the left.

## A move

```js
export const crossover = {
  id: 'crossover', label: 'Crossover',
  family: 'handle',            // 'handle' or 'show'
  start: 'R', end: 'L',        // the hand the ball is in at the start and the end
  duration: 0.55,              // seconds
  needs: [],                   // context points it cannot do without, e.g. ['rim', 'feeder']
  ball: [ /* segments, back to back, covering the whole move */ ],
  hands: { R: [ /* keys */ ], L: [ /* keys */ ] },
  feet: [ /* keys */ ],
  body: [ /* keys */ ],
  look: [ /* optional: {t, p} where his eyes go */ ],
  spin: [ /* optional: {from, to, w: [x, y, z]} ball spin in rad/s, base frame */ ],
  extra: t => ({ feeder: 'pass' }),   // optional: anything the stage needs (a rebounder's arms)
  build: ctx => ({ ...same shape }),  // optional instead: a move made from context points (ctx.rim, ctx.feeder)
};
```

### Ball segments

Each segment runs from the previous one's `until` to its own `until` (seconds from the move's start).

- **Held**: `{ hold: 'R' | 'L' | 'both' | 'other', until, keys: [{t, p: [x, y, z]}], n, nR, nL, off, flex, pron, frame }`
  - `keys` are ball-centre positions, `t` **relative to the segment start**. Or `fn: t => [x, y, z]` instead of keys.
  - `n` is the palm normal: the direction from the ball's centre to the hand (`[0, 1, 0]` = hand on top). Fixed, or keys
    `[{t, v}]` (absolute move time). `'both'` takes `nR` and `nL`. `off` is the wrist's distance from the ball centre
    (default `PALM`, hand on the ball; larger for a ball on a fingertip).
  - `flex` / `pron` (or `flexR`, `pronL`...) override the wrist while holding (see Hands).
  - `'other'`: someone else has it (the rebounder); no hand of his is on it.
- **Free**: `{ free: true, until, bounce: [x, z] | null, from, to }`
  - A real flight under gravity from where the ball leaves to where it is next held. With `bounce`, it hits the floor at
    `[x, z]` (base frame) at the moment that makes the bounce keep 82% of its speed (a real floor). `check.js` reports the
    restitution it actually got; if a bounce cannot be real with your timing, change the timing.
  - `from` / `to` (base frame) fix an end that is not a hold: the rim, the net. Several free segments can follow each other.
- The held track **leaves the hand at the flight's launch velocity** and **takes a catch at 30% of the arriving speed**,
  so releases never kink and catches are soft. Keep catches soft by timing: a ball should arrive near the top of its
  bounce (`check.js`: last catch under 1.6 units/s; the plain dribble arrives at 0.6).

### Hands

`hands.R` / `hands.L`: keys `{t, p, flex, pron, w, pole}` for the wrist when the hand is not on the ball (body frame by
default; `{frame: 'base', keys}` for the base frame; `{fn: t => [x, y, z], keys}` for a computed path).

- While a hand holds the ball it is on the ball (ball + `n` x `off`); it settles on over 0.06 s before a catch and comes
  off over 0.06 s after a release, blending with its keys. **Send a catching hand to where the ball will be**, a beat early.
- `flex`: wrist bend, + toward the palm (snap), − cocked back. `pron`: forearm turn; 0 = palm facing the body (rest),
  1.35 = palm down. Defaults while holding: palm on top → pron 1.35, flex −0.55; palm on the side → 0, 0.
- `w`: 0..1 how much the hand follows the move (0 hands it back to the guard pose). `pole`: where the elbow points
  (body-frame direction); defaults: back (`[∓0.3, −0.2, −1]`) below the shoulder, forward and out above it.
- The off hand rests at `GUARD` (out front, protecting). Every move starts and ends with the off hand there.

### Feet

`feet: [{t, R: [x, z, yaw, y], L: [x, z, yaw, y], lift: {R, L}}]` (base frame). A foot stays planted between keys with
the same position, and steps (lifts and comes down) between keys where it moves; `lift` overrides the step height. A
fourth value `y` puts the foot in the air at that key, so a foot can travel along a path (a spin's swinging foot). Feet
never slide. The ready stance is `STANCE` (square, a little wider than the hips); every move starts and ends in it. In a jump
(`body.y > 0`) the feet come up with him automatically.

### Body

`body: [{t, x, y, z, yaw, drop, lean, twist, side}]`: `x, z` shift his hips over the feet (weight shifts, a step back);
`y` jumps him; `yaw` turns him (a spin: the feet must pivot with it, written in the base frame); `drop` crouches lower
(units); `lean` bends forward (radians); `twist` turns the shoulders; `side` bends sideways (+ toward his left). Every move
starts and ends square (all zero).

## Combos

`combo({id, label, family}, [moveA, moveB])` (core.js) plays moves back to back as one set piece, mirroring each to start
in the hand the ball is in (`behindBackCross`, `tweenBack`). Moves built from a context (`build`) cannot be chained.

## The rules every move keeps (`check.js`, `tests/moves.test.js`)

- Starts with the ball arriving at the top of a dribble in its start hand (`topOf(start)`), ends the same way in its end
  hand; feet in `STANCE`, body square, off hand at `GUARD`.
- No ball through the floor; every bounce keeps 65-95% of its speed (82% is real); a held ball stays exactly in the hand.
- No hand sent beyond his reach (104% of arm length); no hand faster than 12 units/s (a jump shot's release is about 10).
- The ball does not pass through his legs or torso (clearance > −0.03).
- The last catch is soft (under 1.6 units/s).

Passing the checks is necessary, not enough: look at the sheets. A move looks real when the hand leads the ball, the
weight goes where the ball goes, the feet do what a real player's feet do, and nothing pops between two frames.
