import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena } from '../src/arena.js';
import { gymMethods } from '../src/arena/gym.js';
import { castMethods } from '../src/arena/cast.js';
import { ballMethods } from '../src/arena/ball.js';
import { poseMethods } from '../src/arena/pose.js';
import { playbackMethods } from '../src/arena/playback.js';
import { idleMethods } from '../src/arena/idle.js';
import { cameraMethods } from '../src/arena/cameras.js';

const PARTS = {
  gymMethods,
  castMethods,
  ballMethods,
  poseMethods,
  playbackMethods,
  idleMethods,
  cameraMethods,
};

test('arena: every method module is on the class, each name once, as ordinary (non-enumerable) methods', () => {
  const seen = new Map();
  for (const [part, methods] of Object.entries(PARTS))
    for (const name of Object.keys(methods)) {
      assert.ok(!seen.has(name), `${name} in ${part} and ${seen.get(name)}`);
      seen.set(name, part);
      const d = Object.getOwnPropertyDescriptor(Arena.prototype, name);
      assert.ok(d, `Arena.${name}`);
      assert.equal(d.value, methods[name]);
      assert.equal(d.enumerable, false);
    }
  // what the UI and the harness call (src/ui, scripts/gym-harness.mjs) is all there
  for (const name of [
    'update',
    'play',
    'clear',
    'isPlaying',
    'presentation',
    'setView',
    'setQuality',
    'setPlayers',
    'setTitlePaused',
    'flyIn',
    'mount',
    'frame',
    'score',
  ])
    assert.equal(typeof Arena.prototype[name], 'function', name);
});
