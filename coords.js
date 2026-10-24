/* Shared coordinate parsing/formatting. Needs js/grids.js loaded first for ITM / Irish Grid input. */
(function () {
  function toDeg(nums, hemi) {
    const [d, m = 0, s = 0] = nums;
    let v = Math.abs(d) + m / 60 + s / 3600;
    if (hemi === 'S' || hemi === 'W' || d < 0 || Object.is(d, -0)) v = -v;
    return v;
  }
  const numsOf = str => (str.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

  function parseCoord(input) {
    const s = String(input).toUpperCase().replace(/[°º'′"″,;]/g, ' ').replace(/\s+/g, ' ').trim();
    let lat, lon, m;
    // letter before: N 53 21.123 W 006 15.456
    let parts = [...s.matchAll(/([NSEW])\s*([\d.\s-]+)/g)];
    if (parts.length === 2) {
      parts.forEach(p => { const v = toDeg(numsOf(p[2]), p[1]); if ('NS'.includes(p[1])) lat = v; else lon = v; });
    } else {
      // letter after: 53 21.123 N 6 15.456 W
      parts = [...s.matchAll(/([\d.\s-]+?)\s*([NSEW])/g)];
      if (parts.length === 2) parts.forEach(p => { const v = toDeg(numsOf(p[1]), p[2]); if ('NS'.includes(p[2])) lat = v; else lon = v; });
      else {
        const n = numsOf(s);
        if (n.length === 2) { lat = n[0]; lon = n[1]; }
        else if (n.length === 4) { lat = toDeg(n.slice(0, 2)); lon = toDeg(n.slice(2)); }
        else if (n.length === 6) { lat = toDeg(n.slice(0, 3)); lon = toDeg(n.slice(3)); }
      }
    }
    if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat, lon };
  }
  const pad = (n, w, dp = 0) => n.toFixed(dp).padStart(w + (dp ? dp + 1 : 0), '0');
  function fmtDD(c) { return `${c.lat.toFixed(6)}, ${c.lon.toFixed(6)}`; }
  function fmtDMM(c) {
    const f = (v, pos, neg, w) => { const a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60; return `${v >= 0 ? pos : neg} ${pad(d, w)}° ${pad(m, 2, 3)}'`; };
    return `${f(c.lat, 'N', 'S', 2)} ${f(c.lon, 'E', 'W', 3)}`;
  }
  function fmtDMS(c) {
    const f = (v, pos, neg, w) => { const a = Math.abs(v), d = Math.floor(a), mm = (a - d) * 60, m = Math.floor(mm), s = (mm - m) * 60; return `${v >= 0 ? pos : neg} ${pad(d, w)}° ${pad(m, 2)}' ${pad(s, 2, 2)}"`; };
    return `${f(c.lat, 'N', 'S', 2)} ${f(c.lon, 'E', 'W', 3)}`;
  }

  const inIreland = c => c && !isNaN(c.lat) && !isNaN(c.lon) && c.lat > 51 && c.lat < 56 && c.lon > -11.5 && c.lon < -5;

  /* Accepts: lat/lon in any common format, ITM "715830 734697", Irish Grid "315904 234671",
     prefixed "ITM ..." / "IG ...", or letter refs like "O 15904 34671" / "O1534". */
  function parseAny(input) {
    const raw = String(input || '').trim();
    if (!raw) return null;
    const G = window.KGIGrid;
    if (G) {
      const up = raw.toUpperCase();
      const compact = up.replace(/\s+/g, '');
      if (/^[A-HJ-Z]\d{2,10}$/.test(compact) && compact.length % 2 === 1) {
        const g = G.refToIG(compact);
        const c = g && G.igToWGS84(g.e, g.n);
        if (inIreland(c)) return c;
      }
      const pm = up.match(/^(ITM|IG|TM75|IRISH GRID)\s*:?\s*(.*)$/);
      const rest = pm ? pm[2] : up;
      if (/^[\d.\s,]+$/.test(rest)) {
        const n = numsOf(rest);
        if (n.length === 2 && n[0] >= 1000 && n[1] >= 1000) {
          const kind = pm ? (pm[1] === 'ITM' ? 'itm' : 'ig') : (n[1] >= 500000 ? 'itm' : 'ig');
          const c = kind === 'itm' ? G.itmToWGS84(n[0], n[1]) : G.igToWGS84(n[0], n[1]);
          if (inIreland(c)) return c;
        }
      }
    }
    return parseCoord(raw);
  }

  window.KGICoords = { parseCoord, parseAny, fmtDD, fmtDMM, fmtDMS, numsOf };
  window.KGITools = window.KGICoords; // alias used by map.js
})();
