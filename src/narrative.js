// Shows text the simulation wrote (commentary, decision trail, result summary) in the interface language.
// The engine stores English text plus a small structured record; anything without a record, such as older saves, is shown as stored.
import {t,up,has,section} from './i18n/index.js';
import {renderCommentary} from './basketball.js';
// Words from the roster and schedule data (positions, grades, game types, prospects) and the translation each one has.
export const VALUES={Guard:'pos.guard',Forward:'pos.forward','Not listed':'pos.unlisted',Senior:'year.senior',Junior:'year.junior',Sophomore:'year.sophomore',Freshman:'year.freshman','Fictional prospect':'year.prospect',Tryout:'year.tryout',Conference:'gtype.conference','Non-Conference':'gtype.nonConference',Postseason:'gtype.postseason','Regular Season':'gtype.regular',Center:'pos.center','Slashing Playmaker':'arch.slashing','Post Scorer':'arch.post','Mid-Range Maestro':'arch.midrange',Sharpshooter:'arch.sharp','Stretch Forward':'arch.stretch','Lockdown Defender':'arch.lockdown','Rim Protector':'arch.rim','Glass Cleaner':'arch.glass','Inside scoring':'attr.inside','Mid-range':'attr.mid','Three-point':'attr.three','Perimeter D':'attr.perim','Interior D':'attr.interior'};
export const tv=v=>VALUES[v]?t(VALUES[v]):v;
export function commentaryText(play){
 if(play.cm){const text=renderCommentary(play,play.cm,section('cm'));if(text)return text;}
 return play.commentary;
}
export const explanationText=event=>event.plays?.[0]?commentaryText(event.plays[0]):event.explanation;
// Decision-trail entries and "ripples" (which call their text "detail").
export function logText(entry){
 const stored=entry.text??entry.detail;
 if(!entry.k||!has(`log.${entry.k}`))return stored;
 const p={...entry.p};
 if(entry.k==='train'){p.plan=has(`plan.${p.plan}.name`)?t(`plan.${p.plan}.name`):p.plan;p.who=p.whole?t('log.wholeTeam'):p.who;}
 else if(entry.k==='event'){p.title=has(`ev.${p.id}.title`)?t(`ev.${p.id}.title`):p.id;p.choice=has(`ev.${p.id}.o.${p.choice}`)?t(`ev.${p.id}.o.${p.choice}`):p.choice;}
 else if(entry.k==='upgrade')p.item=has(`upg.${p.item}.name`)?t(`upg.${p.item}.name`):p.item;
 else if(entry.k==='hire')p.staff=has(`staff.${p.staff}.name`)?t(`staff.${p.staff}.name`):p.staff;
 else if(entry.k==='result'){p.outcome=up(t(p.won?'log.win':'log.loss'));p.reason=t(p.scouted?'log.reasonWithScouting':'log.reason',p);}
 return t(`log.${entry.k}`,p)+(entry.k==='train'&&p.perfect?` · ${t('log.perfectBonus')}`:'');
}
export const reasonText=result=>result.why?t(result.why.scouted?'log.reasonWithScouting':'log.reason',result.why):result.reason;
// The live play-by-play feed, one line per stored line. feedMeta says what each line is; saves from before it existed show their stored text.
export function feedLines(match){
 const aligned=Array.isArray(match.feedMeta)&&match.feedMeta.length===match.feed.length;
 return match.feed.map((line,i)=>{
  const meta=aligned?match.feedMeta[i]:null;if(!meta)return line;
  if(meta.t==='t')return has(`timeout.feed.${meta.m}`)?`${up(t('timeout.feedPrefix'))} · ${t(`timeout.feed.${meta.m}`)}`:line;
  const play=match.events[meta.n-1]?.plays?.[meta.team==='home'?0:1];
  return play?`${up(t(meta.team==='home'?'game.kangs':'game.visitors'))} · ${commentaryText(play)}`:line;
 });
}
