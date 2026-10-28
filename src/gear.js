// One copy per item, one item per body slot, and no permanent changes to base stats.
export const GEAR=[
 {key:'courtshoes',slot:'feet',cost:180,buff:{skill:2}},
 {key:'speedshoes',slot:'feet',cost:260,buff:{energy:5}},
 {key:'shootingsleeve',slot:'arm',cost:160,buff:{skill:2}},
 {key:'compression',slot:'arm',cost:210,buff:{energy:4}},
 {key:'headband',slot:'head',cost:120,buff:{morale:5}},
 {key:'focusband',slot:'head',cost:240,buff:{skill:1,morale:3}},
];
export const GEAR_SLOTS=['feet','arm','head'];
export const gearItem=key=>GEAR.find(g=>g.key===key);
export const gearOwner=(s,key)=>Object.entries(s.gear?.equipped||{}).find(([,slots])=>Object.values(slots).includes(key))?.[0];
export function gearBonus(s,p){const total={skill:0,energy:0,morale:0};for(const key of Object.values(s.gear?.equipped?.[p.id]||{})){const item=gearItem(key);if(!item||!s.gear?.owned?.includes(key))continue;for(const [stat,n] of Object.entries(item.buff))total[stat]+=n;}return total;}
export const effectiveStat=(s,p,key)=>Math.min(100,p[key]+(gearBonus(s,p)[key]||0));
export function validGear(s){
 if(s.gear===undefined)return true;
 const g=s.gear,obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 if(!obj(g)||Object.keys(g).some(k=>!['owned','equipped'].includes(k))||!Array.isArray(g.owned)||g.owned.length>GEAR.length||new Set(g.owned).size!==g.owned.length||!g.owned.every(gearItem)||!obj(g.equipped)||!Array.isArray(s.players))return false;
 const used=new Set();
 return Object.entries(g.equipped).every(([id,slots])=>s.players.some(p=>String(p?.id)===id)&&obj(slots)&&Object.entries(slots).every(([slot,key])=>{if(!GEAR_SLOTS.includes(slot)||!g.owned.includes(key)||gearItem(key)?.slot!==slot||used.has(key))return false;used.add(key);return true;}));
}
