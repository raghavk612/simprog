import test from 'node:test';import assert from 'node:assert/strict';
import * as P from '../src/shotphysics.js';
import * as T from '../src/drilltiming.js';

const good = (dist = 20.6, angle = 55, bearing = 0, extra = {}) => ({ dist, bearing, angle, aim: 0, power: P.idealPower(dist, angle), ...extra });

test('idealPower is the closed-form inverse of speedFor and stays in the playable range for every spot and arc', () => {
  for (const s of [...P.THREE_SPOTS, P.FT_SPOT]) for (const a of [P.ARC_MIN, 45, 52, 60, P.ARC_MAX]) {
    const pw = P.idealPower(s.dist, a);
    assert.ok(pw > 15 && pw < 85, `${s.id} ${a}: ${pw}`);
  }
  assert.ok(Math.abs(P.powerFor(P.speedFor(37.5)) - 37.5) < 1e-9);
});

test('a known-good shot is a clean swish from every three-point spot and the free-throw line', () => {
  for (const s of [...P.THREE_SPOTS, P.FT_SPOT]) {
    const r = P.simulateShot({ spot: s, angle: 55, aim: 0, power: P.idealPower(s.dist, 55) });
    assert.equal(r.made, true, s.id); assert.equal(r.reason, 'swish', s.id); assert.equal(r.rimHits, 0, s.id);
    assert.ok(r.events.some(e => e.type === 'net'));
  }
});

test('arc matters: a flat shot with perfect power still hits the front of the rim, a high one swishes', () => {
  const slot = P.THREE_SPOTS.find(x => x.id === 'slotL');
  const flat = P.simulateShot({ spot: slot, angle: P.ARC_MIN, aim: 0, power: P.idealPower(slot.dist, P.ARC_MIN) });
  const high = P.simulateShot({ spot: slot, angle: 58, aim: 0, power: P.idealPower(slot.dist, 58) });
  assert.equal(flat.made, false); assert.ok(flat.rimHits >= 1); assert.equal(high.reason, 'swish');
});

test('the same input always produces the same path and result', () => {
  const a = P.simulateShot(good(21, 47, 20, { aim: 0.4, power: 53 })), b = P.simulateShot(good(21, 47, 20, { aim: 0.4, power: 53 }));
  assert.deepEqual(a, b);
});

test('misses are classified short, long, left and right', () => {
  const ip = P.idealPower(20.6, 55);
  const short = P.simulateShot(good(20.6, 55, 0, { power: ip - 12 })), long = P.simulateShot(good(20.6, 55, 0, { power: ip + 12 }));
  assert.equal(short.made, false); assert.equal(short.reason, 'short'); assert.ok(short.miss > 1);
  assert.equal(long.made, false); assert.equal(long.reason, 'long'); assert.ok(long.miss > 1);
  const left = P.simulateShot(good(20.6, 55, 0, { aim: -4 })), right = P.simulateShot(good(20.6, 55, 0, { aim: 4 }));
  assert.equal(left.made, false); assert.equal(left.reason, 'left');
  assert.equal(right.made, false); assert.equal(right.reason, 'right');
  assert.ok(left.offset.lat < 0 && right.offset.lat > 0);
  // an airball that never touches the iron says so
  assert.equal(P.simulateShot(good(20.6, 55, 0, { power: ip - 25 })).air, true);
});

test('classification follows the shooter, not the court: a corner shooter missing to his left is still "left"', () => {
  for (const s of [P.THREE_SPOTS.find(x => x.id === 'cornerR'), P.THREE_SPOTS.find(x => x.id === 'wingL')]) {
    const base = { spot: s, angle: 55, power: P.idealPower(s.dist, 55) };
    assert.equal(P.simulateShot({ ...base, aim: -4 }).reason, 'left', s.id);
    assert.equal(P.simulateShot({ ...base, aim: 4 }).reason, 'right', s.id);
  }
});

test('lateral aim error can rattle in, rim out, or go in off the glass', () => {
  const seen = new Set();
  for (let aim = -3; aim <= 3; aim += 0.1) for (let dp = -5; dp <= 5; dp += 0.5) {
    const r = P.simulateShot(good(20.6, 55, 0, { aim, power: P.idealPower(20.6, 55) + dp }));
    seen.add(r.made ? r.reason : r.rimHits ? 'rimout' : 'miss');
  }
  for (const k of ['swish', 'rattle', 'rimout', 'miss']) assert.ok(seen.has(k), `${k} in ${[...seen]}`);
});

test('bank shots are possible: aiming at the glass from the wing can score', () => {
  const wing = P.THREE_SPOTS.find(s => s.id === 'wingR');
  let bank = null;
  for (let aim = -25; aim <= 25 && !bank; aim += 0.5) for (let pw = 30; pw <= 90 && !bank; pw += 1) {
    const r = P.simulateShot({ spot: wing, angle: 52, aim, power: pw });
    if (r.made && r.reason === 'bank') bank = r;
  }
  assert.ok(bank, 'found a bank shot');
  assert.equal(bank.board, true); assert.equal(bank.rimHits, 0);
  assert.ok(bank.events.some(e => e.type === 'board'));
});

test('the ball never passes through the backboard or the floor', () => {
  for (let aim = -6; aim <= 6; aim += 1.5) for (let pw = 30; pw <= 90; pw += 15) {
    const r = P.simulateShot(good(15, 55, 0, { aim, power: pw }));
    for (const q of r.path) assert.ok(q.y >= P.BALL_R - 1e-6, 'floor');
  }
  const board = P.simulateShot({ dist: 14.4, angle: 55, aim: 0, power: P.idealPower(14.4, 55) + 9 });
  assert.ok(board.path.every(q => q.z > P.BOARD_Z - P.BALL_R - 0.5 || q.y < P.BOARD.y0 || q.y > P.BOARD.y1 || Math.abs(q.x) > P.BOARD.halfW + 1));
});

test('meter damping keeps a human-sized timing error inside the sweet spot, and assist is more forgiving', () => {
  const ip = P.idealPower(20.6, 55);
  const shot = (err, assist) => P.simulateShot(good(20.6, 55, 0, { power: P.effectivePower(ip + err, ip, assist) }));
  for (const [band, assist] of [[P.SWEET, false], [P.SWEET_ASSIST, true]]) {
    for (const sign of [-1, 1]) {
      assert.equal(shot(sign * band.swish * 0.85, assist).reason, 'swish', `swish ${sign} ${assist}`);
      assert.equal(shot(sign * band.made * 0.85, assist).made, true, `made ${sign} ${assist}`);
    }
    assert.equal(shot(-40, assist).made, false);
  }
  assert.ok(P.METER_SENS_ASSIST < P.METER_SENS && P.SWEET_ASSIST.made > P.SWEET.made && P.SWEET_ASSIST.swish > P.SWEET.swish);
});

test('the power meter is a triangle wave: it fills, then falls back down', () => {
  assert.equal(P.meterAt(0), 0); assert.ok(Math.abs(P.meterAt(1.3) - 100) < 1e-9); assert.ok(Math.abs(P.meterAt(1.95) - 50) < 1e-9); assert.ok(P.meterAt(2.6) < 1e-9);
  for (let t = 0; t < 6; t += 0.05) { const m = P.meterAt(t); assert.ok(m >= 0 && m <= 100); }
});

test('the aim guide covers the first 30% of the flight, starts at the ball and bends down', () => {
  const g = P.guidePoints({ dist: 20.6, angle: 50, aim: 0, power: P.idealPower(20.6, 55) });
  assert.equal(g.length, 19); assert.ok(Math.abs(g[0][1] - P.REL_H) < 1e-9);
  const full = P.simulateShot(good()); const reach = Math.hypot(g.at(-1)[0] - g[0][0], g.at(-1)[2] - g[0][2]), total = Math.hypot(full.path.find(q => q.t >= full.scoreT).x - g[0][0], full.path.find(q => q.t >= full.scoreT).z - g[0][2]);
  assert.ok(reach / total > 0.2 && reach / total < 0.4, `${reach / total}`);
  const rising = g.map(p => p[1]); assert.ok(rising[3] - rising[0] > rising[18] - rising[15] - 5); // gets flatter along the way
});

test('every three-point spot is outside the 19 ft 9 in line and every spot is legal', () => {
  for (const s of P.THREE_SPOTS) {
    const inCorner = s.z < 0; // corner: the straight part of the line is x = 19.75
    assert.ok(inCorner ? Math.abs(s.x) > 19.75 : s.dist > 19.75, s.id);
    assert.ok(s.z >= P.BASELINE_Z + 1 && Math.abs(s.x) < 24);
  }
  assert.ok(P.FT_SPOT.dist > 13.75 && P.FT_SPOT.dist < 16);
  assert.equal(new Set(P.THREE_SPOTS.map(s => s.id)).size, 7);
});

test('placeShooter faces the rim', () => {
  const p = P.placeShooter({ spot: { x: 0, z: 20 } }); assert.ok(Math.abs(Math.abs(p.faceYaw) - Math.PI) < 1e-9);
  const q = P.placeShooter({ dist: 20, bearing: 90 }); assert.ok(Math.abs(q.faceYaw + Math.PI / 2) < 1e-9); // standing on the right, facing left
});

test('close-out windows tighten each round, timing assist widens them, and the ring reaches the target when the window opens', () => {
  for (const assist of [false, true]) { const r = [0, 1, 2].map(i => T.closeoutRound(i, assist)); assert.ok(r[0].half > r[1].half && r[1].half > r[2].half); }
  for (let i = 0; i < 3; i++) { const a = T.closeoutRound(i, true), n = T.closeoutRound(i, false); assert.ok(a.half > n.half && a.approach > n.approach); assert.ok(Math.abs(n.release - n.ideal - n.arrive) < 1e-9); }
});

test('recovery rounds are slower and wider than close-outs and the window sits on the second exhale', () => {
  for (let i = 0; i < 3; i++) {
    const b = T.breatheRound(i), c = T.closeoutRound(i);
    assert.ok(b.half > c.half); assert.ok(b.period > 3);
    const t = b.ideal - b.lead, u = (t % b.period) / b.period;
    assert.ok(t > b.period && u > 0.5 && u < 1, 'second breath, falling half');
    assert.ok(Math.abs(T.breath(t, b.period) - 0.18) < 1e-6);
  }
  assert.ok(T.breatheRound(0, true).half > T.breatheRound(0).half);
});

test('judge says early, hit or late', () => {
  assert.equal(T.judge(1, 2, 0.2), 'early'); assert.equal(T.judge(2.1, 2, 0.2), 'hit'); assert.equal(T.judge(1.8, 2, 0.2), 'hit'); assert.equal(T.judge(2.3, 2, 0.2), 'late');
});
