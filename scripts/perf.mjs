// Repeatable performance measurement of the 3D gym, at each graphics level, in three scenes a judge sees:
//   title  - the title screen (the hero's ball-handling show, the jib camera)
//   live   - a whole live possession on the Auto camera (a drive at one end, a pull-up jumper and rebound at the other)
//   replay - the replay close-up (the director's low rim camera with depth of field) around a finish
// For each: frame cost median and 95th percentile (CPU + GPU, synced, at a fixed 1/60 s step: see gym-harness.mjs), draw
// calls and triangles per frame (all passes), JS heap; per level the bytes the session downloaded (service worker
// blocked, so it is what the level itself asks for); and the size of the built JavaScript chunks.
//
//   node scripts/perf.mjs --label before          # builds dist/, measures, writes docs/perf/before.json
//   node scripts/perf.mjs --label after --no-build
//   node scripts/perf.mjs --compare before,after  # prints the markdown comparison (docs/perf-baseline.md)
//   options: --levels high,medium,low  --configs laptop,retina  --repeat 2  --dev (source server, no bytes)
// Needs Google Chrome. Frame costs are from this machine's GPU; compare runs made on the same machine.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import {
  root,
  serve,
  launch,
  fixture,
  restage,
  openGym,
  takeOver,
  fullFrame,
  toGame,
  stagePlay,
} from './gym-harness.mjs';

const argv = process.argv.slice(2),
  opt = (k, d) => {
    const i = argv.indexOf(`--${k}`);
    return i < 0 ? d : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
  };
const OUT = `${root}docs/perf`;
// laptop: a school laptop's 1366x768 screen at 1x; retina: a 13-inch MacBook window at 2x (the levels' pixel ratios differ)
const CONFIGS = { laptop: { size: [1366, 768], dpr: 1 }, retina: { size: [1440, 900], dpr: 2 } };

if (opt('table')) {
  console.log(table(JSON.parse(fs.readFileSync(`${OUT}/${opt('table')}.json`))));
  process.exit(0);
}
if (opt('compare')) {
  const [a, b] = String(opt('compare')).split(',');
  console.log(
    compare(
      JSON.parse(fs.readFileSync(`${OUT}/${a}.json`)),
      JSON.parse(fs.readFileSync(`${OUT}/${b}.json`)),
      a,
      b,
    ),
  );
  process.exit(0);
}

const label = opt('label', 'run'),
  levels = String(opt('levels', 'high,medium,low')).split(','),
  configs = String(opt('configs', 'laptop,retina')).split(','),
  repeat = +opt('repeat', 2),
  dev = !!opt('dev');
if (!dev && !opt('no-build')) execSync('npm run build', { cwd: root, stdio: 'inherit' });

const chunks = dev ? null : chunkSizes();
const srv = await serve(dev ? 'dev' : 'build'),
  browser = await launch(),
  { save, event } = fixture(),
  // the live possession: a Kangs crossover layup (made), then a visitors' pull-up jumper (missed, rebounded)
  live = restage(
    event,
    { kind: 'drive', outcome: 'made', points: 2, contest: 'contested' },
    { kind: 'pullup', outcome: 'miss', points: 0 },
  ),
  replay = restage(
    event,
    { kind: 'floater', outcome: 'made', points: 2 },
    { kind: 'pullup', outcome: 'miss', points: 0 },
  );
const result = {
  label,
  date: new Date().toISOString(),
  commit: git('rev-parse --short HEAD'),
  chunks,
  runs: {},
};
try {
  for (const cfgName of configs) {
    const cfg = CONFIGS[cfgName];
    for (const level of levels) {
      const key = `${cfgName}/${level}`,
        best = {};
      let bytes = null;
      for (let r = 0; r < repeat; r++) {
        const net = new Map();
        const { page, context, errors } = await openGym(browser, srv.url, {
          level,
          save,
          size: cfg.size,
          dpr: cfg.dpr,
          before: async (p, ctx) => {
            const cdp = await ctx.newCDPSession(p);
            await cdp.send('Network.enable');
            const urls = new Map();
            cdp.on('Network.responseReceived', e => urls.set(e.requestId, e.response.url));
            cdp.on('Network.loadingFinished', e => {
              const u = urls.get(e.requestId);
              if (u) net.set(u, (net.get(u) || 0) + e.encodedDataLength);
            });
          },
        });
        await fullFrame(page);
        await page.addStyleTag({ content: '.perf-hud{display:none!important}' });
        await takeOver(page);
        // title: 1 s to settle (the hero walks in), then 5 s
        await page.evaluate(() => __gym.step(60));
        const title = await page.evaluate(() => __gym.measure(300));
        // live: the whole possession (both plays and the run between them), 10 s
        await toGame(page, null);
        await fullFrame(page);
        await stagePlay(page, live, { mode: 'auto' });
        const liveStats = await page.evaluate(() => __gym.measure(600));
        // replay close-up: into the finish of the first play, on the director's rim camera
        await stagePlay(page, replay, { replay: true, mode: 'auto' });
        await page.evaluate(() =>
          __gym.until(
            a =>
              !a.transit && a.playTime > 4.4 * 0.62 && (!a.look?.active || a.director.shot === 'replayClose'),
          ),
        );
        const replayStats = await page.evaluate(() => ({
          ...__gym.measure(60),
          shot: window.__kangsArena.director.shot,
        }));
        await page.waitForLoadState('networkidle');
        for (const [name, s] of [
          ['title', title],
          ['live', liveStats],
          ['replay', replayStats],
        ])
          if (!best[name] || s.medianMs < best[name].medianMs) best[name] = s;
        if (errors.length) console.warn(`${key}: page errors\n  ${errors.join('\n  ')}`);
        if (!bytes) bytes = byteSummary(net, srv.url);
        await context.close();
      }
      result.runs[key] = { ...best, bytes };
      console.log(
        `${key.padEnd(15)} title ${fmt(best.title)} | live ${fmt(best.live)} | replay ${fmt(best.replay)} | ${(bytes.total / 1e6).toFixed(2)} MB`,
      );
    }
  }
} finally {
  await browser.close();
  await srv.close();
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/${label}.json`, JSON.stringify(result, null, 1) + '\n');
console.log(`Wrote docs/perf/${label}.json`);

function fmt(s) {
  return `${s.medianMs.toFixed(1)}/${s.p95Ms.toFixed(1)} ms ${s.calls} dc ${(s.triangles / 1e6).toFixed(2)}M`;
}
function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: root }).toString().trim();
  } catch {
    return '';
  }
}
function chunkSizes() {
  const dir = `${root}dist/assets`,
    js = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  const list = js.map(f => {
    const b = fs.readFileSync(`${dir}/${f}`);
    return { file: f, bytes: b.length, gzip: zlib.gzipSync(b, { level: 9 }).length };
  });
  list.sort((a, b) => b.bytes - a.bytes);
  const main = list.find(c => /^index-/.test(c.file));
  return { main, all: list, totalJs: list.reduce((s, c) => s + c.bytes, 0) };
}
function byteSummary(net, base) {
  const cat = u => {
    const p = u.replace(base, '/');
    if (p.includes('/models/players/maps/')) return 'playerMaps';
    if (p.includes('/models/players/')) return 'playerModels';
    if (p.includes('/models/')) return 'props';
    if (/\.js(\?|$)/.test(p)) return 'js';
    if (/\.css(\?|$)/.test(p)) return 'css';
    if (/\.(woff2?|ttf)(\?|$)/.test(p)) return 'fonts';
    if (/\.(png|jpe?g|webp|svg|ktx2)(\?|$)/.test(p)) return 'images';
    if (/\.json(\?|$)/.test(p)) return 'data';
    return 'other';
  };
  const out = { total: 0 };
  for (const [u, b] of net) {
    const c = cat(u);
    out[c] = (out[c] || 0) + b;
    out.total += b;
  }
  return out;
}
function table(A) {
  const rows = [
    '| config / level | scene | frame median ms | p95 ms | draw calls | triangles | heap MB |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const [key, r] of Object.entries(A.runs))
    for (const scene of ['title', 'live', 'replay'])
      rows.push(
        `| ${key} | ${scene} | ${r[scene].medianMs.toFixed(1)} | ${r[scene].p95Ms.toFixed(1)} | ${r[scene].calls} | ${(r[scene].triangles / 1e6).toFixed(2)}M | ${r[scene].heapMB?.toFixed(0)} |`,
      );
  rows.push(
    '',
    '| config / level | downloaded MB | player maps MB | player models MB | JS MB |',
    '|---|---|---|---|---|',
  );
  const mb = v => ((v || 0) / 1e6).toFixed(2);
  for (const [key, r] of Object.entries(A.runs))
    rows.push(
      `| ${key} | ${mb(r.bytes.total)} | ${mb(r.bytes.playerMaps)} | ${mb(r.bytes.playerModels)} | ${mb(r.bytes.js)} |`,
    );
  if (A.chunks)
    rows.push(
      '',
      `Main chunk ${A.chunks.main.file}: ${(A.chunks.main.bytes / 1e3).toFixed(0)} kB (${(A.chunks.main.gzip / 1e3).toFixed(0)} kB gzip). All JS: ${(A.chunks.totalJs / 1e6).toFixed(2)} MB.`,
    );
  return rows.join('\n');
}
function compare(A, B, a, b) {
  const pct = (x, y) => (x ? `${(((y - x) / x) * 100).toFixed(0)}%` : '');
  const rows = [];
  rows.push(
    `| config / level | scene | frame median ms (${a} → ${b}) | p95 ms | draw calls | triangles | heap MB |`,
  );
  rows.push('|---|---|---|---|---|---|---|');
  for (const key of Object.keys(A.runs))
    for (const scene of ['title', 'live', 'replay']) {
      const x = A.runs[key]?.[scene],
        y = B.runs[key]?.[scene];
      if (!x || !y) continue;
      rows.push(
        `| ${key} | ${scene} | ${x.medianMs.toFixed(1)} → ${y.medianMs.toFixed(1)} (${pct(x.medianMs, y.medianMs)}) | ${x.p95Ms.toFixed(1)} → ${y.p95Ms.toFixed(1)} | ${x.calls} → ${y.calls} | ${(x.triangles / 1e6).toFixed(2)}M → ${(y.triangles / 1e6).toFixed(2)}M | ${x.heapMB?.toFixed(0)} → ${y.heapMB?.toFixed(0)} |`,
      );
    }
  rows.push(
    '',
    `| config / level | downloaded MB (${a} → ${b}) | player maps MB | player models MB | JS MB |`,
    '|---|---|---|---|---|',
  );
  for (const key of Object.keys(A.runs)) {
    const x = A.runs[key]?.bytes,
      y = B.runs[key]?.bytes;
    if (!x || !y) continue;
    const mb = v => ((v || 0) / 1e6).toFixed(2);
    rows.push(
      `| ${key} | ${mb(x.total)} → ${mb(y.total)} (${pct(x.total, y.total)}) | ${mb(x.playerMaps)} → ${mb(y.playerMaps)} | ${mb(x.playerModels)} → ${mb(y.playerModels)} | ${mb(x.js)} → ${mb(y.js)} |`,
    );
  }
  if (A.chunks && B.chunks) {
    const k = c => `${(c.bytes / 1e3).toFixed(0)} kB (${(c.gzip / 1e3).toFixed(0)} kB gzip)`;
    rows.push(
      '',
      `Main chunk: ${k(A.chunks.main)} → ${k(B.chunks.main)}. All JS: ${(A.chunks.totalJs / 1e6).toFixed(2)} MB → ${(B.chunks.totalJs / 1e6).toFixed(2)} MB.`,
    );
  }
  return rows.join('\n');
}
