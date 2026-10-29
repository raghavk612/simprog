// Spoken live commentary through the browser's speech voices. Off when sound is off; the text is the same translated line that is shown and announced.
// Three things keep it from sounding robotic:
//  * the best installed voice for the language is chosen (natural/neural/premium voices first, novelty voices never);
//  * a line is spoken as phrases: the build-up at an even pace, the call (anything with "!") a little higher and quicker;
//  * lines queue instead of cutting each other off; if plays come faster than the voice, only the newest waiting line is kept.
let on=true,volume=.35,voices=[];
export function configureSpeech({enabled,volume:v}={}){if(typeof enabled==='boolean'){on=enabled;if(!on)stopSpeech();}if(typeof v==='number')volume=Math.max(0,Math.min(1,v));}
const synth=()=>globalThis.speechSynthesis;
export const speechAvailable=()=>!!synth()&&typeof globalThis.SpeechSynthesisUtterance==='function';
const norm=l=>String(l).toLowerCase().replace('_','-');
// Voices worth hearing (after the Readium "recommended voices" lists): cloud/neural voices and the good system voices.
const GOOD=/natural|neural|premium|enhanced|online|google|siri|\b(ava|samantha|aria|jenny|guy|emma|andrew|brian|daniel|serena|karen|moira|tessa|zoe|evan|nathan|allison|susan|tom)\b/i;
// Novelty and very low quality voices that should never read commentary.
const NOVELTY=/\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|bruce|agnes|princess|deranged|hysterical|grandma|grandpa|rocko|shelley|flo|eddy|reed|sandy)\b|espeak|\bmbrola\b/i;
export function voiceScore(v,tag){
 const t=norm(tag),lang=t.split('-')[0],vl=norm(v.lang);
 if(vl.split('-')[0]!==lang||NOVELTY.test(v.name||''))return -Infinity;
 return (vl===t?2:0)+(GOOD.test(v.name||'')?3:0)+(/natural|neural|premium|enhanced/i.test(v.name||'')?1:0)+(v.localService?.5:0);
}
/* The best installed voice for a language tag: good voices first, an exact language-region match next, then a local voice; none if the language is missing. */
export function pickVoice(list,tag){
 let best=null,score=-Infinity;
 for(const v of list){const s=voiceScore(v,tag);if(s>score){score=s;best=v;}}
 return score>-Infinity?best:null;
}
/* A line as phrases with a delivery each: the build-up is even, the call (with "!") comes out a touch higher and faster. */
export function phrases(text){
 const parts=String(text).match(/[^.!?…]+(?:…|[.!?]+)?/g)?.map(s=>s.trim()).filter(Boolean)||[];
 return parts.map(p=>{const hype=/!/.test(p);return {text:p,pitch:hype?1.14:1,rate:hype?1.08:1};});
}
let speaking=false,waiting=null;
export function stopSpeech(){waiting=null;speaking=false;try{synth()?.cancel();}catch{}}
function sayNext(){
 const job=waiting;waiting=null;if(!job||!on){speaking=false;return;}
 const s=synth();speaking=true;let left=job.parts.length;
 for(const p of job.parts){
  const u=new globalThis.SpeechSynthesisUtterance(p.text);u.lang=job.tag;u.volume=Math.min(1,volume*2);
  u.rate=Math.max(.7,Math.min(1.7,job.rate*p.rate));u.pitch=p.pitch;if(job.voice)u.voice=job.voice;
  u.onend=u.onerror=()=>{if(--left<=0){speaking=false;if(waiting)sayNext();}};
  s.speak(u);
 }
}
/* Speaks a line. If the voice is busy the line waits for it (only the newest waiting line is kept), so calls finish instead of being cut off mid-word. */
export function speak(text,{tag='en-US',muted=false,rate=1}={}){
 if(!on||muted||volume<=0||!text||!speechAvailable())return false;
 try{
  const s=synth();if(!voices.length)voices=s.getVoices();
  waiting={parts:phrases(text),tag,rate,voice:pickVoice(voices,tag)};
  if(!speaking||!s.speaking){speaking=false;sayNext();}
  return true;
 }catch{return false;}
}
try{globalThis.speechSynthesis?.addEventListener?.('voiceschanged',()=>{voices=globalThis.speechSynthesis.getVoices();});}catch{}
