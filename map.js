function routeMap(host, exp, opts={}) {
  const colors={waypoint:'#204836',camp:'#547540',difficult:'#a94728',note:'#705481',change:'#905a15'};
  const canvas=document.createElement('canvas');
  const controls=document.createElement('div');
  controls.className='map-controls';
  const caption=document.createElement('div');
  caption.className='map-caption';
  const popup=document.createElement('div');
  popup.className='map-popup';
  popup.hidden=true;
  popup.setAttribute('role','status');
  canvas.tabIndex=0;
  canvas.setAttribute('aria-label','Mapa interactivo. Usá las flechas para desplazar y + o − para cambiar el zoom.');
  host.replaceChildren(canvas,controls,caption,popup);
  const ctx=canvas.getContext('2d');
  const tiles=new Map();
  const pointers=new Map();
  const wrap=(x,n)=>((x%n)+n)%n;
  const clamp=(x,a,b)=>Math.max(a,Math.min(x,b));
  const project=p=>{
    const y=Math.sin(clamp(p.lat,-85.05112878,85.05112878)*Math.PI/180);
    return {x:(p.lon+180)/360,y:.5-Math.log((1+y)/(1-y))/(4*Math.PI)};
  };
  const unproject=p=>({lon:wrap(p.x,1)*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*clamp(p.y,0,1))))*180/Math.PI});
  const closeX=(x,to)=>x+Math.round(to-x);
  const source={lat:-39.645,lon:-71.502};
  let center=project(source),zoom=11,width=1,height=1,dpr=1,frame=0,focus=null,active=null,tilesOn=opts.basemap!==false;
  let picking=false,moved=false,initial=null,pinch=null,dead=false;
  const scale=()=>256*2**zoom;
  const screen=p=>({x:(closeX(p.x,center.x)-center.x)*scale()+width/2,y:(p.y-center.y)*scale()+height/2});
  const world=(x,y)=>({x:center.x+(x-width/2)/scale(),y:center.y+(y-height/2)/scale()});
  const tracks=exp.track.map(segment=>segment.map(project));
  const pins=exp.points.map(p=>({p,xy:project(p)}));
  const all=tracks.flat().concat(pins.map(p=>p.xy));
  function queue(){
    if (!dead && !frame) frame=requestAnimationFrame(()=>{frame=0;draw();});
  }
  function fit(){
    if (!all.length) {center=project(source);zoom=11;queue();return;}
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const q of all){
      const x=closeX(q.x,all[0].x);
      x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,q.y);y1=Math.max(y1,q.y);
    }
    center={x:(x0+x1)/2,y:(y0+y1)/2};
    const gutter=110;
    zoom=clamp(Math.log2(Math.min(Math.max(40,width-gutter)/Math.max(1e-9,x1-x0),
      Math.max(40,height-gutter)/Math.max(1e-9,y1-y0))/256),1,16);
    queue();
  }
  function tile(x,y,z){
    const key=`${z}/${x}/${y}`;
    if(tiles.has(key)) {
      const image=tiles.get(key);
      tiles.delete(key); tiles.set(key,image);
      return image;
    }
    const image=new Image();
    image.onload=queue;
    image.src=`https://tile.openstreetmap.org/${key}.png`;
    tiles.set(key,image);
    if(tiles.size>140)tiles.delete(tiles.keys().next().value);
    return image;
  }
  function base(){
    ctx.fillStyle='#e9efe5';
    ctx.fillRect(0,0,width,height);
    ctx.strokeStyle='#d3dfd1';ctx.lineWidth=1;ctx.beginPath();
    const gx=wrap(width/2-center.x*scale(),44),gy=wrap(height/2-center.y*scale(),44);
    for(let x=gx;x<width;x+=44){ctx.moveTo(x,0);ctx.lineTo(x,height);}
    for(let y=gy;y<height;y+=44){ctx.moveTo(0,y);ctx.lineTo(width,y);}
    ctx.stroke();
    if(!tilesOn || !navigator.onLine)return;
    const z=Math.floor(zoom), count=2**z, size=scale()/count;
    const left=center.x*count-width/(2*size),top=center.y*count-height/(2*size);
    for(let y=Math.max(0,Math.floor(top));y<count&&y<top+height/size;y++){
      for(let x=Math.floor(left);x<left+width/size;x++){
        const image=tile(wrap(x,count),y,z);
        if(image.complete&&image.naturalWidth)ctx.drawImage(image,Math.round((x-left)*size),Math.round((y-top)*size),Math.ceil(size)+1,Math.ceil(size)+1);
      }
    }
  }
  function circle(p,fill,radius,stroke='#fff'){
    ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);
    ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();
  }
  function draw(){
    ctx.setTransform(dpr,0,0,dpr,0,0);
    base();
    ctx.lineCap='round';ctx.lineJoin='round';
    for(const segment of tracks){
      ctx.beginPath();
      let last=null;
      for(const q of segment){
        const p=screen(q);
        if(!last||Math.abs(last.x-p.x)>scale()/2)ctx.moveTo(p.x,p.y);
        else ctx.lineTo(p.x,p.y);
        last=p;
      }
      ctx.strokeStyle='#fff9ec';ctx.lineWidth=8;ctx.stroke();
      ctx.strokeStyle='#c44b2f';ctx.lineWidth=4;ctx.stroke();
      if(segment.length===1)circle(screen(segment[0]),'#c44b2f',4);
    }
    const trackStart=tracks[0]?.[0],trackEnd=tracks.at(-1)?.at(-1);
    if(trackStart)circle(screen(trackStart),'#30604c',5);
    if(trackEnd)circle(screen(trackEnd),'#c44b2f',5);
    for(const {p,xy} of pins)circle(screen(xy),colors[p.type],active===p?9:7);
    if(focus)circle(screen(project(focus)),'#173b2c',7,'#f5cf61');
    if(active){
      const p=screen(project(active));
      popup.hidden=p.x<-5||p.x>width+5||p.y<-5||p.y>height+5;
      popup.style.left=`${clamp(p.x,88,Math.max(88,width-88))}px`;
      popup.style.top=`${Math.max(60,p.y-12)}px`;
    }
  }
  function resize(){
    width=host.clientWidth||1;height=host.clientHeight||1;dpr=Math.min(2,devicePixelRatio||1);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    queue();
  }
  function changeZoom(delta,x=width/2,y=height/2){
    const near=world(x,y);
    zoom=clamp(zoom+delta,1,19);
    center={x:near.x-(x-width/2)/scale(),y:clamp(near.y-(y-height/2)/scale(),0,1)};
    queue();
  }
  function move(dx,dy){
    center={x:wrap(center.x-dx/scale(),1),y:clamp(center.y-dy/scale(),0,1)};
    queue();
  }
  function select(p,recenter){
    active=p;
    popup.textContent=p?`${ME.kinds[p.type]} · ${p.name}`:'';
    popup.hidden=!p;
    if(p&&recenter)center=project(p);
    queue();
  }
  function action(label,title,fn){
    const b=document.createElement('button');
    b.type='button';b.textContent=label;b.title=title;b.setAttribute('aria-label',title);
    b.addEventListener('click',fn);
    controls.append(b);
    return b;
  }
  action('+','Acercar',()=>changeZoom(1));
  action('−','Alejar',()=>changeZoom(-1));
  action('⌖','Ver recorrido completo',()=>{select(null);fit();});
  function setCaption(){
    caption.innerHTML=tilesOn?'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>':'Sin mapa base';
  }
  if(opts.toggleBasemap){
    const b=action('▧','Mostrar u ocultar el mapa base',()=>{tilesOn=!tilesOn;b.setAttribute('aria-pressed',String(tilesOn));setCaption();queue();});
    b.setAttribute('aria-pressed',String(tilesOn));
  }
  setCaption();
  function position(e){const box=canvas.getBoundingClientRect();return {x:e.clientX-box.left,y:e.clientY-box.top};}
  function pair(){
    const [a,b]=pointers.values();
    return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};
  }
  canvas.addEventListener('pointerdown',e=>{
    const p=position(e);
    pointers.set(e.pointerId,p);canvas.setPointerCapture(e.pointerId);
    if(pointers.size===1){initial=p;moved=false;}
    if(pointers.size===2){pinch=pair();moved=true;}
  });
  canvas.addEventListener('pointermove',e=>{
    const old=pointers.get(e.pointerId);
    if(!old)return;
    const p=position(e);
    pointers.set(e.pointerId,p);
    if(pointers.size===2&&pinch){
      const next=pair();
      move(next.x-pinch.x,next.y-pinch.y);
      changeZoom(Math.log2(next.d/pinch.d),next.x,next.y);
      pinch=next;
    } else if(pointers.size===1){
      if(initial&&Math.hypot(p.x-initial.x,p.y-initial.y)>5)moved=true;
      if(moved)move(p.x-old.x,p.y-old.y);
    }
  });
  function release(e){
    if(!pointers.has(e.pointerId))return;
    pointers.delete(e.pointerId);pinch=null;
    if(moved||pointers.size||e.type!=='pointerup')return;
    const p=position(e);
    if(picking){opts.onPick?.(unproject(world(p.x,p.y)));return;}
    const closest=pins.find(pin=>{const q=screen(pin.xy);return Math.hypot(p.x-q.x,p.y-q.y)<14;});
    select(closest?.p||null);
  }
  canvas.addEventListener('pointerup',release);
  canvas.addEventListener('pointercancel',release);
  canvas.addEventListener('wheel',e=>{
    if(document.activeElement!==canvas&&!e.ctrlKey)return;
    e.preventDefault();
    const p=position(e);changeZoom(Math.sign(-e.deltaY)*.32,p.x,p.y);
  },{passive:false});
  canvas.addEventListener('keydown',e=>{
    const offsets={ArrowLeft:[60,0],ArrowRight:[-60,0],ArrowUp:[0,60],ArrowDown:[0,-60]};
    if(offsets[e.key])move(...offsets[e.key]);
    else if(e.key==='+'||e.key==='=')changeZoom(1);
    else if(e.key==='-')changeZoom(-1);
    else return;
    e.preventDefault();
  });
  const observer=new ResizeObserver(resize);
  observer.observe(host);
  window.addEventListener('online',queue);
  window.addEventListener('offline',queue);
  resize();fit();
  return {select:p=>select(p,true),focus:p=>{focus=p;queue();},pick:on=>{picking=on;canvas.classList.toggle('picking',on);},
    destroy:()=>{dead=true;observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('online',queue);window.removeEventListener('offline',queue);}};
}
