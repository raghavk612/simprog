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
    k => !light.has(k) && !['--purple', '--deep', '--muted', '--border'].includes(k),
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
test('no fading gradients: only flat colour blocks on jerseys, the whiteboard tray, the timing ruler and the high-contrast stripes', () => {
  const allowed = /\.shirt|\.mb-|\.timing-bar|a11y-high-contrast/;
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
test('light mode is a palette, not a filter over the page', () => {
  assert.ok(!/invert\(/.test(read('../src/settings.js')));
  assert.ok(!/invert\(/.test(read('../src/a11y.css')));
});
