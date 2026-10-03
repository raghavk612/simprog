// Pure-engine regression suite. Run with: node tests/season.test.cjs
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const ui = read('src/ui.js');
const hooks = ui.slice(ui.indexOf('window.RTC = {'), ui.indexOf('/* ---------- Boot ---------- */'));
const ctx = vm.createContext({ console, window: {} });
vm.runInContext(read('src/engine.js') + '\n' + read('src/events.js') + '\nconst UI = {}, SET = {};\n' + hooks + '\nwindow.test = { filmDemo, filmExperiment, filmSnapshot, getGame: () => G, max: MAX_SEASONS };', ctx);
const { RTC, test } = ctx.window;
assert.equal(test.max, 1);
const snap = test.filmDemo();
assert.equal(test.getGame(), null, 'Exhibition must not create a saved season');
const identical = test.filmExperiment(snap, snap.state.strategy);
assert.equal(JSON.stringify(identical.original), JSON.stringify(identical.alternative), 'Identical tactics must reproduce identical results');
RTC.newGame({name:'Regression',seed:'LIVE-SEASON'}); RTC.autoSignBest(); RTC.finalizeTryouts();
const live = test.getGame(), before = JSON.stringify(live);
const result = test.filmExperiment(snap, {tempo:'fast',def:'press',focus:'perimeter'});
assert.equal(test.getGame(), live, 'Replay must restore live object identity');
assert.equal(JSON.stringify(live), before, 'Replay must not alter state, RNG, resources or stats');
assert.equal(JSON.stringify(result), JSON.stringify(test.filmExperiment(snap, {tempo:'fast',def:'press',focus:'perimeter'})), 'Replay must be deterministic');
assert.notEqual(JSON.stringify(result.original), JSON.stringify(result.alternative), 'Tactical branches must actually simulate different decisions');
const invalid = JSON.parse(JSON.stringify(snap)); invalid.state.roster = null;
assert.throws(() => test.filmExperiment(invalid, {}));
assert.equal(test.getGame(), live, 'Even a failed replay must restore the live season');
const counts = {};
for (const diff of ['rookie','varsity','legend']) for (const policy of ['smart','naive']) {
  const key = diff + '/' + policy, outcomes = {};
  for (let i = 0; i < 60; i++) {
    const r = RTC.autoSeason({diff,policy,seed:key+i});
    assert.equal(test.getGame().season, 1);
    assert.equal(test.getGame().phase, 'ended');
    assert.ok(test.getGame().games.length <= 14);
    outcomes[r.kind] = (outcomes[r.kind] || 0) + 1;
  }
  if (policy === 'smart') assert.ok((outcomes.champion||0)+(outcomes.perfect||0)>0, diff+' must allow a first-season title');
  counts[key] = outcomes;
}
console.log(JSON.stringify(counts,null,2));
// The previous save slot remains intact; only compatible first-season runs migrate.
const storage = new Map();
const migration = vm.createContext({store:{get:key=>storage.get(key)},SAVE_KEY:'rtc-save-v5'});
vm.runInContext(ui.slice(ui.indexOf('function loadSave()'),ui.indexOf('\n\nfunction applySettings')),migration);
storage.set('rtc-save-v4',JSON.stringify({v:4,season:1,phase:'season',week:6}));
assert.equal(vm.runInContext('loadSave().week',migration),6);
assert.equal(vm.runInContext('loadSave().v',migration),5);
assert.equal(JSON.parse(storage.get('rtc-save-v4')).v,4);
storage.set('rtc-save-v4',JSON.stringify({v:4,season:3,phase:'season'}));
assert.equal(vm.runInContext('loadSave()',migration),null);
console.log('PASS: 360 one-season runs; replay isolation/determinism; compatible save migration.');
