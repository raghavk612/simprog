// Live captures of the players as a person sees them: Game day opened through the real UI (title -> Continue -> the game's
// own replay path, scripts/gym-harness.mjs toGame), a possession staged in the gym, stepped at a fixed 1/60 s. 14 captures per
// level and screen size:
//   auto-0.8 ... auto-7.6   the whole page with the Auto camera (the broadcast view) at fixed moments of the play
//   face-handler, body-handler, feet   close cameras on the ball handler (home 0)
//   defender-front          the on-ball defender (home 5) seen from the front
//   group                   the handler and his defender from further back
//   shot-release            a pull-up shooter at the release
//   reaction                a made, assisted three a second after the ball goes in
//   visitor-face, visitor-group   the visitors' player (clip 1, subject 5), close and with the nearest defender
//
//   node scripts/players-shots.mjs                                  # medium and low, desktop and phone: 56 PNGs
//   node scripts/players-shots.mjs --levels medium --sizes phone --out ui-shots/players-x --only feet,auto-2.2
//   options: --levels medium,low  --sizes desktop,phone  --out ui-shots/players-live  --only name,name  --no-fast
// Files: <out>/<level>-<size>-<name>.png. desktop is 1440x900, phone 390x844 at 2x. Frames between the captured moments
// are simulated but not drawn (like contact-sheet --fast); --no-fast draws all of them. Use flock /tmp/kangs-browser.lock
// when another job shares the machine, and --levels medium,low here (High does not draw under llvmpipe).
import fs from 'node:fs';
import path from 'node:path';
import { root, serve, launch, fixture, openGym, takeOver, toGame, forceLevel } from './gym-harness.mjs';
import { sampleClip, shotTiming, SHOTS } from '../src/basketball.js';
import { S, HOME, shotMoments, sideCam } from './sheet-cams.mjs';

const argv = process.argv.slice(2),
  opt = (k, d) => {
    const i = argv.indexOf(`--${k}`);
    return i < 0 ? d : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
  },
  list = (k, d) => String(opt(k, d)).split(','),
  levels = list('levels', 'medium,low'),
  sizes = list('sizes', 'desktop,phone'),
  only = opt('only') ? list('only') : null,
  fast = !argv.includes('--no-fast'),
  outDir = path.resolve(root, opt('out', 'ui-shots/players-live'));
const SIZES = { desktop: { size: [1440, 900], dpr: 1 }, phone: { size: [390, 844], dpr: 2 } },
  AUTO = [0.8, 2.2, 3.6, 5.9, 7.6]; // seconds of the possession (two plays of 4.4 s)
fs.mkdirSync(outDir, { recursive: true });

/* The close shots: the plays, the clip and subject they look at, the moment (seconds into that clip) and the camera. */
function closeShots(base) {
  const at = (plays, ci) => ({ ...base.plays[ci], ...plays[ci] }),
    cam = (plays, ci, subject, m, o) => sideCam(at(plays, ci), subject, [m], o),
    drive = HOME('drive'),
    pull = HOME('pullup'),
    three = HOME('catch', { assisted: true }),
    // a camera that keeps the subject and the nearest player of the other side in frame
    group = (plays, ci, subject, m, o) => {
      const A = sampleClip(at(plays, ci), m).actors,
        me = A[subject],
        near = A.filter((_, k) => k < 5 !== subject < 5).sort(
          (p, q) => Math.hypot(p.x - me.x, p.z - me.z) - Math.hypot(q.x - me.x, q.z - me.z),
        )[0];
      return sideCam(at(plays, ci), subject, [m], { ...o, fixed: true, include: [near.x, near.z] });
    },
    shot = (name, plays, clipIndex, subject, m, camera) => ({ name, plays, clipIndex, subject, m, camera });
  const release = shotMoments('pullup')[3],
    after = Math.min(4.38, shotTiming('catch').release * S + (SHOTS.catch.three ? 0.85 : 0.55) + 0.5);
  return [
    shot(
      'face-handler',
      drive,
      0,
      0,
      1.2,
      cam(drive, 0, 0, 1.2, { dist: 1.9, angle: 70, height: 1.6, aimY: 1.35 }),
    ),
    shot(
      'body-handler',
      drive,
      0,
      0,
      1.0,
      cam(drive, 0, 0, 1.0, { dist: 3.2, angle: 40, height: 1.3, aimY: 1.0 }),
    ),
    shot('feet', drive, 0, 0, 1.2, cam(drive, 0, 0, 1.2, { dist: 1.7, angle: 40, height: 0.5, aimY: 0.25 })),
    shot(
      'defender-front',
      drive,
      0,
      5,
      1.0,
      cam(drive, 0, 5, 1.0, { dist: 2.4, angle: 50, height: 1.5, aimY: 1.2, face: true }),
    ),
    shot('group', drive, 0, 0, 1.0, group(drive, 0, 0, 1.0, { dist: 6, height: 2.2, aimY: 1.0 })),
    shot(
      'shot-release',
      pull,
      0,
      0,
      release,
      cam(pull, 0, 0, release, { dist: 3.5, angle: 40, height: 1.6, aimY: 1.4 }),
    ),
    shot('reaction', three, 0, 0, after, cam(three, 0, 0, after, { dist: 4.2, angle: 35 })),
    shot(
      'visitor-face',
      drive,
      1,
      5,
      0.8,
      cam(drive, 1, 5, 0.8, { dist: 1.9, angle: 60, height: 1.6, aimY: 1.4, face: true }),
    ),
    shot('visitor-group', drive, 1, 5, 1.0, group(drive, 1, 5, 1.0, { dist: 6, height: 2.2, aimY: 1.0 })),
  ];
}

const srv = await serve('dev'),
  browser = await launch(),
  { save, event } = fixture(),
  closes = closeShots(event);
let written = 0;
const t0 = Date.now();
try {
  for (const level of levels)
    for (const sz of sizes) {
      const { size, dpr } = SIZES[sz];
      if (!size) throw Error(`unknown size ${sz}`);
      const names = [...AUTO.map(t => `auto-${t}`), ...closes.map(c => c.name)].filter(
          n => !only || only.includes(n),
        ),
        { page, context, errors } = await openGym(browser, srv.url, {
          level,
          players: 'athletes',
          save,
          size,
          dpr,
        });
      if (!names.length) {
        await context.close();
        continue;
      }
      await page.addStyleTag({ content: '.perf-hud{display:none!important}' });
      await takeOver(page);
      await toGame(page, null);
      await forceLevel(page, level);
      /* one more frame with no time passing, drawn, then the picture */
      const grab = async (name, whole) => {
        // drawn and copied in the same task: a WebGL canvas reads back black once the frame has been presented
        const url = await page.evaluate(() => {
          const a = window.__kangsArena,
            g = window.__gym,
            src = a.renderer.domElement,
            c = document.createElement('canvas');
          g.setDt(0);
          a.frame();
          g.setDt(1 / 60);
          c.width = src.width;
          c.height = src.height;
          c.getContext('2d').drawImage(src, 0, 0);
          return c.toDataURL('image/png');
        });
        const file = path.join(outDir, `${level}-${sz}-${name}.png`);
        if (whole) await page.screenshot({ path: file });
        else fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
        written++;
        console.log(`${path.relative(root, file)}`);
      };
      // the Auto camera, the whole page: one possession, captured at fixed moments
      if (AUTO.some(t => names.includes(`auto-${t}`))) {
        await page.evaluate(e => {
          const a = window.__kangsArena;
          a.clear();
          a.setView('auto');
          a.play(e, { replay: false });
          a.speed = 1;
          window.__gym.setDt(1 / 60);
        }, event);
        for (const t of AUTO) {
          await page.evaluate(([t, fast]) => window.__gym.until(x => x.playTime >= t, 3000, fast), [t, fast]);
          if (names.includes(`auto-${t}`)) await grab(`auto-${t}`, true);
        }
      }
      // the close cameras on one player, the canvas only
      for (const c of closes.filter(c => names.includes(c.name))) {
        await page.evaluate(
          ([e, c, fast]) => {
            const a = window.__kangsArena,
              g = window.__gym,
              ev = { ...e, plays: e.plays.map((p, i) => ({ ...p, ...c.plays[i] })) };
            a.clear();
            a.setView('court');
            a.userMoved = true;
            a.play(ev, { replay: false });
            a.speed = 1;
            g.setDt(1 / 60);
            a.controls.maxPolarAngle = Math.PI * 0.499;
            a.controls.minDistance = 0.5;
            const start = c.clipIndex * 4.4;
            g.until(x => !x.transit && x.playTime >= start && x.clipIndex === c.clipIndex, 3000, fast);
            g.until(x => !x.transit && x.playTime >= start + c.m, 3000, fast);
            if (c.camera.follow) {
              const p = a.people[c.subject].position,
                o = c.camera.offset;
              a.camera.position.set(p.x + o[0], c.camera.aimY + o[1], p.z + o[2]);
              a.controls.target.set(p.x, c.camera.aimY, p.z);
            } else {
              a.camera.position.set(...c.camera.position);
              a.controls.target.set(...c.camera.target);
            }
            a.controls.update();
          },
          [event, c, fast],
        );
        await grab(c.name, false);
      }
      if (errors.length) console.warn(`${level}-${sz}: page errors\n  ${errors.join('\n  ')}`);
      await context.close();
    }
} finally {
  await browser.close();
  await srv.close();
}
console.log(
  `${written} captures in ${((Date.now() - t0) / 1000).toFixed(0)} s -> ${path.relative(root, outDir)}`,
);
