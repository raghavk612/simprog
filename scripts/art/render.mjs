// node render.mjs jobs.json  → writes the PNGs listed in the jobs (each job's `out`, relative to where it runs)
// Renders with the installed Google Chrome through playwright-core (no browser download), as scripts/ui-check.mjs does.
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const b = await chromium.launch({
  channel: 'chrome',
  args: [
    '--allow-file-access-from-files',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const p = await b.newPage();
p.on('console', m => console.log('page:', m.text()));
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(new URL('./render.html', import.meta.url).href);
await p.waitForFunction(() => window.ready);
for (const j of jobs) {
  const url = await p.evaluate(o => window.renderAsset(o), j);
  fs.writeFileSync(j.out, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', j.out);
}
await b.close();
