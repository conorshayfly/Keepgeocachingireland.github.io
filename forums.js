(function () {
  const { esc, timeAgo } = KGI;
  const $ = id => document.getElementById(id);
  const view = $('view'), authbar = $('authbar');
  let user = null, cats = [], signupMode = false, current = null, openCount = 0;

  if (!KGIData.live) {
    $('demoNotice').innerHTML =
      '<div class="notice"><strong>Demo mode:</strong> Supabase isn\'t configured yet, so posts are saved only in this browser. Add your keys in <code>config.js</code> to go live.</div>';
  }

  /* ---------- auth modal ---------- */
  const modal = $('authModal');
  function setMode(signup) {
    signupMode = signup;
    $('authTitle').textContent = signup ? 'Create account' : 'Log in';
    $('authSubmit').textContent = signup ? 'Sign up' : 'Log in';
    $('authSwitch').textContent = signup ? 'Have an account?' : 'Need an account?';
    $('userField').style.display = (signup || !KGIData.live) ? 'block' : 'none';
    $('ap').autocomplete = signup ? 'new-password' : 'current-password';
    $('authMsg').innerHTML = '';
  }
  function openAuth(signup) { setMode(!!signup); modal.classList.add('open'); }
  $('authClose').onclick = () => modal.classList.remove('open');
  $('authSwitch').onclick = () => setMode(!signupMode);
  $('authForm').onsubmit = async e => {
    e.preventDefault();
    const email = $('ae').value.trim(), pw = $('ap').value, name = $('au').value.trim();
    try {
      if (signupMode) {
        if (!name) throw new Error('Choose a username.');
        const r = await KGIData.signUp(email, pw, name);
        if (r.confirm) { $('authMsg').innerHTML = '<div class="notice ok">Check your email to confirm your account, then log in.</div>'; return; }
      } else {
        if (!KGIData.live && !name) throw new Error('Enter a username for demo mode.');
        await KGIData.signIn(email, pw, name);
      }
      modal.classList.remove('open');
    } catch (err) { $('authMsg').innerHTML = `<div class="notice err">${esc(err.message)}</div>`; }
  };

  /* ---------- report modal ---------- */
  let reportTarget = null;
  function openReport(target) {
    if (!user) { openAuth(false); return; }
    reportTarget = target; $('rMsg').innerHTML = ''; $('rReason').value = '';
    $('reportModal').classList.add('open');
  }
  $('rClose').onclick = () => $('reportModal').classList.remove('open');
  $('reportForm').onsubmit = async e => {
    e.preventDefault();
    try {
      await KGIData.report({ ...reportTarget, reason: $('rReason').value.trim() });
      $('rMsg').innerHTML = '<div class="notice ok">Thanks. A moderator will take a look.</div>';
      setTimeout(() => $('reportModal').classList.remove('open'), 1200);
    } catch (err) { $('rMsg').innerHTML = `<div class="notice err">${esc(err.message)}</div>`; }
  };

  /* ---------- auth bar ---------- */
  async function renderAuth() {
    openCount = user?.isMod ? (await KGIData.openReports().catch(() => [])).length : 0;
    authbar.innerHTML = user
      ? `${user.isMod ? `<a class="btn small gold" href="#/mod">Reports${openCount ? ` (${openCount})` : ''}</a>` : ''}
         ${!KGIData.live ? `<label style="margin:0;font-weight:500;font-size:.85rem;display:flex;gap:.3rem;align-items:center"><input type="checkbox" id="demoMod" style="width:auto" ${user.isMod ? 'checked' : ''}> Demo: moderator</label>` : ''}
         <span>Signed in as <strong>${esc(user.name)}</strong>${user.isMod ? ' <span class="tag">mod</span>' : ''}</span>
         <button class="btn small outline" id="logout">Log out</button>`
      : `<button class="btn small" id="login">Log in</button><button class="btn small outline" id="signup">Sign up</button>`;
    if (user) {
      $('logout').onclick = () => KGIData.signOut();
      if ($('demoMod')) $('demoMod').onchange = e => KGIData.setDemoRole(e.target.checked ? 'moderator' : 'member');
    } else { $('login').onclick = () => openAuth(false); $('signup').onclick = () => openAuth(true); }
  }

  /* ---------- views ---------- */
  async function showCategories() {
    view.innerHTML = '<p>Loading…</p>';
    cats = await KGIData.categories();
    view.innerHTML = '<h2 class="title">Categories</h2>' + cats.map(c => `
      <a class="list-item" href="#/c/${esc(c.slug)}">
        <div><h3>${esc(c.name)}</h3><small>${esc(c.description)}</small></div><span>→</span>
      </a>`).join('');
  }

  async function showCategory(slug) {
    cats = cats.length ? cats : await KGIData.categories();
    const cat = cats.find(c => c.slug === slug);
    if (!cat) { view.innerHTML = '<p>Category not found.</p>'; return; }
    const threads = await KGIData.threads(cat.id);
    view.innerHTML = `
      <div class="crumbs"><a href="#/">Forums</a> › ${esc(cat.name)}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
        <h2 class="title" style="margin:0">${esc(cat.name)}</h2>
        <a class="btn small" href="#/new/${esc(cat.slug)}">+ New thread</a>
      </div><br>
      ${threads.length ? threads.map(t => `
        <a class="list-item" href="#/t/${t.id}">
          <div><h3>${t.is_pinned ? '📌 ' : ''}${t.is_locked ? '🔒 ' : ''}${esc(t.title)}</h3><small>by ${esc(t.author_name)} · ${timeAgo(t.created_at)}</small></div>
          <span class="tag">${t.reply_count} repl${t.reply_count === 1 ? 'y' : 'ies'}</span>
        </a>`).join('') : '<div class="card"><p>No threads yet. Be the first!</p></div>'}`;
  }

  async function showNew(slug) {
    cats = cats.length ? cats : await KGIData.categories();
    const cat = cats.find(c => c.slug === slug);
    if (!cat) { view.innerHTML = '<p>Category not found.</p>'; return; }
    if (!user) {
      view.innerHTML = `<div class="crumbs"><a href="#/c/${esc(slug)}">← ${esc(cat.name)}</a></div><div class="card"><p>Please log in to start a thread.</p></div>`;
      openAuth(false); return;
    }
    view.innerHTML = `
      <div class="crumbs"><a href="#/c/${esc(slug)}">← ${esc(cat.name)}</a></div>
      <div class="card"><h3>New thread in ${esc(cat.name)}</h3>
        <div id="formMsg"></div>
        <form id="newForm">
          <label for="nt">Title</label><input id="nt" required maxlength="120">
          <label for="nb">Message</label><textarea id="nb" required maxlength="5000"></textarea>
          <p style="font-size:.85rem;color:var(--muted)">Please avoid spoilers in titles and don't post exact coordinates for hidden caches.</p>
          <button class="btn" type="submit">Post thread</button>
        </form></div>`;
    $('newForm').onsubmit = async e => {
      e.preventDefault();
      try {
        const t = await KGIData.createThread({ category_id: cat.id, title: $('nt').value.trim(), body: $('nb').value.trim() });
        location.hash = '#/t/' + t.id;
      } catch (err) { $('formMsg').innerHTML = `<div class="notice err">${esc(err.message)}</div>`; }
    };
  }

  function postActions(type, p, threadId) {
    const mine = user && user.id === p.author_id;
    const bits = [];
    if (user && !mine) bits.push(`<button class="copy" data-act="report" data-type="${type}" data-id="${p.id}">Report</button>`);
    if (mine || user?.isMod) bits.push(`<button class="copy" data-act="del" data-type="${type}" data-id="${p.id}" style="color:#b3402f">Delete</button>`);
    return bits.length ? `<div style="text-align:right;margin-top:.3rem">${bits.join(' ')}</div>` : '';
  }

  async function showThread(id) {
    const t = await KGIData.thread(id);
    if (!t) { view.innerHTML = '<div class="card"><p>Thread not found (it may have been removed).</p><a href="#/">Back to forums</a></div>'; return; }
    cats = cats.length ? cats : await KGIData.categories();
    const cat = cats.find(c => c.id === t.category_id);
    const replies = await KGIData.replies(id);
    current = { t, replies, cat };
    const canReply = user && (!t.is_locked || user.isMod);
    view.innerHTML = `
      <div class="crumbs"><a href="#/">Forums</a> › <a href="#/c/${esc(cat?.slug)}">${esc(cat?.name || '')}</a></div>
      <h2 class="title">${t.is_pinned ? '📌 ' : ''}${t.is_locked ? '🔒 ' : ''}${esc(t.title)}</h2>
      ${user?.isMod ? `<div class="notice" style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center"><strong>Moderator:</strong>
        <button class="btn small outline" data-act="pin">${t.is_pinned ? 'Unpin' : 'Pin'}</button>
        <button class="btn small outline" data-act="lock">${t.is_locked ? 'Unlock' : 'Lock'}</button>
        <button class="btn small danger" data-act="del" data-type="thread" data-id="${t.id}">Delete thread</button></div>` : ''}
      ${t.is_locked ? '<div class="notice">This thread is locked. No new replies.</div>' : ''}
      <div class="post op"><div class="meta"><strong>${esc(t.author_name)}</strong> · ${timeAgo(t.created_at)}</div><div class="body">${esc(t.body)}</div>${postActions('thread', t)}</div>
      ${replies.map(r => `<div class="post"><div class="meta"><strong>${esc(r.author_name)}</strong> · ${timeAgo(r.created_at)}</div><div class="body">${esc(r.body)}</div>${postActions('reply', r)}</div>`).join('')}
      <div class="card" style="margin-top:1rem"><h3>Reply</h3>
        ${canReply ? `<div id="formMsg"></div><form id="replyForm"><textarea id="rb" required maxlength="5000"></textarea><br><br><button class="btn" type="submit">Post reply</button></form>`
          : user ? '<p>Replies are closed.</p>' : `<p>Please <a href="#" id="loginLink">log in</a> to reply.</p>`}
      </div>`;
    if (canReply) {
      $('replyForm').onsubmit = async e => {
        e.preventDefault();
        try { await KGIData.createReply({ thread_id: t.id, body: $('rb').value.trim() }); showThread(id); }
        catch (err) { $('formMsg').innerHTML = `<div class="notice err">${esc(err.message)}</div>`; }
      };
    } else if (!user) {
      $('loginLink').onclick = e => { e.preventDefault(); openAuth(false); };
    }
  }

  async function showMod() {
    if (!user?.isMod) { view.innerHTML = '<div class="card"><p>Moderators only.</p></div>'; return; }
    const reports = await KGIData.openReports();
    view.innerHTML = `
      <div class="crumbs"><a href="#/">Forums</a> › Reports</div>
      <h2 class="title">Open reports (${reports.length})</h2>
      ${reports.length ? reports.map(r => `
        <div class="post" data-rid="${r.id}">
          <div class="meta"><span class="tag">${esc(r.target_type)}</span> · reported ${timeAgo(r.created_at)}</div>
          <div class="body"><strong>Reason:</strong> ${esc(r.reason)}</div>
          <div class="body" style="color:var(--muted);margin-top:.3rem"><em>“${esc(r.excerpt)}”</em></div>
          <div style="display:flex;gap:.5rem;margin-top:.6rem;flex-wrap:wrap">
            <a class="btn small outline" href="#/t/${r.thread_id}">View thread</a>
            <button class="btn small danger" data-act="rdel" data-id="${r.id}" data-type="${esc(r.target_type)}" data-target="${r.target_id}">Delete post</button>
            <button class="btn small" data-act="rok" data-id="${r.id}">Dismiss</button>
          </div>
        </div>`).join('') : '<div class="card"><p>Nothing to review. 🎉</p></div>'}`;
  }

  /* ---------- actions (delegated) ---------- */
  view.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, type = b.dataset.type, id = b.dataset.id;
    try {
      if (act === 'report') {
        const src = type === 'thread' ? current.t : current.replies.find(r => String(r.id) === id);
        openReport({ target_type: type, target_id: Number(id), thread_id: current.t.id, excerpt: src?.body });
      } else if (act === 'del') {
        if (!confirm(type === 'thread' ? 'Delete this whole thread and all replies?' : 'Delete this reply?')) return;
        if (type === 'thread') { await KGIData.deleteThread(id); location.hash = '#/c/' + (current.cat?.slug || ''); }
        else { await KGIData.deleteReply(id); showThread(current.t.id); }
        renderAuth();
      } else if (act === 'pin') { await KGIData.setThreadFlags(current.t.id, { is_pinned: !current.t.is_pinned }); showThread(current.t.id); }
      else if (act === 'lock') { await KGIData.setThreadFlags(current.t.id, { is_locked: !current.t.is_locked }); showThread(current.t.id); }
      else if (act === 'rdel') {
        if (!confirm('Delete the reported ' + type + '?')) return;
        if (type === 'thread') await KGIData.deleteThread(b.dataset.target); else await KGIData.deleteReply(b.dataset.target);
        await KGIData.resolveReport(id); showMod(); renderAuth();
      } else if (act === 'rok') { await KGIData.resolveReport(id); showMod(); renderAuth(); }
    } catch (err) { alert(err.message); }
  });

  async function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    try {
      if (parts[0] === 'c' && parts[1]) await showCategory(parts[1]);
      else if (parts[0] === 't' && parts[1]) await showThread(parts[1]);
      else if (parts[0] === 'new' && parts[1]) await showNew(parts[1]);
      else if (parts[0] === 'mod') await showMod();
      else await showCategories();
    } catch (err) { view.innerHTML = `<div class="notice err">Something went wrong: ${esc(err.message)}</div>`; }
  }

  KGIData.onAuth(async u => { user = u; await renderAuth(); route(); });
  window.addEventListener('hashchange', route);
  (async () => { user = await KGIData.getUser(); await renderAuth(); route(); })();
})();
