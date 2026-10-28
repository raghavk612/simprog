// Adds a simplified "far" version (LOD1) of every skinned mesh to the player models in public/models/players/*.glb.
// Run after scripts/build_players.py:   node scripts/player_lods.mjs
// The LOD meshes reuse the original vertex buffers (positions, normals, UVs, skin weights) and only get a new, shorter
// index list from meshoptimizer's simplifier, so they deform with the same skin and add very little to the file.
// Each LOD node is named <mesh>_lod1 and bound to the same skin. Running it twice is harmless (existing LODs are skipped).
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MeshoptSimplifier} from 'meshoptimizer';

const DIR=join(dirname(fileURLToPath(import.meta.url)),'..','public','models','players');
export const LOD_RATIO=.3;        // keep about 30% of the triangles
export const LOD_ERROR=.012;      // relative error ceiling (fraction of the mesh's size)

function readGlb(buf){
 const jsonLen=buf.readUInt32LE(12),json=JSON.parse(buf.subarray(20,20+jsonLen).toString('utf8'));
 const binStart=20+jsonLen,binLen=buf.readUInt32LE(binStart);return {json,bin:Buffer.from(buf.subarray(binStart+8,binStart+8+binLen))};
}
function writeGlb(json,bin){
 const pad=(b,c)=>Buffer.concat([b,Buffer.alloc((4-b.length%4)%4,c)]);
 const j=pad(Buffer.from(JSON.stringify(json),'utf8'),0x20),b=pad(bin,0),head=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
 head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(12+8+j.length+8+b.length,8);
 jh.writeUInt32LE(j.length,0);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(b.length,0);bh.writeUInt32LE(0x004e4942,4);
 return Buffer.concat([head,jh,j,bh,b]);
}
const COMP={5121:[Uint8Array,1],5123:[Uint16Array,2],5125:[Uint32Array,4],5126:[Float32Array,4]},SIZE={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function read(json,bin,index){
 const a=json.accessors[index],v=json.bufferViews[a.bufferView],[T,bytes]=COMP[a.componentType],n=SIZE[a.type],stride=(v.byteStride||bytes*n)/bytes;
 const src=new T(bin.buffer,bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0),(a.count-1)*stride+n),out=new T(a.count*n);
 for(let i=0;i<a.count;i++)for(let k=0;k<n;k++)out[i*n+k]=src[i*stride+k];return out;
}
/* Simplify an index list. Vertices that share a position (UV or normal seams) are welded for the simplifier, so seams do
   not count as borders; open garment edges (hems, sleeve openings) stay locked so pieces keep meeting the body. */
export function simplifyIndices(indices,positions,ratio=LOD_RATIO,error=LOD_ERROR){
 const count=positions.length/3,key=new Map(),weld=new Uint32Array(count);
 for(let i=0;i<count;i++){const k=`${positions[i*3].toFixed(5)},${positions[i*3+1].toFixed(5)},${positions[i*3+2].toFixed(5)}`;if(!key.has(k))key.set(k,i);weld[i]=key.get(k);}
 const welded=Uint32Array.from(indices,i=>weld[i]),target=Math.max(3,Math.floor(indices.length*ratio/3)*3);
 const [out]=MeshoptSimplifier.simplify(welded,positions,3,target,error,['LockBorder']);
 return out;
}

export async function addLods(file){
 await MeshoptSimplifier.ready;
 const {json,bin}=readGlb(readFileSync(file));
 if(json.nodes.some(n=>/_lod1$/.test(n.name||'')))return {file,skipped:true};
 const root=json.nodes.find(n=>n.name==='player'),chunks=[bin];let length=bin.length;const report=[];
 for(const [ni,node] of [...json.nodes.entries()]){
  if(node.mesh===undefined||node.skin===undefined)continue;
  const mesh=json.meshes[node.mesh],prims=[];let before=0,after=0;
  for(const p of mesh.primitives){
   const idx=read(json,bin,p.indices),pos=read(json,bin,p.attributes.POSITION),lod=simplifyIndices(Uint32Array.from(idx),pos);
   before+=idx.length/3;after+=lod.length/3;
   const big=pos.length/3>65535,data=big?Buffer.from(lod.buffer,lod.byteOffset,lod.byteLength):Buffer.from(Uint16Array.from(lod).buffer);
   const padBytes=(4-length%4)%4;if(padBytes){chunks.push(Buffer.alloc(padBytes));length+=padBytes;}
   json.bufferViews.push({buffer:0,byteOffset:length,byteLength:data.length,target:34963});chunks.push(data);length+=data.length;
   json.accessors.push({bufferView:json.bufferViews.length-1,componentType:big?5125:5123,count:lod.length,type:'SCALAR'});
   prims.push({...p,indices:json.accessors.length-1});
  }
  json.meshes.push({name:mesh.name+'_lod1',primitives:prims});
  json.nodes.push({name:node.name+'_lod1',mesh:json.meshes.length-1,skin:node.skin});
  root.children.push(json.nodes.length-1);report.push([node.name,before,after]);
 }
 const out=Buffer.concat(chunks);json.buffers[0].byteLength=out.length;writeFileSync(file,writeGlb(json,out));
 return {file,report};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 for(const f of readdirSync(DIR).filter(f=>f.endsWith('.glb'))){
  const r=await addLods(join(DIR,f));
  if(r.skipped){console.log(f,'already has LODs');continue;}
  const t=r.report.reduce((s,[,b,a])=>[s[0]+b,s[1]+a],[0,0]);
  console.log(f,`${t[0]} -> ${t[1]} triangles (${Math.round(t[1]/t[0]*100)}%)`,r.report.map(([n,b,a])=>`${n.replace('_mesh','')} ${b}->${a}`).join(', '));
 }
}
