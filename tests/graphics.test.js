import test from 'node:test';import assert from 'node:assert/strict';
import {GRAPHICS_LEVELS,bodyPixels,lodFor,LOD_PIXELS,qualityProfile,lowerLevel,autoDowngrade,probeDone,medianMs,PROBE} from '../src/graphics.js';
import {normalizeA11y,A11Y_DEFAULTS,activeA11yCount} from '../src/settings.js';

test('quality levels map to renderer profiles; High keeps the current look',()=>{
 assert.deepEqual(GRAPHICS_LEVELS,['auto','low','medium','high']);
 assert.deepEqual(qualityProfile('high',3),{pixelRatio:2,shadowSize:2048,crowd:'full',shadows:true});
 assert.deepEqual(qualityProfile('medium',3),{pixelRatio:1.5,shadowSize:1024,crowd:'noshadow',shadows:true});
 assert.deepEqual(qualityProfile('low',3),{pixelRatio:1,shadowSize:0,crowd:'hidden',shadows:false});
 assert.equal(qualityProfile('high',1).pixelRatio,1,'never above the screen ratio');
 assert.equal(qualityProfile('auto',2).pixelRatio,2,'auto starts at the High look');
 assert.equal(qualityProfile('high',2,{width:1742,height:822}).pixelRatio,1.6,'a full-screen Retina canvas is held to the High pixel budget');
 assert.ok(1742*822*1.6**2<=3.7e6);assert.equal(qualityProfile('high',2,{width:1280,height:720}).pixelRatio,2,'normal windows keep 2x');
 assert.equal(qualityProfile('medium',2,{width:3000,height:2000}).pixelRatio,1,'never below 1x');
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
test('broadcast look: High has reflections and ambient occlusion, Medium only bloom and grade, Low is the classic gym',async()=>{
 const {lookFeatures}=await import('../src/graphics.js');
 assert.deepEqual(lookFeatures('high'),{reflections:true,ao:true,bloom:true,grade:true,spots:6,contact:true,dof:true});
 const m=lookFeatures('medium');assert.equal(m.reflections,false);assert.equal(m.ao,false);assert.equal(m.bloom,true);assert.equal(m.spots,3);assert.equal(m.dof,true,'depth of field only runs on replays and close angles, so Medium can afford it');
 assert.equal(lookFeatures('low'),null);assert.equal(lookFeatures('auto'),null,'auto resolves to a level before it gets here');
});
test('broadcast rig: the Spline values convert to game units on the same court',async()=>{
 const {RIG,toGame,SPLINE_FILE}=await import('../src/broadcastRig.js');
 assert.match(SPLINE_FILE,/^https:\/\/app\.spline\.design\/file\//);
 const [x]=toGame([640,0,0]);assert.ok(Math.abs(x-13.89)<.02,`half court ${x}`);   // 42 ft
 assert.equal(RIG.spots.length,6);assert.equal(RIG.banks.length,10);
 for(const c of Object.values(RIG.cameras)){assert.equal(c.position.length,3);assert.equal(c.target.length,3);}
 const key=toGame(RIG.key.position);assert.ok(key[1]>20,'key light high over the court');
});
test('player detail follows on-screen size in pixels: a Follow-view player on a big screen keeps the full head',()=>{
 // a 2.2 m player 15 m away through a 43° lens on an 822 px tall view
 assert.ok(Math.abs(bodyPixels(43,15,822)-2.2/(2*15*Math.tan(21.5*Math.PI/180))*822)<1e-9);
 // the reported bug: Follow (long lens, ~30 m) on a Retina canvas 1644 px tall drew the 30% mesh (dented faces, jagged hair)
 assert.equal(lodFor(bodyPixels(28.4,30,1644),0),0);
 assert.equal(lodFor(bodyPixels(28.4,30,1644),1),0,'switches back to full detail');
 // small on screen: the far mesh is fine (head only a few pixels)
 assert.equal(lodFor(bodyPixels(43,40,600),0),1);
 // hysteresis band so a player walking at the edge does not flicker between meshes
 assert.equal(lodFor(LOD_PIXELS.far+5,0),0);
 assert.equal(lodFor(LOD_PIXELS.far+5,1),1);
 assert.equal(lodFor(LOD_PIXELS.near+1,1),0);
});
