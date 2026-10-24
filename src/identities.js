// Who the five visiting bodies on the 3D court are. Pure, so it can be tested without Three.js.
import {boardName} from './scoreboard.js';
const DEFAULT_NUMBERS=[12,8,22,30,24];
/* The clip's shooter and helper come first (they are the names on screen), then the rest of the opponent roster.
   Fictional rosters ("Liberty #4") read as the school name on the nameplate; the number still tells them apart. */
export function visitorCast(roster,clip,opp){
 const list=Array.isArray(roster)?roster.filter(r=>r&&r.name):[];
 const named=[clip&&clip.player&&clip.player!=='Visitors'?{name:clip.player,number:clip.jersey}:null,clip&&clip.helper?{name:clip.helper,number:list.find(r=>r.name===clip.helper)?.number}:null].filter(Boolean);
 const used=new Set(named.map(x=>x.name)),all=[...named,...list.filter(r=>!used.has(r.name))];
 return Array.from({length:5},(_,i)=>{const r=all[i],name=r?.name;return {id:-i-1,number:r?.number??DEFAULT_NUMBERS[i],name:name||'Visitors',plate:name&&/#\d+$/.test(name)?boardName(opp):undefined};});
}
