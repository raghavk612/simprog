// Screen-reader announcements and colour-vision correction filters.
const HIDDEN='position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
const regions={};
function region(kind){
 if(regions[kind])return regions[kind];
 const el=document.createElement('div');
 el.setAttribute('role',kind==='polite'?'status':'alert');el.setAttribute('aria-live',kind);el.setAttribute('aria-atomic','true');
 el.className='sr-only';el.style.cssText=HIDDEN;document.body.append(el);return regions[kind]=el;
}
// Clearing first makes screen readers read a repeated message again.
function say(kind,message){if(typeof document==='undefined')return;const el=region(kind);el.textContent='';requestAnimationFrame(()=>{el.textContent=message;});}
export const announce=message=>say('polite',message);
export const interrupt=message=>say('assertive',message);

// Machado et al. (2009) dichromacy simulation matrices, severity 1.0, applied in linear RGB.
const SIMULATE={
 protanopia:[[.152286,1.052583,-.204868],[.114503,.786281,.099216],[-.003882,-.048116,1.051998]],
 deuteranopia:[[.367322,.860646,-.227968],[.280085,.672501,.047413],[-.01182,.04294,.968881]],
 tritanopia:[[1.255528,-.076749,-.178779],[-.078411,.930809,.147602],[.004733,.691367,.3039]]
};
// Where the information a viewer cannot see is moved to: red-green loss goes into green/blue, blue-yellow loss into red/green.
const REDIRECT={protanopia:[[0,0,0],[.7,1,0],[.7,0,1]],deuteranopia:[[0,0,0],[.7,1,0],[.7,0,1]],tritanopia:[[1,0,.7],[0,1,.7],[0,0,0]]};
const mul=(a,b)=>a.map(r=>b[0].map((_,j)=>r.reduce((s,v,k)=>s+v*b[k][j],0)));
// Daltonization: corrected = original + redirect × (original − simulated). Neutral greys are unchanged because every row sums to 1.
export function correctionMatrix(mode){
 const sim=SIMULATE[mode],to=REDIRECT[mode];if(!sim)return null;
 const loss=sim.map((r,i)=>r.map((v,j)=>(i===j?1:0)-v)),shifted=mul(to,loss);
 return shifted.map((r,i)=>r.map((v,j)=>(i===j?1:0)+v));
}
export const FILTER_ID=mode=>`kangs-cb-${mode}`;
// Invisible SVG referenced from CSS: filter:url(#kangs-cb-deuteranopia).
export function installColorFilters(){
 if(typeof document==='undefined'||document.getElementById('kangs-filters'))return;
 const filters=Object.keys(SIMULATE).map(mode=>{const m=correctionMatrix(mode);return `<filter id="${FILTER_ID(mode)}" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="${m.map(r=>[...r,0,0].join(' ')).join(' ')} 0 0 0 1 0"/></filter>`;}).join('');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.id='kangs-filters';svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.style.cssText='position:absolute;width:0;height:0;overflow:hidden';svg.innerHTML=`<defs>${filters}</defs>`;
 document.body.append(svg);
}
