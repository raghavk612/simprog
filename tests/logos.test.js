import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {logoSlug,opponentLogo} from '../src/logos.js';
// Opponent name -> logo file mapping (the UI falls back to the initials crest when there is none).
test('logoSlug normalises names',()=>{
 assert.equal(logoSlug('Liberty (Renton)'),'liberty');
 assert.equal(logoSlug('Hazen High School'),'hazen');
 assert.equal(logoSlug('Bothell HS'),'bothell');
 assert.equal(logoSlug('  North   Creek '),'north-creek');
 assert.equal(logoSlug('Mt. Si'),'mount-si');
 assert.equal(logoSlug('Mt Si'),'mount-si');
 assert.equal(logoSlug('Mount Si'),'mount-si');
 assert.equal(logoSlug('MOUNTSI'),'mount-si');
 assert.equal(logoSlug(null),'');
 assert.equal(logoSlug(undefined),'');
});
test('opponentLogo finds known schools and returns null otherwise',()=>{
 assert.match(opponentLogo('Redmond'),/images\/opponents\/redmond\.png$/);
 assert.match(opponentLogo('Mt. Si High School'),/opponents\/mount-si\.png$/);
 assert.match(opponentLogo('North Creek (Bothell)'),/opponents\/north-creek\.png$/);
 assert.equal(opponentLogo('Liberty (Renton)'),null);
 assert.equal(opponentLogo(''),null);
 assert.equal(opponentLogo(undefined),null);
});
test('every mapped logo has a file in public/images/opponents',()=>{
 for(const name of ['Bothell','Redmond','Juanita','North Creek','Woodinville','Hazen','Arlington','Eastlake','Newport','Issaquah','Skyline','Mount Si','Bellevue']){
  const url=opponentLogo(name),file=new URL('../public/images/opponents/'+url.split('/').pop(),import.meta.url);
  assert.ok(fs.existsSync(file),`${name}: ${file.pathname}`);
 }
});
