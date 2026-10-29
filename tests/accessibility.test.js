import {pickVoice,speak,configureSpeech,speechAvailable} from '../src/speech.js';import {startCrowd,stopCrowd,crowdRunning} from '../src/audio.js';import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeSound,normalizeA11y,SOUND_DEFAULTS,A11Y_DEFAULTS,TEXT_SCALE,activeA11yCount} from '../src/settings.js';
import {SOUND_KEYS,play,preview,configureAudio} from '../src/audio.js';
import {correctionMatrix} from '../src/a11y.js';
import {ACTIONS,DEFAULT_KEYS,RESERVED,findConflict,keyLabel,ariaKey,loadKeys} from '../src/keys.js';

test('sound settings fall back to safe defaults and clamp bad values',()=>{
 assert.deepEqual(normalizeSound(null),SOUND_DEFAULTS);
 assert.equal(SOUND_DEFAULTS.muted,true,'sound stays opt-in');
 const s=normalizeSound({volume:7,muted:'yes',toggles:{swish:false,nonsense:false,rim:'no'}});
 assert.equal(s.volume,1);assert.equal(s.muted,true);assert.equal(s.toggles.swish,false);assert.equal(s.toggles.rim,true);
 assert.deepEqual(Object.keys(s.toggles),SOUND_KEYS);
 assert.equal(normalizeSound({volume:-3}).volume,0);assert.equal(normalizeSound({volume:'loud'}).volume,SOUND_DEFAULTS.volume);
});
test('accessibility settings are validated field by field',()=>{
 assert.deepEqual(normalizeA11y(null),A11Y_DEFAULTS);
 const a=normalizeA11y({colorBlindMode:'rainbow',textScale:9,fontFamily:'comic',playbackSpeed:3,highContrast:'true',timingAssist:true});
 assert.equal(a.colorBlindMode,'none');assert.equal(a.textScale,TEXT_SCALE.max);assert.equal(a.fontFamily,'default');assert.equal(a.playbackSpeed,1);assert.equal(a.highContrast,false);assert.equal(a.timingAssist,true);
 assert.equal(normalizeA11y({textScale:.1}).textScale,TEXT_SCALE.min);assert.equal(normalizeA11y({textScale:1.25}).textScale,1.25);assert.equal(normalizeA11y({playbackSpeed:.5}).playbackSpeed,.5);assert.equal(normalizeA11y({playbackSpeed:.75}).playbackSpeed,.75);
 assert.equal(normalizeA11y({colorBlindMode:'tritanopia',fontFamily:'readable'}).fontFamily,'readable');
});
test('OS preferences seed the defaults used when nothing is saved',()=>{
 const base={...A11Y_DEFAULTS,reducedMotion:true,screenShake:false,highContrast:true};
 const a=normalizeA11y({},base);assert.equal(a.reducedMotion,true);assert.equal(a.screenShake,false);assert.equal(a.highContrast,true);
 assert.equal(normalizeA11y({reducedMotion:false},base).reducedMotion,false,'a saved choice overrides the OS default');
});
test('the badge counts only options that differ from the defaults',()=>{
 assert.equal(activeA11yCount(A11Y_DEFAULTS),0);
 assert.equal(activeA11yCount({...A11Y_DEFAULTS,highContrast:true,textScale:1.4,playbackSpeed:.5}),3);
});
test('colour correction keeps greys unchanged and makes confusable colours easier to tell apart',()=>{
 const SIM={
  protanopia:[[.152286,1.052583,-.204868],[.114503,.786281,.099216],[-.003882,-.048116,1.051998]],
  deuteranopia:[[.367322,.860646,-.227968],[.280085,.672501,.047413],[-.01182,.04294,.968881]],
  tritanopia:[[1.255528,-.076749,-.178779],[-.078411,.930809,.147602],[.004733,.691367,.3039]]};
 const mv=(m,v)=>m.map(r=>r.reduce((s,x,i)=>s+x*v[i],0)),clamp=v=>v.map(x=>Math.max(0,Math.min(1,x))),dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
 const confusable={protanopia:[[.8,.4,.4],[.4,.6,.4]],deuteranopia:[[.8,.4,.4],[.4,.6,.4]],tritanopia:[[1,1,0],[.9,.6,.9]]};
 for(const mode of Object.keys(SIM)){
  const C=correctionMatrix(mode);assert.equal(C.length,3);
  for(const row of C){assert.equal(row.length,3);assert.ok(Math.abs(row.reduce((a,b)=>a+b,0)-1)<1e-4,`${mode} row sum`);}
  const grey=mv(C,[.5,.5,.5]);for(const x of grey)assert.ok(Math.abs(x-.5)<1e-4);
  const [a,b]=confusable[mode],seen=v=>clamp(mv(SIM[mode],v));
  assert.ok(dist(seen(clamp(mv(C,a))),seen(clamp(mv(C,b))))>dist(seen(a),seen(b))*1.5,`${mode} separates confusable colours`);
 }
 assert.equal(correctionMatrix('none'),null);
});
test('sounds respect mute, per-sound toggles and a missing audio device',()=>{
 assert.equal(SOUND_KEYS.length,17);
 configureAudio({volume:.5,muted:false,toggles:{swish:false}});
 for(const k of SOUND_KEYS){play(k);preview(k);}play('doesNotExist');preview('doesNotExist');
 configureAudio({muted:true});play('swish');
});
test('keyboard shortcuts: defaults are unique and conflicts are detected',()=>{
 assert.equal(new Set(Object.values(DEFAULT_KEYS)).size,ACTIONS.length);
 for(const a of ACTIONS){assert.ok(DEFAULT_KEYS[a]);assert.ok(!RESERVED.includes(DEFAULT_KEYS[a]));}
 assert.equal(findConflict(DEFAULT_KEYS,'nextPlay','KeyW'),'playPause');
 assert.equal(findConflict(DEFAULT_KEYS,'playPause','KeyW'),null,'a key does not conflict with itself');
 assert.equal(findConflict(DEFAULT_KEYS,'nextPlay','KeyZ'),null);
 for(const code of ['Escape','Tab','Enter','Space','ShiftLeft'])assert.equal(findConflict(DEFAULT_KEYS,'nextPlay',code),'reserved',code);
 assert.deepEqual(loadKeys(),DEFAULT_KEYS);
});
test('key labels are readable',()=>{
 assert.equal(keyLabel('KeyP'),'P');assert.equal(keyLabel('Digit1'),'1');assert.equal(keyLabel('ArrowUp'),'↑');assert.equal(keyLabel('Comma'),',');assert.equal(keyLabel('Numpad5'),'Num 5');assert.equal(keyLabel('F5'),'F5');
 assert.equal(ariaKey('KeyP'),'P');assert.equal(ariaKey('Digit3'),'3');assert.equal(ariaKey('ArrowUp'),'ArrowUp');
});
test('spoken commentary: picks a voice for the language, and stays silent without a speech engine or while muted',()=>{
 const voices=[{lang:'en-GB',localService:false,name:'a'},{lang:'es_MX',localService:true,name:'b'},{lang:'es-ES',localService:false,name:'c'},{lang:'ja-JP',localService:true,name:'d'}];
 assert.equal(pickVoice(voices,'es-ES').name,'c','an exact match wins');assert.equal(pickVoice(voices,'es').name,'b','otherwise a local voice of that language');assert.equal(pickVoice(voices,'hi-IN'),null);assert.equal(pickVoice([],'en-US'),null);
 assert.equal(speechAvailable(),false,'no speech engine in Node');assert.equal(speak('Three-pointer'),false);configureSpeech({enabled:false,volume:.5});assert.equal(speak('x',{muted:true}),false);
 configureSpeech({enabled:true});
});
test('spoken commentary: natural voices first, novelty voices never, and the call is delivered higher than the build-up',async()=>{
 const {phrases}=await import('../src/speech.js');
 const V=[{name:'Albert',lang:'en-US',localService:true},{name:'Samantha',lang:'en-US',localService:true},{name:'Microsoft Aria Online (Natural) - English (United States)',lang:'en-US',localService:false},{name:'Daniel',lang:'en-GB'}];
 assert.equal(pickVoice(V,'en-US').name,'Microsoft Aria Online (Natural) - English (United States)');
 assert.equal(pickVoice(V.slice(0,2),'en-US').name,'Samantha','a good system voice beats a novelty one');
 assert.equal(pickVoice([{name:'Zarvox',lang:'en-US'},{name:'Bad News',lang:'en-US'}],'en-US'),null,'novelty voices are never used');
 const p=phrases('Pawar drifts to the left wing… Darwazeh finds him. Got it! Three!');
 assert.deepEqual(p.map(x=>x.text),['Pawar drifts to the left wing…','Darwazeh finds him.','Got it!','Three!']);
 assert.ok(p[2].pitch>p[0].pitch&&p[2].rate>p[0].rate,'the call lifts');
});
test('crowd ambience never throws without an audio device and follows the mute',()=>{
 configureAudio({muted:false});startCrowd();assert.equal(crowdRunning(),false,'nothing to run in Node');stopCrowd();configureAudio({muted:true});startCrowd();assert.equal(crowdRunning(),false);
});
test('sound settings keep commentary on by default and reject bad values',async()=>{
 const {normalizeSound}=await import('../src/settings.js');assert.equal(normalizeSound(null).commentary,true);assert.equal(normalizeSound({commentary:false}).commentary,false);assert.equal(normalizeSound({commentary:'yes'}).commentary,true);assert.equal(normalizeSound(null).toggles.cheer,true);
});
