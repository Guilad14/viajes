const ME = (function model() {
  'use strict';
  const kinds = { waypoint:'Waypoint', camp:'Campamento', difficult:'Dificultad', note:'Nota', change:'Cambio de itinerario' };
  const levels = ['Sin clasificar','Baja','Moderada','Alta','Técnica'];
  const str = (v, limit=4000) => typeof v === 'string' ? v.trim().slice(0,limit) : '';
  const id = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const obj = v => v && typeof v === 'object';
  const number = v => typeof v === 'number' && Number.isFinite(v);
  const coord = (lat,lon) => number(lat) && number(lon) && Math.abs(lat)<=90 && Math.abs(lon)<=180;
  function point(v) {
    if (!obj(v) || !coord(v.lat,v.lon)) return null;
    return {lat:v.lat,lon:v.lon,ele:number(v.ele)?v.ele:null};
  }
  function interest(v) {
    const p = point(v);
    if (!p) return null;
    return {...p,id:str(v.id,100)||id(),name:str(v.name,140)||'Punto de interés',
      type:Object.hasOwn(kinds,v.type)?v.type:'waypoint',note:str(v.note,1200)};
  }
  function expedition(v) {
    if (!obj(v)) return null;
    const name = str(v.name,140);
    if (!name) return null;
    const track = Array.isArray(v.track) ? v.track
      .filter(Array.isArray).flatMap(segment => {
        const chunks = [];
        let chunk = [];
        for (const item of segment) {
          const p = point(item);
          if (p) chunk.push(p);
          else if (chunk.length) { chunks.push(chunk); chunk = []; }
        }
        if (chunk.length) chunks.push(chunk);
        return chunks;
      }) : [];
    const points = Array.isArray(v.points) ? v.points.map(interest).filter(Boolean) : [];
    return {
      id:str(v.id,100)||id(),name,region:str(v.region,160),date:str(v.date,80),
      difficulty:levels.includes(v.difficulty)?v.difficulty:levels[0],
      description:str(v.description),itinerary:str(v.itinerary),notes:str(v.notes),
      meeting:str(v.meeting,1000),gear:str(v.gear,2500),links:str(v.links,2500),
      demo:v.demo===true,track,points
    };
  }
  function catalog(input) {
    if (!obj(input) || input.version!==1 || !Array.isArray(input.expeditions)) {
      throw Error('El archivo debe ser un catálogo de Mi Expedición (versión 1).');
    }
    const expeditions = input.expeditions.map(expedition);
    if (expeditions.some(x => !x) || new Set(expeditions.map(x=>x.id)).size!==expeditions.length) {
      throw Error('Hay fichas inválidas o identificadores repetidos en el catálogo.');
    }
    return {version:1,expeditions};
  }
  const numeric = v => v==null || v.trim()==='' ? null : Number(v);
  function parseGPX(xmlText) {
    if (/<!DOCTYPE/i.test(xmlText)) throw Error('Elegí un GPX sin declaraciones DOCTYPE.');
    const xml = new DOMParser().parseFromString(xmlText,'application/xml');
    const root = xml.documentElement;
    if (root?.localName!=='gpx' || xml.getElementsByTagNameNS('*','parsererror').length) {
      throw Error('El archivo no es un GPX válido.');
    }
    const children = (node,name) => Array.from(node.children).filter(child=>child.localName===name);
    const value = (node,name) => children(node,name)[0]?.textContent?.trim() || '';
    const coords = el => point({lat:numeric(el.getAttribute('lat')),lon:numeric(el.getAttribute('lon')),ele:numeric(value(el,'ele'))});
    const tracks = children(root,'trk').flatMap(trk => children(trk,'trkseg'))
      .map(seg => children(seg,'trkpt').map(coords));
    const routes = children(root,'rte').map(rte => children(rte,'rtept').map(coords));
    const points = children(root,'wpt').map(node=>{
      const p = coords(node);
      if (!p) return null;
      const type = value(node,'type').toLowerCase();
      return interest({...p,name:value(node,'name'),note:value(node,'desc')||value(node,'cmt'),
        type:/camp|refug/.test(type)?'camp':/danger|dificult/.test(type)?'difficult':type});
    }).filter(Boolean);
    const route = expedition({name:'GPX',track:tracks.some(s=>s.some((p,i)=>i>0&&p&&s[i-1]))||!routes.some(s=>s.some(Boolean))?tracks:routes}).track;
    if (!route.some(s=>s.length>=2) && !points.length) {
      throw Error('El GPX debe tener dos puntos consecutivos de recorrido o al menos un waypoint válido.');
    }
    return {track:route,points};
  }
  function distance(a,b) {
    const r = Math.PI/180;
    const x = Math.sin((b.lat-a.lat)*r/2)**2
      + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lon-a.lon)*r/2)**2;
    return 12742*Math.asin(Math.sqrt(Math.min(1,Math.max(0,x))));
  }
  function metrics(track) {
    let km=0,up=0,down=0,max=null,min=null,pairs=0,edges=0;
    const profile=[];
    for (const segment of track) {
      let previous=null,run=[];
      for (const p of segment) {
        if (previous) {
          km += distance(previous,p);
          edges++;
          if (number(previous.ele) && number(p.ele)) {
            pairs++;
            up += Math.max(0,p.ele-previous.ele);
            down += Math.max(0,previous.ele-p.ele);
          }
        }
        if (number(p.ele)) {
          max=max===null?p.ele:Math.max(max,p.ele);
          min=min===null?p.ele:Math.min(min,p.ele);
          run.push({km,ele:p.ele,lat:p.lat,lon:p.lon});
        } else if (run.length) { profile.push(run); run=[]; }
        previous=p;
      }
      if (run.length) profile.push(run);
    }
    return {km,up,down,max,min,pairs,edges,profile};
  }
  const escape = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  function gpx(exp) {
    const xml = v => escape(String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,''));
    const loc = p => `lat="${p.lat}" lon="${p.lon}"`;
    const elevation = p => number(p.ele)?`<ele>${p.ele}</ele>`:'';
    const waypoints = exp.points.map(p=>`  <wpt ${loc(p)}>${elevation(p)}<name>${xml(p.name)}</name>${p.note?`<desc>${xml(p.note)}</desc>`:''}<type>${p.type}</type></wpt>`);
    const segments = exp.track.map(segment=>`    <trkseg>\n${segment.map(p=>`      <trkpt ${loc(p)}>${elevation(p)}</trkpt>`).join('\n')}\n    </trkseg>`);
    return ['<?xml version="1.0" encoding="UTF-8"?>','<gpx version="1.1" creator="Mi Expedición" xmlns="http://www.topografix.com/GPX/1/1">',...waypoints,
      ...(segments.length?['  <trk>',`    <name>${xml(exp.name)}</name>`,...segments,'  </trk>']:[]),'</gpx>',''].join('\n');
  }
  return {kinds,levels,id,number,coord,interest,expedition,catalog,parseGPX,distance,metrics,escape,gpx};
})();
