(function application() {
  'use strict';
  const $=(id)=>document.getElementById(id);
  const esc=ME.escape;
  const params=new URLSearchParams(location.search);
  const isEditor=document.documentElement.dataset.page==='editor';
  const nf=new Intl.NumberFormat('es-AR',{maximumFractionDigits:2});
  const whole=new Intl.NumberFormat('es-AR',{maximumFractionDigits:0});
  const text=(v)=>`<p class="copy">${esc(v)}</p>`;
  const opt=(value,label,selected)=>`<option value="${esc(value)}"${selected===value?' selected':''}>${esc(label)}</option>`;
  const pointCount=e=>e.track.reduce((n,s)=>n+s.length,0);
  let map=null,stopProfile=null,timer=0,installPrompt=null;
  function toast(message,error=false){
    const el=$('toast');
    el.classList.toggle('error',error);
    el.textContent=message;el.hidden=false;
    clearTimeout(timer);timer=setTimeout(()=>{el.hidden=true;},5500);
  }
  function download(name,content,type){
    const url=URL.createObjectURL(new Blob([content],{type}));
    const a=document.createElement('a');
    a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function teardown(){map?.destroy();stopProfile?.();map=null;stopProfile=null;}
  function statsHtml(m){
    const v=[['Distancia',m.edges?`${nf.format(m.km)} km`:'—'],['Desnivel positivo',m.pairs?`+${whole.format(m.up)} m`:'—'],
      ['Desnivel negativo',m.pairs?`−${whole.format(m.down)} m`:'—'],['Altitud máxima',m.max===null?'—':`${whole.format(m.max)} m`]];
    return `<div class="stats">${v.map(([label,value])=>`<div class="stat"><small>${label}</small><strong>${value}</strong></div>`).join('')}</div>`;
  }
  function showProfile(metrics){
    const host=$('profile');
    if(!host)return;
    const all=metrics.profile.flat();
    if(all.length<2||metrics.km===0||metrics.pairs===0){
      host.innerHTML='<p class="muted">El recorrido necesita alturas consecutivas para mostrar el perfil.</p>';
      return;
    }
    host.innerHTML=`<div class="profile-box"><canvas class="profile" aria-hidden="true"></canvas>
      <label for="profile-slider" class="field-hint">Explorá el perfil por distancia</label>
      <input id="profile-slider" class="profile-slider" type="range" min="0" max="${all.length-1}" value="0">
      <p class="profile-tip" id="profile-tip" aria-live="polite"></p></div>`;
    const canvas=host.querySelector('canvas'),ctx=canvas.getContext('2d'),slider=$('profile-slider'),tip=$('profile-tip');
    let width=0,height=158,index=-1;
    const left=46,right=12,base=height-27,top=13;
    const x=p=>left+(width-left-right)*p.km/metrics.km;
    const y=p=>base-(base-top)*(p.ele-metrics.min)/Math.max(1,metrics.max-metrics.min);
    function draw(){
      const dpr=Math.min(2,devicePixelRatio||1);
      width=Math.max(100,canvas.clientWidth);
      canvas.width=Math.round(width*dpr);canvas.height=height*dpr;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.font='11px system-ui';ctx.fillStyle='#52655a';ctx.lineWidth=1;
      for(let i=0;i<=3;i++){
        const yy=top+(base-top)*i/3;
        ctx.strokeStyle='#e0e8de';ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(width-right,yy);ctx.stroke();
        ctx.textAlign='left';ctx.fillText(`${whole.format(metrics.max-(metrics.max-metrics.min)*i/3)} m`,0,yy+4);
      }
      ctx.textAlign='left';ctx.fillText('0 km',left,height-5);
      ctx.textAlign='right';ctx.fillText(`${nf.format(metrics.km)} km`,width-right,height-5);
      for(const run of metrics.profile){
        const stride=Math.max(1,Math.ceil(run.length/(width*2)));
        const sampled=run.filter((_,i)=>i%stride===0||i===run.length-1);
        if(sampled.length===1){ctx.fillStyle='#3b7756';ctx.fillRect(x(sampled[0])-2,y(sampled[0])-2,4,4);continue;}
        ctx.beginPath();ctx.moveTo(x(sampled[0]),base);
        for(const p of sampled)ctx.lineTo(x(p),y(p));
        ctx.lineTo(x(sampled.at(-1)),base);ctx.closePath();ctx.fillStyle='#e0eddb';ctx.fill();
        ctx.beginPath();ctx.moveTo(x(sampled[0]),y(sampled[0]));
        for(const p of sampled)ctx.lineTo(x(p),y(p));
        ctx.lineWidth=2;ctx.strokeStyle='#3b7756';ctx.stroke();
      }
      if(index>=0){
        const p=all[index];ctx.beginPath();ctx.moveTo(x(p),top);ctx.lineTo(x(p),base);ctx.strokeStyle='#ac462c';ctx.stroke();
        ctx.beginPath();ctx.arc(x(p),y(p),4.5,0,Math.PI*2);ctx.fillStyle='#ac462c';ctx.fill();
      }
    }
    function choose(i){
      if(i===index)return;
      index=i;slider.value=i;
      const p=all[i],label=`${nf.format(p.km)} km · ${whole.format(p.ele)} m`;
      slider.setAttribute('aria-valuetext',label);tip.textContent=label;map?.focus(p);draw();
    }
    slider.addEventListener('input',()=>choose(Number(slider.value)));
    canvas.addEventListener('pointermove',e=>{
      if(e.pointerType==='touch')return;
      const km=(e.clientX-canvas.getBoundingClientRect().left-left)/(width-left-right)*metrics.km;
      let low=0,high=all.length-1;
      while(low<high){const mid=(low+high)>>1;if(all[mid].km<km)low=mid+1;else high=mid;}
      choose(low>0&&Math.abs(all[low-1].km-km)<Math.abs(all[low].km-km)?low-1:low);
    });
    const ro=new ResizeObserver(draw);ro.observe(canvas);
    stopProfile=()=>ro.disconnect();
    draw();
    tip.textContent=metrics.pairs<metrics.edges?'Hay tramos sin datos de elevación.':'Mové el cursor o el control para ver la altitud.';
  }
  function pointList(exp,editable){
    if(!exp.points.length)return `<p class="muted">Todavía no hay puntos de interés.</p>`;
    return `<ul class="point-list">${exp.points.map((p,i)=>`<li><span class="dot ${p.type}" aria-hidden="true"></span>
      <div class="point-text"><b>${esc(p.name)}</b><div class="muted">${ME.kinds[p.type]}${p.ele!==null?` · ${whole.format(p.ele)} m`:''}</div>${p.note?text(p.note):''}</div>
      <button type="button" class="button small outline" data-pin="${i}" aria-label="Ver ${esc(p.name)} en el mapa">Ver mapa</button>
      ${editable?`<button type="button" class="button small outline" data-edit="${i}" aria-label="Editar ${esc(p.name)}">Editar</button>
        <button type="button" class="button small danger" data-delete="${i}" aria-label="Eliminar ${esc(p.name)}">Eliminar</button>`:''}</li>`).join('')}</ul>`;
  }
  const panel=(name,html)=>`<section class="panel"><h3>${name}</h3>${html}</section>`;
  function infoPanels(exp){
    const parts=[];
    for(const [key,label] of [['itinerary','Itinerario'],['notes','Notas de la expedición'],['meeting','Punto de encuentro'],['gear','Equipo']]){
      if(exp[key])parts.push(panel(label,text(exp[key])));
    }
    const links=exp.links.split(/\r?\n/).flatMap(line=>{
      const [name,link]=line.split('|').map(x=>x.trim());
      if(!link||!/^https?:\/\//i.test(link))return [];
      try{return [`<li><a href="${esc(new URL(link).href)}" target="_blank" rel="noreferrer">${esc(name||link)} ↗</a></li>`];}
      catch{return [];}
    });
    if(links.length)parts.push(panel('Recursos',`<ul class="resource-list">${links.join('')}</ul>`));
    return parts.join('');
  }
  async function published(){
    const res=await fetch('./expediciones.json');
    if(!res.ok)throw Error('El catálogo no está disponible.');
    return ME.catalog(await res.json()).expeditions;
  }
  function mountPublic(entries){
    const catalog=$('catalog'),target=$('expedition');
    $('count').textContent=`${entries.length} ${entries.length===1?'expedición publicada':'expediciones publicadas'}`;
    if(!entries.length){catalog.innerHTML='<p class="notice">Todavía no hay expediciones publicadas.</p>';return;}
    function render(exp){
      teardown();
      catalog.innerHTML=entries.map(item=>`<button type="button" data-id="${esc(item.id)}" aria-pressed="${item===exp}">
        <span class="peak" aria-hidden="true">△</span><span><strong>${esc(item.name)}</strong><small>${esc(item.region||item.difficulty)}</small></span>
        <span class="arrow" aria-hidden="true">↗</span></button>`).join('');
      const m=ME.metrics(exp.track);
      const photo=exp.id==='lanin-demo'&&exp.demo;
      target.innerHTML=`<header class="hero${photo?' photo':''}"><div>
        <div class="hero-meta"><span class="tag">${esc(exp.difficulty)}</span>${exp.demo?'<span>Expedición de ejemplo</span>':''}</div>
        <h2>${esc(exp.name)}</h2>
        ${[exp.region,exp.date].filter(Boolean).length?`<p>${[exp.region,exp.date].filter(Boolean).map(esc).join(' · ')}</p>`:''}
        </div>${photo?`<a class="photo-credit" href="https://commons.wikimedia.org/wiki/File:Lanin_Huechulafquen.jpg" target="_blank" rel="noreferrer">Foto · Luis Argerich</a>`:''}
        </header>
        ${exp.demo?'<p class="notice demo-note">Recorrido y puntos ficticios para probar la app. No usar para navegar.</p>':''}
        ${statsHtml(m)}
        ${exp.description?`<p class="copy">${esc(exp.description)}</p>`:''}
        <div class="route-grid"><div class="stack">
        <section class="panel"><div class="section-head"><h3>Mapa del recorrido</h3>${pointCount(exp)||exp.points.length?'<button type="button" data-gpx class="button small outline">↓ GPX</button>':''}</div>
        <div class="map" id="map"></div>
        <p class="map-help">Arrastrá para mover el mapa. Usá +, − o dos dedos para cambiar el zoom. ⌖ muestra el recorrido completo.</p></section>
        ${panel('Perfil de elevación','<div id="profile"></div>')}</div>
        <div class="stack">${panel(`Puntos de interés <span class="tag">${exp.points.length}</span>`,pointList(exp,false))}${infoPanels(exp)}</div></div>`;
      map=routeMap($('map'),exp);
      showProfile(m);
      target.onclick=e=>{
        if(e.target.closest('[data-gpx]'))download('recorrido.gpx',ME.gpx(exp),'application/gpx+xml');
        const pin=e.target.closest('[data-pin]');
        if(pin){map.select(exp.points[Number(pin.dataset.pin)]);$('map').scrollIntoView({block:'center',behavior:'smooth'});}
      };
    }
    catalog.addEventListener('click',e=>{
      const button=e.target.closest('[data-id]');
      if(!button)return;
      const exp=entries.find(d=>d.id===button.dataset.id);
      if(!exp)return;
      const next=new URL(location.href);next.searchParams.set('exp',exp.id);next.hash='';
      history.replaceState(null,'',next);
      render(exp);
      [...catalog.querySelectorAll('button')].find(x=>x.dataset.id===exp.id)?.focus({preventScroll:true});
    });
    render(entries.find(e=>e.id===params.get('exp'))||entries[0]);
  }
  function legacy(){
    const read=key=>{
      try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}
    };
    const oldAdmin=read('mi_expedicion_admin_demo_v1');
    const recovered=Array.isArray(oldAdmin)?oldAdmin.flatMap(x=>{
      if(!x||typeof x!=='object')return [];
      const meeting=[x.meetPlace,x.meetDate,x.meetNotes,x.meetLink].filter(Boolean).join('\n');
      const items=v=>Array.isArray(v)?v.filter(x=>typeof x==='string').join('\n'):'';
      const gear=[items(x.required),items(x.optional)].filter(Boolean).join('\n\n');
      const item=ME.expedition({id:'borrador-'+ME.id(),name:x.title,region:x.place,date:x.date,
        meeting,gear,description:x.routeDescription,itinerary:x.schedule,links:x.links,notes:x.notes});
      return item?[item]:[];
    }):[];
    const cfg=read('mi_exp_admin_cfg');
    const route=read('mi_exp_route');
    if(!cfg&&!route?.gpxText)return recovered;
    let gpx={track:[],points:[]};
    if(route?.gpxText){
      try{gpx=ME.parseGPX(route.gpxText);}catch{ /* A malformed old track stays in its original storage. */ }
    }
    const importDraft=ME.expedition({...gpx,id:'borrador-anterior',name:cfg?.title||'Borrador de la versión anterior',region:cfg?.place,date:cfg?.date,
      meeting:[cfg?.meeting,cfg?.when,cfg?.instructions].filter(Boolean).join('\n'),itinerary:cfg?.schedule,
      gear:[cfg?.mandatory,cfg?.optional].filter(Boolean).join('\n\n'),links:cfg?.links,
      points:Array.isArray(route?.pois)?route.pois:gpx.points});
    return importDraft?[importDraft,...recovered]:recovered;
  }
  function storeInMemory(seed){
    const records=new Map(seed.map(exp=>[exp.id,{...exp,rev:1}]));
    return {persistent:false,all:async()=>[...records.values()],
      save:async (e,rev)=>{if((records.get(e.id)?.rev||0)!==rev)throw Error('El borrador cambió. Volvé a abrirlo.');const x={...e,rev:rev+1};records.set(e.id,x);return x;},
      addMany:async incoming=>incoming.map(e=>{const next={...e,id:records.has(e.id)?ME.id():e.id,rev:1};records.set(next.id,next);return next;}),
      drop:async (id,rev)=>{if(records.get(id)?.rev!==rev)throw Error('El borrador cambió. Volvé a abrirlo.');records.delete(id);}};
  }
  function openStore(seed){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open('mi-expedicion-local',1);
      req.onupgradeneeded=()=>{
        const store=req.result.createObjectStore('drafts',{keyPath:'id'});
        for(const e of seed)store.add({...e,rev:1});
      };
      req.onerror=()=>reject(req.error);
      req.onsuccess=()=>{
        const db=req.result;
        db.onversionchange=()=>db.close();
        const transaction=(mode,fn)=>new Promise((ok,fail)=>{
          const t=db.transaction('drafts',mode);
          let result,reason;
          const put=(v)=>{result=v;};
          const abort=message=>{reason=Error(message);t.abort();};
          t.oncomplete=()=>ok(result);
          t.onabort=()=>fail(reason||t.error||Error('No se pudo guardar en este navegador.'));
          fn(t.objectStore('drafts'),put,abort);
        });
        const update=(id,rev,fn)=>transaction('readwrite',(s,put,abort)=>{
          const read=s.get(id);
          read.onsuccess=()=>{
            if((read.result?.rev||0)!==rev){abort('El borrador cambió en otra pestaña. Abrí el editor nuevamente antes de sobrescribirlo.');return;}
            put(fn(s));
          };
        });
        resolve({persistent:true,all:()=>transaction('readonly',(s,put)=>{const r=s.getAll();r.onsuccess=()=>put(r.result);}),
          save:(e,rev)=>update(e.id,rev,s=>{const next={...e,rev:rev+1};s.put(next);return next;}),
          addMany:incoming=>transaction('readwrite',(s,put)=>{
            const keys=s.getAllKeys();
            keys.onsuccess=()=>{
              const known=new Set(keys.result);
              const added=incoming.map(e=>{
                const next={...e,id:known.has(e.id)?ME.id():e.id,rev:1};
                known.add(next.id);s.add(next);return next;
              });
              put(added);
            };
          }),
          drop:(id,rev)=>update(id,rev,s=>s.delete(id))});
      };
    });
  }
  async function mountEditor(seed){
    const target=$('editor');
    const initial=[...seed,...legacy()];
    let db,records;
    try{db=await openStore(initial);records=await db.all();}
    catch{
      db=storeInMemory(initial);
      records=await db.all();
      toast('El navegador bloqueó el almacenamiento. Exportá tus cambios antes de cerrar el editor.',true);
    }
    let working=null,workingRev=0,dirty=false,busy=false,picking=false,poiIndex=-1,importing=false;
    const clone=v=>JSON.parse(JSON.stringify(v));
    function setWorking(item){
      working=item?clone(item):null;
      workingRev=item?.rev||0;dirty=false;picking=false;render();
    }
    function changed(){
      dirty=true;
      const status=$('edit-status');
      if(status)status.textContent='Cambios sin guardar';
    }
    function okay(){
      return !importing&&(!dirty||confirm('¿Descartar los cambios sin guardar de este borrador?'));
    }
    window.addEventListener('beforeunload',e=>{if(dirty||importing){e.preventDefault();e.returnValue='';}});
    const isBusy=()=>busy||importing;
    const moveToEditor=()=> $('edit-heading')?.scrollIntoView({block:'start',behavior:'smooth'});
    function render(){
      teardown();
      let body='<p class="panel">Elegí un borrador o creá una expedición para empezar.</p>';
      if(working){
        const e=working,m=ME.metrics(e.track);
        const short=(key,label,max=140)=>`<label>${label}<input name="${key}" maxlength="${max}" value="${esc(e[key])}"${key==='name'?' required':''}></label>`;
        const long=(key,label,max=4000)=>`<label>${label}<textarea name="${key}" maxlength="${max}" rows="3">${esc(e[key])}</textarea></label>`;
        body=`<div class="editor-work">
          <section class="panel"><div class="section-head"><h2 id="edit-heading">Ficha de expedición</h2><button form="exp-form" class="button primary" type="submit"${busy?' disabled':''}>Guardar borrador</button></div>
          <p class="muted" id="edit-status" role="status">${dirty?'Cambios sin guardar':workingRev?'Borrador guardado':'Nueva expedición'}</p>
          <form id="exp-form"><div class="fields cols">
            ${short('name','Nombre de la expedición')}${short('region','Región o lugar',160)}${short('date','Fecha o período',80)}
            <label>Dificultad<select name="difficulty">${ME.levels.map(v=>opt(v,v,e.difficulty)).join('')}</select></label>
          </div><div class="fields">
            ${long('description','Descripción')}${long('itinerary','Itinerario')}${long('notes','Notas y cambios generales')}${long('meeting','Punto de encuentro',1000)}
            ${long('gear','Equipo',2500)}${long('links','Recursos y enlaces (título | URL, uno por línea)',2500)}
            <label class="check"><input name="demo" type="checkbox"${e.demo?' checked':''}> <span>Identificar como expedición de ejemplo</span></label>
          </div></form></section>
          <section class="panel"><h3>Recorrido GPX</h3>
          <div class="fields"><label>Importar archivo GPX<input type="file" id="gpx-input" accept=".gpx,application/gpx+xml,application/xml,text/xml" ${importing?'disabled':''}></label>
          <p class="field-hint" id="gpx-status">${nf.format(pointCount(e))} coordenadas del recorrido · ${e.track.length} tramos. Al importar un track, se reemplaza el recorrido y se agregan sus waypoints a los puntos existentes.</p></div>
          <div class="actions">
          ${pointCount(e)?'<button type="button" data-action="clear-track" class="button small danger">Quitar recorrido</button>':''}
          ${pointCount(e)||e.points.length?'<button type="button" data-action="download-gpx" class="button small outline">↓ Descargar GPX</button>':''}
          </div></section>
          ${statsHtml(m)}
          <section class="panel"><div class="section-head"><h3>Mapa y puntos</h3><button type="button" class="button small outline" data-action="pick" aria-pressed="${picking}">${picking?'Cancelar selección':'Ubicar punto en el mapa'}</button></div>
          <div class="map" id="map"></div>
          <p class="map-help" id="map-editor-help">${picking?'Tocá el mapa para tomar las coordenadas del punto.':'Podés activar el mapa base con ▧. OpenStreetMap recibirá solicitudes de la zona que estés viendo.'}</p></section>
          ${panel('Perfil de elevación','<div id="profile"></div>')}
          <section class="panel"><div class="section-head"><h3>Puntos de interés <span class="tag">${e.points.length}</span></h3><button type="button" class="button small outline" data-action="add-pin">+ Agregar punto</button></div>
          ${pointList(e,true)}</section>
          ${workingRev?'<div class="actions"><button type="button" class="button small danger" data-action="delete-exp">Eliminar borrador</button></div>':''}</div>`;
      }
      target.innerHTML=`<aside class="panel editor-side"><h2>Borradores</h2>
        ${db.persistent?'':'<p class="muted">Almacenamiento temporal. Exportá antes de cerrar.</p>'}
        <button class="button primary" type="button" data-action="new">+ Nueva expedición</button>
        <div class="editor-choices">${records.map((e,i)=>`<button type="button" class="button outline" data-select="${i}" aria-pressed="${working?.id===e.id}">${esc(e.name)}</button>`).join('')}</div>
        <button class="button outline" type="button" data-action="publish">Preparar publicación ↗</button>
        <label>Importar catálogo JSON<input type="file" id="json-input" accept=".json,application/json"></label>
        <a href="https://github.com/Guilad14/viajes#publicar-en-github-pages" target="_blank" rel="noreferrer">Guía para publicar ↗</a>
      </aside>${body}`;
      if(!working)return;
      map=routeMap($('map'),working,{basemap:false,toggleBasemap:true,onPick:coords=>{
        picking=false;map.pick(false);
        const b=target.querySelector('[data-action="pick"]');b.setAttribute('aria-pressed','false');b.textContent='Ubicar punto en el mapa';
        $('map-editor-help').textContent='Podés activar el mapa base con ▧. OpenStreetMap recibirá solicitudes de la zona que estés viendo.';
        openPoi(-1,coords);
      }});
      map.pick(picking);
      showProfile(ME.metrics(working.track));
      $('exp-form').addEventListener('input',e=>{
        const el=e.target;
        if(el.name){working[el.name]=el.type==='checkbox'?el.checked:el.value;changed();}
      });
      $('exp-form').addEventListener('submit',async e=>{
        e.preventDefault();
        if(isBusy())return;
        const normalized=ME.expedition(working);
        if(!normalized){toast('Ingresá un nombre para guardar la expedición.',true);return;}
        const button=target.querySelector('[form="exp-form"]');
        try{
          busy=true;button.disabled=true;
          const saved=await db.save(normalized,workingRev);
          records=await db.all();setWorking(saved);
          toast(db.persistent?'Borrador guardado en este navegador.':'Borrador guardado durante esta sesión.');
        }catch(err){toast(err.message||'No se pudo guardar el borrador.',true);}
        finally{busy=false;button.disabled=false;const current=target.querySelector('[form="exp-form"]');if(current)current.disabled=false;}
      });
    }
    const poiForm=$('poi-form'),publishForm=$('publish-form');
    poiForm.elements.type.innerHTML=Object.entries(ME.kinds).map(([v,l])=>opt(v,l)).join('');
    function openPoi(index,coords={}){
      poiIndex=index;
      const p=index<0?coords:working.points[index];
      $('poi-title').textContent=index<0?'Agregar punto de interés':'Editar punto de interés';
      poiForm.reset();
      for(const name of ['name','type','lat','lon','ele','note']){
        const v=p[name]??(name==='type'?'waypoint':'');
        poiForm.elements[name].value=typeof v==='number'&&['lat','lon'].includes(name)?String(Number(v.toFixed(7))):v;
      }
      $('poi-dialog').showModal();
    }
    poiForm.addEventListener('submit',e=>{
      e.preventDefault();
      const f=new FormData(poiForm);
      const p=ME.interest({id:working.points[poiIndex]?.id,lat:Number(f.get('lat')),lon:Number(f.get('lon')),
        ele:f.get('ele')===''?null:Number(f.get('ele')),name:f.get('name'),type:f.get('type'),note:f.get('note')});
      if(!p||!f.get('name').trim()){toast('Ingresá un nombre y coordenadas válidas.',true);return;}
      if(poiIndex<0)working.points.push(p);else working.points[poiIndex]=p;
      $('poi-dialog').close();changed();render();toast('Punto actualizado en la ficha. Guardá el borrador para conservarlo.');
    });
    function openPublish(){
      publishForm.reset();
      $('publish-list').innerHTML=records.map((e,i)=>`<label class="check"><input type="checkbox" name="include" value="${i}"${e.id===working?.id?' checked':''}>
        <span><strong>${esc(e.name)}</strong><br><small>${pointCount(e)} coordenadas · ${e.points.length} puntos${e.demo?' · Ejemplo':''}</small></span></label>`).join('');
      $('publish-dialog').showModal();
    }
    publishForm.addEventListener('submit',e=>{
      e.preventDefault();
      const f=new FormData(publishForm);
      const selected=f.getAll('include').map(i=>ME.expedition(records[Number(i)])).filter(Boolean);
      if(!selected.length&&!confirm('Si publicás este catálogo vacío, se quitarán todas las expediciones de la vista pública. ¿Descargarlo igual?'))return;
      download('expediciones.json',JSON.stringify({version:1,expeditions:selected},null,2)+'\n','application/json');
      $('publish-dialog').close();toast('Catálogo descargado. Reemplazá expediciones.json en tu hosting para publicar.');
    });
    target.addEventListener('click',async e=>{
      const button=e.target.closest('button');
      if(!button||isBusy())return;
      const d=button.dataset,a=d.action;
      if(d.select!==undefined){if(okay()){setWorking(records[Number(d.select)]);if(matchMedia('(max-width: 650px)').matches)moveToEditor();}return;}
      if(a==='new'){if(okay()){setWorking(ME.expedition({id:ME.id(),name:'Nueva expedición'}));$('exp-form').elements.name.select();moveToEditor();}return;}
      if(a==='publish'){
        if(dirty){toast('Guardá el borrador antes de preparar la publicación.',true);return;}
        openPublish();return;
      }
      if(!working)return;
      if(d.pin!==undefined){map.select(working.points[Number(d.pin)]);$('map').scrollIntoView({block:'center',behavior:'smooth'});}
      if(d.edit!==undefined)openPoi(Number(d.edit));
      if(d.delete!==undefined&&confirm('¿Eliminar este punto de interés de la ficha?')){
        working.points.splice(Number(d.delete),1);changed();render();
      }
      if(a==='add-pin')openPoi(-1);
      if(a==='pick'){
        picking=!picking;map.pick(picking);button.setAttribute('aria-pressed',String(picking));
        button.textContent=picking?'Cancelar selección':'Ubicar punto en el mapa';
        $('map-editor-help').textContent=picking?'Tocá el mapa para tomar las coordenadas del punto.':'Podés activar el mapa base con ▧. OpenStreetMap recibirá solicitudes de la zona que estés viendo.';
        if(picking)$('map').scrollIntoView({block:'center',behavior:'smooth'});
      }
      if(a==='clear-track'&&confirm('¿Quitar el recorrido de esta ficha? Los puntos de interés quedan en la ficha.')){working.track=[];changed();render();}
      if(a==='download-gpx')download('recorrido.gpx',ME.gpx(working),'application/gpx+xml');
      if(a==='delete-exp'&&confirm('¿Eliminar este borrador de tu navegador?')){
        try{busy=true;await db.drop(working.id,workingRev);records=await db.all();setWorking(records[0]);toast('Borrador eliminado.');}
        catch(err){toast(err.message,true);}
        finally{busy=false;}
      }
    });
    target.addEventListener('change',async e=>{
      const input=e.target;
      if(!['gpx-input','json-input'].includes(input.id)||!input.files?.[0]||isBusy())return;
      const file=input.files[0];input.value='';
      if(file.size>20*1024*1024){toast('Elegí un archivo de hasta 20 MB.',true);return;}
      if(input.id==='json-input'&&!okay())return;
      try{
        importing=true;input.disabled=true;
        const fileText=await file.text();
        if(input.id==='gpx-input'){
          const imported=ME.parseGPX(fileText);
          if(imported.track.length)working.track=imported.track;
          working.points=working.points.concat(imported.points);
          changed();toast(`GPX leído. ${imported.points.length} puntos incorporados. Guardá el borrador para conservarlo.`);
        }else{
          const incoming=ME.catalog(JSON.parse(fileText)).expeditions;
          if(!incoming.length)throw Error('El catálogo está vacío.');
          // Use fresh IDs for collisions so a local draft is never overwritten by import.
          const added=await db.addMany(incoming);
          records=await db.all();setWorking(added[0]);toast(`${incoming.length} expediciones importadas como borradores.`);
        }
      }catch(err){toast(err.message||'No se pudo leer el archivo.',true);records=await db.all().catch(()=>records);}
      finally{importing=false;input.disabled=false;render();}
    });
    setWorking(records.find(e=>e.id==='borrador-anterior')||records[0]);
  }
  const install=$('install');
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
  function installed(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;}
  install.hidden=installed();
  window.addEventListener('appinstalled',()=>{install.hidden=true;installPrompt=null;});
  let swError=false;
  if('serviceWorker' in navigator&&isSecureContext){
    navigator.serviceWorker.register('./sw.js').catch(()=>{swError=true;});
  }
  install.addEventListener('click',async()=>{
    if(installPrompt){
      const prompt=installPrompt;installPrompt=null;
      try{await prompt.prompt();return;}catch{ /* Show manual paths if the browser rejects the prompt. */ }
    }
    $('install-state').textContent=!isSecureContext?'Abrí la versión publicada por HTTPS para instalarla.':swError?'El navegador no pudo activar el modo sin conexión.':'Después de la primera carga, el catálogo y el trazado están disponibles sin conexión. El mapa base requiere internet.';
    $('install-help').showModal();
  });
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-close]');
    if(b)$(b.dataset.close).close();
  });
  published().then(entries=>isEditor?mountEditor(entries):mountPublic(entries)).catch(err=>{
    if(isEditor){mountEditor([]).catch(()=>{$('editor').textContent='No se pudo abrir el editor. Recargá la página.';});return;}
    $('catalog').innerHTML=`<p class="notice">${esc(err.message||'No se pudo cargar el catálogo.')} Probá recargar la página.</p>`;
  });
})();
