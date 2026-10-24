// Spoken live commentary through the browser's speech voices. Off when sound is off; the text is the same translated line that is shown and announced.
let on=true,volume=.35,voices=[];
export function configureSpeech({enabled,volume:v}={}){if(typeof enabled==='boolean'){on=enabled;if(!on)stopSpeech();}if(typeof v==='number')volume=Math.max(0,Math.min(1,v));}
const synth=()=>globalThis.speechSynthesis;
export const speechAvailable=()=>!!synth()&&typeof globalThis.SpeechSynthesisUtterance==='function';
/* The best installed voice for a language tag: an exact match first, then the same language, otherwise none (the browser then picks its default for the utterance's lang). */
export function pickVoice(list,tag){
 const t=String(tag).toLowerCase(),lang=t.split('-')[0];
 const same=list.filter(v=>String(v.lang).toLowerCase().replace('_','-').split('-')[0]===lang);
 return same.find(v=>String(v.lang).toLowerCase().replace('_','-')===t)||same.find(v=>v.localService)||same[0]||null;
}
export function stopSpeech(){try{synth()?.cancel();}catch{}}
/* Speaks a line. A new line replaces one that is still being read, so the voice never falls behind the play. */
export function speak(text,{tag='en-US',muted=false,rate=1}={}){
 if(!on||muted||volume<=0||!text||!speechAvailable())return false;
 try{
  const s=synth();if(!voices.length)voices=s.getVoices();s.cancel();
  const u=new globalThis.SpeechSynthesisUtterance(text);u.lang=tag;u.volume=Math.min(1,volume*2);u.rate=Math.max(.7,Math.min(1.6,rate));
  const v=pickVoice(voices,tag);if(v)u.voice=v;s.speak(u);return true;
 }catch{return false;}
}
try{globalThis.speechSynthesis?.addEventListener?.('voiceschanged',()=>{voices=globalThis.speechSynthesis.getVoices();});}catch{}
