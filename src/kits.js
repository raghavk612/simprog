// Jersey kits. The first three are always available; the three special kits are earned during the season (see unlockedKits in engine.js).
// Showcase palette (3D locker-room jerseys) and the two colours the 3D gym players wear: [jersey, lettering]. A lettering of null means the coach's trim colour.
export const CORE_KITS=['home','away','alternate'];
export const SPECIAL_KITS=['throwback','seniornight','blackout'];
export const ALL_KITS=[...CORE_KITS,...SPECIAL_KITS];
export const KIT_NAMES={throwback:'Throwback',seniornight:'Senior Night',blackout:'Blackout'};
export const isSpecialKit=k=>SPECIAL_KITS.includes(k);
export const KITS={
 home:{body:'#6832ab',dark:'#4a1f80',trim:'#ffffff',ink:'#ffffff',accent:'#e9b858',scriptLine:'#2a1050',numLine:'#2a1050'},
 away:{body:'#f4effc',dark:'#d9cdee',trim:'#562494',ink:'#562494',accent:'#8b4fe0',scriptLine:'#ffffff',numLine:'#2a1050'},
 // Midnight: black with purple trim, white script and a purple number outlined in white (like the real Lake Washington black jersey).
 alternate:{body:'#16121b',dark:'#08060b',trim:'#7b3fd1',ink:'#ffffff',accent:'#7b3fd1',scriptLine:'#7b3fd1',num:'#8b4fe0',numLine:'#ffffff'},
 // Throwback: cream with vintage purple and gold trim.
 throwback:{body:'#f1e6c8',dark:'#d8c79b',trim:'#6832ab',ink:'#6832ab',accent:'#e9b858',vintage:true,scriptLine:'#e9b858',numLine:'#e9b858'},
 // Senior Night: purple with gold sleeves and neck, and a star.
 seniornight:{body:'#6832ab',dark:'#4a1f80',trim:'#e9b858',ink:'#e9b858',accent:'#e9b858',star:true,sleeves:'#e9b858',scriptLine:'#2a1050',numLine:'#2a1050'},
 // Blackout: all black with purple pinstripes, purple script and a black number outlined in purple.
 blackout:{body:'#0b0910',dark:'#030207',trim:'#5b2a9e',ink:'#9d5cf2',accent:'#7b3fd1',stripe:'#3b1f66',scriptLine:'#000000',num:'#0b0910',numLine:'#9d5cf2'}
};
const GYM={home:['#6832ab',null],away:['#f4effc','#562494'],alternate:['#16121b','#8b4fe0'],throwback:['#f1e6c8','#6832ab'],seniornight:['#6832ab','#e9b858'],blackout:['#0b0910','#9d5cf2']};
export const gymColors=(kit,trim='#ffffff')=>{const [bg,fg]=GYM[kit]||GYM.home;return [bg,fg||trim];};
