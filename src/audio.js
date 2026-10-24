// Synthesized sound effects: no audio files. The AudioContext is created on first use so the browser autoplay policy is respected.
export const SOUND_KEYS=['swish','three','rim','block','steal','whistle','timeout','confirm','select','error','signing','victory','defeat','uiClick','cheer','groan','crowd'];
let ctx=null,volume=.35,muted=true,bypass=false;
const enabled=Object.fromEntries(SOUND_KEYS.map(k=>[k,true]));
export function configureAudio({volume:v,muted:m,toggles}={}){
 if(typeof v==='number')volume=Math.max(0,Math.min(1,v));
 if(typeof m==='boolean')muted=m;
 if(toggles)for(const k of SOUND_KEYS)if(typeof toggles[k]==='boolean')enabled[k]=toggles[k];
 if(bed&&(muted||!enabled.crowd))stopCrowd();
}
function context(){
 const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return null;
 try{ctx??=new AC();}catch{return null;}
 if(ctx.state==='suspended')ctx.resume().catch(()=>{});return ctx;
}
function osc(type,f0,f1,dur,vol=.4,delay=0,attack=.005){
 const c=context();if(!c)return;const now=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();
 o.type=type;o.frequency.setValueAtTime(f0,now);o.frequency.exponentialRampToValueAtTime(Math.max(f1,1),now+dur);
 g.gain.setValueAtTime(.001,now);g.gain.exponentialRampToValueAtTime(Math.max(vol*volume,.001),now+attack);g.gain.exponentialRampToValueAtTime(.001,now+dur);
 o.connect(g).connect(c.destination);o.start(now);o.stop(now+dur+.01);
}
function noise(dur,f0,f1,q,vol=.3,delay=0){
 const c=context();if(!c)return;const now=c.currentTime+delay,buffer=c.createBuffer(1,Math.ceil(c.sampleRate*dur),c.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
 const src=c.createBufferSource(),filter=c.createBiquadFilter(),g=c.createGain();
 src.buffer=buffer;filter.type='bandpass';filter.frequency.setValueAtTime(f0,now);filter.frequency.exponentialRampToValueAtTime(Math.max(f1,1),now+dur);filter.Q.value=q;
 g.gain.setValueAtTime(Math.max(vol*volume,.001),now);g.gain.exponentialRampToValueAtTime(.001,now+dur);
 src.connect(filter).connect(g).connect(c.destination);src.start(now);src.stop(now+dur+.01);
}
const chord=(notes,step,dur,vol,type='sine')=>notes.forEach((f,i)=>{osc(type,f,f*1.005,dur,vol,i*step,.004);osc(type,f*2,f*2*1.005,dur*.65,vol*.25,i*step,.004);});
const SOUNDS={
 // A clean two-point swish: air through the net, then a soft pop.
 swish(){noise(.24,5200,2200,1.1,.26);osc('sine',720,980,.08,.2,.02,.003);osc('sine',420,380,.12,.12,.04,.004);},
 // Three-pointers add a bright rising ping.
 three(){SOUNDS.swish();chord([783.99,1046.5],.07,.3,.2);},
 // Metallic clank off the rim.
 rim(){osc('triangle',430,300,.16,.34,0,.002);osc('square',860,610,.09,.1,0,.002);noise(.05,2400,900,4,.2);},
 // Low thud and a sharp slap.
 block(){osc('sine',260,55,.2,.5,0,.003);noise(.07,2600,700,5,.32);osc('sine',480,240,.08,.2,.03);},
 // Quick swipe across the ball.
 steal(){noise(.12,500,3000,3,.26);osc('sine',560,320,.14,.22,.02);},
 // Referee whistle: two close tones with a fast tremolo.
 whistle(){
  const c=context();if(!c)return;const now=c.currentTime,peak=Math.max(.3*volume,.001),g=c.createGain(),lfo=c.createOscillator(),depth=c.createGain();
  g.gain.setValueAtTime(.001,now);g.gain.exponentialRampToValueAtTime(peak,now+.03);g.gain.setValueAtTime(peak,now+.3);g.gain.exponentialRampToValueAtTime(.001,now+.46);
  lfo.frequency.value=30;depth.gain.value=peak*.45;lfo.connect(depth).connect(g.gain);g.connect(c.destination);
  for(const f of [2850,2905]){const o=c.createOscillator();o.type='sine';o.frequency.value=f;o.connect(g);o.start(now);o.stop(now+.48);}
  lfo.start(now);lfo.stop(now+.48);
 },
 // Two falling bell tones.
 timeout(){osc('sine',659.25,650,.32,.34,0,.004);osc('sine',493.88,485,.4,.34,.16,.004);osc('sine',1318.5,1300,.2,.08,0,.004);},
 // Rising two-tone confirmation.
 confirm(){osc('sine',440,880,.15,.4,0,.004);osc('sine',880,1320,.1,.18,.08,.004);},
 // Soft tick when a choice changes.
 select(){osc('sine',660,700,.09,.3,0,.004);noise(.04,800,1600,6,.08);},
 // Low double buzz for rejected actions.
 error(){osc('sawtooth',190,120,.2,.22,0,.004);osc('square',140,100,.18,.12,.1,.004);},
 // Glittery arpeggio when someone joins the program.
 signing(){noise(.1,4000,9000,10,.14);chord([523.25,659.25,783.99,1046.5,1318.5],.09,.4,.3);noise(.12,6000,12000,8,.1,.45);},
 // Triumphant chime for a win or a title.
 victory(){chord([523.25,659.25,783.99,1046.5],.15,.55,.34);osc('sine',261.63,254,.7,.28,0,.01);noise(.12,3000,8000,6,.12,.55);},
 // Gentle descending phrase for a loss.
 defeat(){chord([392,349.23,293.66,261.63],.2,.5,.28);},
 // Crowd roar: a rising wash of noise with a few shouts on top.
 cheer(){noise(1.1,500,2200,.8,.3);noise(.9,900,2600,1.5,.18,.12);osc('sawtooth',320,420,.5,.05,.1,.05);},
 // The crowd's groan: noise sliding down, with a falling hum.
 groan(){noise(.9,900,260,.9,.26);osc('sawtooth',230,130,.8,.07,0,.08);},
 // A short murmur; the same sound runs continuously as the ambience during a live game.
 crowd(){noise(1.2,400,700,.5,.16);noise(1.2,900,500,.7,.08,.2);},
 // Deep, short click.
 uiClick(){noise(.035,180,60,1.8,.5);osc('sine',320,420,.075,.65,0,.003);},
};
export function play(key){if(!bypass&&(muted||!enabled[key]))return;try{SOUNDS[key]?.();}catch{}}
// Plays a sound even when muted so volume can be checked before sound effects are switched on.
export function preview(key='swish'){bypass=true;try{SOUNDS[key]?.();}catch{}finally{bypass=false;}}
// Ambient crowd for a live game: looping low noise that swells a little now and then. It follows the master mute and the 'crowd' switch.
let bed=null;
function brownNoise(c,seconds=4){const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*seconds),c.sampleRate),d=buffer.getChannelData(0);let last=0;for(let i=0;i<d.length;i++){last=(last+.02*(Math.random()*2-1))/1.02;d[i]=last*3.5;}return buffer;}
export function startCrowd(){
 if(bed||muted||!enabled.crowd)return;const c=context();if(!c)return;
 try{
  const src=c.createBufferSource(),low=c.createBiquadFilter(),g=c.createGain(),lfo=c.createOscillator(),depth=c.createGain();
  src.buffer=brownNoise(c);src.loop=true;low.type='lowpass';low.frequency.value=650;g.gain.value=Math.max(.09*volume,.0005);
  lfo.frequency.value=.12;depth.gain.value=g.gain.value*.45;lfo.connect(depth).connect(g.gain);
  src.connect(low).connect(g).connect(c.destination);src.start();lfo.start();bed={src,lfo,g};
 }catch{bed=null;}
}
export function stopCrowd(){if(!bed)return;try{bed.g.gain.setTargetAtTime(.0001,bed.g.context.currentTime,.15);const b=bed;setTimeout(()=>{try{b.src.stop();b.lfo.stop();}catch{}},600);}catch{}bed=null;}
export const crowdRunning=()=>!!bed;
