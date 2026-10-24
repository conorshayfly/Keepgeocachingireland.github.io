/* Irish Grid (TM75) and ITM <-> WGS84. Pure functions, no DOM.
   ITM: GRS80 transverse Mercator (EPSG:2157), treated as equal to WGS84 (sub-metre).
   Irish Grid: Modified Airy transverse Mercator (EPSG:29903) + 7-parameter Helmert (EPSG:1954, ~1 m).  */
(function (root) {
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

  const ELL = {
    wgs84: { a: 6378137.0, f: 1 / 298.257223563 },
    grs80: { a: 6378137.0, f: 1 / 298.257222101 },
    airy:  { a: 6377340.189, b: 6356034.447 }
  };
  ELL.airy.f = 1 - ELL.airy.b / ELL.airy.a;

  const ITM = { ell: ELL.grs80, lat0: 53.5, lon0: -8, k0: 0.99982, fe: 600000, fn: 750000 };
  const IG  = { ell: ELL.airy,  lat0: 53.5, lon0: -8, k0: 1.000035, fe: 200000, fn: 250000 };

  /* ---- Transverse Mercator (Krueger series, n-based; mm-level accuracy over Ireland) ---- */
  function tmConsts(p) {
    const { a, f } = p.ell, n = f / (2 - f), n2 = n * n, n3 = n2 * n, n4 = n3 * n;
    const A = a / (1 + n) * (1 + n2 / 4 + n4 / 64);
    const alpha = [
      n / 2 - 2 * n2 / 3 + 5 * n3 / 16 + 41 * n4 / 180,
      13 * n2 / 48 - 3 * n3 / 5 + 557 * n4 / 1440,
      61 * n3 / 240 - 103 * n4 / 140,
      49561 * n4 / 161280
    ];
    const beta = [
      n / 2 - 2 * n2 / 3 + 37 * n3 / 96 - n4 / 360,
      n2 / 48 + n3 / 15 - 437 * n4 / 1440,
      17 * n3 / 480 - 37 * n4 / 840,
      4397 * n4 / 161280
    ];
    const e = Math.sqrt(f * (2 - f));
    return { A, alpha, beta, n, e };
  }
  // meridian arc from equator to latitude phi (rad)
  function conf(phi, e) {
    const s = Math.sin(phi), t = Math.sinh(Math.atanh(s) - e * Math.atanh(e * s));
    return Math.atan(t);
  }
  function tmForward(p, latDeg, lonDeg) {
    const c = tmConsts(p), phi = rad(latDeg), lam = rad(lonDeg - p.lon0);
    const chi = conf(phi, c.e);
    const xi1 = Math.atan2(Math.tan(chi), Math.cos(lam));
    const eta1 = Math.atanh(Math.sin(lam) * Math.cos(chi));
    let xi = xi1, eta = eta1;
    c.alpha.forEach((al, i) => {
      const j = 2 * (i + 1);
      xi += al * Math.sin(j * xi1) * Math.cosh(j * eta1);
      eta += al * Math.cos(j * xi1) * Math.sinh(j * eta1);
    });
    // origin northing
    const chi0 = conf(rad(p.lat0), c.e);
    let xi0 = chi0;
    c.alpha.forEach((al, i) => { xi0 += al * Math.sin(2 * (i + 1) * chi0); });
    return {
      e: p.fe + p.k0 * c.A * eta,
      n: p.fn + p.k0 * c.A * (xi - xi0)
    };
  }
  function tmInverse(p, E, N) {
    const c = tmConsts(p);
    const chi0 = conf(rad(p.lat0), c.e);
    let xi0 = chi0;
    c.alpha.forEach((al, i) => { xi0 += al * Math.sin(2 * (i + 1) * chi0); });
    const xi = (N - p.fn) / (p.k0 * c.A) + xi0, eta = (E - p.fe) / (p.k0 * c.A);
    let xi1 = xi, eta1 = eta;
    c.beta.forEach((b, i) => {
      const j = 2 * (i + 1);
      xi1 -= b * Math.sin(j * xi) * Math.cosh(j * eta);
      eta1 -= b * Math.cos(j * xi) * Math.sinh(j * eta);
    });
    const chi = Math.asin(Math.sin(xi1) / Math.cosh(eta1));
    // invert conformal latitude by iteration
    let phi = chi;
    for (let i = 0; i < 10; i++) {
      const s = Math.sin(phi);
      phi = Math.asin(Math.tanh(Math.atanh(Math.sin(chi)) + c.e * Math.atanh(c.e * s)));
    }
    const lam = Math.atan2(Math.sinh(eta1), Math.cos(xi1));
    return { lat: deg(phi), lon: p.lon0 + deg(lam) };
  }

  /* ---- geodetic <-> cartesian ---- */
  function toXYZ(ell, lat, lon) {
    const e2 = ell.f * (2 - ell.f), phi = rad(lat), lam = rad(lon), s = Math.sin(phi);
    const nu = ell.a / Math.sqrt(1 - e2 * s * s);
    return [nu * Math.cos(phi) * Math.cos(lam), nu * Math.cos(phi) * Math.sin(lam), nu * (1 - e2) * s];
  }
  function toGeodetic(ell, X, Y, Z) {
    const e2 = ell.f * (2 - ell.f), p = Math.hypot(X, Y);
    let phi = Math.atan2(Z, p * (1 - e2));
    for (let i = 0; i < 10; i++) {
      const s = Math.sin(phi), nu = ell.a / Math.sqrt(1 - e2 * s * s);
      phi = Math.atan2(Z + e2 * nu * s, p);
    }
    return { lat: deg(phi), lon: deg(Math.atan2(Y, X)) };
  }

  /* ---- Helmert, Position Vector (EPSG:9606), Ireland 1965/TM75 -> WGS84 (EPSG:1954) ---- */
  const H = { tx: 482.5, ty: -130.6, tz: 564.6, rx: rad(-1.042 / 3600), ry: rad(-0.214 / 3600), rz: rad(-0.631 / 3600), s: 8.15e-6 };
  function helmertFwd([x, y, z]) {
    const m = 1 + H.s;
    return [H.tx + m * (x - H.rz * y + H.ry * z), H.ty + m * (H.rz * x + y - H.rx * z), H.tz + m * (-H.ry * x + H.rx * y + z)];
  }
  function helmertInv([X, Y, Z]) {
    let g = [X - H.tx, Y - H.ty, Z - H.tz]; // first guess
    for (let i = 0; i < 6; i++) {
      const f = helmertFwd(g);
      g = [g[0] + (X - f[0]), g[1] + (Y - f[1]), g[2] + (Z - f[2])];
    }
    return g;
  }

  /* ---- public API ---- */
  function wgs84ToITM(lat, lon) { const r = tmForward(ITM, lat, lon); return { e: r.e, n: r.n }; }
  function itmToWGS84(e, n) { return tmInverse(ITM, e, n); }

  function igToWGS84(e, n) {
    const g = tmInverse(IG, e, n);
    const xyz = helmertFwd(toXYZ(ELL.airy, g.lat, g.lon));
    return toGeodetic(ELL.wgs84, ...xyz);
  }
  function wgs84ToIG(lat, lon) {
    const xyz = helmertInv(toXYZ(ELL.wgs84, lat, lon));
    const g = toGeodetic(ELL.airy, ...xyz);
    const r = tmForward(IG, g.lat, g.lon);
    return { e: r.e, n: r.n };
  }

  /* ---- Irish grid letter references (e.g. O 15904 34671) ---- */
  const LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'; // 25 letters, no I
  function igToRef(e, n, digits = 5) {
    if (e < 0 || e >= 500000 || n < 0 || n >= 500000) return null;
    const col = Math.floor(e / 100000), row = Math.floor(n / 100000);
    const letter = LETTERS[(4 - row) * 5 + col];
    const f = v => String(Math.floor(v % 100000)).padStart(5, '0').slice(0, digits);
    return `${letter} ${f(e)} ${f(n)}`;
  }
  function refToIG(ref) {
    const m = String(ref).toUpperCase().replace(/\s+/g, '').match(/^([A-HJ-Z])(\d+)$/);
    if (!m || m[2].length % 2) return null;
    const idx = LETTERS.indexOf(m[1]), col = idx % 5, row = 4 - Math.floor(idx / 5), h = m[2].length / 2;
    if (h > 5) return null;
    const scale = Math.pow(10, 5 - h);
    return { e: col * 100000 + parseInt(m[2].slice(0, h), 10) * scale + (scale > 1 ? scale / 2 : 0),
             n: row * 100000 + parseInt(m[2].slice(h), 10) * scale + (scale > 1 ? scale / 2 : 0) };
  }

  const api = { wgs84ToITM, itmToWGS84, igToWGS84, wgs84ToIG, igToRef, refToIG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KGIGrid = api;
})(typeof window !== 'undefined' ? window : globalThis);
