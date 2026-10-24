import {seasonPlan} from './engine.js';
/* Achievements are computed from the save, never stored (only the ids already announced are, in s.seenAch). Counters come from s.tally with a fallback to what the results, practice notes and decision trail still show, so saves from before the tally keep their progress. */
export const ACHIEVEMENTS=['firstWin','perfectDrill','streak10','undefeated','zeroInjury','fullStrength','champion'];
export const STREAK=10;
export function bestStreak(results){let best=0,run=0;for(const r of results||[]){run=r.won?run+1:0;best=Math.max(best,run);}return best;}
export function achievements(s){
 const res=s.results||[],cut=seasonPlan(s).cut,tally=s.tally||{};
 const perfects=Math.max(tally.perfects||0,[...res.flatMap(r=>r.ripples||[]),...(s.ripples||[])].filter(r=>r.k==='train'&&r.p?.perfect).length);
 const injuries=Math.max(tally.injuries||0,(s.log||[]).filter(l=>l.k==='injury'&&l.week<=cut).length);
 const streak=bestStreak(res),regular=res.slice(0,cut),regWins=regular.filter(r=>r.won).length;
 return [
  {id:'firstWin',earned:res.some(r=>r.won)},
  {id:'perfectDrill',earned:perfects>0},
  {id:'streak10',earned:streak>=STREAK,progress:{n:Math.min(STREAK,streak),of:STREAK}},
  {id:'undefeated',earned:regular.length>=cut&&regWins===cut,progress:{n:regWins,of:cut}},
  {id:'zeroInjury',earned:res.length>=cut&&injuries===0,progress:{n:Math.min(res.length,cut),of:cut}},
  {id:'fullStrength',earned:(tally.full||0)>0},
  {id:'champion',earned:!!s.finished&&!!s.champion&&(s.level??'varsity')==='varsity'}
 ];
}
/* Ids earned that have not been announced yet. */
export const newlyEarned=s=>achievements(s).filter(a=>a.earned&&!(s.seenAch||[]).includes(a.id)).map(a=>a.id);
