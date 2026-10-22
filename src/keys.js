// Rebindable keyboard shortcuts for the coaching controls. Bindings are stored as KeyboardEvent.code values.
export const ACTIONS=['playPause','nextPlay','timeout','camWide','camCourt','camFollow','speed','sound','settings'];
export const DEFAULT_KEYS={playPause:'KeyP',nextPlay:'KeyN',timeout:'KeyT',camWide:'Digit1',camCourt:'Digit2',camFollow:'Digit3',speed:'KeyS',sound:'KeyM',settings:'KeyO'};
// Keys that keep their normal meaning (navigation, activation, dismissal and modifiers).
export const RESERVED=['Tab','Enter','NumpadEnter','Space','Escape','Backspace','CapsLock','ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight','ContextMenu'];
const STORAGE='kangs_keybindings';
const NAMES={ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Comma:',',Period:'.',Slash:'/',Backslash:'\\',Semicolon:';',Quote:"'",BracketLeft:'[',BracketRight:']',Minus:'-',Equal:'=',Backquote:'`'};
// Value for aria-keyshortcuts, which names keys rather than physical key codes.
export const ariaKey=code=>code.replace(/^(Key|Digit)/,'');
export function keyLabel(code){return NAMES[code]||code.replace(/^(Key|Digit|Numpad)/,(m)=>m==='Numpad'?'Num ':'');}
export function loadKeys(){
 const keys={...DEFAULT_KEYS};
 try{
  const saved=JSON.parse(localStorage.getItem(STORAGE));
  if(saved&&typeof saved==='object'){
   const used=new Set();
   for(const a of ACTIONS){const c=saved[a];if(typeof c==='string'&&c.length<=20&&!RESERVED.includes(c)&&!used.has(c)){keys[a]=c;used.add(c);}}
   // If a saved key collides with a default that stayed in place, fall back to the defaults.
   const taken=new Map();for(const a of ACTIONS){if(taken.has(keys[a]))return {...DEFAULT_KEYS};taken.set(keys[a],a);}
  }
 }catch{}
 return keys;
}
export function saveKeys(keys){try{localStorage.setItem(STORAGE,JSON.stringify(keys));}catch{}}
// Returns the action that already uses this key, or null. Reserved keys are reported as 'reserved'.
export function findConflict(keys,action,code){
 if(RESERVED.includes(code))return 'reserved';
 return ACTIONS.find(a=>a!==action&&keys[a]===code)||null;
}
