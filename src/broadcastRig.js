// The arena's broadcast lighting rig and camera angles, as built in Spline:
//   "Kangs Arena – Broadcast Lighting"  https://app.spline.design/file/22b369ab-471f-43d1-8a65-6dc71fe2f9ee
// Values are copied from the Spline scene in Spline units (1 m = 50 units; the court's long axis on x, centre at the origin,
// exactly like the game) and converted with toGame(). To change the rig, edit the Spline scene and re-read it into this file.
export const SPLINE_FILE='https://app.spline.design/file/22b369ab-471f-43d1-8a65-6dc71fe2f9ee';
export const SPLINE_UNITS_PER_M=50;
export const GAME_UNITS_PER_M=0.3306/0.3048;   // the court is drawn at 0.3306 game units per foot
export const toGame=v=>v.map(n=>n/SPLINE_UNITS_PER_M*GAME_UNITS_PER_M);

export const RIG={
 key:{position:[120,1250,260],color:'#fff1e2',intensity:1.1,shadowSoftness:8},
 spots:[[-420,760,-260],[0,760,-260],[420,760,-260],[-420,760,260],[0,760,260],[420,760,260]].map(position=>({position,color:'#fff3e2',intensity:3,angle:36,penumbra:.55,distance:1500,decay:1.2})),
 rims:[{position:[-950,520,-650],color:'#cdd9ff',intensity:.75},{position:[950,520,-650],color:'#cdd9ff',intensity:.75}],
 ambient:{color:'#e6dcff',intensity:.45},
 trusses:[{position:[0,790,-260],size:[1500,16,16]},{position:[0,790,260],size:[1500,16,16]}],
 banks:[-260,260].flatMap(z=>[-560,-280,0,280,560].map(x=>({position:[x,774,z],size:[64,16,44]}))),
 // broadcast camera angles (used by the camera stage): position and the point it looks at
 cameras:{
  broadcastLow:{position:[0,230,1180],target:[0,70,0]},
  wide:{position:[0,700,1550],target:[0,0,0]},
  baseline:{position:[-1050,270,60],target:[300,90,0]},
  replayClose:{position:[380,115,400],target:[560,120,0]},
  freeThrow:{position:[150,175,30],target:[560,160,0]}
 }
};
