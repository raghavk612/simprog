import test from 'node:test';import assert from 'node:assert/strict';
import {visitorCast} from '../src/identities.js';
const real=[{number:4,name:'Ava Stone'},{number:11,name:'Bo Reed'},{number:12,name:'Cy Lund'},{number:22,name:'Di Park'},{number:30,name:'Ed Voss'},{number:8,name:'Flo King'},{number:24,name:'Gus Hale'}];
test('visitors wear the clip shooter and helper first, then the rest of the real roster',()=>{
 const c=visitorCast(real,{player:'Cy Lund',jersey:12,helper:'Di Park'},'Liberty');
 assert.deepEqual(c.map(x=>x.name),['Cy Lund','Di Park','Ava Stone','Bo Reed','Ed Voss']);
 assert.deepEqual(c.map(x=>x.number),[12,22,4,11,30]);
 assert.equal(new Set(c.map(x=>x.name)).size,5,'nobody twice');assert.ok(c.every(x=>x.plate===undefined),'real names use their own surname');
 assert.deepEqual(c.map(x=>x.id),[-1,-2,-3,-4,-5]);
});
test('with no clip (before tip-off) the roster is used in order',()=>{const c=visitorCast(real,undefined,'Liberty');assert.deepEqual(c.map(x=>x.name),real.slice(0,5).map(r=>r.name));});
test('fictional rosters read as the school name on the nameplate and keep their numbers',()=>{
 const fict=[4,11,12,22,30,8,24].map(n=>({number:n,name:`Liberty #${n}`})),c=visitorCast(fict,{player:'Liberty #12',jersey:12,helper:'Liberty #22'},'Liberty');
 assert.equal(c[0].name,'Liberty #12');assert.ok(c.every(x=>x.plate==='LIBERTY'));assert.equal(c[1].number,22);
});
test('old events and short or missing rosters still give five usable bodies',()=>{
 const legacy=visitorCast(real,{player:'Visitors',jersey:12},'Liberty');assert.equal(legacy[0].name,'Ava Stone');
 const none=visitorCast([],undefined,'Liberty');assert.equal(none.length,5);assert.ok(none.every(x=>x.name==='Visitors'&&Number.isFinite(x.number)));
 assert.equal(visitorCast(null,null,'X').length,5);
 const two=visitorCast(real.slice(0,2),{player:'Zed Quinn',jersey:3},'Liberty');assert.equal(two[0].name,'Zed Quinn');assert.equal(two[1].name,'Ava Stone');assert.equal(two[4].name,'Visitors');
});
