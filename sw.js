const PREFIX='mi-expedicion-pwa-';
const CACHE=PREFIX+'2026-11-16-1';
const scope=new URL(self.registration.scope);
const paths=['./','index.html','editor.html','admin.html','styles.css','core.js','map.js','app.js','expediciones.json','manifest.webmanifest','icon-192.png','icon-512.png','ejemplo.gpx'];
const urlFor=path=>new URL(path,scope).href;
const shell=new Set(paths.map(urlFor));
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(paths.map(path=>new Request(urlFor(path),{cache:'reload'})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys()){
      if((key.startsWith(PREFIX)||key==='mi-expedicion-demo-v1')&&key!==CACHE)await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  if(req.mode==='navigate'){
    const path=url.pathname.slice(scope.pathname.length);
    if(!['','index.html','editor.html','admin.html'].includes(path))return;
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      return await cache.match(urlFor(path||'index.html'))||fetch(req);
    })());
    return;
  }
  if(url.href===urlFor('expediciones.json')){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try{
        const response=await fetch(new Request(req,{cache:'no-cache'}));
        if(response.ok){await cache.put(req,response.clone());return response;}
        return await cache.match(req)||response;
      }catch{return await cache.match(req)||Response.error();}
    })());
    return;
  }
  if(shell.has(url.href))event.respondWith(caches.open(CACHE).then(async c=>await c.match(req)||fetch(req)));
});
