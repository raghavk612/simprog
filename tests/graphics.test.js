import test from 'node:test';import assert from 'node:assert/strict';
import {GRAPHICS_LEVELS,qualityProfile,lowerLevel,autoDowngrade,probeDone,medianMs,PROBE} from '../src/graphics.js';
import {normalizeA11y,A11Y_DEFAULTS,activeA11yCount} from '../src/settings.js';

test('quality levels map to renderer profiles; High keeps the current look',()=>{
 assert.deepEqual(GRAPHICS_LEVELS,['auto','low','medium','high']);
 assert.deepEqual(qualityProfile('high',3),{pixelRatio:2,shadowSize:2048,crowd:'full',shadows:true});
 assert.deepEqual(qualityProfile('medium',3),{pixelRatio:1.5,shadowSize:1024,crowd:'noshadow',shadows:true});
 assert.deepEqual(qualityProfile('low',3),{pixelRatio:1,shadowSize:0,crowd:'hidden',shadows:false});
 assert.equal(qualityProfile('high',1).pixelRatio,1,'never above the screen ratio');
 assert.equal(qualityProfile('auto',2).pixelRatio,2,'auto starts at the High look');
 assert.equal(qualityProfile('nonsense',NaN).pixelRatio,1);assert.equal(qualityProfile('high',0).pixelRatio,1);
});
test('lowerLevel drops exactly one step and stops at Low',()=>{assert.equal(lowerLevel('high'),'medium');assert.equal(lowerLevel('medium'),'low');assert.equal(lowerLevel('low'),'low');});
test('median ignores outliers',()=>{assert.equal(medianMs([]),0);assert.equal(medianMs([5]),5);assert.equal(medianMs([1,100,2]),2);assert.equal(medianMs([4,2,8,6]),5);assert.equal(medianMs([NaN,3,Infinity]),3);});
test('auto downgrades only when the median frame is slower than ~28 fps',()=>{
 const fps=(f,n=60)=>Array(n).fill(1000/f);
 assert.equal(autoDowngrade(fps(60)),false);assert.equal(autoDowngrade(fps(30)),false,'a 30 Hz display is not "slow"');assert.equal(autoDowngrade(fps(20)),true);assert.equal(autoDowngrade(fps(10)),true);
 assert.equal(autoDowngrade([...fps(60,50),400,400,400]),false,'a few hitches do not count');
 assert.equal(autoDowngrade(fps(10,5)),false,'too few frames to judge');assert.equal(autoDowngrade(null),false);assert.equal(autoDowngrade(undefined),false);
});
test('the probe finishes after about two seconds of frames, not before',()=>{
 assert.equal(probeDone([]),false);assert.equal(probeDone(Array(30).fill(16)),false,'30 frames of 16 ms is under two seconds');
 assert.equal(probeDone(Array(125).fill(16)),true);assert.equal(probeDone(Array(25).fill(100)),true,'slow machines finish after 2 s too');
 assert.equal(probeDone(Array(5).fill(1000)),false,'needs a minimum number of frames');assert.equal(probeDone(Array(PROBE.maxFrames).fill(1)),true);
});
test('graphics is a validated, optional setting that defaults to auto',()=>{
 assert.equal(A11Y_DEFAULTS.graphics,'auto');assert.equal(normalizeA11y(null).graphics,'auto');
 for(const l of GRAPHICS_LEVELS)assert.equal(normalizeA11y({graphics:l}).graphics,l);
 for(const bad of ['ultra',null,5,{},[],'HIGH',undefined])assert.equal(normalizeA11y({graphics:bad}).graphics,'auto');
 assert.equal(normalizeA11y({},{...A11Y_DEFAULTS,graphics:'low'}).graphics,'low');
 assert.equal(activeA11yCount({...A11Y_DEFAULTS,graphics:'low'}),0,'a performance choice is not counted as an accessibility option');
});
