// node render.mjs job.json  → writes PNGs listed in the job
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const b = await chromium.launch({
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
await p.goto('file:///home/claude/kangs-render/render.html');
await p.waitForFunction(() => window.ready);
for (const j of jobs) {
  const url = await p.evaluate(o => window.renderAsset(o), j);
  fs.writeFileSync(j.out, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', j.out);
}
await b.close();
