import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.js';
import {
  SHOTS,
  sampleClip,
  CLIP_SECONDS,
  BALL,
  fly,
  launch,
  shotTiming,
  smoothRoute,
  dribbleAt,
  DRIBBLE,
} from '../src/basketball.js';
const data = JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json', import.meta.url)));
function match(seed) {
  const s = E.createGame(data, 'Actions', 'standard', seed);
  E.autoLineup(s);
  E.startMatch(s);
  return s;
}
test('plays cover shot families, blocks, steals and varied chance without contradicting score', () => {
  const kinds = new Set(),
    outcomes = new Set(),
    chances = new Set(),
    lines = new Set(),
    recoveries = { offense: 0, defense: 0 };
  let clips = 0;
  // The Kangs start with the five basic moves (skills.js); with the whole tree learned, these games show every move.
  for (let seed = 1; seed <= 15; seed++) {
    const s = match(seed);
    s.skills = Object.values(E.SKILL_TREE)
      .flat()
      .map(n => n.key);
    s.match.pace = seed % 2 ? 'fast' : 'steady';
    while (s.match) {
      const event = E.possession(s);
      assert.equal(event.plays[0].points, event.points);
      assert.equal(event.plays[1].points, event.away);
      for (const c of event.plays) {
        clips++;
        kinds.add(c.kind);
        outcomes.add(c.outcome);
        chances.add(c.shotChance);
        lines.add(c.commentary);
        assert.equal(c.points, c.outcome === 'made' ? (c.three ? 3 : 2) : c.putback === 'made' ? 2 : 0);
        // only a block has a loose ball, and only the shooting team's recovery has a putback
        assert.equal(c.recovery !== undefined, c.outcome === 'block');
        assert.equal(c.putback !== undefined, c.recovery === 'offense');
        if (c.recovery) recoveries[c.recovery]++;
        assert.ok(c.commentary.includes(c.player));
        assert.equal(
          c.assisted,
          !!c.points && c.outcome === 'made' && ['catch', 'dunk'].includes(SHOTS[c.kind].like || c.kind),
        );
        assert.ok(!c.commentary.includes('shot quality'));
      }
    }
  }
  assert.deepEqual([...kinds].sort(), Object.keys(SHOTS).sort());
  assert.deepEqual([...outcomes].sort(), ['block', 'made', 'miss', 'steal']);
  assert.ok(chances.size > 30);
  assert.ok(lines.size > clips * 0.5);
  // after a block either side can come up with the ball, the defense more often
  const share = recoveries.offense / (recoveries.offense + recoveries.defense);
  assert.ok(
    share > 0.12 && share < 0.45,
    `the shooting team kept ${(share * 100).toFixed(0)}% of blocked shots`,
  );
});
test('recorded poses are finite, bounded, mirrored, and contain actual jumps and contests', () => {
  for (const kind of Object.keys(SHOTS))
    for (const outcome of ['made', 'miss', 'block', 'steal']) {
      const c = {
        team: 'home',
        kind,
        lane: 1,
        contest: 'tight',
        outcome,
        points: outcome === 'made' ? 2 : 0,
      };
      let jump = 0;
      for (let time = 0; time <= CLIP_SECONDS; time += 0.05) {
        const pose = sampleClip(c, time);
        assert.equal(pose.actors.length, 10);
        for (const p of [...pose.actors, pose.ball]) {
          assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
          assert.ok(Math.abs(p.x) <= 16 && Math.abs(p.z) <= 9);
          assert.ok(p.y >= 0);
        }
        jump = Math.max(jump, pose.actors[0].y);
      }
      if (outcome !== 'steal') assert.ok(jump > 0.5, kind);
      const home = sampleClip(c, 2.2),
        away = sampleClip({ ...c, team: 'away' }, 2.2);
      assert.equal(home.ball.x, -away.ball.x);
      assert.deepEqual(home, sampleClip(c, 2.2));
    }
});
test('scores resolve after the shot, blocks deflect instead of scoring, and idle clips stop', () => {
  const c = { team: 'home', kind: 'drive', lane: -1, contest: 'tight', outcome: 'block', points: 0 };
  const at = f => CLIP_SECONDS * f;
  /* times as fractions of a play */ assert.equal(sampleClip(c, at(1 / 3.6)).resolved, false);
  assert.equal(sampleClip(c, at(3.5 / 3.6)).resolved, true);
  const block = sampleClip(c, at(3 / 3.6)).ball,
    make = sampleClip({ ...c, outcome: 'made', points: 2 }, at(3 / 3.6)).ball;
  assert.notDeepEqual(block, make);
  assert.deepEqual(sampleClip(c, CLIP_SECONDS), sampleClip(c, CLIP_SECONDS * 10));
});
test('viewing speed cannot consume random numbers or change a saved outcome', () => {
  const s = match(182);
  const event = E.possession(s),
    before = JSON.stringify(s);
  for (const speed of [1, 2, 4])
    for (let elapsed = 0; elapsed < CLIP_SECONDS / speed; elapsed += 0.016)
      sampleClip(event.plays[0], elapsed * speed);
  assert.equal(JSON.stringify(s), before);
});
test('new action records survive save validation; malformed replay paths are rejected', () => {
  const s = match(781);
  E.possession(s);
  assert.ok(E.validSave(s));
  s.match.events[0].plays[0].lane = 'bad';
  assert.equal(E.validSave(s), false);
});
test('a launched ball reaches its target on time under gravity, and bounces lose speed off the floor', () => {
  const p = { x: 6, y: 3.1, z: 1 },
    q = { x: 12.15, y: BALL.rim, z: 0 },
    at = fly(p, launch(p, q, 1.1), 1.1);
  for (const k of ['x', 'y', 'z']) assert.ok(Math.abs(at[k] - q[k]) < 1e-9, k);
  // dropped from 3 units: every bounce peaks lower than the one before, and the ball never goes through the floor
  let peaks = [],
    prev = 3,
    rising = false;
  for (let t = 0; t < 4; t += 0.002) {
    const y = fly({ x: 0, y: 3, z: 0 }, { x: 0, y: 0, z: 0 }, t).y;
    assert.ok(y >= BALL.floor - 1e-9);
    if (rising && y < prev) peaks.push(prev);
    rising = y > prev;
    prev = y;
  }
  assert.ok(peaks.length >= 2 && peaks.every((h, i) => h < (i ? peaks[i - 1] : 3)));
});
test('shots fly for as long as gravity takes: threes hang longest, dunks barely leave the hand', () => {
  const T = k => shotTiming(k).flight;
  assert.ok(T('catch') > 1 && T('catch') < 1.3);
  assert.ok(T('drive') < T('floater') && T('floater') < T('catch'));
  assert.ok(T('dunk') < 0.5);
  for (const k of Object.keys(SHOTS)) {
    const s = shotTiming(k);
    assert.ok(s.gather < s.release && s.release < BALL.arrive, k);
  }
});
test('routes are rounded through their waypoints instead of turning on the spot', () => {
  const route = [
      [0, 0],
      [4, 0],
      [4, 4],
    ],
    curve = smoothRoute(route);
  for (const w of route) assert.ok(curve.some(p => Math.hypot(p[0] - w[0], p[1] - w[1]) < 1e-9));
  // near the corner the curve cuts inside it, so the heading changes over several steps
  const turns = curve.slice(2).map((p, i) => {
    const a = Math.atan2(curve[i + 1][1] - curve[i][1], curve[i + 1][0] - curve[i][0]),
      b = Math.atan2(p[1] - curve[i + 1][1], p[0] - curve[i + 1][0]);
    return Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
  });
  assert.ok(Math.max(...turns) < Math.PI / 4);
});
test('the dribble: hand and ball move together in the push, the ball bounces off the floor and is back in the hand on the beat', () => {
  let prev = dribbleAt(0),
    fastest = 0,
    lowest = 9,
    handLowest = 9;
  for (let i = 1; i <= 2000; i++) {
    const d = dribbleAt(i / 1000);
    if (d.contact) assert.equal(d.ball, d.hand);
    fastest = Math.max(fastest, Math.abs(d.ball - prev.ball) / (DRIBBLE.period / 1000));
    lowest = Math.min(lowest, d.ball);
    handLowest = Math.min(handLowest, d.hand);
    prev = d;
  }
  assert.ok(Math.abs(lowest - BALL.floor) < 0.01); // it reaches the floor
  assert.ok(handLowest > DRIBBLE.top - 2 * DRIBBLE.reach - 1e-9); // the hand never follows it down to the floor
  // the hand's loop is smooth: its speed never jumps (no kick as it takes or lets go of the ball)
  for (let i = 1; i < 1000; i++) {
    const h = k => dribbleAt(k / 1000).hand,
      v0 = h(i) - h(i - 1),
      v1 = h(i + 1) - h(i);
    assert.ok(Math.abs(v1 - v0) < 0.004, `hand speed jumps at ${i / 1000}`);
  }
  assert.ok(DRIBBLE.arrive < 1.5); // the ball comes back into the hand slowly: a soft catch
  assert.ok(fastest < 8); // about 19 ft/s at most: a real dribble, no jumps where the phases meet
  assert.ok(Math.abs(dribbleAt(1).ball - dribbleAt(0).ball) < 1e-9);
});
test('in-game jump shots use the title jumper form: a real jump, released at its top, hands moving smoothly', () => {
  for (const kind of ['catch', 'pullup', 'stepback', 'corner', 'fadeaway']) {
    const c = { team: 'home', kind, lane: 1, contest: 'tight', outcome: 'made', points: 3 },
      T = shotTiming(kind),
      dt = 1 / 240;
    assert.ok(T.jumper, kind);
    // the shooter is highest at the release, and the jump is a parabola under gravity (hang time from the height)
    const at = t => sampleClip(c, t * CLIP_SECONDS).actors[0].y;
    assert.ok(Math.abs(at(T.release) - T.jump) < 1e-6, kind);
    assert.ok(Math.abs(T.hang * CLIP_SECONDS - 2 * Math.sqrt((2 * T.jump) / BALL.g)) < 1e-9);
    let prev = null,
      seen = 0;
    for (let t = 0; t <= CLIP_SECONDS; t += dt) {
      const h = sampleClip(c, t).shotHands;
      if (h) {
        seen++;
        if (prev)
          for (const s of ['R', 'L']) {
            const d = Math.hypot(...h[s].p.map((v, i) => v - prev[s].p[i]));
            assert.ok(
              d < 14 * dt + 1e-3,
              `${kind} ${s} hand jumps ${d.toFixed(3)} at ${(t / CLIP_SECONDS).toFixed(3)}`,
            );
          }
      }
      prev = h;
    }
    assert.ok(seen > 50, kind);
  }
  assert.equal(
    sampleClip({ team: 'home', kind: 'drive', lane: 1, contest: 'tight', outcome: 'made', points: 2 }, 2)
      .shotHands,
    null,
  );
});
test('after a steal the stealer keeps the ball into the next play; an outlet pass comes from the passer, not past him', () => {
  for (const kind of ['dunk', 'alley', 'catch', 'corner']) {
    const c = { team: 'away', kind, lane: 1, contest: 'open', outcome: 'made', points: 2 },
      after = { ...c, afterSteal: true },
      s0 = sampleClip(after, 0),
      handler = s0.actors[5];
    // the ball starts with him (dribbling at his side), not out at the passer
    assert.ok(Math.hypot(s0.ball.x - handler.x, s0.ball.z - handler.z) < 0.6, kind);
    if (kind === 'dunk' || kind === 'alley') {
      const p = sampleClip(c, 0),
        passer = p.actors[6];
      assert.ok(
        Math.hypot(p.ball.x - passer.x, p.ball.z - passer.z) < 1,
        `${kind}: the outlet leaves the passer's hands`,
      );
    }
  }
});
