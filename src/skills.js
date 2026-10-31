// Moves the Kangs know. Every team starts with the five basic moves; the rest are learned once, for tokens, along three branches where each move needs the one before it.
import {moveBag} from './basketball.js';
export const BASIC_MOVES=['catch','pullup','drive','floater','roll'];
export const SKILL_TREE={
 shooter:[{key:'corner',cost:150,requires:null},{key:'stepback',cost:250,requires:'corner'},{key:'fadeaway',cost:350,requires:'stepback'}],
 slasher:[{key:'euro',cost:150,requires:null},{key:'dunk',cost:300,requires:'euro'},{key:'alley',cost:400,requires:'dunk'}],
 post:[{key:'hook',cost:150,requires:null},{key:'spin',cost:250,requires:'hook'}],
};
const NODES=Object.values(SKILL_TREE).flat();
export const skillNode=key=>NODES.find(n=>n.key===key);
export const unlockedMoves=s=>[...BASIC_MOVES,...(Array.isArray(s.skills)?s.skills.filter(skillNode):[])];
/* Why a move cannot be learned now: owned, locked (the previous move in its branch is missing), or the same blocks as any purchase (season over, game in progress, inbox waiting, not enough tokens). */
export function canUnlock(s,key){const n=skillNode(key),own=unlockedMoves(s),no=reason=>({ok:false,reason});if(!n)return no('locked');if(own.includes(key))return no('owned');if(n.requires&&!own.includes(n.requires))return no('locked');if(s.finished)return no('season');if(s.match)return no('game');if(s.pendingEvent)return no('inbox');if(s.tokens<n.cost)return no('tokens');return {ok:true};}
/* The Kangs' bag for a tactic and pace, limited to learned moves. Dunks are a skill: a learned dunk joins the steady bag and a learned alley-oop the fast bag, so dunks appear in any non-perimeter game. A bag left empty falls back to its basic moves (or all five). */
export function skillBag(s,tactic,pace){
 const own=unlockedMoves(s),base=moveBag(tactic,pace),open=tactic!=='perimeter',extra=open&&pace==='fast'?'alley':open?'dunk':null;
 const bag=[...base,...(extra&&own.includes(extra)&&!base.includes(extra)?[extra]:[])].filter(k=>own.includes(k));if(bag.length)return bag;
 const basic=base.filter(k=>BASIC_MOVES.includes(k));return basic.length?basic:[...BASIC_MOVES];
}
/* Saves: optional; otherwise an array of distinct tree keys, each with its prerequisite present. */
export const validSkills=s=>s.skills===undefined||(Array.isArray(s.skills)&&s.skills.length<=NODES.length&&new Set(s.skills).size===s.skills.length&&s.skills.every(k=>{const n=skillNode(k);return !!n&&(n.requires===null||s.skills.includes(n.requires));}));
/* Share of the tree still locked (0 to 1): a team with few moves is predictable, and the engine lowers its shot chance by TUNING.repertoire times this share. */
export const lockedShare=s=>1-new Set(unlockedMoves(s).filter(skillNode)).size/NODES.length;
