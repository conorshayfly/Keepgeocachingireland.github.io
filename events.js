(function () {
  const { esc } = KGI, $ = id => document.getElementById(id), E = KGIEvents;
  let user = null, showPast = false, all = [];
  const TZ = 'Europe/Dublin';

  if (!KGIData.live) $('demoNotice').innerHTML = '<div class="notice"><strong>Demo mode:</strong> events are saved only in this browser until Supabase is configured in <code>config.js</code>.</div>';

  E.TYPES.forEach(t => { $('fType').add(new Option(t, t)); $('eType').add(new Option(t, t)); });
  E.COUNTIES.forEach(c => { $('fCounty').add(new Option(c, c)); $('eCounty').add(new Option(c, c)); });

  const fmtDate = (iso, opts) => new Date(iso).toLocaleString('en-IE', { timeZone: TZ, ...opts });
  const dayNum = iso => fmtDate(iso, { day: 'numeric' });
  const monShort = iso => fmtDate(iso, { month: 'short' });
  const monthKey = iso => fmtDate(iso, { month: 'long', year: 'numeric' });
  function when(e) {
    const s = fmtDate(e.starts_at, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    if (!e.ends_at) return s;
    const sameDay = fmtDate(e.starts_at, { dateStyle: 'short' }) === fmtDate(e.ends_at, { dateStyle: 'short' });
    return s + ' → ' + (sameDay ? fmtDate(e.ends_at, { hour: '2-digit', minute: '2-digit' }) : fmtDate(e.ends_at, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
  }

  function render() {
    const type = $('fType').value, county = $('fCounty').value;
    const items = all.filter(e => (!type || e.type === type) && (!county || e.county === county));
    if (!items.length) { $('list').innerHTML = `<div class="card"><p>No ${showPast ? 'past' : 'upcoming'} events match. ${showPast ? '' : 'Be the first to add one!'}</p></div>`; return; }
    let last = '', html = '';
    items.forEach(e => {
      const m = monthKey(e.starts_at);
      if (m !== last) { html += `<div class="month">${esc(m)}</div>`; last = m; }
      const canDel = user && (user.isMod || user.id === e.organiser_id);
      const hasLL = e.lat != null && e.lon != null;
      html += `<div class="event ${showPast ? 'past' : ''}">
        <div class="date-badge"><b>${dayNum(e.starts_at)}</b><span>${monShort(e.starts_at)}</span></div>
        <div style="flex:1;min-width:0">
          <h3>${esc(e.title)}</h3>
          <div class="meta"><span class="tag">${esc(e.type)}</span> ${e.county ? `<span class="tag">${esc(e.county)}</span>` : ''} · ${esc(when(e))}${e.venue ? ' · ' + esc(e.venue) : ''}</div>
          ${e.description ? `<div class="desc">${esc(e.description)}</div>` : ''}
          <div class="meta" style="margin-top:.4rem">Organised by ${esc(e.organiser_name)}</div>
          <div class="actions">
            ${hasLL ? `<a class="btn small outline" href="map.html?ll=${e.lat},${e.lon}&label=${encodeURIComponent(e.title)}">View on map</a>` : ''}
            ${showPast ? '' : `<button class="btn small outline" data-ics="${e.id}">Add to calendar</button>`}
            ${canDel ? `<button class="btn small danger" data-del="${e.id}">Delete</button>` : ''}
          </div>
        </div></div>`;
    });
    $('list').innerHTML = html;
  }

  async function load() {
    $('list').innerHTML = '<p>Loading…</p>';
    try { all = await E.list(showPast); render(); }
    catch (err) { $('list').innerHTML = `<div class="notice err">Could not load events: ${esc(err.message)}</div>`; }
  }

  /* ---------- .ics download ---------- */
  const icsDate = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function downloadIcs(e) {
    const end = e.ends_at || new Date(new Date(e.starts_at).getTime() + 2 * 36e5).toISOString();
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Keep Geocaching Ireland//EN', 'BEGIN:VEVENT',
      `UID:event-${e.id}@keepgeocachingireland`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(e.starts_at)}`, `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsEsc(e.title)}`, `DESCRIPTION:${icsEsc(e.description)}`, `LOCATION:${icsEsc([e.venue, e.county].filter(Boolean).join(', '))}`];
    if (e.lat != null && e.lon != null) lines.push(`GEO:${e.lat};${e.lon}`);
    lines.push('END:VEVENT', 'END:VCALENDAR');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
    a.download = 'event-' + e.id + '.ics'; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- wiring ---------- */
  $('fType').onchange = $('fCounty').onchange = render;
  $('pastBtn').onclick = () => { showPast = !showPast; $('pastBtn').textContent = showPast ? 'Show upcoming' : 'Show past events'; load(); };
  $('addBtn').onclick = () => { if (!user) { KGIAuth.open(false); return; } $('formCard').style.display = 'block'; $('formCard').scrollIntoView({ behavior: 'smooth' }); };
  $('cancelBtn').onclick = () => { $('formCard').style.display = 'none'; };
  $('list').addEventListener('click', async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.ics) downloadIcs(all.find(e => String(e.id) === b.dataset.ics));
    if (b.dataset.del && confirm('Delete this event?')) {
      try { await E.remove(b.dataset.del); load(); } catch (err) { alert(err.message); }
    }
  });
  $('eCoords').addEventListener('input', () => {
    const v = $('eCoords').value.trim(), c = v && KGICoords.parseAny(v);
    $('coordHint').textContent = !v ? '' : c ? '✓ ' + KGICoords.fmtDMM(c) : 'Not recognised';
  });
  $('evForm').onsubmit = async ev => {
    ev.preventDefault();
    const msg = $('formMsg'); msg.innerHTML = '';
    try {
      const starts = new Date($('eStart').value), endV = $('eEnd').value, ends = endV ? new Date(endV) : null;
      if (isNaN(starts)) throw new Error('Pick a start date and time.');
      if (ends && ends < starts) throw new Error('End time must be after the start.');
      const cv = $('eCoords').value.trim(); let lat = null, lon = null;
      if (cv) { const c = KGICoords.parseAny(cv); if (!c) throw new Error('Could not understand the coordinates (or they are outside Ireland).'); lat = +c.lat.toFixed(6); lon = +c.lon.toFixed(6); }
      await E.create({
        title: $('eTitle').value.trim(), type: $('eType').value, county: $('eCounty').value, venue: $('eVenue').value.trim(),
        description: $('eDesc').value.trim(), lat, lon, starts_at: starts.toISOString(), ends_at: ends ? ends.toISOString() : null
      });
      $('evForm').reset(); $('coordHint').textContent = ''; $('formCard').style.display = 'none';
      showPast = false; $('pastBtn').textContent = 'Show past events'; load();
    } catch (err) { msg.innerHTML = `<div class="notice err">${esc(err.message)}</div>`; }
  };

  KGIAuth.init($('authbar'), u => { user = u; if (!u) $('formCard').style.display = 'none'; render(); });
  load();
})();
