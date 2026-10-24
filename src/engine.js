import {SHOTS,choosePlay,describePlay} from './basketball.js';
export const VERSION=3;
export const cap=(x,min=0,max=100)=>Math.max(min,Math.min(max,x));
export const mean=(list,key)=>list.reduce((s,p)=>s+p[key],0)/Math.max(1,list.length);
export function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
export const plans={shooting:{name:'Shooting lab',cost:90,skill:3,energy:-10,morale:1,chem:1,gpa:-.03},defense:{name:'Defensive rotations',cost:80,skill:2,energy:-8,morale:0,chem:3,gpa:-.02},recovery:{name:'Recovery & mobility',cost:60,skill:0,energy:20,morale:2,chem:0,gpa:0},study:{name:'Study hall',cost:40,skill:0,energy:4,morale:0,chem:1,gpa:.25},bond:{name:'Team dinner',cost:100,skill:0,energy:6,morale:8,chem:8,gpa:0}};
export const staff=[{name:'Development specialist',cost:300,detail:'+1 skill on skill practices',key:'development'},{name:'Sports recovery coach',cost:300,detail:'+8 energy on recovery; lower injury risk',key:'recovery'},{name:'Culture builder',cost:250,detail:'+3 morale and chemistry on team dinners',key:'culture'}];
export const eligible=p=>p.gpa>=2&&p.injury===0&&p.energy>=15;
/* Display names for the three difficulty keys. Keys stay the same so existing saves still load. */
export const DIFFICULTIES={rookie:{label:'C Team',short:'C TEAM',blurb:'Rookie',tier:'ROOKIE',level:'c'},standard:{label:'Junior Varsity',short:'JV',blurb:'All-Star',tier:'ALL-STAR',level:'jv'},elite:{label:'Varsity',short:'VARSITY',blurb:'Hall of Fame',tier:'HALL OF FAME',level:'varsity'}};
/* The real team a difficulty coaches. Older single-team data files fall back to their top-level roster. */
export const teamFor=(data,difficulty)=>data.levels?.[DIFFICULTIES[difficulty]?.level]??{label:'Varsity',players:data.players,games:data.games,source:data.source};
/* Season structure for any schedule length: the last four games are the elimination run; the qualifying bar is 46% wins before it (7 of 14 for an 18-game varsity season). */
export function seasonPlan(s){const n=s.schedule.length,cut=Math.max(1,n-4),post=s.schedule.findIndex(g=>g.type==='Postseason'),stretch=post>0&&post<cut?post:Math.max(0,cut-6),varsity=(s.level??'varsity')==='varsity';return {n,cut,stretch,need:Math.ceil(cut*.46),run:varsity?'state run':'title run',stretchName:varsity?'District stretch':'League stretch',runName:varsity?'State run':'Title run'};}
const STAT_KEYS=['reb','ast','stl','blk','fgm','fga','tpm','tpa','tov'];
export const blankLine=()=>({pts:0,reb:0,ast:0,stl:0,blk:0,fgm:0,fga:0,tpm:0,tpa:0,tov:0});
const totals=()=>Object.fromEntries(STAT_KEYS.map(k=>[k,0]));
/* ESPN-style per-game averages (PPG, RPG, APG, SPG, BPG) from season totals. */
export function perGame(p){const g=p.games||0,f=k=>g?Math.round((p[k]||0)/g*10)/10:null;return {gp:g,ppg:g?Math.round(p.points/g*10)/10:null,rpg:f('reb'),apg:f('ast'),spg:f('stl'),bpg:f('blk'),fgp:p.fga?Math.round(p.fgm/p.fga*1000)/10:null,tpp:p.tpa?Math.round(p.tpm/p.tpa*1000)/10:null};}
export function leaders(s,min=1){const pool=s.players.filter(p=>(p.games||0)>=min);if(!pool.length&&s.players.length){const L=estimateLines(s);const top=k=>{const b=[...s.players].sort((a,c)=>L[c.id][k]-L[a.id][k])[0];return {name:b.name,id:b.id,number:b.number,value:L[b.id][k]};};return {ppg:top('ppg'),apg:top('apg'),rpg:top('rpg'),bpg:top('bpg'),spg:top('spg'),est:true};}const top=k=>{const best=pool.map(p=>({p,v:perGame(p)[k]})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v)[0];return best?{name:best.p.name,id:best.p.id,number:best.p.number,value:best.v}:null;};return {ppg:top('ppg'),apg:top('apg'),rpg:top('rpg'),bpg:top('bpg'),spg:top('spg')};}
export function createGame(data,name,difficulty='standard',seed=Date.now()>>>0){const team=teamFor(data,difficulty);
 return {version:VERSION,coach:name.trim().slice(0,32)||'Coach',difficulty,seed,week:0,tokens:1000,fans:120,chemistry:58,actions:3,wins:0,losses:0,assistant:null,kit:'home',trim:'#e9b858',finished:false,champion:false,scouted:false,conversation:false,results:[],level:DIFFICULTIES[difficulty]?.level??'varsity',standings:Object.fromEntries(['Lake Washington',...new Set(team.games.map(g=>g.opponent))].map(name=>[name,{name,w:0,l:0}])),log:[],ripples:[],match:null,players:team.players.map((p,i)=>({...p,id:i,originalName:p.name,...totals(),skill:64+(i*7%15),energy:88,morale:70,gpa:2.8+(i%4)*.2,injury:0,starter:[0,2,3,7,10].includes(i),minutes:[0,2,3,7,10].includes(i)?24:0,points:0,games:0})),pool:['Alex Rivera','Jordan Lee','Sam Taylor','Casey Brooks','Morgan Ellis','Riley Chen'].map((name,i)=>({id:100+i,name,originalName:name,number:40+i,position:i%2?'Forward':'Guard',height:'Tryout',year:'Fictional prospect',...totals(),skill:66+i*2,energy:90,morale:70,gpa:3,injury:0,starter:false,minutes:0,points:0,games:0,cost:150+i*45})),schedule:structuredClone(team.games),opponents:structuredClone(team.opponents??{}),sourceChecked:data.checkedAt,refPpg:Number.isFinite(team.refPointsPerGame)?team.refPointsPerGame:null};
}
// Entries keep their English text and may also carry a key (k) and parameters (p), which the interface uses to show the line in the player's language.
export function log(s,text,k,p){const entry={week:s.week+1,text};if(k){entry.k=k;if(p)entry.p=p;}s.log.unshift(entry);s.log=s.log.slice(0,120);return entry;}
function open(s){if(s.finished)throw Error('This season is complete. Start a new season to play again.');if(s.match)throw Error('Finish the current game first.');}
function spend(s,cost,action=true){open(s);if(s.tokens<cost)throw Error('Not enough program tokens.');if(action&&s.actions<1)throw Error('Your three preparation slots are used. Play the next game.');s.tokens-=cost;if(action)s.actions--;}
export function train(s,type,id='all',opts={}){
 const a=plans[type];if(!a)throw Error('Unknown practice');const selected=id==='all'?s.players:s.players.filter(p=>p.id===+id);if(!selected.length)throw Error('Choose a player');spend(s,0);const perfect=!!opts.perfect;
 for(const p of selected){p.skill=cap(p.skill+a.skill+(s.assistant==='development'&&a.skill?1:0)+(perfect&&a.skill?1:0),35,98);p.energy=cap(p.energy+a.energy+(s.assistant==='recovery'&&type==='recovery'?8:0));p.morale=cap(p.morale+a.morale+(s.assistant==='culture'&&type==='bond'?3:0)+(perfect?2:0));p.gpa=cap(p.gpa+a.gpa,0,4);if(type==='recovery')p.injury=Math.max(0,p.injury-1);}
 s.chemistry=cap(s.chemistry+a.chem+(s.assistant==='culture'&&type==='bond'?3:0));
 const whole=selected.length===s.players.length,sign=n=>`${n>=0?'+':''}${n}`,p={plan:type,who:whole?'':selected[0].name,whole,skill:sign(a.skill),energy:sign(a.energy),gpa:sign(a.gpa.toFixed(2)),perfect};
 const text=`${a.name}: ${whole?'whole team':selected[0].name} · skill ${p.skill}, energy ${p.energy}, GPA ${p.gpa}${perfect?' · perfect drill bonus':''}`;
 log(s,text,'train',p);s.ripples.unshift({label:a.name,detail:text,week:s.week,k:'train',p});s.ripples=s.ripples.slice(0,12);
}
export function recruit(s,id){const p=s.pool.find(p=>p.id===+id);if(!p)throw Error('Prospect unavailable');if(s.players.length>=15)throw Error('Roster full: release a player before signing.');spend(s,p.cost,false);s.players.push({...p});s.pool=s.pool.filter(x=>x.id!==p.id);log(s,`${p.name} joined through tryouts for ${p.cost} tokens.`,'recruit',{name:p.name,cost:p.cost});}
export function release(s,id){open(s);if(s.players.length<=5)throw Error('Keep at least five players.');const p=s.players.find(p=>p.id===+id);if(!p)throw Error('Player unavailable');s.players=s.players.filter(x=>x.id!==p.id);log(s,`${p.name} released from the active roster.`,'release',{name:p.name});}
export function hire(s,key){if(s.assistant)throw Error('One assistant allowed. Dismiss your assistant first.');const a=staff.find(a=>a.key===key);if(!a)throw Error('Coach unavailable');spend(s,a.cost,false);s.assistant=key;log(s,`Hired ${a.name}.`,'hire',{staff:key});}
export function talk(s,choice){if(s.conversation)throw Error('This week’s team conversation is complete.');spend(s,0);s.conversation=true;
 if(choice==='listen'){s.players.forEach(p=>p.morale=cap(p.morale+7));s.chemistry=cap(s.chemistry+5);log(s,'You listened to the bench: morale +7, chemistry +5.','talkListen');}
 else if(choice==='fundraise'){s.tokens+=180;s.fans+=40;s.players.forEach(p=>p.energy=cap(p.energy-5));log(s,'Community clinic: +180 tokens, +40 fans, −5 energy.','talkFundraise');}
 else {s.players.forEach(p=>p.gpa=cap(p.gpa+.18,0,4));log(s,'Academic check-in: every simulated GPA +0.18.','talkAcademics');}
 s.ripples.unshift({label:'Team conversation',detail:s.log[0].text,week:s.week,k:s.log[0].k});
}
export function scout(s){if(s.scouted)throw Error('Opponent already scouted.');spend(s,50);s.scouted=true;log(s,'Film study revealed the opponent’s preferred style. Tactical reads improved.','scout');}
export function autoLineup(s){open(s);const list=s.players.filter(eligible).sort((a,b)=>(b.skill+b.energy*.2)-(a.skill+a.energy*.2));s.players.forEach(p=>{p.starter=false;p.minutes=0;});list.slice(0,5).forEach(p=>{p.starter=true;p.minutes=32;});}
/* Toggling a starter keeps the rotation consistent: a player who stops starting leaves it, and a new starter takes whatever minutes are still unassigned (up to 32). */
export function setStarter(s,id,on){open(s);const p=s.players.find(x=>x.id===+id);if(!p)throw Error('Choose a player');on=!!on;if(p.starter===on)return p;p.starter=on;if(!on)p.minutes=0;else if(p.minutes===0)p.minutes=Math.max(0,Math.min(32,160-s.players.reduce((a,x)=>a+x.minutes,0)));return p;}
/* Who in the rotation cannot play, and why: the reason is 'injured', 'gpa' or 'tired' (the first that applies). */
export function lineupIssues(s){return s.players.filter(p=>(p.starter||p.minutes>0)&&!eligible(p)).map(p=>({id:p.id,name:p.name,reason:p.injury>0?'injured':p.gpa<2?'gpa':'tired'}));}
/* Plays games with sensible preparation (recover when tired, study when grades slip, otherwise bond or shoot) until the season reaches the given week. Used by the judge demo and its "jump ahead" button. */
export function playTo(s,week){let guard=0;const stop=Math.min(week,s.schedule.length);while(!s.finished&&s.week<stop&&guard++<s.schedule.length+1){if(s.match)while(s.match)possession(s);if(s.week>=stop)break;if(mean(s.players,'energy')<70&&s.actions>0)train(s,'recovery');if(mean(s.players,'gpa')<2.7&&s.actions>0)train(s,'study');while(s.actions>0)train(s,s.chemistry<85?'bond':'shooting');autoLineup(s);startMatch(s);let k=0;while(s.match&&k++<500)possession(s);}return s;}
/* The season shown in the judge demo: a Junior Varsity campaign played to the middle of the schedule. It uses the first seed whose story suits a demonstration (4–5 wins by mid-season, then qualifying for the final run and winning it with the same sensible preparation), so it stays repeatable even after the schedule data is refreshed. */
export const DEMO={difficulty:'standard',week:7,seeds:400};
export function demoSeason(data){
 const start=seed=>playTo(createGame(data,'Judge',DEMO.difficulty,seed),DEMO.week);
 for(let seed=1;seed<=DEMO.seeds;seed++){const s=start(seed),P=seasonPlan(s);if(s.wins<4||s.wins>5)continue;const t=playTo(structuredClone(s),P.cut);if(t.wins<P.need)continue;if(playTo(t,t.schedule.length).champion)return s;}
 return start(1);
}
export function validateLineup(s){const active=s.players.filter(p=>p.minutes>0);if(s.players.filter(p=>p.starter).length!==5)throw Error('Select exactly five starters.');if(s.players.some(p=>p.starter&&p.minutes===0))throw Error('Each starter needs playing time.');if(active.some(p=>!eligible(p)))throw Error('An assigned player is injured, exhausted, or below the game’s 2.0 GPA threshold.');if(s.players.some(p=>!Number.isInteger(p.minutes)||p.minutes<0||p.minutes>32))throw Error('Minutes must be whole numbers from 0 to 32.');if(active.reduce((a,p)=>a+p.minutes,0)!==160)throw Error('Allocate exactly 160 player-minutes (five players × 32 minutes).');return true;}
/* The opponent's real roster for this level (or flagged fictional names when none is published). */
export function oppRoster(s,name){const r=s.opponents?.[name]?.players;return r?.length?r:[4,11,12,22,30,8,24].map(n=>({number:n,name:`${name} #${n}`}));}
export function opponent(s){const g=s.schedule[s.week];return {...g,roster:oppRoster(s,g.opponent),realRoster:!!s.opponents?.[g.opponent]?.real,rating:68+(s.week%5)*2+(s.week>=seasonPlan(s).cut?7:0),style:['perimeter','paint','transition'][s.week%3]};}
export function startMatch(s){open(s);validateLineup(s);s.match={possession:0,home:0,away:0,tactic:'balanced',pace:'steady',timeouts:3,boost:0,feed:[],box:Object.fromEntries(s.players.map(p=>[p.id,0])),line:Object.fromEntries(s.players.map(p=>[p.id,{...blankLine(),min:p.minutes,start:p.starter?1:0}])),events:[],seedStart:s.seed,feedMeta:[]};log(s,`Tip-off vs ${opponent(s).opponent}.`,'tipoff',{opp:opponent(s).opponent});}
export function timeout(s,message){const m=s.match;if(!m||m.timeouts<=0)throw Error('No timeouts remaining.');m.timeouts--;m.boost=8;if(message==='calm')s.players.forEach(p=>p.energy=cap(p.energy+4));else s.players.forEach(p=>p.morale=cap(p.morale+3));m.feed.unshift(`TIMEOUT · ${message==='calm'?'Breathe. Settle. Execute. Energy +4.':'Trust each other. Morale +3.'}`);m.feedMeta?.unshift({t:'t',m:message==='calm'?'calm':'belief'});}
function makePlay(s,team,shooter,helper,defender,opp,m){
 const home=team==='home',rng=()=>random(s);
 const kind=choosePlay(rng,home?m.tactic:opp.style==='perimeter'?'perimeter':'balanced',home?m.pace:opp.style==='transition'?'fast':'steady',m.events.at(-1)?.plays?.find(p=>p.team===team)?.kind);
 const spec=SHOTS[kind],separation=rng(),contest=separation>.68?'open':separation<.3?'tight':'contested';
 const skill=home?shooter.skill:opp.rating,energy=home?shooter.energy:78,chemistry=home?s.chemistry:65;
 const counter={perimeter:'zone',paint:'pressure',transition:'balanced'}[opp.style];
 const tactical=home?(s.scouted?.025:0):(m.tactic===counter?-.035:0);
 const impacts={skill:(skill-(home?opp.rating:74))*.55,energy:(energy-65)*.15,morale:home?(shooter.morale-65)*.1:0,chemistry:(chemistry-60)*.1,shotType:spec.base*100,space:(separation-.5)*17,tactics:tactical*100};
 const chance=cap(.43+Object.values(impacts).reduce((a,b)=>a+b,0)/100+(home&&m.boost>0?.04:0)+(home?(s.difficulty==='rookie'?.075:s.difficulty==='elite'?-.04:0):0),.16,.86);
 const stealChance=home?.035+(contest==='tight'?.04:0)+(100-energy)*.0004:(m.tactic==='pressure'?.10:.035);
 const blockChance=spec.three?.018:(contest==='tight'?.13:.045)+(kind==='dunk'?.015:0);
 let outcome=rng()<stealChance?'steal':rng()<blockChance?'block':rng()<chance?'made':'miss';
 const points=outcome==='made'?(spec.three?3:2):0,assisted=points>0&&['catch','dunk'].includes(kind);
 const play={team,kind,label:spec.label,player:shooter.name,id:shooter.id,jersey:shooter.number,helper:helper.name,helperId:helper.id,defender:defender.name,defenderId:defender.id,rebounder:home?opp.roster[Math.floor(rng()*opp.roster.length)].name:defender.name,lane:rng()>.5?1:-1,contest,points,outcome,three:!!spec.three,assisted,shotChance:Math.round(chance*100),impacts};
 const said=describePlay(play,rng);play.commentary=said.text;play.cm=said.cm;return play;
}
/* Weighted pick: forwards and players with more minutes defend (and rebound) more often. */
function weighted(list,r){const w=list.map(p=>Math.max(1,p.minutes)*(p.position==='Forward'||p.position==='Center'?1.8:1));let x=r*w.reduce((a,b)=>a+b,0);for(let i=0;i<list.length;i++){x-=w[i];if(x<=0)return list[i];}return list.at(-1);}
export function possession(s){
 const m=s.match;if(!m)throw Error('No game in progress');const opp=opponent(s),active=s.players.filter(p=>p.minutes>0);
 let pick=random(s)*160,shooter=active.at(-1);for(const p of active){pick-=p.minutes;if(pick<=0){shooter=p;break;}}
 const teammates=active.filter(p=>p.id!==shooter.id),helper=teammates[Math.floor(random(s)*teammates.length)],defender=weighted(teammates,random(s));
 const oppList=opp.roster,g1=oppList[Math.floor(random(s)*oppList.length)],g2=oppList.filter(x=>x!==g1)[Math.floor(random(s)*Math.max(1,oppList.length-1))]??g1;const guest={name:g1.name,id:-1,number:g1.number};
 const home=makePlay(s,'home',shooter,helper,guest,opp,m),away=makePlay(s,'away',guest,{name:g2.name,id:-2,number:g2.number},defender,opp,m);
 m.home+=home.points;m.away+=away.points;m.box[shooter.id]+=home.points;m.possession++;m.boost=Math.max(0,m.boost-1);
 m.stats??={home:{assists:0,blocks:0,steals:0,rebounds:0},away:{assists:0,blocks:0,steals:0,rebounds:0}};
 for(const p of [home,away]){const other=p.team==='home'?'away':'home';if(p.assisted)m.stats[p.team].assists++;if(p.outcome==='block')m.stats[other].blocks++;if(p.outcome==='steal')m.stats[other].steals++;else if(!p.points)m.stats[other].rebounds++;}
 m.line??=Object.fromEntries(s.players.map(p=>[p.id,blankLine()]));const L=id=>(m.line[id]??=blankLine());
 const sl=L(shooter.id);if(home.outcome==='steal')sl.tov++;else{sl.fga++;if(home.three)sl.tpa++;if(home.points){sl.fgm++;sl.pts+=home.points;if(home.three)sl.tpm++;}}
 if(home.assisted&&helper)L(helper.id).ast++;
 if(away.outcome==='steal')L(defender.id).stl++;else if(!away.points){if(away.outcome==='block')L(defender.id).blk++;L(defender.id).reb++;}
 const lineup=[...new Map([shooter,helper,defender,...active].map(p=>[p.id,p])).values()].slice(0,5).map(p=>({id:p.id,name:p.name,number:p.number}));
 const event={player:shooter.name,id:shooter.id,jersey:shooter.number,shotChance:home.shotChance,impacts:home.impacts,points:home.points,away:away.points,three:home.three,home:m.home,visitor:m.away,explanation:home.commentary,tactic:m.tactic,number:m.possession,plays:[home,away],lineup};
 m.events.push(event);m.feed.unshift(`VISITORS · ${away.commentary}`,`KANGS · ${home.commentary}`);m.feed=m.feed.slice(0,8);
 // A parallel record of what each feed line is, so it can be rebuilt in another language. Older saves have none.
 if(m.feedMeta)m.feedMeta=[{t:'p',team:'away',n:m.possession},{t:'p',team:'home',n:m.possession},...m.feedMeta].slice(0,8);
 active.forEach(p=>p.energy=cap(p.energy-(m.pace==='fast'?.22:.1)*p.minutes/32));
 if(m.possession>=64&&m.home!==m.away&&((m.possession-64)%5===0||m.possession===64))finish(s);
 return event;
}
function finish(s){const m=s.match,opp=opponent(s),won=m.home>m.away;const result={...opp,home:m.home,away:m.away,won,box:{...m.box},line:structuredClone(m.line??{}),stats:m.stats,events:m.events.slice(-12),ripples:s.ripples.filter(r=>r.week===s.week),reason:`${s.scouted?'Scouting prepared your defensive reads. ':''}Team chemistry ${Math.round(s.chemistry)}; average energy ${Math.round(mean(s.players,'energy'))}.`,why:{chem:Math.round(s.chemistry),energy:Math.round(mean(s.players,'energy')),scouted:!!s.scouted},week:s.week};s.results.push(result);won?s.wins++:s.losses++;updateStandings(s,opp.opponent,won);s.tokens+=won?230:160;s.fans=Math.max(40,s.fans+(won?80:-15));
 for(const p of s.players){if(p.minutes>0){p.points+=m.box[p.id];const ln=m.line?.[p.id];if(ln)for(const k of STAT_KEYS)p[k]=(p[k]||0)+ln[k];p.games++;p.energy=cap(p.energy-8);p.gpa=cap(p.gpa-.07,0,4);if(random(s)<(p.energy<45?.14:.025)*(s.assistant==='recovery'?.5:1)){p.injury=2;log(s,`${p.name}: simulated ankle strain. Recovery or rest required.`,'injury',{name:p.name});}}else{p.energy=cap(p.energy+12);p.morale=cap(p.morale-2);}p.morale=cap(p.morale+(won?4:-3));p.injury=Math.max(0,p.injury-1);}
 log(s,`${won?'WIN':'LOSS'} ${m.home}–${m.away} vs ${opp.opponent}. ${result.reason}`,'result',{won,home:m.home,away:m.away,opp:opp.opponent,...result.why});
 const plan=seasonPlan(s);if((s.week>=plan.cut&&!won)||(s.week===plan.cut-1&&s.wins<plan.need)){s.finished=true;s.champion=false;log(s,'The championship run ends this season. Review your decisions and try again.','runEnds');}
 s.week++;if(s.week===s.schedule.length){s.finished=true;s.champion=won;log(s,won?'STATE CHAMPIONS. One season. Your program.':'Season complete.',won?'champions':'seasonComplete');}
 s.actions=3;s.scouted=false;s.conversation=false;s.match=null;
}
function updateStandings(s,opponent,won){
 s.standings??=Object.fromEntries(['Lake Washington',...new Set(s.schedule.map(g=>g.opponent))].map(name=>[name,{name,w:0,l:0}]));
 s.standings['Lake Washington'][won?'w':'l']++;s.standings[opponent][won?'l':'w']++;
 const others=Object.keys(s.standings).filter(n=>n!=='Lake Washington'&&n!==opponent);
 const shift=s.week%others.length;const order=[...others.slice(shift),...others.slice(0,shift)];
 for(let i=0;i+1<order.length;i+=2){const [a,b]=[order[i],order[i+1]];let hash=(s.week+1)*7919;for(const c of a+b)hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;const awin=hash%101>48;s.standings[a][awin?'w':'l']++;s.standings[b][awin?'l':'w']++;}
}
export function validSave(s){
 const num=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
 const text=(v,max=200)=>typeof v==='string'&&v.length<=max;
 // Optional structured text: a short key plus a few scalar parameters.
 const scalar=v=>typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v))||text(v,100);
 const meta=o=>o.k===undefined||(typeof o.k==='string'&&/^[a-zA-Z]{1,24}$/.test(o.k)&&(o.p===undefined||(!!o.p&&typeof o.p==='object'&&!Array.isArray(o.p)&&Object.keys(o.p).length<=8&&Object.entries(o.p).every(([k,v])=>/^[a-zA-Z]{1,12}$/.test(k)&&scalar(v)))));
 const details=e=>!e.plays||(Array.isArray(e.plays)&&e.plays.length===2&&e.plays[0].team==='home'&&e.plays[1].team==='away'&&e.plays.every(c=>Object.hasOwn(SHOTS,c.kind)&&text(c.player,100)&&text(c.helper,100)&&text(c.defender,100)&&text(c.rebounder,100)&&text(c.commentary,500)&&text(c.label,100)&&num(c.jersey,0,99)&&[1,-1].includes(c.lane)&&['open','tight','contested'].includes(c.contest)&&['made','miss','block','steal'].includes(c.outcome)&&num(c.points,0,3)&&num(c.shotChance,0,100)&&(c.cm===undefined||(Array.isArray(c.cm)&&c.cm.length<=2&&c.cm.every(n=>Number.isInteger(n)&&n>=0&&n<=9))))&&Array.isArray(e.lineup)&&e.lineup.length===5&&e.lineup.every(p=>num(p.id,0,200)&&num(p.number,0,99)&&text(p.name,36)));
 const lineOk=l=>l===undefined||(l&&typeof l==='object'&&Object.values(l).every(x=>x&&typeof x==='object'&&Object.values(x).every(n=>num(n,0,300))));
 const oppOk=o=>o===undefined||(o&&typeof o==='object'&&Object.values(o).every(t=>t&&Array.isArray(t.players)&&t.players.length<=40&&t.players.every(x=>text(x.name,80)&&num(x.number,0,99))));
 const player=p=>p&&Number.isInteger(p.id)&&num(p.number,0,99)&&text(p.name,36)&&text(p.originalName,80)&&text(p.position,40)&&text(p.year,40)&&text(p.height,40)&&['skill','energy','morale'].every(k=>num(p[k],0,100))&&num(p.gpa,0,4)&&Number.isInteger(p.injury)&&num(p.injury,0,10)&&typeof p.starter==='boolean'&&Number.isInteger(p.minutes)&&num(p.minutes,0,32)&&num(p.points,0,100000)&&num(p.games,0,40)&&STAT_KEYS.every(k=>num(p[k],0,100000));
 return !!(s&&s.version===VERSION&&typeof s.finished==='boolean'&&typeof s.champion==='boolean'&&text(s.coach,32)&&['rookie','standard','elite'].includes(s.difficulty)&&['home','away','alternate'].includes(s.kit)&&/^#[0-9a-f]{6}$/i.test(s.trim)&&Number.isInteger(s.seed)&&Array.isArray(s.players)&&s.players.length>=5&&s.players.length<=15&&s.players.every(player)&&new Set(s.players.map(p=>p.id)).size===s.players.length&&Array.isArray(s.pool)&&s.pool.length<=6&&s.pool.every(p=>player(p)&&num(p.cost,0,1000))&&Array.isArray(s.schedule)&&s.schedule.length>=8&&s.schedule.length<=40&&s.schedule.every(g=>text(g.opponent,100)&&/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(g.date)&&text(g.venue,200)&&((g.points===null&&g.against===null)||(Number.isInteger(g.points)&&Number.isInteger(g.against)&&num(g.points,0,300)&&num(g.against,0,300))))&&Number.isInteger(s.week)&&num(s.week,0,s.schedule.length)&&['varsity','jv','c'].includes(s.level)&&oppOk(s.opponents)&&(s.refPpg==null||num(s.refPpg,0,300))&&num(s.tokens,0,100000)&&num(s.fans,0,1000000)&&num(s.chemistry,0,100)&&num(s.actions,0,3)&&num(s.wins,0,40)&&num(s.losses,0,40)&&[null,...staff.map(a=>a.key)].includes(s.assistant)&&(!s.standings||Object.values(s.standings).every(t=>text(t.name,100)&&num(t.w,0,40)&&num(t.l,0,40)))&&Array.isArray(s.results)&&s.results.length===s.week&&s.results.every(r=>text(r.opponent,100)&&text(r.date,20)&&num(r.home,0,300)&&num(r.away,0,300)&&Array.isArray(r.events)&&r.events.length<=500&&r.events.every(e=>details(e)&&text(e.player,36)&&text(e.explanation,300)&&num(e.id,0,200)&&num(e.points,0,3)&&(!e.impacts||Object.values(e.impacts).every(n=>num(n,-100,100))))&&Array.isArray(r.ripples)&&r.ripples.every(x=>text(x.detail,500)&&meta(x))&&(r.why===undefined||(!!r.why&&num(r.why.chem,0,100)&&num(r.why.energy,0,100)&&typeof r.why.scouted==='boolean'))&&r.box&&typeof r.box==='object'&&Object.values(r.box).every(n=>num(n,0,300))&&lineOk(r.line))&&Array.isArray(s.log)&&s.log.every(l=>text(l.text,500)&&num(l.week,0,41)&&meta(l))&&Array.isArray(s.ripples)&&s.ripples.every(r=>text(r.label,100)&&text(r.detail,500)&&num(r.week,0,40)&&meta(r))&&(s.match===null||(s.match&&num(s.match.possession,0,500)&&num(s.match.home,0,300)&&num(s.match.away,0,300)&&num(s.match.timeouts,0,3)&&num(s.match.boost,0,8)&&['balanced','zone','pressure','perimeter'].includes(s.match.tactic)&&['steady','fast'].includes(s.match.pace)&&Array.isArray(s.match.feed)&&s.match.feed.every(t=>text(t,500))&&(s.match.feedMeta===undefined||(Array.isArray(s.match.feedMeta)&&s.match.feedMeta.length<=12&&s.match.feedMeta.every(f=>!!f&&(f.t==='t'?['calm','belief'].includes(f.m):f.t==='p'&&['home','away'].includes(f.team)&&Number.isInteger(f.n)&&f.n>=1&&f.n<=500))))&&Array.isArray(s.match.events)&&s.match.events.every(e=>details(e)&&text(e.player,36)&&text(e.explanation,300)&&num(e.id,0,200)&&num(e.points,0,3)&&(!e.impacts||Object.values(e.impacts).every(n=>num(n,-100,100))))&&s.match.box&&Object.values(s.match.box).every(n=>num(n,0,300))&&s.players.every(p=>num(s.match.box[p.id],0,300))&&lineOk(s.match.line))));
}

// ---- Scouting ratings, bios and generated stat lines (no placeholders) ----
export function hashStr(str){let h=2166136261;for(const c of String(str))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
const pick=(h,shift,n)=>((h>>>shift)%n);
export function bio(p){const listed=p.position&&p.position!=='Not listed',hasHeight=p.height&&/\d/.test(p.height);const h=hashStr(p.originalName||p.name);const pos=listed?p.position:['Guard','Guard','Forward','Forward','Center'][pick(h,3,5)];
 const base={Guard:69,Forward:73,Center:75}[pos]??71;const inches=hasHeight?null:base-2+pick(h,9,5)-(p.year==='Freshman'?1:0);return {position:pos,height:hasHeight?p.height:`${Math.floor(inches/12)}' ${inches%12}"`,assigned:!listed||!hasHeight};}
export function ratings(p){const h=hashStr((p.originalName||p.name)+'#'+p.number),pos=bio(p).position,sk=p.skill;const tilt={Guard:[-3,2,4,3,-6],Forward:[3,0,-2,-1,3],Center:[7,-3,-9,-5,8]}[pos]||[0,0,0,0,0];const jit=i=>pick(h,i*5,9)-4;
 const v=tilt.map((t,i)=>Math.max(35,Math.min(99,Math.round(sk+t+jit(i)))));const [ins,mid,tpt,perd,insd]=v;const ovr=Math.round((ins+mid+tpt+perd+insd)/5*.55+Math.max(...v)*.45);
 const top=['ins','mid','tpt','perd','insd'][v.indexOf(Math.max(...v))];const archetype={ins:pos==='Guard'?'Slashing Playmaker':'Post Scorer',mid:'Mid-Range Maestro',tpt:pos==='Guard'?'Sharpshooter':'Stretch Forward',perd:'Lockdown Defender',insd:pos==='Center'?'Rim Protector':'Glass Cleaner'}[top];
 const stars=a=>a>=82?3:a>=72?2:1;const attrs=[['Inside scoring',ins],['Mid-range',mid],['Three-point',tpt],['Perimeter D',perd],['Interior D',insd]].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n,a])=>({name:n,stars:stars(a)}));return {ovr,ins,mid,tpt,perd,insd,archetype,attrs};}
export function grade(v){return v>=92?'A+':v>=88?'A':v>=84?'A-':v>=80?'B+':v>=76?'B':v>=72?'B-':v>=68?'C+':v>=64?'C':v>=60?'C-':v>=56?'D+':v>=52?'D':'D-';}
// Estimated per-game line built from the team's points per game split by role and ratings: this season's final scores when any exist, else the previous season's average (refPpg), else 55.
export function estimateLines(s){const games=s.schedule||[],real=games.filter(g=>Number.isInteger(g.points));const teamPpg=real.length?real.reduce((a,g)=>a+g.points,0)/real.length:(s.refPpg>0?s.refPpg:55);
 const ranked=[...s.players].sort((a,b)=>b.skill-a.skill||a.id-b.id),role=new Map(ranked.map((p,i)=>[p.id,i<5?1:i<8?.5:.3]));
 const w=s.players.map(p=>{const r=ratings(p);return [p,Math.pow(Math.max(5,(r.ins+r.mid+r.tpt)/3-40),1.35)*role.get(p.id)];});const tot=w.reduce((a,[,x])=>a+x,0)||1;const out={};
 for(const [p,x] of w){const pos=bio(p).position,r=ratings(p),ro=role.get(p.id),h=hashStr(p.name+'line'),j=k=>.85+pick(h,k*4,31)/100,q=v=>Math.max(.1,Math.round(v*10)/10);
  const reb={Guard:2.4,Forward:4.8,Center:6.4}[pos]*ro*(.6+r.insd/150)*j(1),ast={Guard:2.6,Forward:1.4,Center:.9}[pos]*ro*(.6+r.mid/160)*j(2),stl={Guard:1.3,Forward:.9,Center:.6}[pos]*ro*(.6+r.perd/160)*j(3),blk={Guard:.2,Forward:.6,Center:1.3}[pos]*ro*(.6+r.insd/160)*j(4);
  out[p.id]={gp:0,ppg:q(teamPpg*x/tot),rpg:q(reb),apg:q(ast),spg:q(stl),bpg:q(blk),fgp:Math.round((38+r.ins/10+pick(h,20,8))*10)/10,tpp:Math.round((24+r.tpt/9+pick(h,24,8))*10)/10,est:true};}
 return out;}
export function statLine(s,p){return p.games?{...perGame(p),est:false}:(estimateLines(s)[p.id]);}
