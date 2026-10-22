// Interface language: seven languages, remembered per browser, English fallback for anything missing.
import en from './locales/en.js';
export const LANGUAGES=[{code:'en',native:'English',tag:'en-US'},{code:'es',native:'Español',tag:'es'},{code:'zh',native:'中文',tag:'zh-CN'},{code:'fr',native:'Français',tag:'fr'},{code:'ja',native:'日本語',tag:'ja'},{code:'it',native:'Italiano',tag:'it'},{code:'hi',native:'हिन्दी',tag:'hi-IN'}];
const LOADERS={es:()=>import('./locales/es.js'),zh:()=>import('./locales/zh.js'),fr:()=>import('./locales/fr.js'),ja:()=>import('./locales/ja.js'),it:()=>import('./locales/it.js'),hi:()=>import('./locales/hi.js')};
const STORAGE='kangs-language';
const packs={en};
let current='en';
export const supported=code=>LANGUAGES.some(l=>l.code===code);
export const getLanguage=()=>current;
export const localeTag=()=>LANGUAGES.find(l=>l.code===current).tag;
// Saved choice first, then the browser's preferred languages (first that matches), otherwise English.
export function detectLanguage(){
 try{const saved=localStorage.getItem(STORAGE);if(supported(saved))return saved;}catch{}
 for(const lang of globalThis.navigator?.languages||[globalThis.navigator?.language]){const code=String(lang||'').slice(0,2).toLowerCase();if(supported(code))return code;}
 return 'en';
}
const lookup=(pack,key)=>key.split('.').reduce((o,k)=>o?.[k],pack);
const fill=(text,params)=>params?text.replace(/\{\{(\w+)\}\}/g,(m,k)=>params[k]??m):text;
// t('home.welcome',{name}) — values are inserted as given, so escape anything user-written before passing it.
export function t(key,params){
 const text=lookup(packs[current],key)??lookup(en,key);
 return typeof text==='string'?fill(text,params):key;
}
// Multi-line strings use \n; this turns them into <br> for HTML templates.
export const tb=(key,params)=>t(key,params).replace(/\n/g,'<br>');
// The design uses all-caps labels. Strings are stored in normal case (better for screen readers) and capitalised by language rules here.
export const tu=(key,params)=>t(key,params).toLocaleUpperCase(localeTag());
export const up=text=>String(text).toLocaleUpperCase(localeTag());
// Arrays of strings, such as the rulebook steps.
export function list(key){const v=lookup(packs[current],key)??lookup(en,key);return Array.isArray(v)?v:[];}
export const has=key=>typeof lookup(en,key)==='string';
// A whole object from the active language (falling back to English), such as the commentary templates.
export const section=key=>lookup(packs[current],key)??lookup(en,key);
export const formatNumber=n=>Number(n).toLocaleString(localeTag());
// Schedule dates are stored as m/d/yyyy.
export function formatDate(text){const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);return m?new Date(+m[3],+m[1]-1,+m[2]).toLocaleDateString(localeTag(),{year:'numeric',month:'short',day:'numeric'}):text;}
export const formatDateTime=iso=>new Date(iso).toLocaleString(localeTag());
// Engine errors are stored in English; known messages are translated for display.
export function translateError(message){return lookup(packs[current],'errors')?.[message]??lookup(en,'errors')?.[message]??message;}
async function load(code){
 if(packs[code])return;
 try{packs[code]=(await LOADERS[code]()).default;}catch{packs[code]=en;}
}
function applyDocument(){
 if(typeof document==='undefined')return;
 document.documentElement.lang=current;document.title=t('meta.title');
 document.querySelector('meta[name="description"]')?.setAttribute('content',t('meta.description'));
 const skip=document.querySelector('.skip-link');if(skip)skip.textContent=t('a11y.skip');
}
export async function setLanguage(code,{persist=true}={}){
 if(!supported(code))code='en';
 await load(code);current=code;
 if(persist)try{localStorage.setItem(STORAGE,code);}catch{}
 applyDocument();
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('kangs-language-changed',{detail:{code}}));
 return code;
}
export const initLanguage=()=>setLanguage(detectLanguage(),{persist:false});
