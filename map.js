(function () {
  const { esc } = KGI, T = KGITools, $ = id => document.getElementById(id);
  const STORE = 'kgi_waypoints_v1';

  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' });
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenTopoMap (CC-BY-SA), © OpenStreetMap contributors' });
  const map = L.map('map', { layers: [osm] }).setView([53.4, -7.9], 7);
  L.control.layers({ 'Street': osm, 'Topo': topo }).addTo(map);
  map.setMaxBounds([[50.5, -12.5], [56.0, -4.5]]);

  /* Placeholder for future Geocaching API layer. Keep the API secret server-side (e.g. Supabase Edge Function). */
  const cacheLayer = L.layerGroup().addTo(map);
  window.KGIMap = { map, cacheLayer }; // later: fetch caches from your proxy and add markers to cacheLayer

  let wps = [], markers = [];
  try { wps = JSON.parse(localStorage.getItem(STORE)) || []; } catch (e) {}
  const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(wps)); } catch (e) {} };

  function render() {
    markers.forEach(m => map.removeLayer(m)); markers = [];
    wps.forEach((w, i) => {
      const m = L.marker([w.lat, w.lon]).addTo(map).bindPopup(popupHtml(w.lat, w.lon, w.name, i));
      markers.push(m);
    });
    $('wpList').innerHTML = wps.length ? wps.map((w, i) => `
      <div class="wp"><div><strong>${esc(w.name)}</strong><br><small>${T.fmtDMM(w)}</small></div>
      <div><button class="copy" data-go="${i}">View</button><button class="copy" data-del="${i}">Delete</button></div></div>`).join('')
      : '<p style="font-size:.9rem">None yet. Click the map, then "Save".</p>';
  }
  function popupHtml(lat, lon, name, idx) {
    const c = { lat, lon }, dmm = T.fmtDMM(c);
    const G = window.KGIGrid, itm = G.wgs84ToITM(lat, lon), ig = G.wgs84ToIG(lat, lon);
    const grid = `ITM ${itm.e.toFixed(0)} ${itm.n.toFixed(0)}<br>IG ${G.igToRef(ig.e, ig.n) || '-'}`;
    return `<strong>${esc(name || 'Point')}</strong><br>${esc(dmm)}<br>${lat.toFixed(5)}, ${lon.toFixed(5)}<br>${grid}<br>
      <button class="copy" data-copy="${esc(dmm)}">Copy</button>
      ${idx === undefined ? `<button class="copy" data-save="${lat},${lon}">Save</button>` : ''}`;
  }

  let temp = null;
  map.on('click', e => {
    if (temp) map.removeLayer(temp);
    temp = L.marker(e.latlng, { opacity: .8 }).addTo(map).bindPopup(popupHtml(e.latlng.lat, e.latlng.lng, 'Selected point')).openPopup();
  });

  document.addEventListener('click', e => {
    const t = e.target;
    if (t.dataset.copy) KGI.copy(t.dataset.copy, t);
    if (t.dataset.save) {
      const [lat, lon] = t.dataset.save.split(',').map(Number);
      const name = prompt('Name this waypoint:', 'Waypoint ' + (wps.length + 1));
      if (name === null) return;
      wps.push({ lat, lon, name: name.trim() || 'Waypoint ' + (wps.length + 1) }); persist(); render();
      if (temp) { map.removeLayer(temp); temp = null; }
    }
    if (t.dataset.go) { const w = wps[+t.dataset.go]; map.setView([w.lat, w.lon], 15); markers[+t.dataset.go].openPopup(); }
    if (t.dataset.del) { wps.splice(+t.dataset.del, 1); persist(); render(); }
  });

  $('goBtn').onclick = () => {
    const c = T.parseAny($('goIn').value);
    if (!c) { $('goMsg').textContent = 'Could not understand those coordinates.'; return; }
    $('goMsg').textContent = '';
    map.setView([c.lat, c.lon], 15);
    if (temp) map.removeLayer(temp);
    temp = L.marker([c.lat, c.lon]).addTo(map).bindPopup(popupHtml(c.lat, c.lon, 'Selected point')).openPopup();
  };
  $('goIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('goBtn').click(); });
  $('locBtn').onclick = () => {
    if (!navigator.geolocation) { $('goMsg').textContent = 'Geolocation not supported.'; return; }
    navigator.geolocation.getCurrentPosition(p => {
      map.setView([p.coords.latitude, p.coords.longitude], 16);
      if (temp) map.removeLayer(temp);
      temp = L.marker([p.coords.latitude, p.coords.longitude]).addTo(map).bindPopup(popupHtml(p.coords.latitude, p.coords.longitude, 'You are here')).openPopup();
    }, () => ($('goMsg').textContent = 'Could not get your location.'));
  };
  $('clearBtn').onclick = () => { if (wps.length && confirm('Delete all saved waypoints?')) { wps = []; persist(); render(); } };

  // deep link: map.html?ll=53.35,-6.26&label=Dublin%20meetup
  const q = new URLSearchParams(location.search), ll = (q.get('ll') || '').split(',').map(Number);
  if (ll.length === 2 && !ll.some(isNaN)) {
    map.setView(ll, 15);
    temp = L.marker(ll).addTo(map).bindPopup(popupHtml(ll[0], ll[1], q.get('label') || 'Selected point')).openPopup();
  }

  render();
})();
