(() => {
  'use strict';

  const STORAGE_KEY = 'terrainEnvironmentalGIS.v1';
  const $ = (id) => document.getElementById(id);
  const state = { selectedLayer: null, baseLayer: null, agencyLayers: {}, importedCount: 0 };

  const basemaps = {
    osm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', options: { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' } },
    usgsTopo: { url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', options: { maxZoom: 16, attribution: 'USGS The National Map' } },
    usgsImagery: { url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}', options: { maxZoom: 16, attribution: 'USGS The National Map' } },
    usgsImageryTopo: { url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}', options: { maxZoom: 16, attribution: 'USGS The National Map' } }
  };

  const presets = {
    placer: { center: [39.09, -120.79], zoom: 9, label: 'Placer County, CA' },
    plymouth: { center: [38.4819, -120.8488], zoom: 12, label: 'Plymouth / Amador County, CA' }
  };

  const map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([38.75, -121.0], 8);
  const projectGroup = L.featureGroup().addTo(map);
  setBasemap('usgsImageryTopo');

  map.pm.addControls({
    position: 'topleft', drawMarker: true, drawCircleMarker: false, drawPolyline: true,
    drawRectangle: true, drawPolygon: true, drawCircle: false, editMode: true,
    dragMode: false, cutPolygon: false, removalMode: true, rotateMode: false
  });

  function status(message, timeout = 3500) {
    $('statusBadge').textContent = message;
    if (timeout) setTimeout(() => { if ($('statusBadge').textContent === message) $('statusBadge').textContent = 'Ready'; }, timeout);
  }

  function setBasemap(key) {
    if (state.baseLayer) map.removeLayer(state.baseLayer);
    const cfg = basemaps[key] || basemaps.osm;
    state.baseLayer = L.tileLayer(cfg.url, cfg.options).addTo(map);
    state.baseLayer.bringToBack();
  }

  function normalizeFeatureProps(feature) {
    feature.properties = feature.properties || {};
    if (!feature.properties.name) feature.properties.name = feature.properties.Name || feature.properties.NAME || feature.properties.title || 'Untitled feature';
    if (!feature.properties.description) feature.properties.description = feature.properties.Description || feature.properties.DESCRIPTION || feature.properties.desc || '';
    return feature;
  }

  function styleFeature(feature) {
    const geom = feature && feature.geometry && feature.geometry.type;
    if (geom && geom.includes('Polygon')) return { color: '#f97316', weight: 2, fillColor: '#fb923c', fillOpacity: .18 };
    if (geom && geom.includes('Line')) return { color: '#38bdf8', weight: 4, opacity: .9 };
    return { color: '#22c55e', weight: 2 };
  }

  function pointToLayer(feature, latlng) {
    return L.circleMarker(latlng, { radius: 7, color: '#052e16', weight: 2, fillColor: '#22c55e', fillOpacity: .95 });
  }

  function addGeoJSON(geojson, sourceName = 'Imported') {
    if (!geojson) return;
    const collection = geojson.type === 'FeatureCollection' ? geojson : geojson.type === 'Feature' ? { type: 'FeatureCollection', features: [geojson] } : null;
    if (!collection) throw new Error('File did not contain GeoJSON features.');
    collection.features.forEach(normalizeFeatureProps);
    const layer = L.geoJSON(collection, {
      style: styleFeature,
      pointToLayer,
      onEachFeature: (feature, leafletLayer) => {
        leafletLayer._sourceName = sourceName;
        leafletLayer.feature = feature;
        bindFeature(leafletLayer);
      }
    });
    layer.eachLayer((child) => projectGroup.addLayer(child));
    state.importedCount += collection.features.length;
    if (projectGroup.getLayers().length) map.fitBounds(projectGroup.getBounds(), { padding: [24, 24], maxZoom: 16 });
    updateSummary(); saveProject(); status(`Added ${collection.features.length} feature${collection.features.length === 1 ? '' : 's'} from ${sourceName}`);
  }

  function bindFeature(layer) {
    layer.on('click', (e) => {
      if (map.pm.globalDrawModeEnabled && map.pm.globalDrawModeEnabled()) return;
      L.DomEvent.stopPropagation(e);
      selectFeature(layer);
    });
    layer.on('pm:edit', () => { updateLayerFeature(layer); updateSummary(); saveProject(); });
  }

  function updateLayerFeature(layer) {
    const gj = layer.toGeoJSON();
    gj.properties = Object.assign({}, layer.feature && layer.feature.properties || {}, gj.properties || {});
    layer.feature = gj;
  }

  function featureMetrics(feature) {
    if (!feature || !feature.geometry) return '';
    const type = feature.geometry.type;
    try {
      if (type.includes('Polygon')) {
        const sqm = turf.area(feature);
        return `${(sqm / 4046.8564224).toFixed(2)} acres · ${(sqm / 1e6).toFixed(3)} km²`;
      }
      if (type.includes('Line')) {
        const km = turf.length(feature, { units: 'kilometers' });
        return `${(km * 0.621371).toFixed(2)} miles · ${km.toFixed(2)} km`;
      }
      if (type === 'Point') {
        const [lng, lat] = feature.geometry.coordinates;
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }
    } catch (_) {}
    return type;
  }

  function selectFeature(layer) {
    state.selectedLayer = layer;
    updateLayerFeature(layer);
    $('featureEmpty').classList.add('hidden');
    $('featureEditor').classList.remove('hidden');
    $('featureName').value = layer.feature.properties?.name || '';
    $('featureDescription').value = layer.feature.properties?.description || '';
    $('featureMetrics').textContent = featureMetrics(layer.feature);
  }

  function clearSelected() {
    state.selectedLayer = null;
    $('featureEmpty').classList.remove('hidden');
    $('featureEditor').classList.add('hidden');
  }

  function collectProjectGeoJSON() {
    const features = [];
    projectGroup.eachLayer((layer) => {
      if (!layer.toGeoJSON) return;
      updateLayerFeature(layer);
      const f = layer.feature || layer.toGeoJSON();
      if (f.type === 'FeatureCollection') features.push(...f.features); else features.push(f);
    });
    return { type: 'FeatureCollection', features };
  }

  function updateSummary() {
    const fc = collectProjectGeoJSON();
    let acres = 0, miles = 0, points = 0;
    for (const f of fc.features) {
      const t = f.geometry && f.geometry.type || '';
      try {
        if (t.includes('Polygon')) acres += turf.area(f) / 4046.8564224;
        else if (t.includes('Line')) miles += turf.length(f, { units: 'miles' });
        else if (t.includes('Point')) points += 1;
      } catch (_) {}
    }
    $('summary').innerHTML = [
      ['Features', fc.features.length], ['Mapped acres', acres.toFixed(1)], ['Line miles', miles.toFixed(2)], ['Points', points]
    ].map(([label,value]) => `<div class="summary-item"><b>${value}</b><span>${label}</span></div>`).join('');
  }

  function saveProject() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: $('projectName').value, geojson: collectProjectGeoJSON(), center: map.getCenter(), zoom: map.getZoom(), basemap: $('basemapSelect').value }));
    } catch (e) { console.warn('Autosave failed', e); }
  }

  function restoreProject() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return;
      const saved = JSON.parse(raw);
      $('projectName').value = saved.name || 'Untitled Project';
      if (saved.basemap && basemaps[saved.basemap]) { $('basemapSelect').value = saved.basemap; setBasemap(saved.basemap); }
      if (saved.geojson?.features?.length) addGeoJSON(saved.geojson, 'Autosaved project');
      if (saved.center && saved.zoom) map.setView([saved.center.lat, saved.center.lng], saved.zoom);
      status('Restored autosaved project');
    } catch (e) { console.warn('Restore failed', e); }
  }

  async function parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'geojson' || ext === 'json') return JSON.parse(await file.text());
    if (ext === 'kml') return toGeoJSON.kml(new DOMParser().parseFromString(await file.text(), 'text/xml'));
    if (ext === 'gpx') return toGeoJSON.gpx(new DOMParser().parseFromString(await file.text(), 'text/xml'));
    if (ext === 'kmz') {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const kmlName = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith('.kml'));
      if (!kmlName) throw new Error('KMZ contained no KML file.');
      return toGeoJSON.kml(new DOMParser().parseFromString(await zip.file(kmlName).async('text'), 'text/xml'));
    }
    if (ext === 'zip') {
      const parsed = await shp(await file.arrayBuffer());
      if (Array.isArray(parsed)) return { type: 'FeatureCollection', features: parsed.flatMap((x) => x.features || []) };
      return parsed;
    }
    if (ext === 'csv') {
      const result = Papa.parse(await file.text(), { header: true, dynamicTyping: true, skipEmptyLines: true });
      const features = [];
      for (const row of result.data) {
        const keys = Object.keys(row);
        const latKey = keys.find(k => /^(lat|latitude|y)$/i.test(k));
        const lonKey = keys.find(k => /^(lon|lng|long|longitude|x)$/i.test(k));
        if (!latKey || !lonKey || !Number.isFinite(Number(row[latKey])) || !Number.isFinite(Number(row[lonKey]))) continue;
        features.push({ type:'Feature', geometry:{ type:'Point', coordinates:[Number(row[lonKey]), Number(row[latKey])] }, properties: row });
      }
      if (!features.length) throw new Error('CSV needs latitude/longitude columns.');
      return { type:'FeatureCollection', features };
    }
    throw new Error(`Unsupported file type: .${ext}`);
  }

  function download(filename, text, mime='application/octet-stream') {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function safeName() { return ($('projectName').value || 'terrain-project').trim().replace(/[^a-z0-9-_]+/gi,'-').replace(/^-|-$/g,'') || 'terrain-project'; }

  function escapeXml(s='') { return String(s).replace(/[<>&'\"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c])); }

  function geoJSONToGPX(fc) {
    const waypoints = [], tracks = [];
    fc.features.forEach((f, i) => {
      const name = escapeXml(f.properties?.name || `Feature ${i+1}`); const desc = escapeXml(f.properties?.description || ''); const g = f.geometry;
      if (!g) return;
      if (g.type === 'Point') waypoints.push(`<wpt lat="${g.coordinates[1]}" lon="${g.coordinates[0]}"><name>${name}</name><desc>${desc}</desc></wpt>`);
      if (g.type === 'LineString') tracks.push(`<trk><name>${name}</name><trkseg>${g.coordinates.map(c=>`<trkpt lat="${c[1]}" lon="${c[0]}"></trkpt>`).join('')}</trkseg></trk>`);
      if (g.type === 'MultiLineString') g.coordinates.forEach(line => tracks.push(`<trk><name>${name}</name><trkseg>${line.map(c=>`<trkpt lat="${c[1]}" lon="${c[0]}"></trkpt>`).join('')}</trkseg></trk>`));
    });
    return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Terrain Environmental GIS" xmlns="http://www.topografix.com/GPX/1/1">${waypoints.join('')}${tracks.join('')}</gpx>`;
  }

  async function searchLocation() {
    const q = $('searchInput').value.trim(); if (!q) return;
    status('Searching…', 0);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, { headers: { 'Accept':'application/json' } });
      if (!res.ok) throw new Error('Search service unavailable');
      const data = await res.json(); if (!data.length) throw new Error('No matching place found');
      map.setView([Number(data[0].lat), Number(data[0].lon)], 13); status(data[0].display_name, 5000);
    } catch (e) { status(e.message || 'Search failed', 5000); }
  }

  async function queryElevation(latlng) {
    const card = $('elevationCard'); card.classList.remove('hidden'); card.textContent = 'USGS elevation: loading…';
    try {
      const url = `https://epqs.nationalmap.gov/v1/json?x=${encodeURIComponent(latlng.lng)}&y=${encodeURIComponent(latlng.lat)}&units=Feet&wkid=4326&includeDate=false`;
      const res = await fetch(url); if (!res.ok) throw new Error('Elevation unavailable');
      const data = await res.json();
      const val = data.value ?? data.USGS_Elevation_Point_Query_Service?.Elevation_Query?.Elevation;
      card.innerHTML = `<strong>Elevation</strong><br>${Number(val).toLocaleString(undefined,{maximumFractionDigits:1})} ft<br><span style="color:#9ca3af">USGS · ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}</span>`;
    } catch (e) { card.textContent = 'USGS elevation unavailable at this point.'; }
  }

  function agencyFeatureLayer(serviceUrl, style, label) {
    const group = L.layerGroup().addTo(map);
    group._service = serviceUrl; group._label = label; group._style = style;
    return group;
  }

  async function refreshAgencyLayer(group) {
    group.clearLayers();
    const b = map.getBounds();
    const geometry = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
    const url = `${group._service}/query?where=1%3D1&geometry=${encodeURIComponent(geometry)}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&outSR=4326&f=geojson&resultRecordCount=2000`;
    try {
      const res = await fetch(url); if (!res.ok) throw new Error('Agency layer request failed');
      const gj = await res.json();
      const layer = L.geoJSON(gj, { style: group._style, pointToLayer });
      layer.addTo(group); status(`${group._label}: ${gj.features?.length || 0} visible features`);
    } catch (e) { status(`${group._label} could not load from the public agency service`, 5500); }
  }

  const CALFIRE_FIRE = 'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/ArcGIS/rest/services/California_Historic_Fire_Perimeters/FeatureServer/0';
  const CALFIRE_FHSZ = 'https://services1.arcgis.com/P5Mv5GY5S66M8Z1Q/ArcGIS/rest/services/Fire_Hazard_Severity/FeatureServer/0';

  async function toggleAgency(which, enabled) {
    if (!enabled) { if (state.agencyLayers[which]) map.removeLayer(state.agencyLayers[which]); delete state.agencyLayers[which]; return; }
    const cfg = which === 'fire' ? { url:CALFIRE_FIRE, style:{ color:'#ef4444',weight:1,fillColor:'#ef4444',fillOpacity:.12 }, label:'CAL FIRE historical perimeters' } : { url:CALFIRE_FHSZ, style:{ color:'#f59e0b',weight:1,fillColor:'#f59e0b',fillOpacity:.18 }, label:'CAL FIRE fire hazard zones' };
    const g = agencyFeatureLayer(cfg.url, cfg.style, cfg.label); state.agencyLayers[which] = g; await refreshAgencyLayer(g);
  }

  map.on('pm:create', (e) => {
    const layer = e.layer; projectGroup.addLayer(layer); layer.feature = layer.toGeoJSON(); layer.feature.properties = { name:'New feature', description:'', source:'Drawn in Terrain Environmental GIS' }; layer._sourceName = 'Drawn'; bindFeature(layer); selectFeature(layer); updateSummary(); saveProject();
  });
  map.on('pm:remove', () => { clearSelected(); updateSummary(); saveProject(); });
  map.on('moveend', () => {
    Object.values(state.agencyLayers).forEach(g => refreshAgencyLayer(g));
    saveProject();
  });
  map.on('click', (e) => { if (!(map.pm.globalDrawModeEnabled && map.pm.globalDrawModeEnabled())) { clearSelected(); queryElevation(e.latlng); } });

  $('importBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', async (e) => {
    for (const file of e.target.files) {
      status(`Importing ${file.name}…`, 0);
      try { addGeoJSON(await parseFile(file), file.name); } catch (err) { status(`${file.name}: ${err.message}`, 6500); }
    }
    e.target.value = '';
  });
  $('basemapSelect').addEventListener('change', (e) => { setBasemap(e.target.value); saveProject(); });
  document.querySelectorAll('.preset').forEach(btn => btn.addEventListener('click', () => { const p=presets[btn.dataset.preset]; map.setView(p.center,p.zoom); status(p.label); if (innerWidth <= 720) $('leftPanel').classList.remove('open'); }));
  $('searchBtn').addEventListener('click', searchLocation); $('searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') searchLocation(); });
  $('locateBtn').addEventListener('click', () => { map.locate({ setView:true, maxZoom:16, enableHighAccuracy:true }); status('Locating…',0); });
  map.on('locationfound', e => { L.circleMarker(e.latlng,{radius:8,color:'#fff',weight:2,fillColor:'#0ea5e9',fillOpacity:1}).addTo(map).bindPopup('Current location').openPopup(); status(`Located within ~${Math.round(e.accuracy)} m`); });
  map.on('locationerror', () => status('Location permission denied or unavailable', 5000));
  $('projectName').addEventListener('input', saveProject);
  $('saveFeatureBtn').addEventListener('click', () => { if (!state.selectedLayer) return; updateLayerFeature(state.selectedLayer); state.selectedLayer.feature.properties.name = $('featureName').value.trim() || 'Untitled feature'; state.selectedLayer.feature.properties.description = $('featureDescription').value.trim(); saveProject(); status('Feature saved'); });
  $('deleteFeatureBtn').addEventListener('click', () => { if (!state.selectedLayer) return; projectGroup.removeLayer(state.selectedLayer); clearSelected(); updateSummary(); saveProject(); status('Feature deleted'); });
  $('firePerimetersToggle').addEventListener('change', e => toggleAgency('fire', e.target.checked));
  $('fhzToggle').addEventListener('change', e => toggleAgency('fhz', e.target.checked));
  document.querySelectorAll('[data-export]').forEach(btn => btn.addEventListener('click', () => {
    const fc = collectProjectGeoJSON(); if (!fc.features.length) return status('Nothing to export', 4000);
    const type = btn.dataset.export; const name = safeName();
    if (type === 'geojson') download(`${name}.geojson`, JSON.stringify(fc,null,2), 'application/geo+json');
    else if (type === 'kml') download(`${name}.kml`, tokml(fc), 'application/vnd.google-earth.kml+xml');
    else if (type === 'gpx') download(`${name}.gpx`, geoJSONToGPX(fc), 'application/gpx+xml');
  }));
  $('summaryBtn').addEventListener('click', () => {
    const fc=collectProjectGeoJSON(); let acres=0,miles=0,points=0,polys=0,lines=0;
    fc.features.forEach(f=>{const t=f.geometry?.type||''; try{if(t.includes('Polygon')){polys++;acres+=turf.area(f)/4046.8564224}else if(t.includes('Line')){lines++;miles+=turf.length(f,{units:'miles'})}else if(t.includes('Point'))points++;}catch(_){}});
    const text = `Terrain Environmental GIS Project Summary\nProject: ${$('projectName').value}\nGenerated: ${new Date().toLocaleString()}\n\nFeatures: ${fc.features.length}\nPoints: ${points}\nLines: ${lines}\nPolygons: ${polys}\nTotal mapped acres: ${acres.toFixed(2)}\nTotal line miles: ${miles.toFixed(2)}\nBasemap: ${$('basemapSelect').selectedOptions[0].text}\n\nData notes: User project data is processed locally in the browser. Basemap/elevation/environmental overlays are sourced from public third-party services and remain subject to source availability and official metadata.`;
    download(`${safeName()}-summary.txt`, text, 'text/plain');
  });
  $('helpBtn').addEventListener('click', () => $('helpDialog').showModal()); $('closeHelpBtn').addEventListener('click', () => $('helpDialog').close());
  $('panelToggle').addEventListener('click', () => $('leftPanel').classList.toggle('open'));

  updateSummary(); restoreProject();
})();
