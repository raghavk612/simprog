// A possession in the gym (Arena methods, mixed into Arena.prototype by src/arena.js: `this` is the Arena).
// play(event) takes a possession from the engine: two plays (event.plays, home then away; an old save's event without
// them gets two plain plays, so old saves still replay). The play clock (playTime, 0 to 2 x CLIP_SECONDS) runs at the
// playback speed, slowed around a block's contact (slowMo); between the plays, if anyone is far from his spot, the clock
// waits while everyone runs there (startTransit). snapshot and blend ease everyone from where they are drawn into the
// next pose instead of jumping. presentation() is what the UI is told: which play, its phase, the score shown, resolved.
// playFrame is the per-frame body of a play (called by Arena.frame).
import * as THREE from 'three';
import {
  CLIP_SECONDS,
  SHOTS,
  sampleClip,
  isDunk,
  shotTiming,
  dribbleAt,
  DRIBBLE,
  blockHit,
  blockPlan,
  flightPath,
  motionOf,
} from '../basketball.js';
import { keepApart, SPACE } from '../motion.js';
import { finishFrame, putbackFrame } from '../finishes.js';
import { actionFrames } from '../actions.js';
import { reactionsFor, reactionFrame } from '../reactions.js';

export const playbackMethods = {
  play(event, { replay = false } = {}) {
    this.event = event;
    this.reactions = null;
    this.replaying = replay;
    this.director?.reset();
    this.run++;
    this.playTime = 0;
    this.paused = false;
    this.clipIndex = -1;
    this.presentKey = '';
    this.transit = null;
    // Previous saves still replay; old events have no detailed action record.
    this.clips =
      event.plays?.length === 2
        ? event.plays
        : [
            {
              team: 'home',
              kind: event.three ? 'catch' : 'pullup',
              player: event.player,
              id: event.id,
              jersey: event.jersey || 11,
              lane: 1,
              contest: 'contested',
              outcome: event.points ? 'made' : 'miss',
              points: event.points,
              commentary: event.explanation,
            },
            {
              team: 'away',
              kind: 'pullup',
              player: 'Visitors',
              jersey: 12,
              lane: -1,
              contest: 'contested',
              outcome: event.away ? 'made' : 'miss',
              points: event.away || 0,
              commentary: 'Visitors complete their possession.',
            },
          ];
    // after a steal the stealer already has the ball: the next play starts with him, not with a pass in to him
    // (otherwise he dribbles up the floor and then the ball goes back to the passer)
    if (this.clips[0]?.outcome === 'steal') this.clips[1] = { ...this.clips[1], afterSteal: true };
    // motion version 3 works each play out once (basketball.js motionOf, a few milliseconds): the first now, as the
    // possession starts, the second while the first plays, so neither lands in the middle of a frame
    const clips = this.clips;
    if ((clips[0]?.v ?? 1) >= 3) {
      motionOf(clips[0]);
      const later = () => this.clips === clips && motionOf(clips[1]);
      if (typeof requestIdleCallback === 'function') requestIdleCallback(later, { timeout: 1500 });
      else setTimeout(later, 200);
    }
  },
  clear() {
    this.endFly();
    this.reactions = null;
    this.transit = null;
    this.event = null;
    this.replaying = false;
    this.director?.reset();
    this.clips = null;
    this.playTime = 0;
    this.paused = false;
    this.clipIndex = -1;
    this.ballFrom = null;
    this.focusRing && (this.focusRing.visible = false);
    if (this.people.length === 10) this.cast(this.state?.players.filter(p => p.starter) || []);
  },
  isPlaying() {
    return !!this.event && this.playTime < CLIP_SECONDS * 2;
  },
  presentation() {
    if (!this.event) return null;
    const index = Math.min(1, Math.floor(this.playTime / CLIP_SECONDS)),
      clip = this.clips[index],
      time = Math.min(CLIP_SECONDS, this.playTime - index * CLIP_SECONDS),
      pose = sampleClip(clip, time),
      e = this.event;
    return {
      index,
      clip,
      phase: pose.phase,
      done: !this.isPlaying(),
      home: e.home - e.points + (index > 0 || pose.resolved ? e.points : 0),
      away: e.visitor - e.away + (index === 1 && pose.resolved ? e.away : 0),
      resolved: pose.resolved,
    };
  },
  /* Broadcast slow motion around a block's contact (so the swat can be seen at any playback speed): the play slows to a
     quarter of the playback speed (and never faster than real time) for about half a second either side, easing in and
     out. 1 otherwise, and with reduced motion. */
  slowMo() {
    if (!this.motion || !this.clips) return 1;
    const i = Math.min(1, Math.floor(this.playTime / CLIP_SECONDS)),
      c = this.clips[i];
    if (c?.outcome !== 'block') return 1;
    const u = (this.playTime - i * CLIP_SECONDS) / CLIP_SECONDS,
      d = Math.abs(u - blockHit(c.kind)) * CLIP_SECONDS, // seconds of play from the contact
      k = Math.max(0, Math.min(1, (d - 0.12) / 0.4)),
      slow = Math.min(0.25, 1 / Math.max(1, this.speed || 1));
    return slow + (1 - slow) * k * k * (3 - 2 * k);
  },
  /* Before a play, if anyone is far from his starting spot (the other end after a basket or a rebound), the play clock waits
    while everyone runs there at a game pace: about 5.5 units a second on average (a run, quicker in the middle of the trip),
    each player at his own distance, the new ball handler dribbling it up. Presentation only: the play itself is unchanged. */
  startTransit(clip, index) {
    if (!this.motion || !this.posed) return false;
    const start = sampleClip(clip, 0).actors,
      RUN = 5.5,
      MAX = 4.2;
    let longest = 0;
    this.people.forEach((p, i) => {
      if (start[i])
        longest = Math.max(longest, Math.hypot(start[i].x - p.position.x, start[i].z - p.position.z));
    });
    if (longest < 1.5) return false; // close enough: the usual quick ease
    const dur = Math.min(MAX, longest / RUN) + 0.2;
    this.people.forEach((p, i) => {
      const a = start[i],
        d = a ? Math.hypot(a.x - p.position.x, a.z - p.position.z) : 0;
      p.userData.from = {
        x: p.position.x,
        y: p.position.y,
        z: p.position.z,
        yaw: p.rotation.y,
        t0: 0,
        dur: Math.min(dur - 0.2, Math.max(0.35, d / RUN)),
      };
    });
    const b = this.ball.position;
    this.ballFrom = { x: b.x, y: b.y, z: b.z, t0: 0 };
    this.transit = { t: 0, dur };
    return true;
  },
  // Remember where everything is drawn right now; the next poses ease out of it instead of jumping.
  snapshot(t0) {
    if (!this.posed) return;
    this.people.forEach(
      p => (p.userData.from = { x: p.position.x, y: p.position.y, z: p.position.z, yaw: p.rotation.y, t0 }),
    );
    const b = this.ball.position;
    this.ballFrom = { x: b.x, y: b.y, z: b.z, t0 };
  },
  blend(from, pose, t) {
    if (!from || !this.motion) return pose;
    const dx = pose.x - from.x,
      dz = pose.z - from.z,
      d = Math.hypot(dx, dz, pose.y - from.y);
    from.dur ??= Math.min(1.35, Math.max(0.3, d / 8));
    const w = Math.max(0, (t - from.t0) / from.dur);
    if (w >= 1 || d < 1e-4) return pose;
    const s = w * w * (3 - 2 * w),
      turn = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k,
      trip = Math.min(1, d / 2) * Math.sin(w * Math.PI);
    return {
      ...pose,
      x: from.x + dx * s,
      y: from.y + (pose.y - from.y) * s,
      z: from.z + dz * s,
      yaw: turn(turn(from.yaw, pose.yaw, s), Math.atan2(dx, dz), trip * 0.9),
      run: Math.max(pose.run, trip),
    };
  },
  /* The moment a play resolves (once per play): who reacts to it (src/reactions.js), kept by player, not by slot, since
     bodies are re-ordered for the next play; the home crowd's cheer; the camera's impact shake. o: the offence's first slot. */
  resolvePlay(clip, o) {
    const roles = {
      shooter: this.people[o],
      helper: this.people[o + 1],
      marker: this.people[5 - o],
      winner:
        clip.outcome === 'block' && clip.recovery === 'offense'
          ? this.people[blockPlan(clip, this.releasePoint(clip)).win.i]
          : null,
    };
    this.reactions = reactionsFor(clip)
      .map(r => ({ player: roles[r.role], kind: r.kind, t: 0 }))
      .filter(r => r.player);
    // the home crowd jumps up for a Kangs basket (longest for a three or a dunk) and for a stop on defence
    const big = SHOTS[clip.kind]?.three || isDunk(clip.kind);
    if (clip.points && clip.team === 'home') this.cheer = big ? 1.6 : 1;
    else if (clip.team === 'away' && (clip.outcome === 'block' || clip.outcome === 'steal')) this.cheer = 1;
    if (isDunk(clip.kind) && clip.points) this.shake = 0.24;
    else if (clip.outcome === 'block') this.shake = 0.18;
  },
  /* Where the ball is drawn in a play (playFrame): the play's ball, but held by the handler (or the stealer) while he is
     still easing into his spot, carried up the floor in the run between plays, on a finish's own path, and scaled with a
     player drawn taller or shorter than his model; passed along an arc when it changes hands (blendBall). o: the
     offence's first slot; fin: the shooter's finish frame (src/finishes.js) or null; tr: the run between plays or null. */
  placePlayBall({ pose, clip, o, clipTime, fin, tr }) {
    const u = clipTime / CLIP_SECONDS;
    // While a player is still easing into place the ball stays in his hands (the handler, or the defender after a steal).
    const sm = x => ((x = Math.max(0, Math.min(1, x))), x * x * (3 - 2 * x)),
      off = j => [this.people[j].position.x - pose.actors[j].x, this.people[j].position.z - pose.actors[j].z],
      a = off(o),
      b = off(5 - o),
      st = clip.outcome === 'steal' ? sm((u - 0.27) / 0.09) : 0,
      hold = 1 - sm((u - shotTiming(clip.kind).release + 0.06) / 0.06);
    // in transition the new ball handler dribbles it up the floor (after a short pass to him if it is elsewhere)
    const h = this.people[o],
      hy = h.rotation.y,
      carried = {
        x: h.position.x - Math.cos(hy) * 0.38 + Math.sin(hy) * 0.3,
        y: dribbleAt(this.gait / DRIBBLE.period).ball,
        z: h.position.z + Math.sin(hy) * 0.38 + Math.cos(hy) * 0.3,
      };
    // a ball in the hands of a player drawn taller or shorter than his model is drawn scaled about his feet with him
    // (presentation only: the play's ball is untouched, and the flight starts where it always did)
    const held = {
        x: pose.ball.x + (a[0] + (b[0] - a[0]) * st) * hold,
        y: pose.ball.y,
        z: pose.ball.z + (a[1] + (b[1] - a[1]) * st) * hold,
      },
      k = fin?.ball ? 0 : (h.scale.x - 1) * hold * (1 - st); // a finish scales its own path
    if (k) {
      held.x += (held.x - h.position.x) * k;
      held.y += (held.y - pose.actors[o].y) * k;
      held.z += (held.z - h.position.z) * k;
    }
    if (fin?.ball) {
      held.x = fin.ball[0];
      held.y = fin.ball[1];
      held.z = fin.ball[2];
    }
    const ball = this.blendBall(tr ? carried : held, tr ? tr.t : clipTime);
    this.ball.position.set(ball.x, ball.y, ball.z);
  },
  /* One frame of a play (frame): the play clock and the run between plays (transit), the cast re-ordered for each play,
     every player's pose (the play's spot kept apart, a finish, an action, a reaction), the ball, its trail and the nets,
     the score, the reactions and the crowd when the play resolves, and onPresentation for the UI. */
  playFrame(dt) {
    // Between clips the play clock waits while everyone runs to the next play at a game pace (see startTransit).
    if (!this.paused) {
      if (this.transit) {
        this.transit.t += dt * this.speed;
        if (this.transit.t >= this.transit.dur) {
          this.transit = null;
          this.people.forEach(p => (p.userData.from = null));
          const b = this.ball.position;
          this.ballFrom = { x: b.x, y: b.y, z: b.z, t0: 0 };
        }
      } else this.playTime = Math.min(CLIP_SECONDS * 2, this.playTime + dt * this.speed * this.slowMo());
    }
    let presentation = this.presentation(),
      clip = presentation.clip,
      index = presentation.index,
      clipTime = Math.min(CLIP_SECONDS, this.playTime - index * CLIP_SECONDS);
    // New clip: re-order bodies (never re-dress them) so the clip's defender is people[0], then ease everyone from where they stand.
    if (index !== this.clipIndex) {
      this.spacing = {}; // bodies are re-ordered for the new play; it starts from where everyone is drawn
      this.clipIndex = index;
      const lineup = this.event.lineup || this.state?.players.filter(p => p.starter) || [];
      let home = [...lineup];
      if (index === 1 && clip.defenderId !== undefined)
        home.sort((a, b) => (a.id === clip.defenderId ? -1 : b.id === clip.defenderId ? 1 : 0));
      this.cast(home, true);
      this.castVisitors();
      this.trail.forEach(d => (d.visible = false));
      if (this.startTransit(clip, index)) {
        this.playTime = index * CLIP_SECONDS;
        clipTime = 0;
        presentation = this.presentation();
      } else this.snapshot(clipTime);
    } else if (this.motion !== this.blendMotion) this.snapshot(clipTime);
    this.blendMotion = this.motion;
    const pose = sampleClip(clip, this.motion ? clipTime : presentation.resolved ? CLIP_SECONDS : 0);
    if (!this.transit) {
      this.dribble = dribbleAt(pose.bounce); // in a play the hand keeps the play's beat
      this.dribbleHand = this.dribble.hand;
    }
    const o = clip.team === 'home' ? 0 : 5,
      ease = !this.motion ? 1 : this.paused ? 0 : 1 - Math.exp(-dt * this.speed * 22);
    const tr = this.transit;
    // where the play wants everyone, then personal space (motion.js keepApart): about 3 ft apart, going round each other
    // instead of through; the ball handler is never pushed, and the defender contesting him may come a little closer
    const wanted = pose.actors.map((p, i) =>
        this.blend(
          this.people[i].userData.from,
          tr ? { ...p, arms: i === o ? 'dribble' : 'run' } : p,
          tr ? tr.t : clipTime,
        ),
      ),
      mk = 5 - o,
      kept = keepApart((this.spacing ??= {}), wanted, {
        pinned: new Set([o]),
        dt: this.motion ? this.frameDt : 0,
        // motion version 3 keeps players apart itself and says which pairs may come closer (pose.contacts: a contest,
        // a block, a steal's reach, a screen); this frame-by-frame push only covers the ease from the last play's spots
        gap: (i, j) =>
          pose.contacts?.find(([a, b]) => (a === i && b === j) || (a === j && b === i))?.[2] ??
          ((i === o && j === mk) || (i === mk && j === o)
            ? clip.outcome === 'block'
              ? SPACE.block
              : SPACE.contest
            : SPACE.min),
      });
    // a jump shooter's arms take the shot's form (basketball.js shotHands: the title jumper's), his legs their own jump
    const feet = (this.shooterFeet ??= new THREE.Vector3()).set(kept[o].x, pose.actors[o].y, kept[o].z),
      shooterArms =
        pose.shotHands && !tr ? this.shotPerform(pose.shotHands, feet, this.people[o].scale.x) : null,
      blockerArm = pose.blockHands && !tr ? this.shotPerform(pose.blockHands, null, 1, 0.9) : null; // spread hands swat
    // a finish at the rim (src/finishes.js): the shooter's hands, body, legs in the air, turn, the euro's side step, the
    // dunk's elevation and rim hang, and the ball on the finish's path; the putback's dip and two-hand rise
    const rel = !tr ? this.releasePoint(clip) : null,
      sh = this.people[o],
      fin = rel
        ? finishFrame(
            clip,
            clipTime,
            { x: kept[o].x, z: kept[o].z, yaw: pose.actors[o].yaw, y: pose.actors[o].y, scale: sh.scale.x },
            pose.ball,
            rel,
          )
        : null,
      pb = rel ? putbackFrame(clip, clipTime, rel) : null,
      // passes, catches, steals, rebounds and contests (src/actions.js), one per player at most
      acts = new Map();
    if (!tr) for (const a of actionFrames(clip, clipTime, pose)) if (!acts.has(a.actor)) acts.set(a.actor, a);
    this.finish = fin;
    wanted.forEach((w, i) => {
      const f = i === o ? fin : null,
        q = {
          ...w,
          x: kept[i].x + (f?.shift?.[0] || 0),
          y: w.y + (f?.lift || 0),
          z: kept[i].z + (f?.shift?.[2] || 0),
          ...(i === o && shooterArms ? { perform: shooterArms } : {}),
          ...(i === mk && blockerArm ? { perform: blockerArm } : {}),
        };
      const act = acts.get(i);
      if (act && !f && !(i === mk && blockerArm) && !(pb && i === pb.actor)) {
        q.perform = this.finishPerform(act);
        q.y += act.lift || 0;
        if (act.legs) q.airLegs = act.legs;
        if (act.arms) q.arms = act.arms;
      }
      // a reaction to the last play (src/reactions.js), when nothing else is moving his arms: it plays over his jog
      const re = !q.perform && this.reactions?.find(r => r.player === this.people[i]);
      if (re) {
        const rf = reactionFrame(re.kind, re.t, { x: q.x, z: q.z, y: q.y, yaw: this.people[i].rotation.y });
        if (rf) q.perform = this.finishPerform(rf);
      }
      if (f)
        Object.assign(q, {
          perform: this.finishPerform(f),
          yawAdd: f.yaw,
          airLegs: f.legs,
          airLead: f.legSide,
        });
      if (pb && i === pb.actor)
        Object.assign(q, {
          perform: this.finishPerform({ body: pb.body }),
          airLegs: pb.legs,
          airLead: 'R',
        });
      this.posePlayer(this.people[i], q, this.gait, ease);
    });
    this.placePlayBall({ pose, clip, o, clipTime, fin, tr });
    this.spinBall(pose.flying);
    this.focusRing.visible = true;
    this.focusRing.position.x = this.people[o].position.x;
    this.focusRing.position.z = this.people[o].position.z;
    this.nets.forEach(n => (n.mesh.rotation.y = n.side === (clip.team === 'home' ? 1 : -1) ? pose.net : 0));
    const flight = pose.flying ? flightPath(clip) : null; // the shot's parabola (no re-sampling of the play)
    this.trail.forEach((d, i) => {
      d.visible = this.motion && !!flight;
      if (d.visible) {
        const previous = flight(Math.max(0, clipTime - i * 0.025));
        d.position.set(previous.x, previous.y, previous.z);
      }
    });
    this.score(presentation.home, presentation.away);
    const impact = `${this.run}|${index}`;
    for (const r of this.reactions || []) r.t += this.frameDt || 0;
    if (presentation.resolved && this.impactKey !== impact) {
      this.impactKey = impact;
      this.resolvePlay(clip, o);
    }
    const key = `${index}|${pose.phase}|${presentation.resolved}|${presentation.done}`;
    if (key !== this.presentKey) {
      this.presentKey = key;
      this.onPresentation?.(presentation);
    }
  },
};
