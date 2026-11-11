import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../src/engine.js';
import { skillTreeCard, selectSkill, selectedSkill, skillNeighbour } from '../src/skillsView.js';
import { gearBody } from '../src/gearView.js';
import { BASIC_MOVES, SKILL_TREE } from '../src/skills.js';
import { setLanguage, LANGUAGES, t } from '../src/i18n/index.js';
const data = JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json', import.meta.url)));
const game = () => {
  const s = E.createGame(data, 'Skills', 'standard', 42);
  E.autoLineup(s);
  return s;
};
const KEYS = Object.values(SKILL_TREE)
  .flat()
  .map(n => n.key);
// One node button on the tree, and the detail panel for the selected move.
const nodeHtml = (html, key) => {
  const m = html.match(new RegExp(`<button class="st-node[^"]*" id="skill-${key}"[\\s\\S]*?</button>`));
  assert.ok(m, `node ${key} rendered`);
  return m[0];
};
const stateOf = (html, key) => nodeHtml(html, key).match(/class="st-node (\w+)/)[1];
const label = (html, key) => nodeHtml(html, key).match(/aria-label="([^"]*)"/)[1];
const detail = html => {
  const m = html.match(/<div class="st-detail[\s\S]*?<!--\/detail-->/);
  assert.ok(m, 'detail panel');
  return m[0];
};
test.beforeEach(() => {
  setLanguage('en', { persist: false });
});

test('a new season shows the five basic moves and three branches in order, roots ready to unlock and the rest locked', () => {
  const s = game(),
    html = skillTreeCard(s);
  assert.match(html, new RegExp(t('skills.title')));
  assert.match(html, /defenses read a team with few moves/i);
  for (const k of BASIC_MOVES)
    assert.match(
      html,
      new RegExp(
        `<li class="skill-chip"><span class="sr-only">${t('skills.owned')}: </span><span aria-hidden="true">✓</span> ${t(`shot.${k}`)}</li>`,
      ),
      k,
    );
  for (const [b, nodes] of Object.entries(SKILL_TREE)) {
    const branch = html.match(
      new RegExp(
        `<div class="st-branch b-${b}" role="group" aria-labelledby="skill-branch-${b}">[\\s\\S]*?id="skill-branch-${b}"[^>]*>${t(`skills.branch.${b}`)}<[\\s\\S]*?<!--/${b}-->`,
      ),
    );
    assert.ok(branch, b);
    assert.deepEqual(
      [...branch[0].matchAll(/id="skill-(\w+)"/g)].map(m => m[1]),
      nodes.map(n => n.key),
      `${b} order`,
    );
    const [root, ...rest] = nodes;
    assert.equal(stateOf(html, root.key), 'open');
    assert.ok(label(html, root.key).includes(t('skills.stateOpen')), root.key);
    for (const n of rest) {
      assert.equal(stateOf(html, n.key), 'locked');
      assert.ok(label(html, n.key).includes(t('skills.needs', { move: t(`shot.${n.requires}`) })), n.key);
    }
  }
  for (const k of KEYS) {
    const h = nodeHtml(html, k);
    assert.match(h, /data-action="skill-select"/);
    assert.ok(label(html, k).startsWith(t(`shot.${k}`)), k);
    assert.ok(
      label(html, k).includes(
        t('skills.cost', {
          cost: SKILL_TREE[Object.keys(SKILL_TREE).find(b => SKILL_TREE[b].some(n => n.key === k))].find(
            n => n.key === k,
          ).cost,
        }),
      ),
      k,
    );
  }
  assert.ok(html.includes(t('skills.progress', { n: 5, total: 13 })));
});
test('the detail panel starts on the first move you can unlock and offers its Unlock button', () => {
  const s = game(),
    html = skillTreeCard(s),
    d = detail(html),
    root = SKILL_TREE.shooter[0];
  assert.equal(selectedSkill(s), root.key);
  assert.match(nodeHtml(html, root.key), /aria-pressed="true"/);
  assert.ok(d.includes(t(`shot.${root.key}`)) && d.includes(t(`skills.hint.${root.key}`)));
  assert.match(
    d,
    new RegExp(
      `<button class="secondary wide" data-action="skill-unlock" data-key="${root.key}"[^>]*>${t('skills.unlock', { cost: root.cost })}</button>`,
    ),
  );
});
test('selecting a locked move explains what it needs and offers no Unlock button', () => {
  const s = game();
  selectSkill('dunk', s);
  const html = skillTreeCard(s),
    d = detail(html);
  assert.match(nodeHtml(html, 'dunk'), /aria-pressed="true"/);
  assert.match(nodeHtml(html, 'corner'), /aria-pressed="false"/);
  assert.ok(d.includes(t('skills.needs', { move: t('shot.euro') })));
  assert.ok(d.includes(t('skills.locked')));
  assert.doesNotMatch(d, /data-action="skill-unlock"/);
  assert.ok(d.includes(t('tactic.perimeter').replace(/&/g, '&amp;')), 'dunk hint names the tactic');
});
test('an unlocked move shows as learned, lights its link and opens the next move in its branch', () => {
  const s = game();
  E.unlockSkill(s, 'euro');
  const html = skillTreeCard(s);
  assert.equal(stateOf(html, 'euro'), 'owned');
  assert.ok(label(html, 'euro').includes(t('skills.owned')));
  assert.equal(stateOf(html, 'dunk'), 'open');
  assert.equal(stateOf(html, 'alley'), 'locked');
  assert.match(html, /<line class="st-link next b-slasher" data-from="euro" data-to="dunk"/);
  assert.match(html, /<line class="st-link locked b-slasher" data-from="dunk" data-to="alley"/);
  E.unlockSkill(s, 'dunk');
  assert.match(skillTreeCard(s), /<line class="st-link lit b-slasher" data-from="euro" data-to="dunk"/);
  assert.equal(selectedSkill(s), 'corner', 'still the first move you can unlock');
  selectSkill('euro', s);
  assert.ok(detail(skillTreeCard(s)).includes(t('skills.owned')));
  assert.ok(skillTreeCard(s).includes(t('skills.progress', { n: 7, total: 13 })));
});
test('a move blocked by tokens, a live game, the inbox or a finished season keeps a disabled button and says why', () => {
  const cases = [
    [
      s => {
        s.tokens = 100;
      },
      t('office.needTokens', { n: 50 }),
    ],
    [
      s => {
        s.match = {};
      },
      t('office.gameActive'),
    ],
    [
      s => {
        s.pendingEvent = { id: 'x' };
      },
      t('office.inboxFirst'),
    ],
    [
      s => {
        s.finished = true;
      },
      t('office.seasonDone'),
    ],
  ];
  for (const [set, why] of cases) {
    const s = game();
    set(s);
    selectSkill('corner', s);
    const html = skillTreeCard(s),
      d = detail(html);
    assert.equal(stateOf(html, 'corner'), 'blocked');
    assert.ok(label(html, 'corner').includes(why), why);
    assert.match(
      d,
      /<button class="secondary wide locked-action" data-action="skill-unlock" data-key="corner"[^>]*disabled/,
    );
    assert.ok(d.includes(why), why);
  }
});
test('when every move is learned the panel shows the last one, and unknown selections are ignored', () => {
  const s = game();
  s.skills = [...KEYS];
  selectSkill('nonsense', s);
  assert.equal(selectedSkill(s), KEYS.at(-1));
  assert.ok(skillTreeCard(s).includes(t('skills.progress', { n: 13, total: 13 })));
});
test('arrow keys walk up and down a branch and across branches on the same tier', () => {
  assert.equal(skillNeighbour('corner', 'ArrowUp'), 'stepback');
  assert.equal(skillNeighbour('stepback', 'ArrowDown'), 'corner');
  assert.equal(skillNeighbour('corner', 'ArrowDown'), null);
  assert.equal(skillNeighbour('corner', 'ArrowRight'), 'euro');
  assert.equal(skillNeighbour('euro', 'ArrowRight'), 'hook');
  assert.equal(skillNeighbour('hook', 'ArrowRight'), null);
  assert.equal(skillNeighbour('alley', 'ArrowRight'), null, 'no post move on tier 3');
  assert.equal(skillNeighbour('alley', 'ArrowLeft'), 'fadeaway');
  assert.equal(skillNeighbour('spin', 'ArrowLeft'), 'dunk');
});
test('gear and the skill tree are separate shop tabs', () => {
  const html = gearBody(game(), 0);
  assert.ok(html.includes('gear-loadout') && html.includes('gear-shop-heading'));
  assert.ok(!html.includes('skill-tree'));
});
test('the skill tree renders in every language without missing keys', async () => {
  const s = game();
  E.unlockSkill(s, 'corner');
  const english = skillTreeCard(s);
  for (const { code } of LANGUAGES) {
    await setLanguage(code, { persist: false });
    for (const k of [null, 'stepback', 'fadeaway', 'corner']) {
      selectSkill(k, s);
      const html = skillTreeCard(s);
      assert.doesNotMatch(html, /skills\.|shot\.|office\.|tactic\.|\{\{/, `${code} ${k}`);
    }
    if (code !== 'en') {
      const html = skillTreeCard(s);
      assert.ok(
        !html.includes(english.match(/<p class="skill-intro">([^<]*)/)[1]),
        `${code} intro is translated`,
      );
      selectSkill('stepback', s);
      assert.ok(
        !label(skillTreeCard(s), 'stepback').includes('Ready to unlock'),
        `${code} state is translated`,
      );
    }
  }
  await setLanguage('en', { persist: false });
});
test('the tree is one Tab stop: only the selected move is tabbable, and the panel is a labelled region', () => {
  const s = game();
  selectSkill('dunk', s);
  const html = skillTreeCard(s);
  for (const k of KEYS) assert.match(nodeHtml(html, k), new RegExp(`tabindex="${k === 'dunk' ? 0 : -1}"`), k);
  assert.match(html, /<div class="st-detail[^"]*" role="region" aria-labelledby="st-detail-name">/);
  assert.doesNotMatch(html, /<aside/);
});
test('a picked move belongs to its own game: a new season starts on its first move you can unlock', () => {
  const a = game();
  selectSkill('dunk', a);
  assert.equal(selectedSkill(a), 'dunk');
  const b = game();
  assert.equal(selectedSkill(b), 'corner');
  assert.equal(selectedSkill(a), 'dunk');
});
