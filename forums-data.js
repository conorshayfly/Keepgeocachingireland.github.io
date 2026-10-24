/* Data layer for forums: Supabase when configured, otherwise local demo mode. */
(function () {
  const cfg = window.KGI_CONFIG || {};
  const live = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const sb = live ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  const SEED_CATS = [
    { id: 1, slug: 'general', name: 'General Chat', description: 'Say hello and talk all things geocaching in Ireland.' },
    { id: 2, slug: 'events', name: 'Events & Meetups', description: 'CITOs, mega events, meet & greets and cache bashes.' },
    { id: 3, slug: 'counties', name: 'County Corner', description: 'Local tips, series and trails by county.' },
    { id: 4, slug: 'puzzles', name: 'Puzzles & Mysteries', description: 'Stuck on a puzzle cache? Ask for nudges here (no spoilers in titles!).' },
    { id: 5, slug: 'gear', name: 'Gear & Tech', description: 'GPS units, apps, containers, swag and trackables.' },
    { id: 6, slug: 'beginners', name: 'Beginners', description: 'New here? No question is too small.' }
  ];

  /* ---------- demo storage ---------- */
  const KEY = 'kgi_demo_v1';
  function load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (!d) {
      const now = new Date().toISOString();
      d = {
        user: null, nextId: 3,
        threads: [{ id: 1, category_id: 6, title: 'Welcome to Keep Geocaching Ireland!', body: 'This is demo content stored only in your browser. Connect Supabase in config.js to go live.', author_id: 'sys', author_name: 'KGI Team', created_at: now }],
        replies: [{ id: 2, thread_id: 1, body: 'Happy caching! 🍀', author_id: 'sys', author_name: 'KGI Team', created_at: now }]
      };
    }
    d.reports = d.reports || [];
    d.threads.forEach(t => { t.is_pinned = !!t.is_pinned; t.is_locked = !!t.is_locked; });
    return d;
  }
  let demo = load();
  const save = () => localStorage.setItem(KEY, JSON.stringify(demo));
  const listeners = [];
  const emit = () => getUser().then(u => listeners.forEach(f => f(u)));
  const isMod = r => r === 'moderator' || r === 'admin';
  const roleCache = {};

  async function getUser() {
    if (!live) return demo.user ? { ...demo.user, role: demo.user.role || 'member', isMod: isMod(demo.user.role) } : null;
    const { data } = await sb.auth.getUser();
    const u = data?.user;
    if (!u) return null;
    if (!(u.id in roleCache)) {
      const { data: p } = await sb.from('profiles').select('role').eq('id', u.id).maybeSingle();
      roleCache[u.id] = p?.role || 'member';
    }
    const role = roleCache[u.id];
    return { id: u.id, name: u.user_metadata?.username || u.email.split('@')[0], email: u.email, role, isMod: isMod(role) };
  }
  const need = async () => { const u = await getUser(); if (!u) throw new Error('Please log in first.'); return u; };

  if (live) sb.auth.onAuthStateChange(() => emit());

  window.KGIData = {
    live, sb,
    getUser,
    onAuth(f) { listeners.push(f); },

    async signUp(email, password, username) {
      if (!live) { demo.user = { id: 'demo-' + username, name: username, email: email || '', role: 'member' }; save(); emit(); return {}; }
      const { error } = await sb.auth.signUp({ email, password, options: { data: { username } } });
      if (error) throw error;
      return { confirm: true };
    },
    async signIn(email, password, username) {
      if (!live) { demo.user = { id: 'demo-' + (username || 'guest'), name: username || 'Guest', email: email || '', role: 'member' }; save(); emit(); return; }
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() {
      if (!live) { demo.user = null; save(); emit(); return; }
      await sb.auth.signOut();
    },
    // demo only: try the moderator tools without a backend
    setDemoRole(role) { if (live || !demo.user) return; demo.user.role = role; save(); emit(); },

    async categories() {
      if (!live) return SEED_CATS;
      const { data, error } = await sb.from('categories').select('*').order('id');
      if (error) throw error;
      return data;
    },
    async threads(categoryId) {
      if (!live) {
        return demo.threads.filter(t => t.category_id === categoryId)
          .map(t => ({ ...t, reply_count: demo.replies.filter(r => r.thread_id === t.id).length }))
          .sort((a, b) => (b.is_pinned - a.is_pinned) || b.created_at.localeCompare(a.created_at));
      }
      const { data, error } = await sb.from('threads').select('*, replies(count)').eq('category_id', categoryId)
        .order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(t => ({ ...t, reply_count: t.replies?.[0]?.count ?? 0 }));
    },
    async latestThreads(n = 5) {
      if (!live) return [...demo.threads].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, n);
      const { data, error } = await sb.from('threads').select('*').order('created_at', { ascending: false }).limit(n);
      if (error) throw error;
      return data;
    },
    async thread(id) {
      if (!live) return demo.threads.find(t => String(t.id) === String(id));
      const { data, error } = await sb.from('threads').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
    async replies(threadId) {
      if (!live) return demo.replies.filter(r => String(r.thread_id) === String(threadId)).sort((a, b) => a.created_at.localeCompare(b.created_at));
      const { data, error } = await sb.from('replies').select('*').eq('thread_id', threadId).order('created_at');
      if (error) throw error;
      return data;
    },
    async createThread({ category_id, title, body }) {
      const user = await need();
      if (!live) {
        const t = { id: demo.nextId++, category_id, title, body, author_id: user.id, author_name: user.name, created_at: new Date().toISOString(), is_pinned: false, is_locked: false };
        demo.threads.push(t); save(); return t;
      }
      const { data, error } = await sb.from('threads').insert({ category_id, title, body, author_id: user.id, author_name: user.name }).select().single();
      if (error) throw error;
      return data;
    },
    async createReply({ thread_id, body }) {
      const user = await need();
      if (!live) {
        const t = demo.threads.find(x => String(x.id) === String(thread_id));
        if (t?.is_locked && !user.isMod) throw new Error('This thread is locked.');
        demo.replies.push({ id: demo.nextId++, thread_id: Number(thread_id), body, author_id: user.id, author_name: user.name, created_at: new Date().toISOString() });
        save(); return;
      }
      const { error } = await sb.from('replies').insert({ thread_id, body, author_id: user.id, author_name: user.name });
      if (error) throw new Error(/row-level security/i.test(error.message) ? 'This thread is locked.' : error.message);
    },

    /* ---- moderation ---- */
    async deleteThread(id) {
      await need();
      if (!live) { demo.threads = demo.threads.filter(t => String(t.id) !== String(id)); demo.replies = demo.replies.filter(r => String(r.thread_id) !== String(id)); save(); return; }
      const { error } = await sb.from('threads').delete().eq('id', id);
      if (error) throw error;
    },
    async deleteReply(id) {
      await need();
      if (!live) { demo.replies = demo.replies.filter(r => String(r.id) !== String(id)); save(); return; }
      const { error } = await sb.from('replies').delete().eq('id', id);
      if (error) throw error;
    },
    async setThreadFlags(id, flags) {
      const u = await need();
      if (!u.isMod) throw new Error('Moderators only.');
      if (!live) { Object.assign(demo.threads.find(t => String(t.id) === String(id)) || {}, flags); save(); return; }
      const { error } = await sb.from('threads').update(flags).eq('id', id);
      if (error) throw error;
    },
    async report({ target_type, target_id, thread_id, excerpt, reason }) {
      const u = await need();
      excerpt = String(excerpt || '').slice(0, 200);
      if (!live) {
        if (demo.reports.some(r => r.reporter_id === u.id && r.target_type === target_type && String(r.target_id) === String(target_id)))
          throw new Error('You have already reported this.');
        demo.reports.push({ id: demo.nextId++, target_type, target_id, thread_id, excerpt, reason, reporter_id: u.id, status: 'open', created_at: new Date().toISOString() });
        save(); return;
      }
      const { error } = await sb.from('reports').insert({ target_type, target_id, thread_id, excerpt, reason, reporter_id: u.id });
      if (error) throw new Error(error.code === '23505' ? 'You have already reported this.' : error.message);
    },
    async openReports() {
      const u = await getUser();
      if (!u?.isMod) return [];
      if (!live) return demo.reports.filter(r => r.status === 'open').sort((a, b) => b.created_at.localeCompare(a.created_at));
      const { data, error } = await sb.from('reports').select('*').eq('status', 'open').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    async resolveReport(id) {
      const u = await need();
      if (!live) { const r = demo.reports.find(x => String(x.id) === String(id)); if (r) r.status = 'resolved'; save(); return; }
      const { error } = await sb.from('reports').update({ status: 'resolved', resolved_by: u.id }).eq('id', id);
      if (error) throw error;
    }
  };
})();
