// Graphics quality: pure helpers (no Three.js) so the choices can be unit-tested. The Arena applies the profile.
export const GRAPHICS_LEVELS=['auto','low','medium','high'];
// pixelRatio is a ceiling for devicePixelRatio; shadowSize 0 turns the sun's shadow off; crowd is 'full' | 'noshadow' | 'hidden'.
const PROFILES={low:{pixelRatio:1,shadowSize:0,crowd:'hidden'},medium:{pixelRatio:1.5,shadowSize:1024,crowd:'noshadow'},high:{pixelRatio:2,shadowSize:2048,crowd:'full'}};
// 'auto' starts at the current (High) look and may be lowered later by autoDowngrade.
export const qualityProfile=(level,dpr=1)=>{const p=PROFILES[level]||PROFILES.high,d=Number.isFinite(+dpr)&&+dpr>0?+dpr:1;return {...p,pixelRatio:Math.min(d,p.pixelRatio),shadows:p.shadowSize>0};};
export const lowerLevel=level=>level==='high'?'medium':'low';
// Frame-time probe: ignore the shader-compile warm-up, collect about two seconds, then decide once.
export const PROBE={warmup:12,seconds:2,minFrames:20,maxFrames:600,slowMs:1000/28};
export function medianMs(times){const a=times.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 0;const m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2;}
// frameTimes in milliseconds. True when the median frame is slower than about 28 fps; the median ignores one-off hitches.
export const autoDowngrade=(frameTimes,{minFrames=PROBE.minFrames,slowMs=PROBE.slowMs}={})=>Array.isArray(frameTimes)&&frameTimes.length>=minFrames&&medianMs(frameTimes)>slowMs;
// True once enough frames or time have been measured to decide.
export const probeDone=(times,{seconds=PROBE.seconds,minFrames=PROBE.minFrames,maxFrames=PROBE.maxFrames}={})=>times.length>=maxFrames||(times.length>=minFrames&&times.reduce((a,b)=>a+b,0)>=seconds*1000);
