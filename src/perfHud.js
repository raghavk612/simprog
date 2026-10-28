// Performance overlay for checking the game on a real graphics card: add ?perf to the address (e.g. .../index.html?perf).
// Shows frames per second, the typical and worst frame time, draw calls and triangles per frame (all passes: shadows,
// court mirror, main view and post-processing), the graphics level and player models. Nothing is shown or measured otherwise.
export const perfWanted=()=>{try{return new URLSearchParams(location.search).has('perf');}catch{return false;}};
export class PerfHud{
 constructor(arena){
  this.a=arena;this.times=[];this.last=performance.now();this.calls=0;this.tris=0;this.next=0;
  const el=this.el=document.createElement('div');el.className='perf-hud';el.setAttribute('aria-hidden','true');
  Object.assign(el.style,{position:'fixed',right:'8px',bottom:'8px',zIndex:9999,font:'12px/1.35 ui-monospace,Menlo,monospace',background:'rgba(10,8,20,.82)',color:'#e9e4ff',padding:'8px 10px',borderRadius:'8px',pointerEvents:'none',whiteSpace:'pre'});
  document.body.append(el);arena.renderer.info.autoReset=false;
 }
 /* Call after the frame has rendered. */
 frame(){const r=this.a.renderer,info=r.info,now=performance.now();this.times.push(now-this.last);this.last=now;if(this.times.length>240)this.times.shift();
  this.calls=info.render.calls;this.tris=info.render.triangles;info.reset();
  if(now<this.next)return;this.next=now+500;const t=[...this.times].sort((x,y)=>x-y),med=t[t.length>>1]||0,p95=t[Math.floor(t.length*.95)]||0,a=this.a;
  this.el.textContent=`${(1000/Math.max(med,.01)).toFixed(0)} fps   ${med.toFixed(1)} ms (95%: ${p95.toFixed(1)} ms)\n${this.calls} draws   ${(this.tris/1000).toFixed(0)}k triangles\n${a.level}${a.quality==='auto'?' (auto)':''} · ${a.playerStyle||a.playersChoice||'classic'} · ${r.getPixelRatio().toFixed(2)}x · ${a.renderer.domElement.width}×${a.renderer.domElement.height}\n${(this.a.director?.shot&&this.a.look?.active)?'camera: '+this.a.director.shot+(this.a.look.dof?.enabled?' + DOF':''):''}`;
  this.stats={fps:1000/Math.max(med,.01),medianMs:med,p95Ms:p95,calls:this.calls,triangles:this.tris,level:a.level,players:a.playerStyle||a.playersChoice,pixelRatio:r.getPixelRatio()};window.__kangsPerf=this.stats;}
}
