// Graphics quality: pure helpers (no Three.js) so the choices can be unit-tested. The Arena applies the profile.
export const GRAPHICS_LEVELS=['auto','low','medium','high'];
// Player models: 'classic' (the original figures) or 'athletes' (the rigged Houdini bodies). Low quality always draws classic.
export const PLAYER_MODELS=['classic','athletes'];
export const effectivePlayers=(choice,level)=>level==='low'||!PLAYER_MODELS.includes(choice)?'classic':choice;
// pixelRatio is a ceiling for devicePixelRatio; shadowSize 0 turns the sun's shadow off; crowd is 'full' | 'noshadow' | 'hidden'.
const PROFILES={low:{pixelRatio:1,shadowSize:0,crowd:'hidden'},medium:{pixelRatio:1.5,shadowSize:1024,crowd:'noshadow'},high:{pixelRatio:2,shadowSize:2048,crowd:'full'}};
// Pixel budget per level: on very large canvases (e.g. a full-screen Retina window, 5.7 million pixels at 2x) the ratio is
// lowered so the canvas stays under this many pixels, never below 1x. Measured on a Mac: High at 5.7 MP (3484×1644) ran at ~56 fps (18 ms); the budget brings that canvas to 1.6x.
export const MAX_PIXELS={high:3.7e6,medium:2.4e6,low:Infinity};
// 'auto' starts at the current (High) look and may be lowered later by autoDowngrade. size = the canvas's CSS size, if known.
export const qualityProfile=(level,dpr=1,size=null)=>{const p=PROFILES[level]||PROFILES.high,d=Number.isFinite(+dpr)&&+dpr>0?+dpr:1;let pixelRatio=Math.min(d,p.pixelRatio);
 const area=size&&size.width>0&&size.height>0?size.width*size.height:0,max=MAX_PIXELS[PROFILES[level]?level:'high'];
 if(area&&area*pixelRatio*pixelRatio>max)pixelRatio=Math.max(1,Math.floor(Math.sqrt(max/area)*20)/20);
 return {...p,pixelRatio,shadows:p.shadowSize>0};};
export const lowerLevel=level=>level==='high'?'medium':'low';
// Frame-time probe: ignore the shader-compile warm-up, collect about two seconds, then decide once.
export const PROBE={warmup:12,seconds:2,minFrames:20,maxFrames:600,slowMs:1000/28};
export function medianMs(times){const a=times.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 0;const m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2;}
// frameTimes in milliseconds. True when the median frame is slower than about 28 fps; the median ignores one-off hitches.
export const autoDowngrade=(frameTimes,{minFrames=PROBE.minFrames,slowMs=PROBE.slowMs}={})=>Array.isArray(frameTimes)&&frameTimes.length>=minFrames&&medianMs(frameTimes)>slowMs;
// True once enough frames or time have been measured to decide.
export const probeDone=(times,{seconds=PROBE.seconds,minFrames=PROBE.minFrames,maxFrames=PROBE.maxFrames}={})=>times.length>=maxFrames||(times.length>=minFrames&&times.reduce((a,b)=>a+b,0)>=seconds*1000);
// Broadcast look (with the 3D athletes): what each level turns on. Low draws the classic gym.
export function lookFeatures(level){
 if(level==='high')return {reflections:true,ao:true,bloom:true,grade:true,spots:6,contact:true,dof:true};
 if(level==='medium')return {reflections:false,ao:false,bloom:true,grade:true,spots:3,contact:true,dof:true};
 return null;
}
/* Player level of detail by on-screen size in device pixels. The far mesh (30% of the triangles, scripts/player_lods.mjs)
   dents the face and breaks up the hairline once a head is more than a few pixels tall, so it is used only when the whole
   player is under LOD_PIXELS.far pixels tall (a head of about 18 px), and dropped again above LOD_PIXELS.near. Judging by
   the fraction of the frame instead put the far mesh on 230 px players in the long-lens Follow view on large screens. */
export const LOD_PIXELS={far:140,near:165};
/* Height in pixels of a body `height` tall, `distance` away, through a vertical field of view of fovDeg on a view viewPx tall. */
export const bodyPixels=(fovDeg,distance,viewPx,height=2.2)=>height/(2*Math.max(.01,distance)*Math.tan(fovDeg*Math.PI/360))*viewPx;
export const lodFor=(px,current=0)=>px<(current?LOD_PIXELS.near:LOD_PIXELS.far)?1:0;
