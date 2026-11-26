// The lessons runtime and its wiring: what can be checked without a browser (npm run check:ui and the hand checks in
// the report cover the rest).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSettingsDialog } from '../src/settingsDialog.js';
import { escapeAnswers, holdsKeys, outOfView } from '../src/ui/lessons.js';

const read = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');

// A stand-in for the <dialog>: it records the listeners the Settings dialog adds and the content shown in it.
function fakeModal() {
  const on = {};
  return {
    on,
    open: true,
    addEventListener: (type, fn) => (on[type] = fn),
    querySelector: () => null,
    contains: () => true,
  };
}
const key = (k, target) => ({
  key: k,
  target,
  prevented: false,
  preventDefault() {
    this.prevented = true;
  },
});
test('arrow keys on Help’s tabs are left to Help: the Settings dialog only answers its own tabs', () => {
  const modal = fakeModal();
  globalThis.CSS ??= { escape: String }; // the dialog finds its focused control again by CSS.escape
  let shown = 0;
  createSettingsDialog({ modal, show: () => shown++, notify() {}, onKeysChange() {} });
  // Help's tab: role="tab" and data-tab, but no data-s-tab
  const helpTab = {
    dataset: { tab: '2' },
    closest: sel => (/role="tab"|data-tab\]/.test(sel) ? helpTab : null),
  };
  const e = key('ArrowRight', helpTab);
  modal.on.keydown(e);
  assert.equal(shown, 0, 'Settings did not open over Help');
  assert.equal(e.prevented, false, 'the key goes on to Help (keyboard.js)');
  // Settings' own tab still moves
  const own = { dataset: { sTab: 'sound' }, closest: () => own };
  const e2 = key('ArrowRight', own);
  modal.on.keydown(e2);
  assert.equal(shown, 1);
  assert.equal(e2.prevented, true);
});
test('no click lock: nothing on the page is blocked while a lesson is up', () => {
  for (const f of ['../src/main.js', '../src/ui/tutorial.js', '../src/ui/keyboard.js'])
    assert.doesNotMatch(read(f), /blockOutsideSpotlight|stopImmediatePropagation/, f);
});
test('the 100 ms loop runs the lessons inside a try/catch, so a failing lesson never stops Watch live', () => {
  const main = read('../src/main.js');
  const loop = main.slice(main.indexOf('setInterval(() => {'), main.indexOf('}, 100);'));
  assert.match(loop, /try \{\s*coachTick\(\);?\s*\} catch/);
  assert.ok(
    loop.indexOf('watchTick()') > loop.indexOf('catch'),
    'Watch live runs after it, whatever happens',
  );
});
test('the old tour is gone: no beats, no skip dialog, no old flag, no checkbox', () => {
  const src = [
    '../src/ui/tutorial.js',
    '../src/ui/screens/landing.js',
    '../src/ui/actions.js',
    '../src/ui/demo.js',
  ]
    .map(read)
    .join('\n');
  for (const old of [
    'BEATS',
    'breakBeat',
    'askSkipTour',
    'tourHoldsKeys',
    'kangs-three-tutorial',
    'walkDefault',
    'name="walk"',
  ])
    assert.ok(!src.includes(old), old);
  const css = ['../src/style.css', '../src/theme.css', '../src/a11y.css'].map(read).join('\n');
  for (const old of ['.tutorial.aimed', '.coach-skip', '.walk-check']) assert.ok(!css.includes(old), old);
});
test('the start form asks whether the coach has coached a season before', () => {
  const landing = read('../src/ui/screens/landing.js');
  assert.match(landing, /name="tips" value="lessons"/);
  assert.match(landing, /name="tips" value="tips"/);
  assert.match(landing, /t\('landing\.ask'\)/);
});
test('Help has a Lessons tab, and Settings has the tips level in its Game section', () => {
  assert.match(read('../src/ui/handbook.js'), /RULE_TABS = \[[^\]]*'lessons'/);
  assert.match(read('../src/settingsDialog.js'), /'prefs\.tips'/);
});
test('Escape answers a card only when no dialog has it; shortcut keys wait only behind a card that holds the game', () => {
  assert.equal(escapeAnswers({ open: true, inline: false, dialog: false }), true);
  assert.equal(
    escapeAnswers({ open: true, inline: false, dialog: true }),
    false,
    'a dialog’s Escape is its own',
  );
  assert.equal(escapeAnswers({ open: true, inline: true, dialog: true }), false, 'a line inside a dialog');
  assert.equal(escapeAnswers({ open: false, inline: false, dialog: false }), false);
  assert.equal(holdsKeys({ open: true, held: true, dialog: false }), true);
  assert.equal(holdsKeys({ open: true, held: false, dialog: false }), false, 'cards outside a paused game');
  assert.equal(holdsKeys({ open: true, held: true, dialog: true }), false);
  assert.equal(holdsKeys({ open: false, held: true, dialog: false }), false);
});
test('Show me appears only when what the card points at is wholly out of view', () => {
  const r = (top, bottom) => ({ top, bottom });
  assert.equal(outOfView(r(100, 200), 800), false);
  assert.equal(outOfView(r(-50, 20), 800), false, 'partly in view');
  assert.equal(outOfView(r(-200, -10), 800), true, 'above');
  assert.equal(outOfView(r(810, 900), 800), true, 'below');
  assert.equal(outOfView(r(700, 760), 800, 690), true, 'under the docked phone card');
  assert.equal(outOfView(r(650, 760), 800, 690), false, 'partly above it');
  assert.equal(outOfView(null, 800), false, 'nothing to point at');
});
