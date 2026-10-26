// The locker room page: kits (with the special jerseys earned in the season), the name and number on the 3D jerseys,
// the captain's corner, the team mood board and one locker per player. Everything here builds HTML from the save;
// main.js owns the events, the 3D showcase and the confirmation dialog.
import {t,tu} from './i18n/index.js';
import * as E from './engine.js';
import {ALL_KITS,CORE_KITS} from './kits.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg=(d,cls='',extra='')=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" ${extra}>${d}</svg>`;
const LOCK='<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>';

/* ---- pure helpers (also used by the tests) ---- */
export const byNumber=players=>[...players].sort((a,b)=>a.number-b.number||a.id-b.id);
/* The name shown on the back of a jersey and on a locker plate: the last name, unless the player has a custom plate. */
export const plateName=p=>String(p.plate||String(p.name).trim().split(/\s+/).at(-1)||p.name);
export const givenNames=p=>{const parts=String(p.name).trim().split(/\s+/);return parts.length>1?parts.slice(0,-1).join(' '):'';};
export const moodFace=m=>m>=70?'happy':m>=50?'neutral':'upset';
/* Eligibility tag and glow for a locker. Red: cannot play (injured, GPA under 2.0, energy under 15). Amber: tired (energy under 40) or unhappy (morale under 50). */
export function lockerStatus(p){
 const bad=p.injury>0||p.gpa<2||p.energy<15,tired=p.energy<40;
 const tag=p.injury>0?'injured':p.gpa<2?'gpa':tired?'tired':'ready';
 return {tag,tone:bad?'bad':tag==='ready'?'good':'warn',glow:bad?'bad':(tired||p.morale<50)?'warn':''};
}
/* What the mood board warns about, grouped: injured players, GPA under 2.3, low energy, and bench players with no minutes and low morale. */
export function moodFlags(s){
 const g={injured:[],gpa:[],energy:[],bench:[]};
 for(const p of byNumber(s.players)){
  if(p.injury>0)g.injured.push({p,v:`${p.injury}`});
  if(p.gpa<2.3)g.gpa.push({p,v:p.gpa.toFixed(2)});
  if(p.injury===0&&p.energy<40)g.energy.push({p,v:`${Math.round(p.energy)}`});
  if(!p.starter&&!(p.minutes>0)&&p.morale<60)g.bench.push({p,v:`${Math.round(p.morale)}`});
 }
 return Object.entries(g).filter(([,l])=>l.length).map(([kind,list])=>({kind,list}));
}
export const moodTrend=s=>(Array.isArray(s.moraleHistory)?s.moraleHistory:[]).slice(-5);
export const kitName=k=>CORE_KITS.includes(k)?t(`locker.${k}`):t(`lk.kit.${k}`);
/* How to unlock a special kit, in words; the Throwback line says how long the current streak is. */
export const kitHow=(s,k)=>t(`lk.how.${k}`,{n:E.KIT_STREAK})+(k==='throwback'?` ${t('lk.streak',{n:E.winStreak(s)})}`:'');
/* Who wears the jerseys in the showcase: the player chosen there, otherwise the captain, otherwise the first starter. */
export const jerseyWho=(s,id)=>s.players.find(p=>p.id===id)||s.players.find(p=>p.id===s.captain)||s.players.find(p=>p.starter)||s.players[0];

/* ---- pieces ---- */
const FACES={
 happy:'<path d="M7.6 14c1 2.4 2.6 3.4 4.4 3.4s3.4-1 4.4-3.4"/>',
 neutral:'<path d="M8.2 15.6h7.6"/>',
 upset:'<path d="M7.8 17c1-2 2.4-2.9 4.2-2.9s3.2.9 4.2 2.9"/><path d="M7.2 8.2l2.8 1.2M16.8 8.2L14 9.4"/>'
};
const face=m=>{const k=moodFace(m);return `<svg class="lk-face ${k}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle class="fc" cx="12" cy="12" r="10.4"/><circle class="ey" cx="8.9" cy="10.6" r="1.25"/><circle class="ey" cx="15.1" cy="10.6" r="1.25"/>${FACES[k]}</svg>`;};

function kitButtons(s){
 return ALL_KITS.map(k=>{
  const locked=!E.kitUnlocked(s,k),name=kitName(k),how=locked?kitHow(s,k):'';
  const label=locked?t('lk.kitLabelLocked',{kit:name,how}):name;
  return `<button data-action="${locked?'kit-locked':'kit'}" data-kit="${k}" class="kit ${k} ${s.kit===k?'selected':''} ${locked?'locked':''}" ${locked?`aria-disabled="true"`:`aria-pressed="${s.kit===k}"`} aria-label="${esc(label)}"><div class="shirt ${k}" aria-hidden="true">${locked?svg(LOCK,'shirt-lock'):'K<br><b>11</b>'}</div><strong>${esc(name)}</strong>${locked?`<small class="kit-how"><span class="kit-lock">${svg(LOCK)}${t('lk.locked')}</span>${esc(how)}</small>`:''}</button>`;
 }).join('');
}

function jerseyPicker(s,id){
 const who=jerseyWho(s,id);
 return `<div class="jersey-picker"><label for="jersey-player">${t('lk.jerseyPlayer')}</label><div class="jp-row">
  <button data-action="jersey-step" data-step="-1" class="secondary small jp-arrow" aria-label="${esc(t('rv.prev'))}">${svg('<path d="M14.5 6l-6 6 6 6"/>')}</button>
  <select id="jersey-player">${byNumber(s.players).map(p=>`<option value="${p.id}" ${p.id===who?.id?'selected':''}>${esc(p.number)} · ${esc(p.name)}${p.id===s.captain?` (${esc(t('captain.c'))})`:''}</option>`).join('')}</select>
  <button data-action="jersey-step" data-step="1" class="secondary small jp-arrow" aria-label="${esc(t('rv.next'))}">${svg('<path d="M9.5 6l6 6-6 6"/>')}</button></div>
  <p class="footnote" id="jersey-tip">${t('lk.jerseyTip')}</p></div>`;
}

function captainCard(s,{avatar,pick}){
 const cur=s.players.find(p=>p.id===s.captain),sel=s.players.find(p=>p.id===pick&&p.id!==s.captain);
 const cost=!sel?'':cur?t('lk.costChange',{old:esc(plateName(cur)),name:esc(plateName(sel)),morale:E.CAPTAIN_COST.morale,chem:E.CAPTAIN_COST.chem}):t('lk.costFirst');
 return `<section class="card lk-captain"><div class="cc-col cc-who"><span class="eyebrow">${tu('lk.captainKicker')}</span><h2>${t('lk.captainTitle')}</h2>
  <div class="cc-now">${cur?`${avatar(cur,56)}<div><small>${t('lk.currentCaptain')}</small><strong>${esc(cur.name)} <abbr class="cap-badge" title="${esc(t('captain.badge'))}">${t('captain.c')}</abbr></strong></div>`:`<span class="cc-empty" aria-hidden="true">${t('captain.c')}</span><div><strong>${t('lk.captainNone')}</strong></div>`}</div>
  <p class="cc-effect">${t('captain.note')}</p></div>
  <div class="cc-col"><div class="cc-chips" role="group" aria-label="${esc(t('lk.captainPick'))}">${byNumber(s.players).map(p=>`<button type="button" data-action="lk-pick" data-id="${p.id}" class="lk-chip ${p.id===s.captain?'current':''} ${p.id===sel?.id?'picked':''}" aria-pressed="${p.id===s.captain||p.id===sel?.id}"><b>${esc(p.number)}</b>${esc(plateName(p))}${p.id===s.captain?` <i aria-hidden="true">${t('captain.c')}</i><span class="sr-only"> (${t('captain.badge')})</span>`:''}</button>`).join('')}</div></div>
  <div class="cc-col cc-act"><p class="cc-cost" aria-live="polite">${cost||t('lk.costHint')}</p>
  ${`<button type="button" data-action="lk-captain" data-id="${sel?.id??''}" class="primary wide" ${sel&&!s.match?'':'disabled'} ${s.match?`title="${esc(t('notify.finishFirst'))}"`:''}>${sel?t('lk.nameBtn',{name:esc(plateName(sel))}):t('lk.captainPick')}</button>`}</div></section>`;
}

function sparkline(values){
 const W=230,H=84,px=14,py=12;
 if(values.length<2)return `<div class="mb-spark empty"><p>${t('lk.trendNone')}</p></div>`;
 const lo=Math.min(...values),hi=Math.max(...values),span=Math.max(14,hi-lo),mid=(hi+lo)/2,min=mid-span/2,max=mid+span/2;
 const pts=values.map((v,i)=>[px+i*(W-2*px)/(values.length-1),H-py-(v-min)/(max-min)*(H-2*py)]);
 const delta=values.at(-1)-values[0];
 return `<div class="mb-spark"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('lk.trendLabel',{list:values.join(', ')}))}"><path class="grid" d="M${px} ${H-py+4}H${W-px}"/><polyline points="${pts.map(p=>p.map(n=>n.toFixed(1)).join(',')).join(' ')}" fill="none"/>${pts.map((p,i)=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i===pts.length-1?5:3.4}" class="${i===pts.length-1?'now':''}"/>`).join('')}</svg><div class="mb-spark-foot"><b>${values.at(-1)}</b><span class="mb-delta ${delta>0?'up':delta<0?'down':''}" aria-hidden="true">${delta>0?'▲ +':delta<0?'▼ −':'● ±'}${Math.abs(delta)}</span></div></div>`;
}

function moodBoard(s){
 const chem=Math.round(s.chemistry),flags=moodFlags(s),cur=s.players.find(p=>p.id===s.captain),avg=Math.round(s.players.reduce((a,p)=>a+p.morale,0)/Math.max(1,s.players.length));
 return `<section class="whiteboard" aria-labelledby="mb-title"><header class="mb-head"><div><span class="mb-kicker">${tu('lk.boardKicker')}</span><h2 id="mb-title">${t('lk.boardTitle')}</h2></div><p class="mb-cap">${t('lk.boardCaptain')}: <b>${cur?esc(cur.name):'—'}</b>${cur?` <abbr class="cap-badge" title="${esc(t('captain.badge'))}">${t('captain.c')}</abbr>`:''}</p></header>
  <div class="mb-grid">
   <div class="mb-block mb-chem"><h3>${t('lk.chem')}</h3><div class="mb-chem-row"><b>${chem}</b><span class="mb-bar" role="img" aria-label="${esc(t('lk.chemLabel',{n:chem}))}"><i style="width:${chem}%"></i></span></div><p class="mb-note">${t('lk.moraleAvg',{n:avg})}</p></div>
   <div class="mb-block"><h3>${t('lk.trend')}</h3>${sparkline(moodTrend(s))}</div>
   <div class="mb-block mb-flags"><h3>${t('lk.flags')}</h3>${flags.length?`<ul>${flags.map(f=>`<li class="${f.kind}"><b>${t(`lk.flag.${f.kind}`)}</b> ${f.list.map(x=>`<span>${esc(plateName(x.p))}${f.kind==='injured'?'':` <em>${x.v}</em>`}</span>`).join('')}</li>`).join('')}</ul>`:`<p class="mb-clear">${t('lk.flagsNone')}</p>`}</div>
  </div><div class="mb-tray" aria-hidden="true"><i class="blue"></i><i class="red"></i><i class="green"></i><u></u></div></section>`;
}

function wall(s){
 return `<section class="card lk-wall-card"><div class="lk-wall-head"><div><span class="eyebrow">${tu('lk.wallKicker')}</span><h2>${t('lk.wallTitle')}</h2></div><p class="lk-legend"><span class="warn"></span>${t('lk.legendWarn')} <span class="bad"></span>${t('lk.legendBad')}</p></div>
  <div class="lk-wall" role="group" aria-label="${esc(t('lk.wallTitle'))}">${byNumber(s.players).map(p=>{
   const st=lockerStatus(p),cap=p.id===s.captain,en=Math.round(p.energy),mo=Math.round(p.morale),tag=t(`lk.tag.${st.tag}`);
   const label=t('lk.lockerLabel',{num:p.number,name:esc(p.name),cap:cap?t('lk.capSuffix'):'',face:t(`lk.face.${moodFace(p.morale)}`),morale:mo,energy:en,tag});
   return `<button type="button" data-action="player" data-id="${p.id}" class="lk ${st.glow?`glow ${st.glow}`:''} ${cap?'captain':''}" aria-label="${label}">
    ${cap?`<span class="lk-c" aria-hidden="true">${t('captain.c')}</span>`:''}<span class="lk-row"><b class="lk-num">${esc(p.number)}</b>${face(p.morale)}</span><span class="lk-vents" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    <span class="lk-plate"><strong>${esc(plateName(p))}</strong><small>${esc(givenNames(p))||'&nbsp;'}</small></span>
    <span class="lk-energy" aria-hidden="true"><span class="lk-bar"><i class="${en<40?'low':''}" style="width:${en}%"></i></span><em>${en}</em></span>
    <span class="lk-tag ${st.tone}" aria-hidden="true">${tag}${st.tag==='gpa'?` ${p.gpa.toFixed(1)}`:''}</span><span class="lk-handle" aria-hidden="true"></span></button>`;}).join('')}</div></section>`;
}

/* The whole page body (below the page heading). ctx: {state, avatar(p,size), jerseyId, captainPick}. */
export function lockerBody({state:s,avatar,jerseyId,captainPick}){
 const who=jerseyWho(s,jerseyId);
 return `<div class="lk-stage-row"><div id="jersey-stage" class="jersey-stage" role="group" tabindex="0" aria-label="${esc(t('lk.showcase'))}" aria-describedby="jersey-tip"><div class="jersey-caption" id="jersey-caption">${who?`<b>${esc(who.number)}</b> ${esc(plateName(who))}`:''}</div></div>
  <section class="card lk-kits"><span class="eyebrow">${tu('locker.issue')}</span><h2>${t('locker.title')}</h2><div class="kit-options" role="group" aria-label="${esc(t('locker.kits'))}">${kitButtons(s)}</div>${jerseyPicker(s,jerseyId)}<p class="footnote">${t('locker.note')}</p></section></div>
  <div class="lk-mid">${moodBoard(s)}${captainCard(s,{avatar,pick:captainPick})}</div>${wall(s)}`;
}
