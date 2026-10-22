// Persistent sound and accessibility preferences. Values are validated on load, applied to the page, and broadcast so other modules can react.
import {SOUND_KEYS,configureAudio} from './audio.js';
import {FILTER_ID,installColorFilters} from './a11y.js';
const EVENT='kangs-settings-changed',STORE={sound:'kangs_sound',a11y:'kangs_accessibility'};
const read=k=>{try{return JSON.parse(localStorage.getItem(k));}catch{return null;}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}};
const num=(v,min,max,d)=>Number.isFinite(+v)&&v!==null&&v!==''?Math.min(max,Math.max(min,+v)):d;
const pick=(v,list,d)=>list.includes(v)?v:d;
const bool=(v,d)=>typeof v==='boolean'?v:d;
export const COLOR_MODES=['none','deuteranopia','protanopia','tritanopia'];
export const FONT_FAMILIES=['default','modern','readable'];
export const PLAYBACK_SPEEDS=[.5,.75,1];
export const TEXT_SCALE={min:.7,max:1.8,step:.05};
// Sound effects start off, as before; volume and the individual sounds are remembered.
export const SOUND_DEFAULTS={volume:.35,muted:true,toggles:Object.fromEntries(SOUND_KEYS.map(k=>[k,true]))};
export const A11Y_DEFAULTS={colorBlindMode:'none',highContrast:false,reducedMotion:false,screenShake:true,flashReduction:false,textScale:1,fontFamily:'default',playbackSpeed:1,timingAssist:false,simplifiedUI:false};
const cache={};
export function normalizeSound(raw){
 const r=raw&&typeof raw==='object'?raw:{},t=r.toggles&&typeof r.toggles==='object'?r.toggles:{};
 return {volume:num(r.volume,0,1,SOUND_DEFAULTS.volume),muted:bool(r.muted,SOUND_DEFAULTS.muted),toggles:Object.fromEntries(SOUND_KEYS.map(k=>[k,bool(t[k],true)]))};
}
export function normalizeA11y(raw,base=A11Y_DEFAULTS){
 const r=raw&&typeof raw==='object'?raw:{},d=base;
 return {
  colorBlindMode:pick(r.colorBlindMode,COLOR_MODES,d.colorBlindMode),highContrast:bool(r.highContrast,d.highContrast),reducedMotion:bool(r.reducedMotion,d.reducedMotion),
  screenShake:bool(r.screenShake,d.screenShake),flashReduction:bool(r.flashReduction,d.flashReduction),textScale:Math.round(num(r.textScale,TEXT_SCALE.min,TEXT_SCALE.max,d.textScale)*100)/100,
  fontFamily:pick(r.fontFamily,FONT_FAMILIES,d.fontFamily),playbackSpeed:pick(+r.playbackSpeed,PLAYBACK_SPEEDS,d.playbackSpeed),timingAssist:bool(r.timingAssist,d.timingAssist),simplifiedUI:bool(r.simplifiedUI,d.simplifiedUI)
 };
}
// First visit: adopt the operating-system preferences for motion and contrast.
function systemDefaults(){
 const media=q=>typeof matchMedia==='function'&&matchMedia(q).matches;
 return {...A11Y_DEFAULTS,reducedMotion:media('(prefers-reduced-motion: reduce)'),screenShake:!media('(prefers-reduced-motion: reduce)'),highContrast:media('(prefers-contrast: more)')};
}
const emit=type=>{if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(EVENT,{detail:{type}}));};
export const getSound=()=>cache.sound??=normalizeSound(read(STORE.sound));
export const getA11y=()=>cache.a11y??=normalizeA11y(read(STORE.a11y),systemDefaults());
function commitSound(next){cache.sound=next;write(STORE.sound,next);configureAudio(next);emit('sound');}
function commitA11y(next){cache.a11y=next;write(STORE.a11y,next);applyA11y(next);emit('a11y');}
export const setSound=patch=>commitSound(normalizeSound({...getSound(),...patch,toggles:{...getSound().toggles,...patch.toggles}}));
export const resetSound=()=>commitSound(normalizeSound(null));
export const setA11y=patch=>commitA11y(normalizeA11y({...getA11y(),...patch}));
export const resetA11y=()=>commitA11y({...A11Y_DEFAULTS});
// Number of accessibility options that differ from their defaults (shown as a badge on the tab).
export const activeA11yCount=(s=getA11y())=>Object.keys(A11Y_DEFAULTS).filter(k=>s[k]!==A11Y_DEFAULTS[k]).length;
export const isTouchOnly=()=>typeof matchMedia==='function'&&matchMedia('(hover: none) and (pointer: coarse)').matches;
// Mirrors the settings onto <html> as classes and custom properties; the stylesheet does the rest.
export function applyA11y(s=getA11y()){
 const root=document.documentElement,cls=root.classList;
 root.style.filter=s.colorBlindMode==='none'?'':`url(#${FILTER_ID(s.colorBlindMode)})`;
 cls.toggle('a11y-high-contrast',s.highContrast);cls.toggle('a11y-reduced-motion',s.reducedMotion);cls.toggle('a11y-no-flash',s.flashReduction);cls.toggle('a11y-simple',s.simplifiedUI);
 for(const f of FONT_FAMILIES)cls.toggle(`a11y-font-${f}`,s.fontFamily===f);
 root.style.setProperty('--ts',String(s.textScale));
}
export function initSettings(){
 installColorFilters();configureAudio(getSound());applyA11y(getA11y());
 // Keep several open tabs in step.
 window.addEventListener('storage',e=>{
  if(e.key===STORE.sound){delete cache.sound;configureAudio(getSound());emit('sound');}
  if(e.key===STORE.a11y){delete cache.a11y;applyA11y(getA11y());emit('a11y');}
 });
}
export const onSettingsChange=fn=>window.addEventListener(EVENT,e=>fn(e.detail.type));
