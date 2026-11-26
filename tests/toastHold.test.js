// Notifications during a live game wait for the next quarter break or the end of the game (P1-10).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ToastHold } from '../src/ui/toastHold.js';

test('outside a live game every notification shows at once', () => {
  const h = new ToastHold();
  assert.equal(h.offer({ msg: 'a', opt: {} }, false), true);
  assert.equal(h.size, 0);
});

test('during a live game a notification waits, unless it is an error or marked now', () => {
  const h = new ToastHold();
  assert.equal(h.offer({ msg: 'achievement', opt: { type: 'success' } }, true), false);
  assert.equal(h.offer({ msg: 'no timeouts', opt: { type: 'error' } }, true), true);
  assert.equal(h.offer({ msg: 'adjustment applied', opt: { type: 'success', now: true } }, true), true);
  assert.equal(h.size, 1);
});

test('release hands back the waiting notifications in the order they came, once', () => {
  const h = new ToastHold();
  for (const msg of ['first', 'second', 'third']) h.offer({ msg, opt: {} }, true);
  assert.deepEqual(
    h.release().map(x => x.msg),
    ['first', 'second', 'third'],
  );
  assert.deepEqual(h.release(), []);
});

test('only the latest few wait, so a long game cannot pile them up', () => {
  const h = new ToastHold(3);
  for (let i = 0; i < 5; i++) h.offer({ msg: String(i), opt: {} }, true);
  assert.deepEqual(
    h.release().map(x => x.msg),
    ['2', '3', '4'],
  );
});
