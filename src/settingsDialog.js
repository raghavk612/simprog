// Settings dialog: controls, sound, accessibility and language. Every change applies immediately and is saved.
import {t,tu,LANGUAGES,getLanguage,setLanguage} from './i18n/index.js';
import {GRAPHICS_LEVELS} from './graphics.js';
import {getSound,setSound,resetSound,getA11y,setA11y,resetA11y,activeA11yCount,isTouchOnly,TEXT_SCALE,COLOR_MODES,FONT_FAMILIES,PLAYBACK_SPEEDS} from './settings.js';
import {SOUND_KEYS,preview} from './audio.js';
import {ACTIONS,DEFAULT_KEYS,loadKeys,saveKeys,keyLabel,findConflict} from './keys.js';
import {announce} from './a11y.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FONT_PREVIEW={default:"'Barlow Condensed','Arial Narrow',sans-serif",modern:"system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",readable:"Verdana,'Trebuchet MS',Tahoma,sans-serif"};
const LISTENING_FLAG='data-listening';

const toggleRow=(key,label,desc,on,dim=false)=>`<div class="srow${dim?' dim':''}"><div class="stext"><label for="s-${key}">${esc(label)}</label><small id="d-${key}">${esc(desc)}</small></div><button type="button" id="s-${key}" class="switch" role="switch" aria-checked="${on}" aria-describedby="d-${key}" data-s-toggle="${key}" data-fk="toggle:${key}"><span></span></button></div>`;
const selectRow=(key,label,desc,value,options)=>`<div class="srow"><div class="stext"><label for="s-${key}">${esc(label)}</label><small id="d-${key}">${esc(desc)}</small></div><select id="s-${key}" aria-describedby="d-${key}" data-s-select="${key}" data-fk="select:${key}">${options.map(([v,l])=>`<option value="${esc(v)}"${String(v)===String(value)?' selected':''}>${esc(l)}</option>`).join('')}</select></div>`;
const rangeRow=(key,label,desc,value,{min,max,step,low,high,text})=>`<div class="srow block"><div class="stext"><label for="s-${key}">${esc(label)}</label><small id="d-${key}">${esc(desc)}</small></div><output class="readout" id="o-${key}" for="s-${key}">${esc(text(value))}</output><input type="range" id="s-${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-describedby="d-${key}" aria-valuetext="${esc(text(value))}" data-s-range="${key}" data-fk="range:${key}"><div class="range-ends"><span>${esc(low)}</span><span>${esc(high)}</span></div></div>`;
const section=(title,body)=>`<section class="ssection"><h3>${esc(title)}</h3>${body}</section>`;
const resetButton=(act,label)=>`<div class="sfooter"><button type="button" class="secondary" data-s-act="${act}" data-fk="act:${act}">↺ ${esc(label)}</button></div>`;

export function createSettingsDialog({modal,show,notify,onKeysChange}){
 let tab=isTouchOnly()?'sound':'controls',keys=loadKeys(),listening=null,open=false;
 const tabs=()=>[...(isTouchOnly()?[]:['controls']),'sound','accessibility','language'];

 function controlsPanel(){
  const rows=ACTIONS.map(a=>{const name=t(`settings.controls.actions.${a}`),on=listening===a;return `<div class="srow"><div class="stext"><span class="slabel">${esc(name)}</span></div><button type="button" class="keycap${on?' listening':''}" data-s-bind="${a}" data-fk="bind:${a}" aria-label="${esc(t('settings.controls.rebind',{action:name,key:keyLabel(keys[a])}))}">${on?esc(t('settings.controls.pressKey')):esc(keyLabel(keys[a]))}</button></div>`;}).join('');
  return `<p class="hint">${esc(t('settings.controls.intro'))}</p>${rows}${resetButton('reset-keys',t('settings.controls.resetDefaults'))}`;
 }
 function soundPanel(){
  const s=getSound(),pct=v=>`${Math.round(v*100)}%`;
  const items=SOUND_KEYS.map(k=>toggleRow(`sound.${k}`,t(`settings.sound.items.${k}.name`),t(`settings.sound.items.${k}.desc`),s.toggles[k],s.muted)).join('');
  return section(t('settings.sound.title'),
    rangeRow('sound.volume',t('settings.sound.masterVolume'),t('settings.sound.masterVolumeDesc'),s.volume,{min:0,max:1,step:.05,low:t('settings.sound.quiet'),high:t('settings.sound.loud'),text:pct})+
    toggleRow('sound.enabled',t('settings.sound.sfxEnabled'),t('settings.sound.sfxEnabledDesc'),!s.muted)+
    toggleRow('sound.commentary',t('settings.sound.commentary'),t('settings.sound.commentaryDesc'),s.commentary,s.muted)+
    `<div class="srow"><div class="stext"><span class="slabel">${esc(t('settings.sound.testSound'))}</span><small>${esc(t('settings.sound.testSoundDesc'))}</small></div><button type="button" class="small" data-s-act="test-sound" data-fk="act:test-sound">▶ ${esc(t('settings.sound.play'))}</button></div>`)+
   section(t('settings.sound.individual'),`<p class="hint">${esc(t('settings.sound.individualDesc'))}</p>${items}`)+resetButton('reset-sound',t('settings.sound.resetAll'));
 }
 function accessibilityPanel(){
  const a=getA11y(),pct=v=>`${Math.round(v*100)}%`;
  const fonts=FONT_FAMILIES.map(f=>`<button type="button" class="choice-card${a.fontFamily===f?' selected':''}" aria-pressed="${a.fontFamily===f}" data-s-choice="a11y.fontFamily" data-value="${f}" data-fk="font:${f}"><span class="choice-name">${esc(t(`settings.accessibility.fontOptions.${f}`))}</span><span class="choice-sample" style="font-family:${FONT_PREVIEW[f]}" lang="en">${esc(t('settings.accessibility.fontPreview'))}</span></button>`).join('');
  return section(t('settings.accessibility.visual'),
    selectRow('a11y.colorBlindMode',t('settings.accessibility.colorBlindMode'),t('settings.accessibility.colorBlindModeDesc'),a.colorBlindMode,COLOR_MODES.map(m=>[m,t(`settings.accessibility.colorBlindOptions.${m}`)]))+
    toggleRow('a11y.lightTheme',t('settings.accessibility.lightTheme'),t('settings.accessibility.lightThemeDesc'),a.lightTheme)+
    toggleRow('a11y.highContrast',t('settings.accessibility.highContrast'),t('settings.accessibility.highContrastDesc'),a.highContrast)+
    toggleRow('a11y.reducedMotion',t('settings.accessibility.reducedMotion'),t('settings.accessibility.reducedMotionDesc'),a.reducedMotion)+
    toggleRow('a11y.screenShake',t('settings.accessibility.screenShake'),t('settings.accessibility.screenShakeDesc'),a.screenShake)+
    toggleRow('a11y.flashReduction',t('settings.accessibility.reduceFlashes'),t('settings.accessibility.reduceFlashesDesc'),a.flashReduction)+
    `<div class="srow block" role="group" aria-labelledby="fonts-label"><div class="stext"><span class="slabel" id="fonts-label">${esc(t('settings.accessibility.fontFamily'))}</span><small>${esc(t('settings.accessibility.fontFamilyDesc'))}</small></div><div class="choice-grid three">${fonts}</div></div>`+
    rangeRow('a11y.textScale',t('settings.accessibility.textSize'),t('settings.accessibility.textSizeDesc'),a.textScale,{min:TEXT_SCALE.min,max:TEXT_SCALE.max,step:TEXT_SCALE.step,low:t('settings.accessibility.textSizeSmall'),high:t('settings.accessibility.textSizeLarge'),text:pct}))+
   section(t('settings.accessibility.motorInput'),
    selectRow('a11y.playbackSpeed',t('settings.accessibility.playbackSpeed'),t('settings.accessibility.playbackSpeedDesc'),a.playbackSpeed,PLAYBACK_SPEEDS.map(v=>[v,t(`settings.accessibility.playbackSpeedOptions.${String(v).replace('.','_')}`)]))+
    toggleRow('a11y.timingAssist',t('settings.accessibility.timingAssist'),t('settings.accessibility.timingAssistDesc'),a.timingAssist))+
   section(t('settings.accessibility.cognitive'),toggleRow('a11y.simplifiedUI',t('settings.accessibility.simplifiedUI'),t('settings.accessibility.simplifiedUIDesc'),a.simplifiedUI))+
   section(t('settings.accessibility.graphicsTitle'),selectRow('a11y.graphics',t('settings.accessibility.graphics'),t('settings.accessibility.graphicsDesc'),a.graphics,GRAPHICS_LEVELS.map(l=>[l,t(`settings.accessibility.graphicsOptions.${l}`)])))+
   resetButton('reset-a11y',t('settings.accessibility.resetAll'))+`<p class="statement">${esc(t('settings.accessibility.statement'))}</p>`;
 }
 function languagePanel(){
  const cards=LANGUAGES.map(l=>`<button type="button" class="choice-card${getLanguage()===l.code?' selected':''}" aria-pressed="${getLanguage()===l.code}" data-s-choice="language" data-value="${l.code}" data-fk="lang:${l.code}"><span class="choice-name">${esc(t(`lang.${l.code}`))}</span><span class="choice-sample" lang="${l.code}">${esc(l.native)}</span></button>`).join('');
  return section(t('settings.language.title'),`<p class="hint">${esc(t('settings.language.desc'))}</p><div class="choice-grid">${cards}</div>`);
 }
 function html(){
  const list=tabs(),count=activeA11yCount();
  const bar=list.map(id=>`<button type="button" role="tab" id="tab-${id}" aria-selected="${tab===id}" aria-controls="panel-${id}" tabindex="${tab===id?0:-1}" data-s-tab="${id}" data-fk="tab:${id}">${esc(t(`settings.tabs.${id}`))}${id==='accessibility'&&count?`<span class="badge" aria-label="${esc(t('settings.activeCount',{n:count}))}">${count}</span>`:''}</button>`).join('');
  const panel={controls:controlsPanel,sound:soundPanel,accessibility:accessibilityPanel,language:languagePanel}[tab]();
  return `<div class="settings"><span class="eyebrow">${esc(tu('settings.eyebrow'))}</span><h1>${esc(t('settings.title'))}</h1><div class="tabs" role="tablist" aria-label="${esc(t('settings.title'))}">${bar}</div><div class="spanel" role="tabpanel" id="panel-${tab}" aria-labelledby="tab-${tab}" tabindex="0">${panel}</div><div class="sdone"><button type="button" class="primary" data-s-act="done" data-fk="act:done">${esc(t('settings.done'))}</button></div></div>`;
 }
 function render(focus){
  const scroll=modal.querySelector('.spanel')?.scrollTop||0,key=focus??document.activeElement?.dataset?.fk;
  show(html());
  const panel=modal.querySelector('.spanel');if(panel)panel.scrollTop=scroll;
  if(key)modal.querySelector(`[data-fk="${CSS.escape(key)}"]`)?.focus({preventScroll:false});
 }
 function stopListening(){if(!listening)return;listening=null;window.removeEventListener('keydown',capture,true);modal.removeAttribute(LISTENING_FLAG);}
 function capture(e){
  e.preventDefault();e.stopPropagation();
  if(['ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight'].includes(e.code))return;
  const action=listening;stopListening();
  if(e.code==='Escape'){render(`bind:${action}`);return;}
  const clash=findConflict(keys,action,e.code);
  if(clash==='reserved')notify(t('settings.controls.reserved',{key:keyLabel(e.code)}));
  else if(clash)notify(t('settings.controls.keyUsed',{key:keyLabel(e.code),action:t(`settings.controls.actions.${clash}`)}));
  else{keys={...keys,[action]:e.code};saveKeys(keys);onKeysChange(keys);announce(t('settings.controls.bound',{action:t(`settings.controls.actions.${action}`),key:keyLabel(e.code)}));}
  render(`bind:${action}`);
 }
 const setByPath=(path,value)=>{const [group,name]=path.split('.');if(group==='a11y')setA11y({[name]:value});};
 function onClick(e){
  const el=e.target.closest('[data-s-tab],[data-s-toggle],[data-s-choice],[data-s-bind],[data-s-act]');if(!el||!modal.querySelector('.settings')?.contains(el))return;
  if(el.dataset.sTab){stopListening();tab=el.dataset.sTab;render(`tab:${tab}`);return;}
  if(el.dataset.sToggle){
   const path=el.dataset.sToggle,on=el.getAttribute('aria-checked')!=='true';
   if(path==='sound.enabled')setSound({muted:!on});
   else if(path==='sound.commentary')setSound({commentary:on});
   else if(path.startsWith('sound.'))setSound({toggles:{[path.slice(6)]:on}});
   else setByPath(path,on);
   render(el.dataset.fk);return;
  }
  if(el.dataset.sChoice){
   if(el.dataset.sChoice==='language'){setLanguage(el.dataset.value).then(()=>{announce(t('a11y.languageChanged',{language:t(`lang.${getLanguage()}`)}));render(`lang:${el.dataset.value}`);});}
   else{setByPath(el.dataset.sChoice,el.dataset.value);render(el.dataset.fk);}
   return;
  }
  if(el.dataset.sBind){stopListening();listening=el.dataset.sBind;modal.setAttribute(LISTENING_FLAG,'');window.addEventListener('keydown',capture,true);announce(t('settings.controls.pressKey'));render(el.dataset.fk);return;}
  const act=el.dataset.sAct;
  if(act==='done'){modal.close();return;}
  if(act==='test-sound'){preview('swish');return;}
  if(act==='reset-sound'){resetSound();notify(t('settings.sound.resetToast'));render(el.dataset.fk);return;}
  if(act==='reset-a11y'){resetA11y();notify(t('settings.accessibility.resetToast'));render(el.dataset.fk);return;}
  if(act==='reset-keys'){keys={...DEFAULT_KEYS};saveKeys(keys);onKeysChange(keys);notify(t('settings.controls.resetToast'));render(el.dataset.fk);}
 }
 // Sliders update their readout while dragging and are applied without re-rendering, so the drag is not interrupted.
 function onInput(e){
  const el=e.target.closest?.('[data-s-range]');if(!el||!modal.contains(el))return;
  const value=+el.value,pct=`${Math.round(value*100)}%`,key=el.dataset.sRange;
  if(key==='sound.volume')setSound({volume:value});else setByPath(key,value);
  const out=modal.querySelector(`#o-${CSS.escape(key)}`);if(out)out.textContent=pct;el.setAttribute('aria-valuetext',pct);
 }
 function onChange(e){
  const range=e.target.closest?.('[data-s-range]');
  if(range&&modal.contains(range)){if(range.dataset.sRange==='sound.volume')preview('swish');return;}
  const el=e.target.closest?.('[data-s-select]');if(!el||!modal.contains(el))return;
  const key=el.dataset.sSelect,v=key==='a11y.playbackSpeed'?+el.value:el.value;setByPath(key,v);render(el.dataset.fk);
 }
 // Arrow keys move between tabs, as screen-reader users expect from a tab list.
 function onKeydown(e){
  const tabEl=e.target.closest?.('[role="tab"]');if(!tabEl||!modal.contains(tabEl))return;
  const list=tabs(),i=list.indexOf(tabEl.dataset.sTab),next={ArrowRight:(i+1)%list.length,ArrowLeft:(i-1+list.length)%list.length,Home:0,End:list.length-1}[e.key];
  if(next===undefined)return;e.preventDefault();tab=list[next];render(`tab:${tab}`);
 }
 modal.addEventListener('click',onClick);modal.addEventListener('input',onInput);modal.addEventListener('change',onChange);modal.addEventListener('keydown',onKeydown);
 // Escape while capturing a key cancels the capture, not the dialog.
 modal.addEventListener('cancel',e=>{if(listening)e.preventDefault();});
 modal.addEventListener('close',()=>{stopListening();open=false;});
 return {
  open(next){open=true;keys=loadKeys();if(next&&tabs().includes(next))tab=next;if(!tabs().includes(tab))tab='sound';render();modal.querySelector(`[data-fk="tab:${tab}"]`)?.focus();},
  isOpen:()=>open,
  refresh:()=>{if(open&&modal.open&&modal.querySelector('.settings'))render();}
 };
}
