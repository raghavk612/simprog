/* Bleacher layout for the arena (pure: no Three, no DOM). Six-row stands on both sidelines and four-row stands behind both baselines, cut around what
   already stands there (src/arena.js): the coach's office corner and its camera (+x, -z), the wall bars, the drill cones and the ball rack (-x). Rows rise
   away from the court; every fan faces it. Boxes are [w,h,d,x,y,z] (sizes along x,y,z and centre), ready for Arena.box(). */
export const RISE=.5,DEEP=.85,PITCH=.64,EMPTY=.05,CAMERA_CLEAR=.8;
/* axis 'z' = a sideline stand (rows step out along z, seats run along x), 'x' = a baseline stand. from/to bound the seats' run; first = the lowest row built (default 0); id seeds each seat's look. */
export const SECTIONS=[
 {axis:'z',side:-1,front:10.2,back:16,rows:6,from:-13,to:13,aisles:[13,26],id:-1000},{axis:'z',side:1,front:10.2,back:16,rows:6,from:-13,to:13,aisles:[13,26],id:1000},
 {axis:'x',side:1,front:16.1,back:19.5,rows:4,from:-3.6,to:9.6,id:3000},   // +x: stops short of the office corner, whose camera hangs over z -6
 {axis:'x',side:-1,front:16.1,back:19.5,rows:4,first:2,from:-3.75,to:2,id:4000},// -x: only the two back rows behind the drill cones, clear of the wall bars; the far corner past the bars stays empty (the locker camera would see it)
 {axis:'x',side:-1,front:16.1,back:19.5,rows:4,from:2,to:5.25,id:5000},    // full rows from past the cones to the ball rack
 {axis:'x',side:-1,front:16.1,back:19.5,rows:4,from:6.75,to:9.6,id:6000}]; // past the ball rack
/* Stable 0..1 hash per seat number: which seats are empty, each fan's jitter, and (in arena.js) shirt and skin colours. */
export const hash=n=>{const s=Math.sin(n*91.7)*43758.5453;return s-Math.floor(s);},R=hash;
/* A seated fan's torso and head boxes (the head's box bounds its sphere); baseline fans turn side-on, so their torso box turns with them. */
export function fanBoxes({x,y,z,h,axis}){const t=axis==='x'?[.28,.56,.42]:[.42,.56,.28];return [[...t,x,y+.28+h,z],[.34,.34,.34,x,y+.75+h,z]];}
/* stations: camera positions [x,y,z] the stands must keep clear; a seat with any part of its fan closer than CAMERA_CLEAR to one stays empty. */
export function seatLayout(stations=[]){const risers=[],rails=[],slots=[],gap=(b,lo,hi)=>Math.hypot(...[0,1,2].map(a=>Math.max(lo[a]-b[a+3]-b[a]/2,b[a+3]-b[a]/2-hi[a],0))),
  lo=[0,1,2].map(a=>Math.min(...stations.map(p=>p[a]))),hi=[0,1,2].map(a=>Math.max(...stations.map(p=>p[a]))),near=b=>stations.length>0&&gap(b,lo,hi)<CAMERA_CLEAR&&stations.some(p=>gap(b,p,p)<CAMERA_CLEAR); // the stations' bounding box rules out most seats at once
 for(const {axis,side,front,back,rows,first=0,from,to,aisles=[],id} of SECTIONS){const len=to-from,mid=(from+to)/2,n=Math.floor((len-.9)/PITCH)+1,off=(len-(n-1)*PITCH)/2,ry=axis==='z'?(side>0?Math.PI:0):-side*Math.PI/2,
   put=(across,along)=>axis==='z'?[across,along]:[along,across],size=(a,b)=>axis==='z'?[a,b]:[b,a];
  {const [w,d]=size(len,.05),[x,z]=put(mid,side*(front+first*DEEP-.03));rails.push([w,.26,d,x,(first+1)*RISE-.18,z]);}
  for(let r=first;r<rows;r++){const d=r===rows-1?back-front-r*DEEP:DEEP,[w,dd]=size(len,d),[x,z]=put(mid,side*(front+r*DEEP+d/2));risers.push([w,(r+1)*RISE,dd,x,(r+1)*RISE/2,z,r%2]);
   for(let i=0;i<n;i++){const k=id+r*50+i,[sx,sz]=put(from+off+i*PITCH+(R(k+.5)-.5)*.1,side*(front+r*DEEP+DEEP*.55)),s={x:sx,y:(r+1)*RISE,z:sz,ry,h:(R(k+.3)-.5)*.08,n:k,axis,aisle:aisles.includes(i)};
    s.taken=!s.aisle&&R(k)>=EMPTY&&!fanBoxes(s).some(near);slots.push(s);}}}
 return {risers,rails,slots,seats:slots.filter(s=>s.taken)};}
