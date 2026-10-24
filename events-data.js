/* Events data layer: Supabase when configured, otherwise local demo mode. Needs forums-data.js first. */
(function () {
  const live = KGIData.live, sb = KGIData.sb;
  const KEY = 'kgi_events_demo_v1';
  const day = n => new Date(Date.now() + n * 864e5);
  const at = (n, h) => { const d = day(n); d.setHours(h, 0, 0, 0); return d.toISOString(); };

  function load() {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) return d; } catch (e) {}
    return { nextId: 3, events: [
      { id: 1, title: 'Example: Phoenix Park Meet & Greet', type: 'Meet & Greet', county: 'Dublin', venue: 'Phoenix Park, near the Visitor Centre',
        description: 'Demo event stored only in your browser. Come say hello, swap trackables and plan a few caches together.',
        lat: 53.3563, lon: -6.3302, starts_at: at(12, 14), ends_at: at(12, 16), organiser_id: 'sys', organiser_name: 'KGI Team', created_at: new Date().toISOString() },
      { id: 2, title: 'Example: Cache In Trash Out, Galway', type: 'CITO', county: 'Galway', venue: 'Salthill Prom',
        description: 'Bring gloves and a bag. We will clean the prom and find a few caches along the way.',
        lat: null, lon: null, starts_at: at(26, 11), ends_at: null, organiser_id: 'sys', organiser_name: 'KGI Team', created_at: new Date().toISOString() }
    ] };
  }
  let demo = load();
  const save = () => localStorage.setItem(KEY, JSON.stringify(demo));
  const need = async () => { const u = await KGIData.getUser(); if (!u) throw new Error('Please log in first.'); return u; };

  window.KGIEvents = {
    TYPES: ['Meet & Greet', 'CITO', 'Mega / Giga', 'Cache Bash', 'Workshop', 'Other'],
    COUNTIES: ['Antrim','Armagh','Carlow','Cavan','Clare','Cork','Derry','Donegal','Down','Dublin','Fermanagh','Galway','Kerry','Kildare','Kilkenny','Laois','Leitrim','Limerick','Longford','Louth','Mayo','Meath','Monaghan','Offaly','Roscommon','Sligo','Tipperary','Tyrone','Waterford','Westmeath','Wexford','Wicklow'],

    async list(past = false) {
      const cutoff = new Date(Date.now() - 3 * 36e5).toISOString(); // keep events visible for 3h after start
      if (!live) {
        return demo.events.filter(e => past ? e.starts_at < cutoff : e.starts_at >= cutoff)
          .sort((a, b) => past ? b.starts_at.localeCompare(a.starts_at) : a.starts_at.localeCompare(b.starts_at));
      }
      let q = sb.from('events').select('*');
      q = past ? q.lt('starts_at', cutoff).order('starts_at', { ascending: false }).limit(60) : q.gte('starts_at', cutoff).order('starts_at');
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    async create(ev) {
      const u = await need();
      if (!live) { const e = { ...ev, id: demo.nextId++, organiser_id: u.id, organiser_name: u.name, created_at: new Date().toISOString() }; demo.events.push(e); save(); return e; }
      const { data, error } = await sb.from('events').insert({ ...ev, organiser_id: u.id, organiser_name: u.name }).select().single();
      if (error) throw error;
      return data;
    },
    async remove(id) {
      await need();
      if (!live) { demo.events = demo.events.filter(e => String(e.id) !== String(id)); save(); return; }
      const { error } = await sb.from('events').delete().eq('id', id);
      if (error) throw error;
    },
    async upcoming(n = 3) { return (await this.list(false)).slice(0, n); }
  };
})();
