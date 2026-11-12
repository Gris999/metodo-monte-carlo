/* Motor en JavaScript para usar la app sin el servidor en Python (por ejemplo, en
 * GitHub Pages).
 *
 * Implementa el mismo estimador y las mismas medidas de error que el núcleo en Python, y
 * el mismo generador pseudoaleatorio: numpy.random.default_rng(semilla), es decir,
 * SeedSequence + PCG64 (XSL-RR 128/64) y random() = (x >> 11) · 2⁻⁵³. Con la misma
 * semilla produce exactamente los mismos números que NumPy.
 */
(function () {
  const Z95 = 1.959963984540054;

  /* ----------------------------------------------- SeedSequence de NumPy (32 bits) */
  const INIT_A = 0x43b0d7e5, MULT_A = 0x931e8875, INIT_B = 0x8b51f9dd, MULT_B = 0x58f38ded;
  const MIX_MULT_L = 0xca01f9dd, MIX_MULT_R = 0x4973f715, POOL = 4;

  function seedSequenceState(semilla, nWords32) {
    let hc = INIT_A;
    const hashmix = (v) => {
      v = (v ^ hc) >>> 0;
      hc = Math.imul(hc, MULT_A) >>> 0;
      v = Math.imul(v, hc) >>> 0;
      return (v ^ (v >>> 16)) >>> 0;
    };
    const mix = (x, y) => {
      const r = (Math.imul(MIX_MULT_L, x) - Math.imul(MIX_MULT_R, y)) >>> 0;
      return (r ^ (r >>> 16)) >>> 0;
    };
    const entropia = [semilla >>> 0];
    const pool = [];
    for (let i = 0; i < POOL; i++) pool[i] = hashmix(i < entropia.length ? entropia[i] : 0);
    for (let s = 0; s < POOL; s++)
      for (let d = 0; d < POOL; d++)
        if (s !== d) pool[d] = mix(pool[d], hashmix(pool[s]));
    let hb = INIT_B;
    const estado = [];
    for (let i = 0; i < nWords32; i++) {
      let v = (pool[i % POOL] ^ hb) >>> 0;
      hb = Math.imul(hb, MULT_B) >>> 0;
      v = Math.imul(v, hb) >>> 0;
      estado.push((v ^ (v >>> 16)) >>> 0);
    }
    return estado;
  }

  /* ----------------------------------------------- PCG64 con aritmética de 128 bits
     Un número de 128 bits se guarda como 8 dígitos de 16 bits (el primero, el menos
     significativo), para que todos los productos sean exactos en punto flotante. */
  const MULT = aDigitos([0x2360ed05, 0x1fc65da4, 0x4385df64, 0x9fccf645]);

  function aDigitos(w) { // w: 4 palabras de 32 bits, de la más a la menos significativa
    const d = [];
    for (let i = 3; i >= 0; i--) d.push(w[i] & 0xffff, w[i] >>> 16);
    return d;
  }
  function mul(a, b) {
    const r = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 8; i++) {
      if (!a[i]) continue;
      for (let j = 0; i + j < 8; j++) r[i + j] += a[i] * b[j];
    }
    let c = 0;
    for (let k = 0; k < 8; k++) { const t = r[k] + c; r[k] = t % 65536; c = Math.floor(t / 65536); }
    return r;
  }
  function sum(a, b) {
    const r = []; let c = 0;
    for (let k = 0; k < 8; k++) { const t = a[k] + b[k] + c; r[k] = t & 0xffff; c = t >>> 16; }
    return r;
  }

  function pcg64(semilla) {
    const w = seedSequenceState(semilla, 8); // 4 enteros de 64 bits, little endian
    const u64 = (k) => [w[2 * k + 1], w[2 * k]]; // [alto, bajo]
    const initstate = aDigitos([...u64(0), ...u64(1)]);
    const initseq = aDigitos([...u64(2), ...u64(3)]);
    const inc = sum(sum(initseq, initseq), [1, 0, 0, 0, 0, 0, 0, 0]); // (initseq << 1) | 1
    let estado = [0, 0, 0, 0, 0, 0, 0, 0];
    const paso = () => { estado = sum(mul(estado, MULT), inc); };
    paso();
    estado = sum(estado, initstate);
    paso();
    return function () {
      paso();
      const e = estado;
      // XSL-RR: (alto64 XOR bajo64) rotado a la derecha según los 6 bits superiores
      let hi = (((e[7] << 16) | e[6]) ^ ((e[3] << 16) | e[2])) >>> 0;
      let lo = (((e[5] << 16) | e[4]) ^ ((e[1] << 16) | e[0])) >>> 0;
      let rot = e[7] >>> 10;
      if (rot >= 32) { [hi, lo] = [lo, hi]; rot -= 32; }
      if (rot) { const h = hi; hi = ((hi >>> rot) | (lo << (32 - rot))) >>> 0; lo = ((lo >>> rot) | (h << (32 - rot))) >>> 0; }
      return (hi * 2097152 + (lo >>> 11)) / 9007199254740992; // (x >> 11) · 2⁻⁵³
    };
  }

  /* ----------------------------------------------- analizador seguro de expresiones */
  const FUNCS = {
    sin: Math.sin, sen: Math.sin, cos: Math.cos, tan: Math.tan, arcsin: Math.asin,
    arccos: Math.acos, arctan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    exp: Math.exp, log: Math.log, ln: Math.log, log10: Math.log10, sqrt: Math.sqrt, abs: Math.abs,
  };
  const CONST = { pi: Math.PI, e: Math.E };

  function tokenizar(src) {
    const s = src.replace(/\*\*/g, "^").replace(/\s+/g, "");
    const t = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
      if (num) { t.push({ k: "num", v: parseFloat(num[0]) }); i += num[0].length; continue; }
      const id = /^[a-z][a-z0-9]*/i.exec(s.slice(i));
      if (id) { t.push({ k: "id", v: id[0].toLowerCase() }); i += id[0].length; continue; }
      if ("+-*/^()".includes(c)) { t.push({ k: "op", v: c }); i++; continue; }
      throw new Error(`Carácter no permitido: “${c}”.`);
    }
    return t;
  }

  /* Descenso recursivo: expr := term (± term)*, term := unario ((× o ÷) unario)*,
     unario := ± unario | potencia, potencia := atomo (^ unario)? */
  function compilar(src) {
    if (!src || !src.trim()) throw new Error("Escriba una función de x.");
    if (src.length > 200) throw new Error("La expresión no puede superar 200 caracteres.");
    const t = tokenizar(src);
    let p = 0;
    const ver = (v) => t[p] && t[p].v === v;
    function expr() {
      let n = term();
      while (ver("+") || ver("-")) { const o = t[p++].v; const a = n, b = term(); n = o === "+" ? (x) => a(x) + b(x) : (x) => a(x) - b(x); }
      return n;
    }
    function term() {
      let n = unario();
      while (ver("*") || ver("/")) { const o = t[p++].v; const a = n, b = unario(); n = o === "*" ? (x) => a(x) * b(x) : (x) => a(x) / b(x); }
      return n;
    }
    function unario() {
      if (ver("-")) { p++; const a = unario(); return (x) => -a(x); }
      if (ver("+")) { p++; return unario(); }
      return potencia();
    }
    function potencia() {
      const a = atomo();
      if (ver("^")) { p++; const b = unario(); return (x) => Math.pow(a(x), b(x)); }
      return a;
    }
    function atomo() {
      const tk = t[p++];
      if (!tk) throw new Error("La expresión está incompleta.");
      if (tk.k === "num") { const v = tk.v; return () => v; }
      if (tk.k === "id") {
        if (tk.v === "x") return (x) => x;
        if (tk.v in CONST) { const v = CONST[tk.v]; return () => v; }
        if (tk.v in FUNCS) {
          if (!ver("(")) throw new Error(`Falta “(” después de ${tk.v}.`);
          p++; const a = expr();
          if (!ver(")")) throw new Error("Falta cerrar un paréntesis.");
          p++; const f = FUNCS[tk.v]; return (x) => f(a(x));
        }
        throw new Error(`Nombre no permitido: “${tk.v}”. Use la variable x.`);
      }
      if (tk.v === "(") { const a = expr(); if (!ver(")")) throw new Error("Falta cerrar un paréntesis."); p++; return a; }
      throw new Error("La expresión no es válida. Ejemplo: x^2 + sin(x)");
    }
    const f = expr();
    if (p < t.length) throw new Error("La expresión no es válida. Ejemplo: x^2 + sin(x)");
    return f;
  }

  /* ----------------------------------------------- casos documentados */
  const CASOS = {
    x2: { nombre: "Caso 1: x² en [0, 1]", expresion: "∫₀¹ x² dx", f: (x) => x * x, lim: [[0, 1]], exacto: 1 / 3, deduccion: "[x³/3] de 0 a 1 = 1/3" },
    seno: { nombre: "Caso 2: sen(x) en [0, π]", expresion: "∫₀^π sen(x) dx", f: Math.sin, lim: [[0, Math.PI]], exacto: 2, deduccion: "[−cos x] de 0 a π = 1 − (−1) = 2" },
    exp: { nombre: "Caso 3: eˣ en [0, 1]", expresion: "∫₀¹ eˣ dx", f: Math.exp, lim: [[0, 1]], exacto: Math.E - 1, deduccion: "[eˣ] de 0 a 1 = e − 1" },
    pi: { nombre: "Caso 4: 4/(1+x²) en [0, 1]", expresion: "∫₀¹ 4/(1+x²) dx", f: (x) => 4 / (1 + x * x), lim: [[0, 1]], exacto: Math.PI, deduccion: "[4·arctan x] de 0 a 1 = 4·(π/4) = π" },
    plano2d: { nombre: "Caso 5: x²+y² en [0, 1]×[0, 1]", expresion: "∫₀¹∫₀¹ (x²+y²) dy dx", f: (x, y) => x * x + y * y, lim: [[0, 1], [0, 1]], exacto: 2 / 3, deduccion: "∫₀¹ (x² + 1/3) dx = 1/3 + 1/3 = 2/3" },
  };

  function armarCaso(p) {
    if (p.caso) {
      const c = CASOS[p.caso];
      if (!c) throw new Error("Caso desconocido.");
      return { clave: p.caso, ...c };
    }
    const a = Number(p.a), b = Number(p.b);
    if (!isFinite(a) || !isFinite(b)) throw new Error("Los límites deben ser números finitos.");
    if (!(a < b)) throw new Error("El límite inferior debe ser menor que el superior.");
    const f = compilar(p.expresion);
    return { clave: "personalizado", nombre: `f(x) = ${p.expresion} en [${a}, ${b}]`, expresion: `∫ ${p.expresion} dx de ${a} a ${b}`,
      f, lim: [[a, b]], exacto: p.exacto == null || p.exacto === "" ? null : Number(p.exacto), deduccion: "Ingresada por el usuario" };
  }

  function estimar(p) {
    const n = Number(p.n), semilla = Number(p.semilla);
    if (!Number.isInteger(n) || n < 2 || n > 2000000) throw new Error("Sin conexión, N debe estar entre 2 y 2.000.000.");
    if (!Number.isInteger(semilla) || semilla < 0) throw new Error("La semilla debe ser un entero no negativo.");
    const c = armarCaso(p);
    const d = c.lim.length;
    const V = c.lim.reduce((acc, [a, b]) => acc * (b - a), 1);
    const rnd = pcg64(semilla);
    const nGraf = Math.min(n, 200000);
    const idx = new Set();
    for (let i = 0; i < 400; i++) idx.add(Math.max(1, Math.round(Math.pow(nGraf, i / 399))));
    let s = 0, s2 = 0;
    const conv = [], pasos = [], muestras = [];
    for (let i = 1; i <= n; i++) {
      const xs = c.lim.map(([a, b]) => a + (b - a) * rnd());
      const y = c.f(...xs);
      if (!isFinite(y)) throw new Error("La función produjo valores no finitos en la región.");
      s += y; s2 += y * y;
      if (i <= 20) pasos.push({ i, x: xs, fx: y, acumulado: V * s / i });
      if (d === 1 && i <= 300) muestras.push([xs[0], y]);
      if (i <= nGraf && idx.has(i)) {
        const m = s / i;
        const ee = i > 1 ? V * Math.sqrt(Math.max(0, (s2 / i - m * m) * i / (i - 1))) / Math.sqrt(i) : null;
        conv.push({ k: i, est: V * m, inf: ee == null ? null : V * m - Z95 * ee, sup: ee == null ? null : V * m + Z95 * ee });
      }
    }
    const media = s / n;
    const desv = Math.sqrt(Math.max(0, (s2 / n - media * media) * n / (n - 1)));
    const est = V * media, ee = V * desv / Math.sqrt(n);
    const abs = c.exacto == null ? null : Math.abs(est - c.exacto);
    const rel = c.exacto == null || c.exacto === 0 ? null : abs / Math.abs(c.exacto);
    const m20 = pasos.length;
    const y20 = pasos.map((q) => q.fx);
    const suma20 = y20.reduce((a, b) => a + b, 0);
    const media20 = suma20 / m20;
    const desv20 = m20 > 1 ? Math.sqrt(y20.reduce((a, v) => a + (v - media20) ** 2, 0) / (m20 - 1)) : null;
    const out = {
      offline: true,
      caso: { clave: c.clave, nombre: c.nombre, expresion: c.expresion, exacto: c.exacto, deduccion: c.deduccion, dimension: d, volumen: V },
      resultado: { estimacion: est, error_absoluto: abs, error_relativo: rel, error_estandar: ee,
        ic_inferior: est - Z95 * ee, ic_superior: est + Z95 * ee,
        ic_contiene_exacto: c.exacto == null ? null : est - Z95 * ee <= c.exacto && c.exacto <= est + Z95 * ee, n, semilla },
      convergencia: conv, pasos, resumen_pasos: { n: m20, suma: suma20, promedio: media20, desviacion: desv20 },
      curva: null, muestras: null, trapecio: null,
    };
    if (d === 1) {
      const [a, b] = c.lim[0];
      out.curva = Array.from({ length: 240 }, (_, i) => { const x = a + (b - a) * i / 239; const y = c.f(x); return [x, isFinite(y) ? y : null]; });
      out.muestras = muestras;
      const m = Math.min(n, 2000000), h = (b - a) / (m - 1);
      let t = 0;
      for (let i = 0; i < m; i++) t += c.f(a + i * h);
      t = h * (t - 0.5 * (c.f(a) + c.f(b)));
      out.trapecio = { resultado: t, error_absoluto: c.exacto == null ? null : Math.abs(t - c.exacto) };
    }
    return out;
  }

  function casos() {
    return Object.entries(CASOS).map(([clave, c]) => ({ clave, nombre: c.nombre, expresion: c.expresion, exacto: c.exacto, deduccion: c.deduccion, dimension: c.lim.length }));
  }

  /* ----------------------------------------------- experimentos repetidos */
  function estimacionSimple(c, n, semilla) {
    const V = c.lim.reduce((acc, [a, b]) => acc * (b - a), 1);
    const rnd = pcg64(semilla);
    let s = 0, s2 = 0;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      const y = c.f(...c.lim.map(([a, b]) => a + (b - a) * rnd()));
      if (!isFinite(y)) throw new Error("La función produjo valores no finitos en la región.");
      s += y; s2 += y * y;
    }
    const media = s / n;
    const est = V * media;
    const ee = V * Math.sqrt(Math.max(0, (s2 / n - media * media) * n / (n - 1))) / Math.sqrt(n);
    const abs = c.exacto == null ? null : Math.abs(est - c.exacto);
    return {
      estimacion: est, error_estandar: ee, error_absoluto: abs,
      error_relativo: abs == null || c.exacto === 0 ? null : abs / Math.abs(c.exacto),
      ic_inferior: est - Z95 * ee, ic_superior: est + Z95 * ee,
      ic_contiene_exacto: c.exacto == null ? null : est - Z95 * ee <= c.exacto && c.exacto <= est + Z95 * ee,
      tiempo_s: (performance.now() - t0) / 1000,
    };
  }

  const media = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  const desv = (v) => { const m = media(v); return v.length > 1 ? Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (v.length - 1)) : null; };
  function percentil(orden, q) {
    const h = (orden.length - 1) * q, i = Math.floor(h);
    return orden[i] + (orden[Math.min(i + 1, orden.length - 1)] - orden[i]) * (h - i);
  }
  const csvLinea = (v) => v.map((x) => x == null ? "" : String(x)).join(",");

  function experimentos(p) {
    const c = armarCaso(p);
    const ns = [...new Set(p.tamanios)].sort((a, b) => a - b);
    const reps = Number(p.repeticiones), base = Number(p.semilla) || 0;
    if (!ns.length) throw new Error("Elija al menos una cantidad de puntos.");
    if (!Number.isInteger(reps) || reps < 1 || reps > 200) throw new Error("Las repeticiones deben estar entre 1 y 200.");
    if (ns.reduce((a, n) => a + n, 0) * reps > 50000000)
      throw new Error("Demasiados cálculos para el navegador: reduzca las repeticiones o quite 1 millón de puntos.");
    const filas = [];
    for (const n of ns) for (let r = 1; r <= reps; r++) {
      const e = estimacionSimple(c, n, base + r - 1);
      filas.push({ caso: c.clave, n, repeticion: r, semilla: base + r - 1, ...e, valor_exacto: c.exacto });
    }
    const resumen = ns.map((n) => {
      const g = filas.filter((f) => f.n === n), est = g.map((f) => f.estimacion);
      const fila = {
        caso: c.clave, n, repeticiones: g.length, media_estimacion: media(est), desv_estimaciones: desv(est),
        min_estimacion: Math.min(...est), max_estimacion: Math.max(...est),
        media_error_estandar: media(g.map((f) => f.error_estandar)), media_tiempo_s: media(g.map((f) => f.tiempo_s)),
        media_error_abs: null, max_error_abs: null, media_error_rel: null, cobertura_ic95: null, rmse: null,
      };
      if (c.exacto != null) {
        const ab = g.map((f) => f.error_absoluto);
        Object.assign(fila, {
          media_error_abs: media(ab), max_error_abs: Math.max(...ab),
          media_error_rel: c.exacto === 0 ? null : media(g.map((f) => f.error_relativo)),
          cobertura_ic95: media(g.map((f) => f.ic_contiene_exacto ? 1 : 0)),
          rmse: Math.sqrt(media(g.map((f) => (f.estimacion - c.exacto) ** 2))),
        });
      }
      return fila;
    });
    const cajas = ns.map((n) => {
      const o = filas.filter((f) => f.n === n).map((f) => f.estimacion).sort((a, b) => a - b);
      return { n, min: o[0], q1: percentil(o, 0.25), mediana: percentil(o, 0.5), q3: percentil(o, 0.75), max: o[o.length - 1] };
    });
    let peores = null, comparaciones = null;
    if (c.exacto != null && ns.length > 1) {
      peores = 0;
      for (let i = 0; i + 1 < ns.length; i++) for (let r = 1; r <= reps; r++) {
        const a = filas.find((f) => f.n === ns[i] && f.repeticion === r), b = filas.find((f) => f.n === ns[i + 1] && f.repeticion === r);
        if (b.error_absoluto > a.error_absoluto) peores++;
      }
      comparaciones = reps * (ns.length - 1);
    }
    const colsF = ["caso", "n", "repeticion", "semilla", "estimacion", "valor_exacto", "error_absoluto", "error_relativo",
      "error_estandar", "ic_inferior", "ic_superior", "ic_contiene_exacto", "tiempo_s"];
    const colsR = Object.keys(resumen[0]);
    return {
      offline: true, resumen, cajas, peores, comparaciones, exacto: c.exacto,
      csv_completo: [colsF.join(","), ...filas.map((f) => csvLinea(colsF.map((k) => f[k])))].join("\n"),
      csv_resumen: [colsR.join(","), ...resumen.map((f) => csvLinea(colsR.map((k) => f[k])))].join("\n"),
    };
  }

  window.Motor = { estimar, casos, compilar, experimentos };
})();
