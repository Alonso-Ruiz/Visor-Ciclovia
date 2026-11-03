(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const format = new ol.format.GeoJSON();
  const read = data => format.readFeatures(data, {dataProjection:'EPSG:4326', featureProjection:'EPSG:3857'});
  const routes = read(json_Ciclovia_0), parking = read(json_Cicloparqueaderos_1);
  const district = read(json_limite_distrital_0);
  routes.forEach(f => f.set('_kind','route'));
  parking.forEach(f => f.set('_kind','parking'));
  const all = [...routes,...parking];
  const name = f => f.get('ETAPA') || f.get('NOMBRE') || 'Cicloparqueadero';
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const pointStyle = color => new ol.style.Style({image:new ol.style.Circle({radius:7, fill:new ol.style.Fill({color}),stroke:new ol.style.Stroke({color:'#fff',width:2})})});
  const routeStyle = [new ol.style.Style({stroke:new ol.style.Stroke({color:'#fff',width:6})}),new ol.style.Style({stroke:new ol.style.Stroke({color:'#00a579',width:4})})];
  const existing = pointStyle('#16896e'), proposed = pointStyle('#e6a336');
  const satellite = new ol.layer.Tile({source:new ol.source.XYZ({url:'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',attributions:'© Google',maxZoom:22}),opacity:0.5});
  const boundary = new ol.layer.Vector({source:new ol.source.Vector({features:district}),style:[
    new ol.style.Style({stroke:new ol.style.Stroke({color:'#111',width:3,lineDash:[12,8]})})
  ]});
  const routeSource = new ol.source.Vector({features:routes});
  const existingParking = parking.filter(f=>f.get('SITUACION')!=='PROPUESTA');
  const proposedParking = parking.filter(f=>f.get('SITUACION')==='PROPUESTA');
  const existingSource = new ol.source.Vector({features:existingParking});
  const proposedSource = new ol.source.Vector({features:proposedParking});
  const routeLayer = new ol.layer.Vector({source:routeSource,style:routeStyle});
  const existingLayer = new ol.layer.Vector({source:existingSource,style:existing});
  const proposedLayer = new ol.layer.Vector({source:proposedSource,style:proposed});
  boundary.setZIndex(5);
  const highlightSource = new ol.source.Vector();
  const highlight = new ol.layer.Vector({source:highlightSource,style:[
    new ol.style.Style({stroke:new ol.style.Stroke({color:'#e00024',width:10,lineCap:'round',lineJoin:'round'})}),
    new ol.style.Style({stroke:new ol.style.Stroke({color:'#ff403f',width:6,lineCap:'round',lineJoin:'round'})}),
    new ol.style.Style({stroke:new ol.style.Stroke({color:'#ffb1a8',width:2,lineCap:'round',lineJoin:'round'}),image:new ol.style.Circle({radius:14,fill:new ol.style.Fill({color:'#ff403f'}),stroke:new ol.style.Stroke({color:'#fff',width:3})})})
  ]});
  const map = new ol.Map({target:'map',layers:[satellite,boundary,routeLayer,existingLayer,proposedLayer,highlight],view:new ol.View({center:ol.proj.fromLonLat([-76.9933,-12.0951]),zoom:14}),controls:[new ol.control.Zoom(),new ol.control.ScaleLine(),new ol.control.Attribution({collapsible:false})]});
  routeLayer.setZIndex(20);
  existingLayer.setZIndex(21);proposedLayer.setZIndex(22);
  boundary.setZIndex(10);
  let selected = null, filtered = [];
  $('route-count').textContent=routes.length;
  $('existing-count').textContent=existingParking.length;$('proposed-count').textContent=proposedParking.length;
  function setLegend(open){
    $('legend-panel').hidden=!open;
    $('legend-tool').setAttribute('aria-expanded',String(open));
  }
  function setPanel(open){
    $('panel').hidden=!open;
    document.body.classList.toggle('panel-open',open);
    $('open-panel').setAttribute('aria-expanded',String(open));
    $('layers-tool').setAttribute('aria-expanded',String(open));
    if(open){closeDetail();setLegend(false);}
  }
  function fit(features){
    if(!features.length)return;
    const extent=ol.extent.createEmpty();
    features.forEach(f=>ol.extent.extend(extent,f.getGeometry().getExtent()));
    const mobile=innerWidth<=896;
    map.getView().cancelAnimations();
    map.getView().fit(extent,{padding:mobile?[95,80,120,30]:[75,$('panel').hidden?85:380,90,100],maxZoom:18,duration:180});
  }
  function closeDetail(){selected=null;highlightSource.clear();$('detail').hidden=true;}
  // Return focus and the entire map surface after dismissing a selected element.
  function dismissDetail(){
    closeDetail();
    setLegend(false);
    setPanel(false);
    $('search-results').hidden=true;
    $('opacity-panel').hidden=true;
    $('opacity-tool').setAttribute('aria-expanded','false');
    map.getView().cancelAnimations();
    $('map').style.cursor='';
    $('map').focus({preventScroll:true});
  }
  function show(feature){
    setLegend(false);
    if(innerWidth<=896)setPanel(false);
    selected=feature;
    highlightSource.clear();highlightSource.addFeature(feature.clone());
    $('opacity-panel').hidden=true;$('opacity-tool').setAttribute('aria-expanded','false');
    $('detail-type').textContent=feature.get('_kind')==='route'?'CICLOVÍA':'CICLOPARQUEADERO';
    $('detail-title').textContent=name(feature);
    const fields=[];
    if(feature.get('_kind')==='route')fields.push(['Longitud estimada',(ol.sphere.getLength(feature.getGeometry())/1000).toFixed(2)+' km']);
    else fields.push(['Situación',feature.get('SITUACION')],['Disponibilidad',feature.get('SITUACION')==='PROPUESTA'?'Propuesto; no confirmado como operativo':'Registrado como existente']);
    $('detail-fields').replaceChildren();
    fields.forEach(([label,value])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;$('detail-fields').append(dt,dd);});
    $('detail').hidden=false;
  }
  function populate(target,features){
    target.replaceChildren();
    if(!features.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No hay coincidencias con los filtros actuales.';target.append(empty);}
    features.forEach(f=>{
      const button=document.createElement('button'),title=document.createElement('strong'),subtitle=document.createElement('small');
      button.className='result';title.textContent=name(f);subtitle.textContent=f.get('_kind')==='route'?'Ciclovía · Ver recorrido':'Cicloparqueadero · '+(f.get('SITUACION')==='PROPUESTA'?'Propuesto':'Existente');
      button.append(title,subtitle);button.onclick=()=>{setPanel(false);$('search').value=name(f);render();$('search-results').hidden=true;fit([f]);show(f);$('close-detail').focus({preventScroll:true});};target.append(button);
    });
  }
  function getVisibleFeatures(){
    return all.filter(f=>{
      const visible=f.get('_kind')==='route'?$('routes-visible').checked:f.get('SITUACION')==='PROPUESTA'?$('proposed-visible').checked:$('existing-visible').checked;
      return visible;
    });
  }
  function syncVisibility(){
    routeLayer.setVisible($('routes-visible').checked);
    existingLayer.setVisible($('existing-visible').checked);proposedLayer.setVisible($('proposed-visible').checked);
    const visible=getVisibleFeatures();
    if(selected&&!visible.includes(selected))closeDetail();
    populate($('catalog'),visible);
  }
  function render(){
    const query=normalize($('search').value.trim());
    const visible=getVisibleFeatures();
    filtered=query?visible.filter(f=>normalize(name(f)).includes(query)):[];
    $('result-count').textContent=filtered.length+' elementos';$('search-count').textContent=filtered.length+' resultados';
    populate($('results'),filtered);
    $('clear-search').hidden=!query;$('search-results').hidden=!query;
  }
  $('search').oninput=render;
  $('search').onfocus=()=>{if($('search').value.trim())$('search-results').hidden=false;};
  $('clear-search').onclick=()=>{$('search').value='';render();$('search-results').hidden=true;$('search').focus();};
  ['routes-visible','existing-visible','proposed-visible'].forEach(id=>$(id).onchange=()=>{syncVisibility();render();});
  $('boundary-visible').onchange=()=>boundary.setVisible($('boundary-visible').checked);
  const togglePanel=event=>{event.preventDefault();event.stopPropagation();setPanel($('panel').hidden);};
  $('open-panel').addEventListener('click',togglePanel);
  $('layers-tool').addEventListener('click',togglePanel);
  $('close-panel').addEventListener('click',event=>{event.preventDefault();event.stopPropagation();setPanel(false);$('open-panel').focus();});
  $('north').addEventListener('click',event=>{event.preventDefault();map.getView().animate({rotation:0,duration:300});});
  map.getView().on('change:rotation',()=>{$('north').firstElementChild.style.transform=`rotate(${map.getView().getRotation()}rad)`;});
  $('close-detail').onclick=event=>{event.preventDefault();event.stopPropagation();dismissDetail();};
  $('opacity-tool').onclick=()=>{const open=$('opacity-panel').hidden;closeDetail();setLegend(false);$('opacity-panel').hidden=!open;$('opacity-tool').setAttribute('aria-expanded',String(open));};
  $('legend-tool').onclick=()=>{const open=$('legend-panel').hidden;setPanel(false);closeDetail();$('opacity-panel').hidden=true;$('opacity-tool').setAttribute('aria-expanded','false');setLegend(open);};
  $('close-legend').onclick=()=>{setLegend(false);$('legend-tool').focus();};
  $('opacity').oninput=()=>satellite.setOpacity(Number($('opacity').value));
  satellite.getSource().on('tileloaderror',()=>{$('notice').textContent='No se pudo cargar el fondo satelital. Revisa tu conexión; las ciclovías y el límite distrital siguen disponibles.';$('notice').hidden=false;});
  satellite.getSource().on('tileloadend',()=>{$('notice').hidden=true;});
  map.on('click',event=>{
    const feature=map.forEachFeatureAtPixel(event.pixel,f=>f,{hitTolerance:12,layerFilter:layer=>layer===routeLayer||layer===existingLayer||layer===proposedLayer});
    $('search-results').hidden=true;
    if(feature){try{show(feature);}catch(error){console.error('No se pudo abrir la ficha del elemento',error);$('detail-type').textContent=feature.get('_kind')==='route'?'CICLOVÍA':'CICLOPARQUEADERO';$('detail-title').textContent=name(feature);$('detail-fields').replaceChildren();$('detail').hidden=false;}}
    else closeDetail();
  });
  $('download').onclick=()=>{if(!selected)return;const copy=selected.clone();copy.unset('_kind');const url=URL.createObjectURL(new Blob([format.writeFeatures([copy],{dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'})],{type:'application/geo+json'}));const a=document.createElement('a');a.href=url;a.download=`${selected.get('_kind')}-${selected.get('id')}.geojson`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  document.addEventListener('keydown',event=>{if(event.key==='Escape')dismissDetail();});
  syncVisibility();render();
  // Fit once the browser has laid out the full map canvas, including when opened from file://.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{map.updateSize();fit(district.length?district:all);}));
})();

