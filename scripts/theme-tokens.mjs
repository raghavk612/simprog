// Rewrites hard-coded colours in src/style.css and src/a11y.css to the theme tokens in src/theme.css, so light and dark mode both work.
// Safe to run again: tokens are left alone and only new literals change. After a merge conflict in style.css, take
// main's version and run `node scripts/theme-tokens.mjs`.
// Also flattens gradients, and removes glows, glass blur, italics and tracked capitals.
import fs from 'node:fs';

// Drawn objects that keep their own colours in both themes: jerseys, the locker wall, the whiteboard, crests.
const ART=/\.shirt|\.whiteboard|\.mb-|\.lk\b|\.lk-(?!kits)|\.prospect-jersey(?!-stage)|\.opp-crest|\.bug-crest|\.crest\b/;
const KEEP_CAPS=/bug|score-strip|\.landing h1|kbd|\.key\b/;
const KEEP_ITALIC=/\.est\b|\.est-key/;
const HEX=/#[0-9a-fA-F]{3,8}\b/g;

function rgba(hex){let h=hex.slice(1);if(h.length<=4)h=[...h].map(c=>c+c).join('');const n=i=>parseInt(h.slice(i,i+2),16);return {r:n(0),g:n(2),b:n(4),a:h.length===8?n(6)/255:1};}
function hsl({r,g,b}){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;if(!d)return {h:0,s:0,l};const s=d/(1-Math.abs(2*l-1));const h=max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4;return {h:h*60,s,l};}
function family(hex){const c=rgba(hex),{h,s,l}=hsl(c),a=c.a;
 if(a<.02)return {name:'clear',l,a};
 if(h>=26&&h<=58&&s>.45&&l>.35)return {name:'gold',l,a};
 if((h<=18||h>=335)&&s>.4&&l>.3)return {name:'red',l,a};
 if(h>=85&&h<=175&&s>.25&&l>.25)return {name:'green',l,a};
 if(h>=240&&h<=320&&s>.3&&l>=.25&&l<=.82)return {name:'purple',l,a};
 return {name:'neutral',l,a};}

function surface(hex){const {name,l,a}=family(hex);
 if(name==='clear')return 'transparent';
 if(name==='gold')return a>.6?'var(--score)':'var(--warn-soft)';
 if(name==='red')return a>.6?'var(--bad-solid)':'var(--bad-soft)';
 if(name==='green')return a>.6?'var(--good-solid)':'var(--good-soft)';
 if(name==='purple')return a>.6?(l>=.33?'var(--accent)':'var(--panel-2)'):'var(--accent-soft)';
 if(l>.8&&a<.9)return a<.06?'var(--panel-2)':'var(--panel-3)';
 if(l<.25&&a<.62)return 'var(--shade)';
 if(l<.085)return 'var(--page)';
 if(l<.15)return 'var(--panel)';
 if(l<.3)return 'var(--panel-2)';
 if(l<.6)return 'var(--panel-3)';
 return l>.97?'var(--panel)':'var(--panel-2)';}
function text(hex,bg){const {name,l,a}=family(hex);
 if(bg==='accent'||bg==='bad')return 'var(--on-accent)';
 if(bg==='score'||bg==='good')return 'var(--on-score)';
 if(name==='clear')return 'transparent';
 if(name==='gold')return 'var(--score)';
 if(name==='red')return 'var(--bad)';
 if(name==='green')return 'var(--good)';
 if(name==='purple')return 'var(--accent-ink)';
 const seen=l*a+(1-a)*.1;
 if(l<.3&&a>.8)return 'var(--ink)';
 return seen>.86?'var(--ink)':seen>.6?'var(--ink-2)':'var(--ink-3)';}
function line(hex){const {name,a}=family(hex);
 if(name==='clear')return 'transparent';
 if(name==='gold')return 'var(--score)';
 if(name==='red')return 'var(--bad)';
 if(name==='green')return 'var(--good)';
 if(name==='purple')return a>.5?'var(--accent-ink)':'var(--line-2)';
 return a>.3?'var(--line-2)':'var(--line)';}

// Applies fn to the parts of a value outside url(...), so data URIs are not touched.
function outsideUrl(value,fn){return value.split(/(url\((?:"[^"]*"|'[^']*'|[^)]*)\))/).map((part,i)=>i%2?part:fn(part)).join('');}
function splitTop(value,sep){const out=[];let depth=0,quote='',cur='';for(const c of value){if(quote){if(c===quote)quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='(')depth++;else if(c===')')depth--;if(c===sep&&!depth&&!quote){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out;}
const GRAD=/(?:repeating-)?(?:linear|radial|conic)-gradient\(/;
function gradients(value){const found=[];let i=0;while(true){const m=GRAD.exec(value.slice(i));if(!m)break;const s=i+m.index;let d=0,k=s+m[0].length-1;do{if(value[k]==='(')d++;else if(value[k]===')')d--;k++;}while(d&&k<value.length);found.push([s,k]);i=k;}return found;}
const blend=stops=>{const c=stops.map(rgba),n=c.length,avg=k=>Math.round(c.reduce((s,x)=>s+x[k],0)/n),a=c.reduce((s,x)=>s+x.a,0)/n;return '#'+[avg('r'),avg('g'),avg('b')].map(v=>v.toString(16).padStart(2,'0')).join('')+Math.round(a*255).toString(16).padStart(2,'0');};
// A gradient whose stops share a position (a colour block, a tick ruler) has no fade and stays.
const hardStops=g=>!g.startsWith('radial')&&/#[0-9a-fA-F]+ +\d+(%|px)? +\d/.test(g);

function flatten(value,art){
 const pieces=[];let last=0,out='';
 for(const [s,e] of gradients(value)){const g=value.slice(s,e),stops=g.match(HEX)||[];out+=value.slice(last,s);last=e;
  const faint=stops.every(h=>rgba(h).a<.05);
  if(hardStops(g)&&!faint&&(art||/repeating/.test(g))){out+=g;continue;}
  const fade=faint||/transparent/.test(g)||stops.some(h=>rgba(h).a<.05);
  if(fade||!stops.length){pieces.push(null);out+='\u0000';continue;}
  const hex=blend(stops.slice(0,2));pieces.push(hex);out+=hex;}
 out+=value.slice(last);
 out=out.replace(/\u0000\s*(?:[^,]*?)(,|$)/g,'$1');
 out=out.replace(/url\("data:image\/svg[^"]*"\)[^,]*(,|$)/g,'$1');
 return splitTop(out,',').map(x=>x.trim()).filter(Boolean).join(',')||'none';}

function shadow(value,prop){const kept=[];for(const part of splitTop(value,',')){const words=part.trim().split(/\s+(?![^(]*\))/).filter(w=>w!=='inset'),nums=words.filter(w=>/^-?[\d.]+(px|em)?$/.test(w));if(nums.length>=2&&parseFloat(nums[2]||0)===0)kept.push(part.trim().replace(HEX,line));}return kept.join(',')||'none';}

function ruleBackground(body){const m=/(?:^|;)\s*background(?:-color)?:([^;]*)/.exec(body);if(!m)return '';const hex=m[1].match(HEX)?.[0];if(!hex)return '';const f=family(hex);if(f.a<.6)return '';return {purple:f.l>=.33?'accent':'',gold:'score',green:'good',red:'bad'}[f.name]||'';}

function declaration(decl,sel,bg){
 const m=/^(\s*)(-?[a-z-]+)\s*:([\s\S]*)$/.exec(decl);if(!m)return decl;
 const [,space,prop,raw]=m;if(prop.startsWith('--'))return decl;
 const art=ART.test(sel);let value=raw;
 if(/^(-webkit-)?backdrop-filter$/.test(prop)||prop==='text-shadow')return null;
 if(/^(-webkit-)?mask-image$/.test(prop))return null;
 if(prop==='letter-spacing')return null;
 if(prop==='text-transform'&&/uppercase/.test(value)&&!KEEP_CAPS.test(sel))return null;
 if(prop==='font-style'&&/italic/.test(value)&&!KEEP_ITALIC.test(sel))return null;
 if(prop==='font'&&!KEEP_ITALIC.test(sel))value=value.replace(/\bitalic\s+/,'');
 if(prop==='filter'&&/drop-shadow/.test(value)){const keep=value.match(/[a-z-]+\((?:[^()]|\([^()]*\))*\)/g)?.filter(f=>!f.startsWith('drop-shadow')||parseFloat(f.split(/\s+/)[2]||'0')<=1)||[];if(!keep.length)return null;value=keep.join(' ');}
 if(prop==='box-shadow'&&!/^\s*none/.test(value))value=shadow(value,prop);
 if(prop==='border-radius'&&!art)value=value.replace(/(\d+(?:\.\d+)?)px/g,(all,n)=>+n>=7&&+n<99?'4px':all);
 if(/^background/.test(prop))value=outsideUrl(value,v=>v).includes('gradient(')||/url\("data:image\/svg/.test(value)?flatten(value,art):value;
 if(!art){
  if(/^background/.test(prop))value=outsideUrl(value,v=>v.replace(HEX,surface));
  else if(['color','fill','stroke','caret-color','accent-color','-webkit-text-fill-color'].includes(prop))value=value.replace(HEX,h=>text(h,bg));
  else if(/^(border|outline|text-decoration)/.test(prop))value=value.replace(HEX,line);
 }
 return value===raw?decl:`${space}${prop}:${value}`;}

function body(src,sel){const bg=ruleBackground(src);return splitTop(src,';').map(d=>d.trim()?declaration(d,sel,bg):d).filter(d=>d!==null).join(';');}

// Walks the stylesheet, keeping every selector and comment exactly as written.
function walk(src){let out='',i=0;
 while(i<src.length){let j=i,depth=0,quote='';
  while(j<src.length){if(!quote&&src.startsWith('/*',j)){j=src.indexOf('*/',j)+2;continue;}const c=src[j];if(quote){if(c===quote)quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='(')depth++;else if(c===')')depth--;else if(!depth&&(c==='{'||c===';'))break;j++;}
  if(j>=src.length){out+=src.slice(i);break;}
  if(src[j]===';'){out+=src.slice(i,j+1);i=j+1;continue;}
  let d=1,k=j+1;quote='';let par=0;
  while(k<src.length&&d){if(!quote&&src.startsWith('/*',k)){k=src.indexOf('*/',k)+2;continue;}const c=src[k];if(quote){if(c===quote)quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='(')par++;else if(c===')')par--;else if(!par&&c==='{')d++;else if(!par&&c==='}')d--;k++;}
  const head=src.slice(i,j),inner=src.slice(j+1,k-1),sel=head.replace(/\/\*[\s\S]*?\*\//g,'').trim();
  out+=`${head}{${/^@(media|supports|keyframes)/.test(sel)?walk(inner):/a11y-high-contrast/.test(sel)?inner:body(inner,sel)}}`;i=k;}
 return out;}

for(const name of ['style.css','a11y.css']){
 const file=new URL(`../src/${name}`,import.meta.url),before=fs.readFileSync(file,'utf8'),after=walk(before);
 fs.writeFileSync(file,after);
 const left=[...after.matchAll(/[^;{}]*gradient\([^;{}]*/g)].map(m=>m[0].trim().slice(0,90));
 console.log(`${name}: ${(before.match(HEX)||[]).length} to ${(after.match(HEX)||[]).length} colour literals, ${left.length} gradients left\n${left.join('\n')}`);
}
