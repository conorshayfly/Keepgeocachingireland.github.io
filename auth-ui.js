/* Small shared login/sign-up UI (modal + bar). Needs main.js and forums-data.js. */
(function () {
  const { esc } = KGI;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-bg" id="authModal"><div class="modal">
      <h2 id="authTitle" style="margin-top:0">Log in</h2><div id="authMsg"></div>
      <form id="authForm">
        <div id="userField"><label for="au">Username</label><input id="au" autocomplete="username" maxlength="24"></div>
        <label for="ae">Email</label><input id="ae" type="email" autocomplete="email">
        <label for="ap">Password</label><input id="ap" type="password" minlength="6">
        <div style="display:flex;gap:.6rem;margin-top:1rem;align-items:center">
          <button class="btn" type="submit" id="authSubmit">Log in</button>
          <button class="btn outline" type="button" id="authSwitch">Need an account?</button>
          <button class="btn outline" type="button" id="authClose" style="margin-left:auto">Close</button>
        </div></form></div></div>`);
  const $ = id => document.getElementById(id);
  let signup = false, user = null, bar = null, onChange = () => {};
  function setMode(s) {
    signup = s;
    $('authTitle').textContent = s ? 'Create account' : 'Log in';
    $('authSubmit').textContent = s ? 'Sign up' : 'Log in';
    $('authSwitch').textContent = s ? 'Have an account?' : 'Need an account?';
    $('userField').style.display = (s || !KGIData.live) ? 'block' : 'none';
    $('authMsg').innerHTML = '';
  }
  function open(s) { setMode(!!s); $('authModal').classList.add('open'); }
  $('authClose').onclick = () => $('authModal').classList.remove('open');
  $('authSwitch').onclick = () => setMode(!signup);
  $('authForm').onsubmit = async e => {
    e.preventDefault();
    const email = $('ae').value.trim(), pw = $('ap').value, name = $('au').value.trim();
    try {
      if (signup) {
        if (!name) throw new Error('Choose a username.');
        const r = await KGIData.signUp(email, pw, name);
        if (r.confirm) { $('authMsg').innerHTML = '<div class="notice ok">Check your email to confirm your account, then log in.</div>'; return; }
      } else {
        if (!KGIData.live && !name) throw new Error('Enter a username for demo mode.');
        await KGIData.signIn(email, pw, name);
      }
      $('authModal').classList.remove('open');
    } catch (err) { $('authMsg').innerHTML = `<div class="notice err">${esc(err.message)}</div>`; }
  };
  function render() {
    bar.innerHTML = user
      ? `<span>Signed in as <strong>${esc(user.name)}</strong>${user.isMod ? ' <span class="tag">mod</span>' : ''}</span><button class="btn small outline" id="logout">Log out</button>`
      : `<button class="btn small" id="login">Log in</button><button class="btn small outline" id="signup">Sign up</button>`;
    if (user) $('logout').onclick = () => KGIData.signOut();
    else { $('login').onclick = () => open(false); $('signup').onclick = () => open(true); }
  }
  window.KGIAuth = {
    open,
    async init(barEl, cb) {
      bar = barEl; onChange = cb || onChange;
      KGIData.onAuth(u => { user = u; render(); onChange(u); });
      user = await KGIData.getUser(); render(); onChange(user);
    }
  };
})();
