import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { visitorKit, colorDistance, luminance, KITS, ROAD_WHITE, FALLBACK_COLORS } from '../src/kits.js';
import { TEAM_COLORS } from '../src/teamColors.js';
import { logoSlug } from '../src/logos.js';
import { teamColors, decodePNG } from '../scripts/team-colors.mjs';

const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
test('visitors wear their own school colour, never one the Kangs could be mistaken for, with readable lettering', () => {
  const data = JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json', import.meta.url)));
  const opponents = new Set(Object.values(data.levels).flatMap(l => l.games.map(g => g.opponent)));
  for (const kit of Object.values(KITS))
    for (const o of [...opponents, 'Liberty (Renton)', 'Fictional Prep']) {
      const [jersey, ink] = visitorKit(o, kit.body);
      assert.ok(colorDistance(jersey, kit.body) >= 42, `${o} vs ${kit.body}: ${jersey}`);
      assert.ok(contrast(jersey, ink) >= 3, `${o}: lettering ${ink} on ${jersey}`);
    }
  // a school with a logo wears its colour against the Kangs purple when they do not clash
  assert.equal(visitorKit('Redmond')[0], TEAM_COLORS.redmond.primary);
  assert.equal(visitorKit('Mount Si')[0], TEAM_COLORS['mount-si'].primary);
  // Issaquah's purple clashes with the Kangs purple: road whites with purple lettering
  assert.deepEqual(visitorKit('Issaquah'), [ROAD_WHITE, TEAM_COLORS.issaquah.primary]);
  // no logo: a classic colour picked by name, the same every time
  assert.ok(FALLBACK_COLORS.includes(visitorKit('Fictional Prep', KITS.away.body)[0]));
  assert.deepEqual(visitorKit('Fictional Prep'), visitorKit('Fictional Prep'));
  // every opponent logo has its colours in the table
  for (const f of fs.readdirSync(new URL('../public/images/opponents', import.meta.url)))
    assert.ok(TEAM_COLORS[logoSlug(f.replace('.png', ''))], f);
});
test('team colours: the logo reader decodes the PNGs and picks the dominant saturated colour', () => {
  const png = decodePNG(fs.readFileSync(new URL('../public/images/opponents/redmond.png', import.meta.url)));
  assert.ok(png.width > 0 && png.data.length === png.width * png.height * 4);
  assert.deepEqual(teamColors(png), TEAM_COLORS.redmond, 'the generated table is up to date');
  // made-up pixels: mostly red, some gold, black outline, transparent background
  const px = [];
  const put = (n, c) => {
    for (let i = 0; i < n; i++) px.push(...c);
  };
  put(500, [200, 20, 30, 255]);
  put(200, [230, 190, 40, 255]); // gold, 50 degrees from the red (Newport's red and gold are 53 apart)
  put(150, [10, 10, 10, 255]);
  put(1000, [0, 0, 0, 0]);
  const c = teamColors({ data: Uint8ClampedArray.from(px) });
  assert.equal(c.primary, '#c8141e');
  assert.equal(c.secondary, '#e6be28');
});
