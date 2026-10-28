import {opponentLogo} from './logos.js';

// Enhance rendered text too, so translated prose, dialogs and live updates keep
// the same team identity as standings and schedule rows. Never modify form values.
export function pairTeamLogos(root,names){
 const teams=[...new Set(names.filter(Boolean))].sort((a,b)=>b.length-a.length);
 if(!teams.length)return;
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const pattern=new RegExp(`(?<![\\p{L}\\p{N}])(${teams.map(escape).join('|')})(?![\\p{L}\\p{N}])`,'giu');
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
 while(walker.nextNode())nodes.push(walker.currentNode);
 for(const node of nodes){
  const parent=node.parentElement;
  if(!parent||parent.closest('script,style,svg,canvas,select,textarea,input,.team-label,.sr-only,[aria-hidden="true"],[data-no-team-logo],nav,button,.pill,.topbar,.arena-top'))continue;   // no logos in navigation, buttons or small tags
  // one logo per team per block: if this text's block (or the one around it) already shows the team's logo (the brand mark,
  // a matchup's VS row, or an earlier mention), later mentions are plain text
  const shown=new Set();for(const up of [parent,parent.parentElement])for(const img of up?.querySelectorAll('img')||[])shown.add(logoFile(img.getAttribute('src')));
  const text=node.textContent;pattern.lastIndex=0;
  const matches=[...text.matchAll(pattern)];if(!matches.length)continue;
  const fragment=document.createDocumentFragment();let end=0;
  for(const match of matches){
   fragment.append(document.createTextNode(text.slice(end,match.index)));
   const label=document.createElement('span');label.className='team-label';
   const image=document.createElement('img');image.className='team-logo';image.alt='';image.decoding='async';
   const home=/^(lake washington|kangs)$/i.test(match[0]);
   const url=home?`${import.meta.env?.BASE_URL??'/'}images/kangs-logo.png`:opponentLogo(match[0]);
   if(!url||shown.has(logoFile(url))){label.textContent=match[0];}else{shown.add(logoFile(url));image.src=url;label.append(image,document.createTextNode(match[0]));}
   fragment.append(label);end=match.index+match[0].length;
  }
  fragment.append(document.createTextNode(text.slice(end)));node.replaceWith(fragment);
  // Existing schedule/bracket badges are replaced by the shared inline identity.
  const badge=parent.querySelector(':scope > .opp-badge');if(badge)badge.remove();
 }
}
const logoFile=src=>String(src||'').split(/[?#]/)[0].split('/').pop().toLowerCase();
export const strengthLevel=rating=>rating>=80?'high':rating>=70?'medium':'low';
