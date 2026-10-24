/* Shared: header, footer, helpers */
(function () {
  const pages = [
    ['index.html', 'Home'],
    ['forums.html', 'Forums'],
    ['events.html', 'Events'],
    ['tools.html', 'Tools'],
    ['map.html', 'Map']
  ];
  const current = location.pathname.split('/').pop() || 'index.html';

  const header = document.getElementById('site-header');
  if (header) {
    header.className = 'site-header';
    header.innerHTML = `
      <div class="container">
        <a class="brand" href="index.html" aria-label="Keep Geocaching Ireland home">
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2C9.9 2 5 6.7 5 12.6 5 20.4 16 30 16 30s11-9.6 11-17.4C27 6.7 22.1 2 16 2z" fill="#e9a23b"/><circle cx="16" cy="12.5" r="4.5" fill="#0b2e22"/></svg>
          <span>Keep Geocaching <em>Ireland</em></span>
        </a>
        <button class="menu-btn" aria-label="Menu" id="menuBtn">☰</button>
        <nav class="nav" id="nav">
          ${pages.map(([href, label]) => `<a href="${href}" class="${href === current ? 'active' : ''}">${label}</a>`).join('')}
        </nav>
      </div>`;
    document.getElementById('menuBtn').addEventListener('click', () =>
      document.getElementById('nav').classList.toggle('open'));
  }

  const footer = document.getElementById('site-footer');
  if (footer) {
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="container">
        <strong>Keep Geocaching Ireland</strong> · A community hub for Irish geocachers.<br>
        Not affiliated with Groundspeak or Geocaching.com. Always follow the Geocaching Code of Conduct and respect
        landowners, nature and Irish access laws. © ${new Date().getFullYear()}
      </div>`;
  }

  window.KGI = {
    esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    timeAgo(iso) {
      const d = new Date(iso), s = Math.floor((Date.now() - d) / 1000);
      if (s < 60) return 'just now';
      if (s < 3600) return Math.floor(s / 60) + ' min ago';
      if (s < 86400) return Math.floor(s / 3600) + ' h ago';
      if (s < 604800) return Math.floor(s / 86400) + ' d ago';
      return d.toLocaleDateString('en-IE');
    },
    copy(text, btn) {
      navigator.clipboard?.writeText(text).then(() => {
        if (!btn) return;
        const old = btn.textContent; btn.textContent = 'Copied!';
        setTimeout(() => (btn.textContent = old), 1200);
      });
    }
  };
})();
