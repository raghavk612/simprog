// Who is on the floor (Arena methods, mixed into Arena.prototype by src/arena.js: `this` is the Arena). Ten player groups
// (people; 0-4 the Kangs, 5-9 the visitors) each carry a body from src/players.js, classic figures or the rigged athletes
// per the Players setting and graphics level (applyPlayers, styleBody), dressed as a person (setIdentity): kit colours,
// name and number, captain's badge, socks and shoes, and the body, height, skin and face that person has wherever he is
// drawn.
// Contract with the rest of the gym: a player's identity is p.userData.identity, a key whose first field is the person's
// id (cast() keeps a body on the person who wears it when a play re-orders people); p.userData.person and p.userData.slot
// say who and which slot; bodies are swapped, never re-dressed per frame. updateLods picks each athlete's level of detail
// from his size on screen.
import * as THREE from 'three';
import { boardGame } from '../scoreboard.js';
import { oppRoster } from '../engine.js';
import { visitorCast, rosterRecord } from '../identities.js';
import { arenaPlayers, bodyPixels, lodFor } from '../graphics.js';
import { gymColors, visitorKit, homeFeet, visitorFeet } from '../kits.js';
import {
  classicBody,
  attachBody,
  disposeBody,
  validBody,
  athleteBody,
  lookFor,
  lookKey,
  loadAthletes,
  bodyFor,
  personSeed,
  feetFor,
  CLASSIC_SKIN,
} from '../players.js';
import { KANGS_PURPLE } from '../kits.js';

export const castMethods = {
  player(i, color) {
    const g = new THREE.Group();
    g.userData.slot = i;
    attachBody(g, classicBody(this.bodyKit(), i, color));
    return g;
  },
  /* What a body builder needs from the Arena: the shared material style, crisp canvas text and the captain badge. */
  bodyKit() {
    return (this.kit ??= {
      mat: (c, extra) => this.mat(c, extra),
      textTexture: (...a) => this.textTexture(...a),
      capMat: (this.capMat ??= new THREE.MeshBasicMaterial({
        map: this.textTexture('C', '#e9b858', '#2a1450', 128, { aspect: 1 }),
        toneMapped: false,
      })),
    });
  },
  /* Player models setting. 'athletes' loads the three rigged bodies once (about 1 MB) and keeps classic figures until they arrive or if they fail. The title gym always shows the athletes (not on Low) without touching the setting; setView re-applies on entering or leaving it. */
  setPlayers(choice) {
    if (this.failed) return;
    this.playersChoice = choice;
    this.applyPlayers();
  },
  applyPlayers() {
    const want = arenaPlayers(this.playersChoice, this.level, this.mode);
    this.playerStyle = want;
    if (want === 'athletes' && !this.templates) {
      (this.bodiesLoading ??= loadAthletes(this.level))
        .then(t => {
          this.templates = t;
          this.applyPlayers();
        })
        .catch(e => {
          console.warn('Player models unavailable, keeping classic', e);
          this.bodiesLoading = null;
          this.playerStyle = 'classic';
        });
      return;
    }
    this.people.forEach(p => {
      this.styleBody(p);
      p.userData.body?.setDetail?.(this.level); // baked detail maps on Medium and High (bodies are not rebuilt per level)
    });
    this.styleBall(want === 'athletes' && !!this.templates);
    this.look?.set(want === 'athletes' && !!this.templates, this.level);
  },
  /* Gives one player the body the current setting asks for: classic, or the athlete variant for his position. */
  styleBody(p) {
    const u = p.userData,
      i = u.slot ?? 0,
      seed = personSeed(u.person, i),
      want = this.playerStyle === 'athletes' && this.templates ? bodyFor(u.person, seed).variant : 'classic',
      look = want === 'classic' ? null : lookFor(seed),
      key = want === 'classic' ? 'classic' : `${want}|${lookKey(look)}`;
    if (u.body?.key === key) return false;
    const color = u.jersey?.color?.getHex?.() ?? (i < 5 ? KANGS_PURPLE : 0xf1e9df);
    const body =
      want === 'classic'
        ? classicBody(this.bodyKit(), i, color)
        : athleteBody(this.templates[want], this.bodyKit(), i, color, want, look, { level: this.level });
    return this.swapBody(p, body);
  },
  /* Swaps one player's body (see src/players.js) and re-applies his name, number and kit colours to the new one. */
  swapBody(p, body) {
    if (!validBody(body)) return false;
    const old = attachBody(p, body),
      who = p.userData.person;
    if (old && old !== body && !old.shared) disposeBody(old, new Set([this.capMat]));
    p.userData.identity = null;
    if (who) this.setIdentity(p, { ...who, plate: p.userData.plate }, who.home);
    return true;
  },
  /* Athletes far from the camera draw their simplified meshes (about a third of the triangles). Chosen by how tall the player
    appears on screen, with a little hysteresis so nobody flickers between the two at the threshold. */
  /* Far mesh only for players that are small in actual pixels (see lodFor in src/graphics.js). */
  updateLods() {
    const cam = this.camera,
      view = this.renderer.domElement.height;
    for (const p of this.people) {
      const b = p.userData.body;
      if (!b?.setLod) continue;
      const lod = lodFor(bodyPixels(cam.fov, cam.position.distanceTo(p.position), view), b.lodLevel || 0);
      if (lod !== (b.lodLevel || 0)) {
        b.lodLevel = lod;
        b.setLod(lod);
      }
    }
  },
  /* Dresses a body as a person: kit colours (the Kangs' chosen kit; visitors their school's colours, src/kits.js
     visitorKit), name, number, and the body itself (src/players.js bodyFor and lookFor: the variant and height from his
     roster position and height, skin, face and hair from who he is, never from the slot he is drawn in). A play's lineup
     carries only id, name and number, so a Kangs player's position and height come from the roster (rosterRecord). */
  setIdentity(p, person, home = true, kit = null) {
    const [kb, kf] = gymColors(this.state?.kit || 'home', this.state?.trim || '#ffffff'),
      [vb, vf] = kit || this.visitorColors || ['#db7536', '#ffffff'],
      bg = home ? kb : vb;
    const fg = home ? kf : vf;
    const rec = home ? rosterRecord(this.state, person) : person;
    p.userData.person = {
      id: rec?.id,
      number: rec?.number,
      name: rec?.name,
      position: rec?.position,
      height: rec?.height,
      home,
    };
    p.userData.plate = person?.plate;
    const fit = bodyFor(
      p.userData.person,
      personSeed(p.userData.person, p.userData.slot),
      this.playerStyle === 'athletes' && this.templates ? 'athletes' : 'classic',
    );
    p.scale.setScalar(fit.scale);
    if (this.playerStyle === 'athletes' && this.templates && this.styleBody(p)) return;
    const look = lookFor(personSeed(p.userData.person, p.userData.slot));
    p.userData.body?.setSkin?.(CLASSIC_SKIN[look.skin]);
    // the team's socks and his pick of its shoes (src/kits.js; the visitors' from their school colours)
    p.userData.body?.setFeet?.(
      feetFor(
        home ? homeFeet(this.state?.kit || 'home') : this.visitorTeamFeet || visitorFeet('', [vb, vf]),
        look,
      ),
    );
    const cap = home && person?.id != null && person.id === this.state?.captain,
      key = [
        person?.id,
        person?.number,
        person?.name,
        bg,
        fg,
        cap ? 'C' : '',
        person?.plate || '',
        fit.scale,
      ].join('|');
    if (p.userData.identity === key) return;
    p.userData.identity = key;
    p.userData.jersey.color.set(bg);
    const num = String(person?.number ?? 11),
      plate = (person?.plate || (person?.name || 'VISITORS').split(' ').at(-1)).toUpperCase();
    if (p.userData.body?.setLettering)
      p.userData.body.setLettering(num, plate, bg, fg, home ? this.state?.kit || 'home' : null); // the Kangs wear the locker-room design
    else {
      const n = p.userData.number.material;
      n.map.dispose();
      n.map = this.textTexture(num, bg, fg, 128);
      const back = p.userData.nameplate.material;
      back.map.dispose();
      back.map = this.textTexture(plate, bg, fg, 256);
    }
    p.userData.capBadge && (p.userData.capBadge.visible = cap);
  },
  /* Opponent bodies wear real names and numbers: the clip's shooter and helper first, then the rest of the roster (fictional rosters read as the school name). */
  castVisitors() {
    const s = this.state;
    if (!s) return;
    const opp = boardGame(s, this.event).opponent;
    this.visitorColors = visitorKit(opp, gymColors(s.kit || 'home', s.trim || '#ffffff')[0]);
    this.visitorTeamFeet = visitorFeet(opp, this.visitorColors);
    visitorCast(oppRoster(s, opp), this.clips?.[1], opp).forEach((v, i) =>
      this.setIdentity(this.people[i + 5], v, false, this.visitorColors),
    );
  },
  // Put the home bodies in pose order without moving them: a body that already wears a player's jersey keeps it.
  cast(list, identify) {
    const pool = this.people.slice(0, 5),
      id = m => m.userData.identity?.split('|')[0],
      own = list.slice(0, 5).map(person => {
        const j = person?.id == null ? -1 : pool.findIndex(m => id(m) === String(person.id));
        return j < 0 ? null : pool.splice(j, 1)[0];
      });
    for (let i = 0; i < 5; i++) {
      this.people[i] = own[i] || pool.shift();
      if (identify) this.setIdentity(this.people[i], list[i] || { number: i + 1, name: 'Kangs' }, true);
    }
  },
};
