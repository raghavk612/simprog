// The gym between plays and on the title screen (Arena methods, mixed into Arena.prototype by src/arena.js: `this` is the
// Arena). idleFrame (called by Arena.frame when no play runs) jogs everyone back to his spot, visitors guarding their men,
// and passes the ball to the dribbler. On the title the dribbler (people[2]) plays a show to the camera: a Routine of
// ball-handling moves from src/moves (titleShow), with a teammate rebounding his jumpers (titleCtx). Reduced motion and
// the title's pause hold everything still.
import { guardSpot, dribbleAt, DRIBBLE } from '../basketball.js';
import { heroYaw, HERO } from '../title.js';
import { MOVES, Routine } from '../moves/index.js';
import { rootPose, worldFrame } from '../moves/stage.js';
import { yawRot } from '../moves/core.js';
import { courtContext } from '../moves/context.js';

export const idleMethods = {
  /* One frame of the idle gym (frame): between plays and on the title. Players jog back to their spots, the title hero
     plays his show (titleShow) to the camera, the ball goes to the dribbler. titled: the title screen is showing; still:
     its pause (WCAG 2.2.2) holds everything where it is. */
  idleFrame(dt, titled, still) {
    // Idle gym: dribbling and movement only. No invisible automatic shot loop.
    // Players jog back to their spots and the ball is passed to the dribbler; nothing snaps unless motion is off.
    // On the title screen the dribbler (people[2]) plays to the camera at HERO instead of his usual spot.
    const live = this.motion && this.posed && !still,
      idt = still ? 0 : dt,
      ease = live ? 1 - Math.exp(-idt * 22) : 1,
      turn = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
    this.idleClock = (this.idleClock || 0) + idt;
    if (!this.ballFrom || this.blendMotion !== this.motion) {
      this.blendMotion = this.motion;
      this.snapshot(this.idleClock);
    }
    // the title hero's show (src/moves): he walks up dribbling, then shuffled ball-handling moves; it holds still while
    // the title is paused and is not played with reduced motion. Leaving the title, everything eases from where it is.
    const show = titled && this.motion && this.posed ? this.titleShow(idt) : null;
    if (!show && this.heroShow) {
      this.heroShow = null;
      this.snapshot(this.idleClock);
    }
    this.people.forEach((p, i) => {
      const k = i % 5,
        hero = titled && i === 2,
        performing = hero && show,
        // during the title show a teammate rebounds under the near hoop for the hero's jumpers and passes the ball back
        feeder = show && i === 0 && this.heroCourt ? this.heroCourt.feederWorld : null,
        spot = { x: [-6, -2, 4, 8, 1][k], z: [-4, 4, -3, 3, 0][k] },
        // a visitor stands guard on his Kangs man: about 5.5 ft off him, between him and the basket they attack (+x)
        guard = i >= 5 ? guardSpot(spot, 1, 1.7) : spot,
        tx = hero ? HERO.x : feeder ? feeder[0] : guard.x,
        tz = hero ? HERO.z : feeder ? feeder[2] : guard.z,
        rest = hero
          ? heroYaw()
          : feeder
            ? Math.atan2(this.people[2].position.x - feeder[0], this.people[2].position.z - feeder[2])
            : i < 5
              ? Math.PI / 2
              : -Math.PI / 2,
        dx = tx - p.position.x,
        dz = tz - p.position.z,
        d = Math.hypot(dx, dz),
        v = Math.min(5, d * 2.2),
        step = !live || d < 0.02 ? d : Math.min(d, v * idt);
      if (performing) {
        this.posePlayer(
          p,
          { ...show.root, run: 0, arms: 'dribble', exactYaw: true, perform: show.world },
          this.gait,
          1,
        );
        return;
      }
      this.posePlayer(
        p,
        {
          x: p.position.x + (d ? (dx / d) * step : 0),
          y: live ? p.position.y * Math.exp(-idt * 12) : 0,
          z: p.position.z + (d ? (dz / d) * step : 0),
          yaw: live ? turn(p.rotation.y, d > 0.6 ? Math.atan2(dx, dz) : rest, 1 - Math.exp(-idt * 7)) : rest,
          run: live && d > 0.02 ? Math.min(1, v / 5) : 0,
          arms: i === 2 ? 'dribble' : feeder ? show.frame.extra?.feeder || 'relax' : 'relax',
        },
        this.gait,
        ease,
      );
    });
    // paused title: the ball holds in the hero's dribble (and the next blend starts from there)
    const at = show
        ? show.world.ball
        : { ...this.dribbleSpot(this.people[2]), y: dribbleAt(this.gait / DRIBBLE.period).ball },
      b =
        show || still
          ? ((this.ballFrom = { x: at.x, y: at.y, z: at.z, t0: this.idleClock }), at)
          : this.blendBall(at, this.idleClock);
    this.ball.position.set(b.x, b.y, b.z);
    if (!still) this.spinBall(false, show?.world.spin || null); // a paused title holds the ball still too
    this.trail.forEach(d => (d.visible = false));
  },
  /* The title hero's show for this frame: his Routine (created on the first title frame, walking up from wherever he
     stands), advanced by dt; returns the move's pose, his root, and its world-space targets. */
  titleShow(dt) {
    const base = { x: HERO.x, z: HERO.z, yaw: heroYaw() };
    if (!this.heroShow) {
      const p = this.people[2]?.position,
        rel = p ? yawRot([p.x - base.x, 0, p.z - base.z], -base.yaw) : null,
        d = rel ? Math.hypot(rel[0], rel[2]) : 0,
        from = d > 0.8 && d < 8 ? [rel[0], rel[2]] : [0.5, -3.4]; // from behind him, toward the camera
      this.heroShow = new Routine({
        library: MOVES,
        seed: globalThis.__kangsShowSeed ?? (Math.random() * 2 ** 31) | 0, // testing: a fixed show for screenshots
        weights: { handle: 1, show: 3 }, // the showtime moves come up most on the title screen
        ctx: this.titleCtx(base),
        entrance: { from },
        dribbleChance: 0.15, // mostly moves back to back, a plain dribble now and then
      });
      this.heroClock = 0;
    }
    this.heroClock += dt;
    const f = this.heroShow.frame(this.heroClock);
    return { frame: f, base, root: rootPose(f, base), world: worldFrame(f, base) };
  },
  /* Context points (the hero's base frame) for title moves that need them. */
  titleCtx(base) {
    const c = courtContext(base); // the near-left hoop, and a rebounder's spot in front of it
    this.heroCourt = c;
    return { rim: c.rim, feeder: c.feeder };
  },
};
