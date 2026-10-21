import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=walk('dist').filter(f=>!f.endsWith('sw.js'));const hash=crypto.createHash('sha256');for(const f of files)hash.update(fs.readFileSync(f));const version=hash.digest('hex').slice(0,12);
fs.writeFileSync('dist/sw.js',`const CACHE='kangs-${version}';const FILES=${JSON.stringify(files.map(f=>'./'+f.slice(5)))};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('kangs-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request,{ignoreSearch:true}).then(async r=>r||(event.request.mode==='navigate'?await caches.match(new URL('index.html',self.registration.scope).href):null)||new Response('Offline asset unavailable',{status:503}))));});`);
console.log(`Offline cache: ${files.length} local assets (${version})`);
