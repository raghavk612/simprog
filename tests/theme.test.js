import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const theme = read('../src/theme.css');
const tokens = block => new Set([...block.matchAll(/(--[a-z0-9-]+):/g)].map(m => m[1]));

test('light mode defines every colour the dark theme defines, apart from the aliases that follow them', () => {
  const dark = tokens(/:root,\s*#arena[^{]*\{([^}]*)\}/.exec(theme)[1]),
    light = tokens(/html\.theme-light:not\(\.a11y-high-contrast\)\s*\{([^}]*)\}/.exec(theme)[1]);
  const missing = [...dark].filter(
    k => !light.has(k) && !['--purple', '--deep', '--muted', '--border', '--band'].includes(k),
  );
  assert.deepEqual(missing, []);
});
test('every theme colour used in the stylesheets is defined', () => {
  const defined = tokens(/:root,\s*#arena[^{]*\{([^}]*)\}/.exec(theme)[1]);
  const names = [
    '--page',
    '--panel',
    '--ink',
    '--line',
    '--accent',
    '--on',
    '--score',
    '--good',
    '--bad',
    '--warn',
    '--shade',
    '--focus',
  ];
  for (const file of ['../src/style.css', '../src/a11y.css', '../src/theme.css'])
    for (const m of read(file).matchAll(/var\((--[a-z0-9-]+)/g))
      if (names.some(n => m[1].startsWith(n))) assert.ok(defined.has(m[1]), `${file}: ${m[1]}`);
});
test('no fading gradients: only flat colour blocks on jerseys, the whiteboard tray, the timing ruler, the high-contrast stripes and the navigation’s empty stretches', () => {
  // .bar-fill / .band-fill: the nav design's stripes, faded at their ends, in stretches with no text (decoration only)
  const allowed = /\.shirt|\.mb-|\.timing-bar|a11y-high-contrast|\.bar-fill|\.band-fill/;
  for (const file of ['../src/style.css', '../src/a11y.css', '../src/theme.css']) {
    const found = [...read(file).matchAll(/([^{}]*)\{([^{}]*gradient\([^{}]*)\}/g)].filter(
      m => !allowed.test(m[1]),
    );
    assert.deepEqual(
      found.map(m => m[1].trim().slice(-60)),
      [],
      file,
    );
  }
});
test('purple fill means the way forward only: a selected tab, filter, camera or speed uses the selected tokens', () => {
  const selected = /\[aria-(pressed|current|selected)=|\.(active|selected|picked)\b/;
  for (const k of ['--selected-bg', '--selected-ink', '--selected-line'])
    assert.ok(tokens(/:root,\s*#arena[^{]*\{([^}]*)\}/.exec(theme)[1]).has(k), k);
  for (const file of ['../src/style.css', '../src/a11y.css', '../src/theme.css']) {
    const found = [...read(file).matchAll(/([^{}]*)\{([^{}]*)\}/g)].filter(
      m => selected.test(m[1]) && /background(-color)?:\s*var\(--accent(-hover)?\)/.test(m[2]),
    );
    assert.deepEqual(
      found.map(m => m[1].trim().slice(-70)),
      [],
      file,
    );
  }
});
test('light mode is a palette, not a filter over the page', () => {
  assert.ok(!/invert\(/.test(read('../src/settings.js')));
  assert.ok(!/invert\(/.test(read('../src/a11y.css')));
});
