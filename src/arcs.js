/* Player development arcs, from the per-game history the engine keeps (p.hist: skill after each game, p.form: average of energy and morale after each game; both at most 40 numbers).
   Breakout: skill is up 3 or more over the last 3 games. Slump: form is down 6 or more over the last 3 games and now below 65. Slump wins if both apply. */
export const ARC={window:3,breakout:3,slumpDrop:6,slumpBelow:65};
const nums=a=>Array.isArray(a)?a.filter(Number.isFinite):[];
export function arc(p){
 const h=nums(p.hist),f=nums(p.form),w=ARC.window;
 const series=h.length&&Number.isFinite(p.skill0)?[p.skill0,...h]:h;
 const from=series[0],to=series.at(-1),games=h.length;
 const gain=games>=w?to-series.at(-1-w):0;
 const drop=f.length>w?f.at(-1-w)-f.at(-1):0;
 const tag=drop>=ARC.slumpDrop&&f.at(-1)<ARC.slumpBelow?'slump':gain>=ARC.breakout?'breakout':null;
 return {series,from,to,games,gain,tag,show:games>=2};
}
/* Polyline points for a sparkline in a w x h box (a flat series draws a mid-height line). */
export function sparkPoints(series,w=120,h=32,pad=3){
 if(series.length<2)return '';
 const lo=Math.min(...series),hi=Math.max(...series),span=hi-lo;
 return series.map((v,i)=>`${+(pad+i*(w-2*pad)/(series.length-1)).toFixed(1)},${+(span?h-pad-(v-lo)/span*(h-2*pad):h/2).toFixed(1)}`).join(' ');
}
/* How much growth is left: high, some or low (near the ceiling). */
export const roomLevel=r=>r>=.75?'high':r>=.4?'some':'low';
