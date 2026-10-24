// Plays many seeded seasons per level and strategy and prints title rate, win rate and skill. Usage: node scripts/balance.mjs [seasons per cell, default 200]
import fs from 'node:fs';
import * as E from '../src/engine.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json',import.meta.url)));
const N=+process.argv[2]||200;
// none: no practice. mix: recover when tired, study when grades slip, otherwise a team dinner or a shooting session. perfect: the same, with a perfect drill each time. focus: one-on-one shooting sessions with the weakest starters.
function season(diff,seed,strat){
 const s=E.createGame(data,'Balance',diff,seed),skill=[],tokens=[];let guard=0;
 while(!s.finished&&guard++<s.schedule.length+1){
  if(strat!=='none'){
   const perfect=strat==='perfect'||strat==='focus';
   if(E.mean(s.players,'energy')<70&&s.actions>0)E.train(s,'recovery','all',{perfect});
   if(E.mean(s.players,'gpa')<2.7&&s.actions>0)E.train(s,'study','all',{perfect});
   if(strat==='focus'){let i=0;while(s.actions>0){if(s.chemistry<85&&i%2===0)E.train(s,'bond','all',{perfect});else{const st=s.players.filter(p=>p.starter).sort((a,b)=>a.skill-b.skill);E.train(s,'shooting',st[i%st.length].id,{perfect});}i++;}}
   else while(s.actions>0)E.train(s,s.chemistry<85?'bond':'shooting','all',{perfect});
  }
  E.autoLineup(s);E.startMatch(s);let k=0;while(s.match&&k++<500)E.possession(s);
  skill.push(E.mean(s.players,'skill'));tokens.push(s.tokens);
 }
 return {champion:s.champion,wins:s.wins,games:s.wins+s.losses,skill8:skill[Math.min(7,skill.length-1)],skillEnd:skill.at(-1),tokens8:tokens[Math.min(7,tokens.length-1)]};
}
const table={};
for(const [diff,label] of [['rookie','C Team'],['standard','JV'],['elite','Varsity']])for(const strat of ['none','mix','perfect','focus']){
 let titles=0,wins=0,games=0,skill8=0,skillEnd=0,tokens8=0;
 for(let seed=1;seed<=N;seed++){const r=season(diff,seed,strat);titles+=r.champion?1:0;wins+=r.wins;games+=r.games;skill8+=r.skill8;skillEnd+=r.skillEnd;tokens8+=r.tokens8;}
 table[`${label} · ${strat}`]={'title %':Math.round(100*titles/N),'win %':Math.round(100*wins/games),'skill at game 8':+(skill8/N).toFixed(1),'skill at end':+(skillEnd/N).toFixed(1),'tokens at game 8':Math.round(tokens8/N)};
}
console.table(table);
