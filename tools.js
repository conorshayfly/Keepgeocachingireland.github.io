(function () {
  const $ = id => document.getElementById(id);
  const R = 6371008.8; // mean Earth radius in metres
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

  const { parseAny, fmtDD, fmtDMM, fmtDMS, numsOf } = KGICoords;
  const bad = el => (el.textContent = 'Could not understand those coordinates.');

  /* ---------- converter ---------- */
  function doConvert() {
    const c = parseAny($('cIn').value), out = $('cOut');
    if (!c) return $('cIn').value ? bad(out) : (out.textContent = '');
    out.textContent = `Decimal degrees:   ${fmtDD(c)}\nDeg + dec. mins:   ${fmtDMM(c)}\nDeg min sec:       ${fmtDMS(c)}\nGoogle Maps:       https://www.google.com/maps?q=${c.lat.toFixed(6)},${c.lon.toFixed(6)}`;
  }

  /* ---------- distance & bearing ---------- */
  function dist(a, b) {
    const dφ = rad(b.lat - a.lat), dλ = rad(b.lon - a.lon);
    const h = Math.sin(dφ / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dλ / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function bearing(a, b) {
    const φ1 = rad(a.lat), φ2 = rad(b.lat), dλ = rad(b.lon - a.lon);
    const y = Math.sin(dλ) * Math.cos(φ2), x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
    return (deg(Math.atan2(y, x)) + 360) % 360;
  }
  const compass = b => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(b / 22.5) % 16];
  function doDistance() {
    const a = parseAny($('dA').value), b = parseAny($('dB').value), out = $('dOut');
    if (!a || !b) return bad(out);
    const d = dist(a, b), br = bearing(a, b);
    out.textContent = `Distance: ${(d / 1000).toFixed(3)} km  (${d.toFixed(0)} m, ${(d / 1609.344).toFixed(3)} miles)\nBearing:  ${br.toFixed(1)}° (${compass(br)})\nReverse:  ${((br + 180) % 360).toFixed(1)}°`;
  }

  /* ---------- projection ---------- */
  function doProject() {
    const a = parseAny($('pA').value), out = $('pOut');
    const brg = parseFloat($('pB').value), d = parseFloat($('pD').value) * parseFloat($('pU').value);
    if (!a || isNaN(brg) || isNaN(d)) return bad(out);
    const δ = d / R, θ = rad(brg), φ1 = rad(a.lat), λ1 = rad(a.lon);
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
    const c = { lat: deg(φ2), lon: ((deg(λ2) + 540) % 360) - 180 };
    out.textContent = `Result:\n${fmtDMM(c)}\n${fmtDD(c)}`;
  }

  /* ---------- ciphers ---------- */
  const A = 'A'.charCodeAt(0), a = 'a'.charCodeAt(0);
  function shiftText(t, k) {
    return t.replace(/[a-z]/gi, ch => {
      const base = ch <= 'Z' ? A : a;
      return String.fromCharCode(((ch.charCodeAt(0) - base + k) % 26 + 26) % 26 + base);
    });
  }
  const atbash = t => t.replace(/[a-z]/gi, ch => { const base = ch <= 'Z' ? A : a; return String.fromCharCode(base + 25 - (ch.charCodeAt(0) - base)); });
  function vig(t, key, dec) {
    const k = key.toUpperCase().replace(/[^A-Z]/g, ''); if (!k) return 'Enter a key first.';
    let i = 0;
    return t.replace(/[a-z]/gi, ch => { const s = k.charCodeAt(i++ % k.length) - A; return shiftText(ch, dec ? -s : s); });
  }
  function doCipher(kind) {
    const t = $('xIn').value, out = $('xOut');
    const shift = parseInt($('xShift').value) || 0;
    switch (kind) {
      case 'caesar': out.textContent = shiftText(t, shift); break;
      case 'brute': out.textContent = Array.from({ length: 25 }, (_, i) => `${String(i + 1).padStart(2, ' ')}: ${shiftText(t, i + 1)}`).join('\n'); break;
      case 'atbash': out.textContent = atbash(t); break;
      case 'a1z26e': out.textContent = t.toUpperCase().replace(/[A-Z]/g, c => c.charCodeAt(0) - 64 + ' ').replace(/ +/g, ' ').trim(); break;
      case 'a1z26d': out.textContent = t.replace(/\d+/g, n => (+n >= 1 && +n <= 26) ? String.fromCharCode(64 + +n) : n).replace(/[\s-]+/g, m => m.length > 1 && /\s/.test(m) ? ' ' : '').trim(); break;
      case 'vigE': out.textContent = vig(t, $('xKey').value, false); break;
      case 'vigD': out.textContent = vig(t, $('xKey').value, true); break;
      case 'rev': out.textContent = [...t].reverse().join(''); break;
    }
  }

  /* ---------- letter values ---------- */
  function doSum() {
    const t = $('sIn').value.toUpperCase(), letters = t.replace(/[^A-Z]/g, '');
    const vals = [...letters].map(c => c.charCodeAt(0) - 64), sum = vals.reduce((x, y) => x + y, 0);
    let root = sum; while (root > 9) root = [...String(root)].reduce((x, y) => x + +y, 0);
    $('sOut').textContent = letters ? `Values: ${vals.join(' + ')}\nSum: ${sum}\nDigital root: ${root}\nLetters: ${letters.length}` : '';
  }


  /* ---------- Irish Grid & ITM ---------- */
  const G = window.KGIGrid;
  const nf = (v, d = 0) => v.toFixed(d);
  function doGrid() {
    const type = $('gType').value, v = $('gIn').value.trim(), out = $('gOut');
    if (!v) { out.textContent = ''; return; }
    let ll = null, hint = '';
    if (type === 'll') ll = parseAny(v);
    else if (type === 'ref') { const g = G.refToIG(v); if (g) ll = G.igToWGS84(g.e, g.n); }
    else {
      const n = numsOf(v);
      if (n.length === 2 && n[0] > 0 && n[1] > 0) {
        if (type === 'itm' && n[0] < 1e6 && n[1] < 1e6) ll = G.itmToWGS84(n[0], n[1]);
        if (type === 'ig' && n[0] < 5e5 && n[1] < 5e5) ll = G.igToWGS84(n[0], n[1]);
      }
    }
    if (!ll || isNaN(ll.lat) || ll.lat < 51 || ll.lat > 56 || ll.lon < -11.5 || ll.lon > -5) {
      out.textContent = 'Could not understand that, or it is outside Ireland.'; return;
    }
    const itm = G.wgs84ToITM(ll.lat, ll.lon), ig = G.wgs84ToIG(ll.lat, ll.lon);
    const ref = G.igToRef(ig.e, ig.n);
    out.textContent =
      `WGS84 (DMM):   ${fmtDMM(ll)}\nWGS84 (DD):    ${fmtDD(ll)}\n` +
      `ITM:           E ${nf(itm.e, 1)}  N ${nf(itm.n, 1)}\n` +
      `Irish Grid:    E ${nf(ig.e, 1)}  N ${nf(ig.n, 1)}\n` +
      `Grid ref:      ${ref || 'outside grid'}  (${G.igToRef(ig.e, ig.n, 3) || ''})`;
  }
  ['gType', 'gIn'].forEach(id => $(id).addEventListener('input', doGrid));
  $('gType').addEventListener('change', () => {
    const ex = { ll: 'N 53° 20.987 W 006° 15.615', itm: '715830 734697', ig: '315904 234671', ref: 'O 15904 34671' };
    $('gIn').value = ex[$('gType').value]; doGrid();
  });

  /* ---------- wiring ---------- */
  ['cIn'].forEach(id => $(id).addEventListener('input', doConvert));
  ['dA', 'dB'].forEach(id => $(id).addEventListener('input', doDistance));
  ['pA', 'pB', 'pD', 'pU'].forEach(id => $(id).addEventListener('input', doProject));
  $('sIn').addEventListener('input', doSum);
  document.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => doCipher(b.dataset.c)));
  document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('active', x === b));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === b.dataset.p));
    if (b.dataset.p) history.replaceState(null, '', '#' + b.dataset.p);
  }));
  const h = location.hash.slice(1); if (h && $(h) && document.querySelector(`#tabs [data-p="${h}"]`)) document.querySelector(`#tabs [data-p="${h}"]`).click();
  doConvert(); doDistance(); doProject(); doSum(); doGrid();

})();
