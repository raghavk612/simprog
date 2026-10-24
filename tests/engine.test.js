import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as E from '../src/engine.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/kangs.json',import.meta.url)));const game=()=>{const s=E.createGame(data,'Test coach','standard',42);E.autoLineup(s);return s;};
test('KingCo dataset has a real roster and a dated schedule for every level (robust to daily score refreshes)',()=>{assert.deepEqual(Object.keys(data.levels),['varsity','jv','c']);const fresh=data.season==='2026–27';for(const [key,team] of Object.entries(data.levels)){assert.ok(team.players.length>=8&&team.players.length<=15,key);assert.ok(team.games.length>=8&&team.games.length<=40,key);assert.equal(new Set(team.players.map(p=>p.number)).size,team.players.length,key+' jersey numbers unique');for(const p of team.players){assert.ok(p.source.startsWith('https://www.kingcoathletics.com/team/'));assert.ok(Number.isInteger(p.number));}for(const g of team.games){assert.match(g.date,/^\d{1,2}\/\d{1,2}\/\d{4}$/);assert.ok(!Number.isNaN(Date.parse(g.date)),'date parses');const noScore=g.points===null&&g.against===null,scored=Number.isInteger(g.points)&&Number.isInteger(g.against)&&g.points!==g.against;assert.ok(noScore||scored,'score is both null (upcoming) or both integers (final), never invented or half-filled');assert.equal(typeof g.home,'boolean');assert.ok(g.time===undefined||g.time===null||/^(\d{1,2}:\d{2} [AP]M|TBA)?$/i.test(g.time),'time is a clock time, TBA or empty');assert.equal(typeof g.type,'string');assert.ok(g.type.length>0,'type is a non-empty string (Conference, Non-Conference, Postseason, Game, ...)');assert.equal(typeof g.venue,'string');assert.ok(team.opponents[g.opponent]&&team.opponents[g.opponent].players.length>0,g.opponent+' has a roster');}if(fresh)for(const g of team.games)assert.match(g.date,/^(1[0-2]\/\d+\/2026|[1-4]\/\d+\/2027)$/);assert.ok(team.refPointsPerGame>30&&team.refPointsPerGame<100,key+' reference scoring');}
 /* Snapshot specifics: only asserted while the data still matches the 2026–27 snapshot (rosters and scores legitimately change during the season). */
 const v=data.levels.varsity,first=v.games[0];if(fresh&&first.opponent==='Bothell'&&first.date==='12/1/2026'){assert.deepEqual([first.home,first.time,first.type],[false,'7:15 PM','Conference']);/* regular-season games never disappear; postseason, tournaments and TBA rows may be added */ Object.values(data.levels).forEach((t,i)=>assert.ok(t.games.length>=[18,17,12][i]));}
 if(fresh&&data.levels.c.games[0].opponent==='Redmond')assert.equal(data.levels.c.games[0].date,'12/5/2026');
 if(data.levels.jv.rosterSeason==='2025–26'){const malhar=data.levels.jv.players.find(p=>p.name==='Malhar Pawar');assert.ok(malhar);assert.equal(malhar.number,11);}
 if(data.levels.c.rosterSeason==='2025–26')assert.ok(data.levels.c.players.every(p=>p.numberAssigned));});
test('difficulty keys keep save compatibility and use team-level names',()=>{assert.deepEqual(Object.keys(E.DIFFICULTIES),['rookie','standard','elite']);assert.deepEqual(Object.values(E.DIFFICULTIES).map(d=>d.label),['C Team','Junior Varsity','Varsity']);assert.deepEqual(Object.values(E.DIFFICULTIES).map(d=>d.blurb),['Rookie','All-Star','Hall of Fame']);for(const k of Object.keys(E.DIFFICULTIES)){const s=E.createGame(data,'Level test',k,7);E.autoLineup(s);assert.ok(E.validSave(s));}});
test('rotation enforces starters, total minutes, eligibility and integer bounds',()=>{const s=game();assert.ok(E.validateLineup(s));s.players.find(p=>p.starter).minutes=31;assert.throws(()=>E.startMatch(s),/160/);E.autoLineup(s);s.players.find(p=>p.starter).gpa=1.9;assert.throws(()=>E.startMatch(s),/eligible|GPA/);E.autoLineup(s);assert.ok(E.validateLineup(s));s.players[0].minutes=1.5;assert.throws(()=>E.startMatch(s),/whole/);});
test('training costs and slots are atomic; recovery and study improve availability',()=>{const s=game();s.players[0].gpa=1.9;s.players[0].injury=1;E.train(s,'study',0);assert.ok(s.players[0].gpa>=2);E.train(s,'recovery',0);assert.equal(s.players[0].injury,0);E.train(s,'bond');const before=JSON.stringify(s);assert.throws(()=>E.train(s,'shooting'),/slots/);assert.equal(JSON.stringify(s),before);});
test('roster and assistant caps prevent overspending or duplicates',()=>{const s=game();let id=100;while(s.players.length<15)E.recruit(s,id++);assert.equal(s.players.length,15);assert.throws(()=>E.recruit(s,id),/full/);E.hire(s,'culture');assert.throws(()=>E.hire(s,'recovery'),/One/);s.tokens=0;const before=JSON.stringify(s);assert.throws(()=>E.scout(s),/tokens/);assert.equal(JSON.stringify(s),before);E.train(s,'bond');assert.equal(s.tokens,0,'training is earned through drills, never bought');});
test('match scoring equals player box totals; save resume deterministic',()=>{let a=game();E.startMatch(a);for(let i=0;i<20;i++)E.possession(a);const b=structuredClone(a);while(a.match)E.possession(a);while(b.match)E.possession(b);assert.deepEqual(a,b);const r=a.results[0];assert.equal(Object.values(r.box).reduce((a,b)=>a+b,0),r.home);assert.notEqual(r.home,r.away);assert.equal(a.week,1);assert.equal(a.actions,3);});
test('timeout capped and preparation disallowed during live games',()=>{const s=game();E.startMatch(s);assert.throws(()=>E.train(s,'bond'),/current game/);for(let i=0;i<3;i++)E.timeout(s,'calm');assert.throws(()=>E.timeout(s,'calm'),/No timeouts/);});
test('every level plays its own real season to the end; seeded campaigns can win',()=>{for(const [diff,level] of [['rookie','c'],['standard','jv'],['elite','varsity']]){let champs=0;for(let seed=1;seed<=50;seed++){const s=E.createGame(data,'Season test',diff,seed);assert.equal(s.level,level);assert.deepEqual(s.players.map(p=>p.name),data.levels[level].players.map(p=>p.name));const n=s.schedule.length;let guard=0;while(!s.finished&&guard++<n+1){if(E.mean(s.players,'energy')<70)E.train(s,'recovery');if(E.mean(s.players,'gpa')<2.7)E.train(s,'study');while(s.actions>0)E.train(s,s.chemistry<85?'bond':'shooting');E.autoLineup(s);E.startMatch(s);let k=0;while(s.match&&k++<500)E.possession(s);assert.ok(k<500);assert.ok(E.validSave(s));}assert.ok(s.finished);assert.ok(s.week<=n);if(s.champion){champs++;assert.equal(s.week,n);}assert.throws(()=>E.startMatch(s),/complete/);}console.log(`${E.DIFFICULTIES[diff].label} campaign champions: ${champs} / 50`);if(diff!=='elite')assert.ok(champs>0,`Expected reachable championship on ${diff}`);}});
test('ESPN-style stat lines add up to the score and feed per-game leaders',()=>{const s=game();E.startMatch(s);while(s.match)E.possession(s);const r=s.results[0];const lines=Object.values(r.line);assert.equal(lines.reduce((a,l)=>a+l.pts,0),r.home);for(const l of lines){assert.ok(l.fgm<=l.fga&&l.tpm<=l.tpa&&l.tpm<=l.fgm);assert.equal(l.pts,(l.fgm-l.tpm)*2+l.tpm*3);}const played=s.players.filter(p=>p.games);assert.ok(played.length>=5);for(const p of played){const pg=E.perGame(p);assert.equal(pg.gp,1);assert.equal(pg.ppg,p.points);}const lead=E.leaders(s);assert.ok(lead.ppg&&lead.ppg.value>0&&lead.rpg&&lead.rpg.value>0);for(const v of Object.values(lead))if(v)assert.ok(v.value>0,'leaders never show zero');assert.equal(E.perGame(s.players.find(p=>!p.games)??{games:0,points:0}).ppg,null);});
test('save validation accepts valid games and rejects malformed inputs',()=>{const s=game();assert.ok(E.validSave(s));E.startMatch(s);E.possession(s);assert.ok(E.validSave(s));const bad=structuredClone(s);bad.players[0].energy='broken';assert.equal(E.validSave(bad),false);const injection=structuredClone(s);injection.trim='" onfocus="alert(1)';assert.equal(E.validSave(injection),false);});
test('background standings balance and imported score fields remain numeric',()=>{const s=game();E.startMatch(s);while(s.match)E.possession(s);assert.equal(s.standings['Lake Washington'].w,s.wins);assert.equal(s.standings['Lake Washington'].l,s.losses);const rows=Object.values(s.standings);assert.equal(rows.reduce((a,t)=>a+t.w,0),rows.reduce((a,t)=>a+t.l,0));assert.ok(rows.filter(t=>t.w+t.l).length>10);assert.ok(E.validSave(s));s.results[0].box[0]='<img src=x>';assert.equal(E.validSave(s),false);});

test('every scheduled opponent has a named roster, with no unused opponents',()=>{for(const [key,t] of Object.entries(data.levels)){const names=new Set(t.games.map(g=>g.opponent));for(const n of names){const o=t.opponents[n];assert.ok(o,`${key} ${n} roster`);assert.equal(typeof o.real,'boolean');assert.ok(o.players.length>=5&&o.players.every(p=>Number.isInteger(p.number)&&p.name));if(o.real)assert.ok(Number.isInteger(o.schoolId),`${key} ${n} schoolId`);}assert.deepEqual(Object.keys(t.opponents).filter(n=>!names.has(n)),[],key+' has no unused opponents');}});
test('every opponent has a named roster and play-by-play uses real names when published',()=>{for(const [key,t] of Object.entries(data.levels)){for(const g of t.games){const o=t.opponents[g.opponent];assert.ok(o,`${key} ${g.opponent} roster`);assert.ok(o.players.length>=5);assert.equal(typeof o.real,'boolean');}}const s=E.createGame(data,'Names test','elite',9);E.autoLineup(s);E.startMatch(s);const opp=E.opponent(s);assert.ok(opp.realRoster);const names=new Set(opp.roster.map(p=>p.name));while(s.match)E.possession(s);const plays=s.results[0].events.flatMap(e=>e.plays||[]);const guests=plays.filter(p=>p.team==='away').map(p=>p.player);assert.ok(guests.length>0&&guests.every(n=>names.has(n)),'visitors are real roster names');assert.ok(!plays.some(p=>/#\d/.test(p.commentary)),'no "Team #N" placeholders');});

test('unplayed games (null scores) validate in saves and estimates fall back to last season scoring',()=>{const unplayed=structuredClone(data);for(const t of Object.values(unplayed.levels))for(const g of t.games){g.points=null;g.against=null;}
 for(const [diff,level] of [['rookie','c'],['standard','jv'],['elite','varsity']]){const s=E.createGame(unplayed,'Null test',diff,3);E.autoLineup(s);assert.ok(s.schedule.every(g=>g.points===null&&g.against===null));assert.equal(s.refPpg,data.levels[level].refPointsPerGame);assert.ok(E.validSave(s));const est=E.estimateLines(s);const sum=Object.values(est).reduce((a,l)=>a+l.ppg,0);assert.ok(Math.abs(sum-s.refPpg)<s.players.length*.06+.5,`${level} estimated PPG sums near ${s.refPpg}, got ${sum}`);const bad=structuredClone(s);bad.schedule[0].points='x';assert.equal(E.validSave(bad),false);const half=structuredClone(s);half.schedule[0].points=60;assert.equal(E.validSave(half),false,'half-scored game rejected');half.schedule[0].against=50;assert.ok(E.validSave(half),'fully scored game accepted');}
 const old=E.createGame(unplayed,'Scored test','elite',5);old.schedule.forEach(g=>{g.points=70;g.against=60;});old.refPpg=null;const sum=Object.values(E.estimateLines(old)).reduce((a,l)=>a+l.ppg,0);assert.ok(Math.abs(sum-70)<1.5,'real scores take precedence over the reference average');const none=E.createGame(unplayed,'Fallback','elite',5);none.refPpg=null;const sum55=Object.values(E.estimateLines(none)).reduce((a,l)=>a+l.ppg,0);assert.ok(Math.abs(sum55-55)<1.5,'55 fallback only without any scoring data');
 const plan=E.seasonPlan(E.createGame(unplayed,'Plan','elite',1));assert.deepEqual([plan.n,plan.cut,plan.need],[data.levels.varsity.games.length,data.levels.varsity.games.length-4,Math.ceil((data.levels.varsity.games.length-4)*.46)]);});
test('starting and un-starting keeps the rotation consistent',()=>{
 const s=game(),starter=s.players.find(p=>p.starter),bench=s.players.find(p=>!p.starter);
 assert.equal(E.setStarter(s,starter.id,false).minutes,0);assert.equal(starter.starter,false);
 assert.equal(s.players.reduce((a,p)=>a+p.minutes,0),128);
 E.setStarter(s,bench.id,true);assert.equal(bench.minutes,32);assert.equal(s.players.reduce((a,p)=>a+p.minutes,0),160);assert.ok(E.validateLineup(s));
 E.setStarter(s,bench.id,true);assert.equal(bench.minutes,32,'starting a starter again changes nothing');
 const other=s.players.find(p=>!p.starter);other.minutes=10;E.setStarter(s,other.id,true);assert.equal(other.minutes,10,'a player who already has minutes keeps them');
 assert.throws(()=>E.setStarter(s,99999,true),/Choose a player/);
 E.autoLineup(s);E.startMatch(s);assert.throws(()=>E.setStarter(s,bench.id,false),/Finish the current game/);
});
test('lineup issues name who cannot play and why',()=>{
 const s=game();assert.deepEqual(E.lineupIssues(s),[]);
 const [a,b,c]=s.players.filter(p=>p.starter);a.injury=2;b.gpa=1.5;c.energy=5;
 assert.deepEqual(E.lineupIssues(s).map(x=>[x.id,x.reason]),[[a.id,'injured'],[b.id,'gpa'],[c.id,'tired']]);
 const idle=s.players.find(p=>!p.starter);idle.injury=1;assert.equal(E.lineupIssues(s).length,3,'an injured player with no minutes is not an issue');
 E.autoLineup(s);assert.deepEqual(E.lineupIssues(s),[]);
});
test('the judge demo is a repeatable mid-season save that can still be won',()=>{
 const a=E.demoSeason(data),b=E.demoSeason(data);assert.deepEqual(a,b);assert.ok(E.validSave(a));
 const P=E.seasonPlan(a);assert.equal(a.week,E.DEMO.week);assert.ok(a.week>0&&a.week<P.cut);assert.equal(a.match,null);assert.equal(a.coach,'Judge');
 const t=E.playTo(structuredClone(a),P.cut);assert.equal(t.week,P.cut);assert.ok(t.wins>=P.need,'the demo qualifies for the final run');assert.equal(t.match,null);assert.ok(E.validSave(t));
 const u=E.playTo(structuredClone(t),t.schedule.length);assert.ok(u.finished);
 const v=E.playTo(structuredClone(a),0);assert.equal(v.week,a.week,'playing to an earlier week changes nothing');
});
test('skill growth slows near the top, and one-on-one sessions are worth more than team sessions',()=>{
 assert.equal(E.growthRoom(40),1);assert.equal(E.growthRoom(98),E.GROWTH.min);assert.ok(E.growthRoom(70)>E.growthRoom(80)&&E.growthRoom(80)>E.growthRoom(90));
 const gainOf=(skill,id)=>{const s=game();s.players.forEach(p=>{p.skill=skill;});const before=s.players[0].skill;E.train(s,'shooting',id);return s.players[0].skill-before;};
 assert.ok(gainOf(70,'all')>gainOf(90,'all')*2,'a player at 70 improves more than one at 90');
 const s=game();s.players.forEach(p=>{p.skill=97.9;});for(let i=0;i<3;i++)E.train(s,'shooting','all',{perfect:true});assert.ok(s.players.every(p=>p.skill<=98),'skill never passes the ceiling');
 const team=gainOf(70,'all'),solo=gainOf(70,0);assert.ok(Math.abs(solo/team-E.GROWTH.focus)<.12,'one-on-one gain is about 1.8× the team gain');
 const t=game();t.players[0].energy=50;t.players[1].energy=50;E.train(t,'recovery',0);assert.ok(t.players[0].energy>t.players[1].energy+25,'a one-on-one recovery restores about 1.8× the energy and only to that player');
 const q=game();q.assistant='development';const p0=q.players[0];p0.skill=70;E.train(q,'shooting',0);const withHelp=p0.skill-70;const r=game();const p1=r.players[0];p1.skill=70;E.train(r,'shooting',0);assert.ok(withHelp>p1.skill-70,'the development coach adds to the gain');
 const log=game();E.train(log,'shooting');assert.match(log.log[0].text,/skill \+\d+(\.\d)?,/,'the decision trail reports the gain that actually happened');
});
test('opponent strength follows the school, not the week, and real results set it once published',()=>{
 const s=game(),rating=n=>E.opponentRating(s,{opponent:n});
 assert.equal(rating('Bothell'),rating('Bothell'));assert.ok(new Set(s.schedule.map(g=>rating(g.opponent))).size>=4,'opponents differ from one another');
 for(const g of s.schedule){const r=E.opponentRating(s,g,0);assert.ok(r>=67&&r<=77.5,`${g.opponent} ${r}`);}
 const a={opponent:'Bothell'},played={opponent:'Bothell',points:50,against:62};
 assert.ok(E.opponentRating(s,played)>E.opponentRating(s,{opponent:'Bothell',points:62,against:50}),'a real loss to a school makes it stronger than a real win over it');
 assert.equal(E.opponentRating(s,played,0),E.opponentRating(s,played,0));
 const cut=E.seasonPlan(s).cut;assert.equal(+(E.opponentRating(s,a,cut)-E.opponentRating(s,a,0)).toFixed(1),7,'the final run is 7 points tougher');
 s.week=0;assert.equal(E.opponent(s).rating,E.opponentRating(s,s.schedule[0]));
});
const playSeason=(seed,diff='standard',practice=true)=>{const s=E.createGame(data,'Report',diff,seed);let guard=0;while(!s.finished&&guard++<s.schedule.length+1){if(practice){if(E.mean(s.players,'energy')<70&&s.actions>0)E.train(s,'recovery');if(E.mean(s.players,'gpa')<2.7&&s.actions>0)E.train(s,'study');while(s.actions>0)E.train(s,s.chemistry<85?'bond':'shooting');}E.autoLineup(s);if(s.players.filter(E.eligible).length<5)break;E.startMatch(s);let k=0;while(s.match&&k++<500)E.possession(s);}return s;};
test('every game names a player of the game who played, and saves with or without it stay valid',()=>{
 const s=playSeason(3);assert.ok(s.results.length>=5);
 for(const r of s.results){assert.ok(r.pog,'a player of the game');const l=r.line[r.pog.id];assert.ok(l.min>0&&l.pts===r.pog.pts);assert.ok(r.box[r.pog.id]===r.pog.pts);const top=Math.max(...Object.entries(r.line).filter(([,x])=>x.min>0).map(([,x])=>x.pts+1.2*x.reb+1.5*x.ast+2*(x.stl+x.blk)-x.tov-.3*(x.fga-x.fgm)));assert.equal(+(l.pts+1.2*l.reb+1.5*l.ast+2*(l.stl+l.blk)-l.tov-.3*(l.fga-l.fgm)).toFixed(6),+top.toFixed(6));}
 assert.ok(E.validSave(s));const old=structuredClone(s);old.results.forEach(r=>delete r.pog);old.players.forEach(p=>delete p.skill0);assert.ok(E.validSave(old),'older saves have neither field');
 const bad=structuredClone(s);bad.results[0].pog.pts='x';assert.equal(E.validSave(bad),false);const bad2=structuredClone(s);bad2.players[0].skill0='x';assert.equal(E.validSave(bad2),false);
});
test('the season report: awards, a coach grade that adds up, and highlights',()=>{
 const s=playSeason(5),R=E.seasonReport(s);
 assert.deepEqual(R.record,[s.wins,s.losses]);assert.equal(R.games,s.results.length);assert.ok(R.ppg>20&&R.oppg>20);
 const g=R.grade;assert.equal(g.total,Object.values(g.parts).reduce((a,b)=>a+b,0));assert.ok(g.total>=0&&g.total<=100);for(const [k,v] of Object.entries(g.parts))assert.ok(v>=0&&v<=E.GRADE_POINTS[k],k);
 assert.match(g.letter,/^[A-DF][+-]?$/);
 const keys=R.awards.map(a=>a.key);assert.ok(keys.includes('mvp')&&keys.includes('pog'));for(const a of R.awards)assert.ok(s.players.some(p=>p.id===a.id)&&a.value>0);
 assert.ok(R.sessions>0&&R.perfect===0);if(R.bestWin)assert.ok(R.bestWin.home>R.bestWin.away);if(R.toughestLoss)assert.ok(R.toughestLoss.home<R.toughestLoss.away);
 const idle=E.seasonReport(playSeason(5,'standard',false));assert.equal(idle.grade.parts.development,0);assert.ok(idle.grade.total<R.grade.total,'doing nothing grades lower than preparing');assert.equal(idle.sessions,0);
 const champ=[...Array(60).keys()].map(i=>playSeason(i+1)).find(x=>x.champion);assert.ok(champ);assert.equal(E.coachGrade(champ).parts.postseason,25);
 const old=structuredClone(s);old.players.forEach(p=>delete p.skill0);assert.equal(E.seasonReport(old).grade.parts.development,0);assert.ok(!E.seasonReport(old).awards.some(a=>a.key==='improved'));
 const empty=E.createGame(data,'New','standard',1);const e=E.seasonReport(empty);assert.deepEqual(e.awards,[]);assert.equal(e.bestWin,null);assert.equal(e.grade.parts.wins,0);
});
test('the final run is a bracket that fills in as games are won',()=>{
 const s=game(),P=E.seasonPlan(s);let b=E.runBracket(s);
 assert.equal(b.rounds.length,4);assert.deepEqual(b.rounds.map(r=>r.status),['upcoming','upcoming','upcoming','upcoming']);assert.equal(b.gate,'open');assert.equal(b.need,P.need);assert.equal(b.rounds[0].opponent,s.schedule[P.cut].opponent);
 const win=()=>{s.players.forEach(p=>{p.energy=100;p.skill=98;p.gpa=4;p.injury=0;});s.chemistry=100;E.autoLineup(s);E.startMatch(s);let k=0;while(s.match&&k++<500)E.possession(s);};
 // qualify by playing the early games (stronger players make that very likely), then check the run
 let guard=0;while(!s.finished&&s.week<P.cut&&guard++<40)win();
 b=E.runBracket(s);
 if(s.week>=P.cut&&!s.finished){assert.equal(b.gate,'qualified');assert.equal(b.rounds[0].status,'next');assert.equal(b.rounds[1].status,'upcoming');
  let rounds=0;while(!s.finished&&rounds++<6){const before=s.results.length;win();const x=E.runBracket(s),last=s.results[before];const idx=before-P.cut;assert.equal(x.rounds[idx].status,last.won?'won':'lost');if(!last.won){assert.ok(x.rounds.slice(idx+1).every(r=>r.status==='out'));assert.ok(s.finished);}}}
 else assert.equal(b.gate,'failed');
});
test('missing the cut shows the run as never reached',()=>{
 const s=game(),P=E.seasonPlan(s);s.week=P.cut;s.finished=true;s.results=Array.from({length:P.cut},(_,i)=>({won:false,home:40,away:60,week:i,opponent:s.schedule[i].opponent,date:s.schedule[i].date,line:{},box:{},events:[],ripples:[]}));
 const b=E.runBracket(s);assert.equal(b.gate,'failed');assert.ok(b.rounds.every(r=>r.status==='missed'));
 const c=game();c.results=Array.from({length:P.need},(_,i)=>({won:true,week:i}));assert.equal(E.runBracket(c).gate,'qualified','clinching early counts');
});
test('shooting lines look like high-school basketball: misses are common (threes most), blocks are frequent and scores are plausible',()=>{
 let fga=0,fgm=0,tpa=0,tpm=0,blocks=0,games=0,pts=0;
 for(let seed=1;seed<=30;seed++){const s=game();s.seed=seed*977;E.startMatch(s);while(s.match){const ev=E.possession(s);for(const p of ev.plays){if(p.team!=='home'||p.outcome==='steal')continue;fga++;if(p.points)fgm++;if(p.three){tpa++;if(p.points)tpm++;}}}
  const r=s.results.at(-1);blocks+=r.stats.home.blocks+r.stats.away.blocks;games++;pts+=r.home+r.away;}
 assert.ok(fgm/fga>.36&&fgm/fga<.56,`FG ${fgm/fga}`);assert.ok(tpm/tpa<.42&&tpm/tpa<fgm/fga-.05,`3P ${tpm/tpa}`);assert.ok(blocks/games>=7,`blocks ${blocks/games}`);assert.ok(pts/games>90&&pts/games<150,`points ${pts/games}`);
});
