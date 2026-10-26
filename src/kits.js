// Jersey kits. The first three are always available; the three special kits are earned during the season (see unlockedKits in engine.js).
// Showcase palette (3D locker-room jerseys) and the two colours the 3D gym players wear: [jersey, lettering]. A lettering of null means the coach's trim colour.
export const CORE_KITS=['home','away','alternate'];
export const SPECIAL_KITS=['throwback','seniornight','blackout'];
export const ALL_KITS=[...CORE_KITS,...SPECIAL_KITS];
export const KIT_NAMES={throwback:'Throwback',seniornight:'Senior Night',blackout:'Blackout'};
export const isSpecialKit=k=>SPECIAL_KITS.includes(k);
export const KITS={
 home:{body:'#6832ab',dark:'#4a1f80',trim:'#ffffff',ink:'#ffffff',accent:'#e9b858'},
 away:{body:'#f4effc',dark:'#d9cdee',trim:'#562494',ink:'#562494',accent:'#8b4fe0'},
 alternate:{body:'#191126',dark:'#0d0915',trim:'#e9b858',ink:'#e9b858',accent:'#8b4fe0'},
 // Throwback: cream with vintage purple and gold trim.
 throwback:{body:'#f1e6c8',dark:'#d8c79b',trim:'#6832ab',ink:'#6832ab',accent:'#e9b858',vintage:true},
 // Senior Night: purple with gold sleeves and neck, and a star.
 seniornight:{body:'#6832ab',dark:'#4a1f80',trim:'#e9b858',ink:'#e9b858',accent:'#e9b858',star:true,sleeves:'#e9b858'},
 // Blackout: black with purple and gold.
 blackout:{body:'#0b0910',dark:'#030207',trim:'#9d5cf2',ink:'#e9b858',accent:'#9d5cf2',stripe:'#e9b858'}
};
const GYM={home:['#6832ab',null],away:['#f4effc','#562494'],alternate:['#191126',null],throwback:['#f1e6c8','#6832ab'],seniornight:['#6832ab','#e9b858'],blackout:['#0b0910','#b78cff']};
export const gymColors=(kit,trim='#ffffff')=>{const [bg,fg]=GYM[kit]||GYM.home;return [bg,fg||trim];};
