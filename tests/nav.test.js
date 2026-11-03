import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import en from '../src/i18n/locales/en.js';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const NAV=JSON.parse(/const NAV=(\{.*?\}),NAV_ICON/.exec(main)[1].replace(/'/g,'"').replace(/(\w+):\[/g,'"$1":['));
const routes=Object.values(NAV).flat();

test('three tabs, the break screens, and no screen listed twice',()=>{
 assert.deepEqual(Object.keys(NAV),['week','team','season','break']);
 assert.equal(new Set(routes).size,routes.length);
});
test('the judge demo and the first-game tutorial only use screens that exist',()=>{
 const demo=/DEMO_VIEWS=\[([^\]]*)\]/.exec(main)[1].match(/'(\w+)'/g).map(x=>x.slice(1,-1));
 const tour=[...main.slice(main.indexOf('const BEATS=['),main.indexOf('function startTour')).matchAll(/view(?:===|!==)'(\w+)'/g)].map(m=>m[1]);
 assert.ok(tour.length>=5,'the tutorial names its screens');
 for(const v of [...demo,...tour])assert.ok(routes.includes(v),v);
});
test('every screen has a page to draw and a name on its tab',()=>{
 const pages=/\(\{(home,roster[^}]*)\}\[view\]/.exec(main)[1].split(',').map(x=>x.split(':')[0]);
 for(const v of routes){assert.ok(pages.includes(v),`page: ${v}`);assert.equal(typeof en.nav[v],'string',`name: ${v}`);}
 for(const g of ['week','team','season'])assert.equal(typeof en.nav.groups[g],'string');
});
