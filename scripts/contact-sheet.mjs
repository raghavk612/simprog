// Contact sheets of the players as the game draws them: real plays staged in the gym (the same arena, bodies, motion and
// broadcast look a judge sees), stepped at a fixed 1/60 s, and captured from fixed cameras at fixed moments. One PNG per
// motion category, plus close-ups (replay camera, orbit zoom on face, hands, trim) and a 1:1 crop for anti-aliasing.
//
//   node scripts/contact-sheet.mjs --out docs/sheets/before           # every sheet
//   node scripts/contact-sheet.mjs --out ui-shots/sheets --only finishes,closeups
//   options: --level high|medium|low  --players athletes|classic
// Sheets: finishes, jumpers, passes, defense, locomotion, reactions, broadcast, closeups, aa.
// Each row is one play (or one player in it) seen from one camera; columns are moments (seconds into the play).
// The ball-handling moves of the title screen have their own sheets: npm run moves:sheet.
import fs from 'node:fs';
import path from 'node:path';
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
} from './gym-harness.mjs';
import { sampleClip, shotTiming, blockHit, CLIP_SECONDS, SHOTS } from '../src/basketball.js';

const argv = process.argv.slice(2),
  opt = (k, d) => {
    const i = argv.indexOf(`--${k}`);
    return i < 0 ? d : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
  };
const outDir = path.resolve(root, opt('out', 'ui-shots/sheets')),
  only = opt('only') ? String(opt('only')).split(',') : null,
  level = opt('level', 'high'),
  players = opt('players', 'athletes'),
  look = opt('look') ? JSON.parse(opt('look')) : null; // --look '{"aa":"smaa"}': a broadcast-look override
fs.mkdirSync(outDir, { recursive: true });

const S = CLIP_SECONDS;
/* Plays: [home, away] overrides of the fixture possession. clip 0 is the home play, clip 1 the visitors'. */
const HOME = (kind, o = {}) => [
  { kind, outcome: 'made', points: SHOTS[kind]?.three ? 3 : 2, contest: 'contested', lane: 1, ...o },
  { kind: 'pullup', outcome: 'miss', points: 0, lane: -1, contest: 'contested' },
];
/* Moments of a shot (seconds): approach, gather, takeoff, release, top of the fall, landing. */
function shotMoments(kind) {
  const T = shotTiming(kind),
    s = x => +(x * S).toFixed(3);
  return [
    s(T.gather - 0.1),
    s(T.gather + 0.04),
    s(T.takeoff),
    s(T.release),
    s((T.release + T.land) / 2),
    s(T.land + 0.04),
  ];
}
const even = (a, b, n = 6) => Array.from({ length: n }, (_, i) => +(a + ((b - a) * i) / (n - 1)).toFixed(3));
/* The camera for a row: it keeps a fixed offset from the subject (so he stays the same size in every moment and his
   travel shows against the floor), from the side of his travel or facing, turned `angle` degrees toward his front. The
   direction is the one nearest that, among 24 round him, that keeps every other player out of the lens and off the line
   of sight at all the row's moments and stays inside the gym. fixed: the camera stays put instead (aimed at the middle). */
const FOV = 43;
function sideCam(
  clip,
  idx,
  moments,
  { dist = 4.6, height = 1.45, angle = 25, aimY = 1.05, fixed = false } = {},
) {
  const S = moments.map(m => sampleClip(clip, m).actors),
    at = S.map(A => A[idx]),
    travel = [at.at(-1).x - at[0].x, at.at(-1).z - at[0].z],
    moved = Math.hypot(...travel),
    mid = at[Math.floor(at.length / 2)],
    fwd = moved > 1 ? [travel[0] / moved, travel[1] / moved] : [Math.sin(mid.yaw), Math.cos(mid.yaw)],
    r = (angle * Math.PI) / 180;
  let best = null;
  for (let k = 0; k < 24; k++) {
    const th = (k / 24) * Math.PI * 2,
      u = [Math.cos(th), Math.sin(th)],
      // how far from the wanted side (either side), plus a small preference for the broadcast (+z) side
      ideal = Math.max(
        ...[1, -1].map(sg => {
          const w = [
            fwd[1] * sg * Math.cos(r) + fwd[0] * Math.sin(r),
            -fwd[0] * sg * Math.cos(r) + fwd[1] * Math.sin(r),
          ];
          return u[0] * w[0] + u[1] * w[1];
        }),
      );
    let pen = (1 - ideal) * 3 - (u[1] > 0 ? 0.3 : 0);
    S.forEach((A, mi) => {
      const p = at[mi],
        c = [p.x + u[0] * dist, p.z + u[1] * dist];
      if (Math.abs(c[0]) > 14.6 || Math.abs(c[1]) > 7.9) pen += 2;
      A.forEach((o, j) => {
        if (j === idx) return;
        const dc = Math.hypot(o.x - c[0], o.z - c[1]);
        if (dc < 1.6) pen += 4;
        // on the line of sight: between the camera and him, close to the line
        const vx = p.x - c[0],
          vz = p.z - c[1],
          L = Math.hypot(vx, vz),
          tt = ((o.x - c[0]) * vx + (o.z - c[1]) * vz) / (L * L);
        if (tt > 0.05 && tt < 0.9) {
          const q = Math.hypot(c[0] + vx * tt - o.x, c[1] + vz * tt - o.z);
          if (q < 0.6) pen += 1.5 * (1 - q / 0.6);
        }
      });
    });
    if (!best || pen < best.pen) best = { pen, u };
  }
  const off = [best.u[0] * dist, height - aimY, best.u[1] * dist];
  if (fixed) {
    const xs = at.map(a => a.x),
      zs = at.map(a => a.z),
      c = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
    return { position: [c[0] + off[0], height, c[1] + off[2]], target: [c[0], aimY, c[1]] };
  }
  return { follow: true, offset: off, aimY };
}
const clipOf = (plays, i, base) => ({ ...base.plays[i], ...plays[i] });

function sheets(base) {
  const row = (label, plays, clipIndex, subject, moments, cam = null, extra = {}) => {
    const clip = clipOf(plays, clipIndex, base);
    return {
      label,
      plays,
      clipIndex,
      subject,
      moments,
      camera: cam === 'director' ? 'director' : sideCam(clip, subject, moments, cam || {}),
      ...extra,
    };
  };
  const finish = (label, kind, o = {}, cam = {}) => row(label, HOME(kind, o), 0, 0, shotMoments(kind), cam);
  const out = {};
  out.finishes = [
    finish('Layup (drive)', 'drive'),
    finish('Euro step', 'euro'),
    finish('Floater', 'floater'),
    finish('Hook', 'hook'),
    finish('Spin move', 'spin'),
    finish('Dunk (fast break)', 'dunk', {}, { dist: 5.4, aimY: 1.4 }),
    finish('Alley-oop', 'alley', {}, { dist: 5.4, aimY: 1.4 }),
    finish('Pick-and-roll finish', 'roll'),
    // the putback: the shooting team wins the loose ball after a block and goes straight back up (an offense actor)
    (() => {
      const plays = HOME('pullup', { outcome: 'block', points: 0, recovery: 'offense', putback: 'made' }),
        clip = clipOf(plays, 0, base),
        // the player who wins the loose ball goes up with it (his arms go to 'shoot' for the putback)
        who =
          [1, 2, 3, 4].find(k =>
            [0.8, 0.85, 0.9].some(t => sampleClip(clip, t * S).actors[k].arms === 'shoot'),
          ) ?? 1;
      return row('Putback (after a block)', plays, 0, who, even(blockHit('pullup') * S + 0.3, 0.995 * S), {});
    })(),
  ];
  out.jumpers = ['pullup', 'catch', 'stepback', 'fadeaway', 'corner'].map(k =>
    finish(SHOTS[k].label, k, k === 'catch' || k === 'corner' ? { assisted: true } : {}),
  );
  out.passes = [
    row('Pass (catch play: the passer)', HOME('catch'), 0, 1, even(0, 1.3), {}),
    row('Catch (catch play: the receiver)', HOME('catch'), 0, 0, even(0.9, 1.7), {}),
    row('Outlet pass (dunk: the passer)', HOME('dunk'), 0, 1, even(0, 0.9), {}),
    row(
      'Steal (the defender reaches and takes it)',
      HOME('euro', { outcome: 'steal', points: 0 }),
      0,
      5,
      even(0.25 * S, 0.5 * S),
      {},
    ),
  ];
  out.defense = [
    row('On-ball defender (drive)', HOME('drive'), 0, 5, even(0.08 * S, 0.5 * S), { angle: 60 }),
    row('Help defender (drive)', HOME('drive'), 0, 7, even(0.1 * S, 0.7 * S), { angle: 40 }),
    row('Contest (pull-up)', HOME('pullup'), 0, 5, shotMoments('pullup'), { angle: 50 }),
    row(
      'Block',
      HOME('pullup', { outcome: 'block', points: 0, recovery: 'defense' }),
      0,
      5,
      even(blockHit('pullup') * S - 0.35, blockHit('pullup') * S + 0.4),
      { angle: 50 },
    ),
    row('Rebound (miss)', HOME('pullup', { outcome: 'miss', points: 0 }), 0, 9, even(0.78 * S, 1.0 * S), {}),
    row('Screen (pick-and-roll)', HOME('roll'), 0, 1, even(0.1 * S, 0.6 * S), { angle: 50 }),
  ];
  out.locomotion = [
    row('Sprint (fast break)', HOME('dunk'), 0, 0, even(0.6, 1.1), { angle: 5 }),
    row('Run (drive approach)', HOME('drive'), 0, 0, even(0.6, 1.1), { angle: 5 }),
    row('Jog (off-ball cutter)', HOME('drive'), 0, 2, even(1.5, 2.0), { angle: 5 }),
    row('Spot-up / idle (off-ball)', HOME('drive'), 0, 3, even(0.5, 3.0), { angle: 30 }),
    row('Defensive slide (help)', HOME('drive'), 0, 8, even(1.0, 2.5), { angle: 30 }),
    row(
      'Transition run (to the other end)',
      HOME('drive'),
      1,
      3,
      even(0.0, 0.5),
      { angle: 10 },
      { transit: true },
    ),
  ];
  // reactions right after the play is decided (src/reactions.js), close on the player who reacts
  const after = kind => even(shotTiming(kind).release * S + (SHOTS[kind].three ? 0.85 : 0.55), 4.38);
  out.reactions = [
    row('Made three: the arm goes up', HOME('catch', { assisted: true }), 0, 0, after('catch'), {
      dist: 4.2,
      angle: 35,
    }),
    row('Assisted three: the passer claps', HOME('catch', { assisted: true }), 0, 1, after('catch'), {
      dist: 4.2,
      angle: 35,
    }),
    row('Dunk: the flex', HOME('dunk'), 0, 0, even(3.95, 4.38), { dist: 4.6, angle: 30 }),
    row('Scored on: hands on hips', HOME('pullup'), 0, 5, after('pullup'), { dist: 4.2, angle: 40 }),
    row('Miss: a shake of the head', HOME('pullup', { outcome: 'miss', points: 0 }), 0, 0, after('pullup'), {
      dist: 4.2,
      angle: 35,
    }),
  ];
  out.broadcast = [
    row('Auto camera, live: drive', HOME('drive'), 0, 0, even(0.3, 4.3), 'director', { mode: 'auto' }),
    row('Auto camera, live: visitors pull-up', HOME('drive'), 1, 5, even(0.3, 4.3), 'director', {
      mode: 'auto',
    }),
  ];
  out.closeups = [
    row(
      'Replay close-up (director rim camera)',
      HOME('floater'),
      0,
      0,
      even(0.6 * S, 0.84 * S, 3),
      'director',
      { mode: 'auto', replay: true, big: true },
    ),
    row(
      'Orbit zoom: face and dribble hand',
      HOME('drive'),
      0,
      0,
      [0.5, 0.9, 1.2],
      { dist: 1.9, angle: 70, height: 1.6, aimY: 1.35 },
      { big: true },
    ),
    row(
      'Orbit zoom: hands on the ball at the gather',
      HOME('pullup'),
      0,
      0,
      (m => [m[1], m[2], m[3]])(shotMoments('pullup')),
      { dist: 1.8, angle: 60, height: 1.9, aimY: 1.7 },
      { big: true },
    ),
    row(
      'Orbit zoom: jersey trim, shorts hem, legs',
      HOME('drive'),
      0,
      0,
      [0.4, 0.8, 1.6],
      { dist: 2.2, angle: 35, height: 1.1, aimY: 0.9 },
      { big: true },
    ),
    row(
      'Orbit zoom: defender up close',
      HOME('drive'),
      0,
      5,
      [0.6, 1.0, 1.4],
      { dist: 2.2, angle: 60, height: 1.5, aimY: 1.2 },
      { big: true },
    ),
  ];
  out.aa = [
    row('Broadcast wide, 1:1 pixels (aliasing check)', HOME('drive'), 0, 0, [1.2], 'director', {
      mode: 'auto',
      crop: true,
    }),
  ];
  return out;
}

const srv = await serve('dev'),
  browser = await launch(),
  { save, event } = fixture(),
  all = sheets(event);
try {
  for (const [name, rows] of Object.entries(all)) {
    if (only && !only.includes(name)) continue;
    const big = rows.some(r => r.big) || rows.some(r => r.crop),
      size = big ? [800, 600] : [640, 480];
    const { page, context, errors } = await openGym(browser, srv.url, {
      level,
      players,
      save,
      size,
      dpr: 1,
      look,
    });
    await page.addStyleTag({ content: '.perf-hud{display:none!important}' });
    await fullFrame(page);
    await takeOver(page);
    await toGame(page, null);
    await fullFrame(page);
    const png = await page.evaluate(
      async ({ rows, base, name, big }) => {
        const a = window.__kangsArena,
          g = window.__gym,
          src = a.renderer.domElement,
          cw = big ? src.width : src.width / 2,
          ch = big ? src.height : src.height / 2,
          crop = rows[0].crop,
          cols = Math.max(...rows.map(r => r.moments.length)),
          LH = 26,
          RH = 30,
          sheet = document.createElement('canvas');
        sheet.width = (crop ? 1 : cols) * cw;
        sheet.height = rows.length * (ch + RH + LH);
        const x = sheet.getContext('2d');
        x.fillStyle = '#0d0a16';
        x.fillRect(0, 0, sheet.width, sheet.height);
        x.font = '600 18px system-ui, sans-serif';
        rows.forEach((r, ri) => {
          const e = { ...base, plays: base.plays.map((p, i) => ({ ...p, ...r.plays[i] })) };
          a.clear();
          a.setView(r.mode || 'court');
          a.userMoved = true;
          a.play(e, { replay: !!r.replay });
          a.speed = 1;
          g.setDt(1 / 60);
          const clipStart = r.clipIndex * 4.4;
          // run into the play: through any run to the starting spots, to the play (clip) asked for; a transit row starts
          // when the run between the two plays does
          a.controls.maxPolarAngle = Math.PI * 0.499; // the sheet's low, close cameras (the game keeps its own limits)
          a.controls.minDistance = 0.5;
          g.until(
            x =>
              r.transit
                ? x.clipIndex === 1
                : !x.transit && x.playTime >= clipStart && x.clipIndex === r.clipIndex,
            3000,
          );
          const y0 = ri * (ch + RH + LH);
          x.fillStyle = '#e9e4ff';
          x.fillText(r.label, 8, y0 + 20);
          r.moments.forEach((m, mi) => {
            if (r.transit) {
              // the run between the two plays: the play clock waits, so step by wall time from its start
              const n = Math.round((m - (mi ? r.moments[mi - 1] : 0)) * 60);
              if (n > 0) g.until(() => false, n);
            } else g.until(x => !x.transit && x.playTime >= clipStart + m, 3000);
            if (r.camera?.follow) {
              const p = a.people[r.subject].position,
                o = r.camera.offset;
              a.camera.position.set(p.x + o[0], r.camera.aimY + o[1], p.z + o[2]);
              a.controls.target.set(p.x, r.camera.aimY, p.z);
              a.controls.update();
            } else if (r.camera !== 'director') {
              a.camera.position.set(...r.camera.position);
              a.controls.target.set(...r.camera.target);
              a.controls.update();
            }
            // the capture: one more frame with no time passing. A frame that comes out all black (the broadcast look's
            // NaN flash, fixed in src/materials.js) is drawn again and the cell is marked with *
            const gl = a.renderer.getContext(),
              px = new Uint8Array(4),
              black = () => {
                let n = 0;
                for (const [u, v] of [
                  [0.5, 0.5],
                  [0.2, 0.8],
                  [0.8, 0.2],
                  [0.5, 0.15],
                ]) {
                  gl.readPixels(
                    (src.width * u) | 0,
                    (src.height * v) | 0,
                    1,
                    1,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    px,
                  );
                  if (px[0] + px[1] + px[2] === 0) n++;
                }
                return n === 4;
              };
            g.setDt(0);
            let tries = 0;
            do a.frame();
            while (black() && ++tries < 6);
            g.setDt(1 / 60);
            const cx = (crop ? 0 : mi) * cw,
              cy = y0 + LH;
            if (crop) {
              // the middle of the frame at 1:1, where the players are
              x.drawImage(src, (src.width - cw) / 2, (src.height - ch) / 2, cw, ch, cx, cy, cw, ch);
            } else x.drawImage(src, 0, 0, src.width, src.height, cx, cy, cw, ch);
            x.fillStyle = '#b8b0d8';
            x.font = '500 15px system-ui, sans-serif';
            x.fillText(
              `${m.toFixed(2)} s${r.camera === 'director' ? ` · ${a.director?.shot || a.autoShot || ''}` : ''}${tries ? ' *' : ''}`,
              cx + 8,
              cy + ch + 20,
            );
            x.font = '600 18px system-ui, sans-serif';
          });
        });
        return sheet.toDataURL('image/png');
      },
      { rows, base: event, name, big },
    );
    const file = path.join(outDir, `${name}.png`);
    fs.writeFileSync(file, Buffer.from(png.split(',')[1], 'base64'));
    if (errors.length) console.warn(`${name}: page errors\n  ${errors.join('\n  ')}`);
    console.log(`Sheet: ${path.relative(root, file)} (${rows.length} rows)`);
    await context.close();
  }
} finally {
  await browser.close();
  await srv.close();
}
