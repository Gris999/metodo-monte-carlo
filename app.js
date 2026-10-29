/* Lógica de la interfaz. Los cálculos los hace la API en Python; si no hay conexión
   con el servidor, se usa el motor de respaldo en JavaScript (motor.js). */
(function () {
  const C = { accent: "#4f46e5", amber: "#f59e0b", ink: "#0b1220", green: "#059669" };
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const nf = (v, d = 6) => v == null ? "—" : Number(v).toLocaleString("es", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" });
  const sci = (v) => v == null ? "—" : Number(v).toExponential(2).replace(".", ",");
  const int = (v) => Number(v).toLocaleString("es", { useGrouping: "always" });
  const sub = (i) => String(i).split("").map((c) => "₀₁₂₃₄₅₆₇₈₉"[c]).join("");

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove("show"), 2600);
  }

  class ErrorEntrada extends Error {}
  async function api(url, body) {
    let r;
    try {
      r = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
    } catch (e) {
      throw new TypeError("sin-conexion");
    }
    const esJson = (r.headers.get("content-type") || "").includes("json");
    if (!esJson) throw new TypeError("sin-conexion");  // sitio estático: no hay API
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const d = data.detail;
      throw new ErrorEntrada(typeof d === "string" ? d : "Revise los valores ingresados.");
    }
    return data;
  }

  const almacen = {
    leer(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
    guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  };

  /* --------------------------------------------------------------- páginas */
  const PAGINAS = [["inicio", "Inicio", "Presentación del proyecto"], ["demo", "Demo", "Estimá π lanzando dardos"],
    ["calculadora", "Calculadora", "Integrales con solución paso a paso"],
    ["experimentos", "Experimentos", "Qué pasa al repetir muchas veces"], ["teoria", "Teoría", "Las fórmulas del método"]];
  const alMostrar = {};
  const nextBar = document.createElement("nav");
  nextBar.className = "page-next";
  nextBar.innerHTML = '<div class="wrap"></div>';
  $("main").after(nextBar);

  function ruta() {
    const r = location.hash.startsWith("#/") ? location.hash.slice(2) : "inicio";
    return PAGINAS.some((p) => p[0] === r) ? r : "inicio";
  }
  function irA() {
    if (location.hash && !location.hash.startsWith("#/")) return;
    const r = ruta();
    $$("[data-page]").forEach((s) => s.classList.toggle("visible", s.dataset.page === r));
    $$("[data-route]").forEach((a) => a.classList.toggle("active", a.dataset.route === r));
    const i = PAGINAS.findIndex((p) => p[0] === r);
    const prev = PAGINAS[i - 1], next = PAGINAS[i + 1];
    const tarjeta = (pg, tipo) => `<a class="pn pn-${tipo}" href="#/${pg[0]}">
        <span class="pn-arrow"><svg><use href="#i-arrow"/></svg></span>
        <span class="pn-txt"><small>${tipo === "prev" ? "Anterior" : "Siguiente"}</small><b>${pg[1]}</b><span>${pg[2]}</span></span></a>`;
    nextBar.firstChild.innerHTML = (prev ? tarjeta(prev, "prev") : "<span></span>") + (next ? tarjeta(next, "next") : "<span></span>");
    $(".footer").classList.toggle("hidden", r === "calculadora");
    nextBar.classList.toggle("hidden", r === "calculadora");
    document.title = (r === "inicio" ? "" : PAGINAS[i][1] + " · ") + "Monte Carlo · Integración numérica";
    window.scrollTo(0, 0);
    if (alMostrar[r]) requestAnimationFrame(alMostrar[r]);
  }
  addEventListener("hashchange", irA);

  /* --------------------------------------------------------------- tablero de dardos */
  function board(canvas) {
    const ctx = canvas.getContext("2d");
    const S = canvas.width, pad = S * 0.04, L = S - 2 * pad;
    function base() {
      ctx.clearRect(0, 0, S, S);
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, "#fafbff"); g.addColorStop(1, "#f5f3ff");
      ctx.fillStyle = g; ctx.fillRect(pad, pad, L, L);
      ctx.fillStyle = "rgba(79,70,229,0.07)";
      ctx.beginPath(); ctx.moveTo(pad, pad + L); ctx.arc(pad, pad + L, L, -Math.PI / 2, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(pad + L * i / 4, pad); ctx.lineTo(pad + L * i / 4, pad + L); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pad, pad + L * i / 4); ctx.lineTo(pad + L, pad + L * i / 4); ctx.stroke();
      }
      ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1.5; ctx.strokeRect(pad, pad, L, L);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(pad, pad + L, L, -Math.PI / 2, 0); ctx.stroke();
    }
    function dot(x, y, inside, r) {
      ctx.fillStyle = inside ? C.accent : C.amber;
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(pad + x * L, pad + L - y * L, r, 0, 2 * Math.PI); ctx.fill();
      ctx.globalAlpha = 1;
    }
    base();
    return { base, dot };
  }

  (function hero() {
    const b = board($("#heroCanvas"));
    let n = 0, inn = 0;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    function step() {
      const k = n < 200 ? 2 : 8;
      for (let i = 0; i < k; i++) {
        const x = Math.random(), y = Math.random(), ins = x * x + y * y <= 1;
        n++; if (ins) inn++;
        b.dot(x, y, ins, 3.4);
      }
      $("#heroPi").textContent = nf(4 * inn / n, 4);
      $("#heroN").textContent = int(n);
      if (n >= 2500) { n = 0; inn = 0; b.base(); }
      if (!reduce) requestAnimationFrame(step);
    }
    if (reduce) { for (let i = 0; i < 300; i++) step(); } else requestAnimationFrame(step);
  })();

  /* ilustración: estudiantes, algunos elegidos al azar */
  (function multitud() {
    const svg = $("#crowd");
    const cols = 16, rows = 4, personas = [];
    let html = "";
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = 22 + c * 18.5, h = 0.85 + ((c * 7 + r * 13) % 5) * 0.06, y = 30 + r * 30;
      personas.push(`<g class="p" transform="translate(${x},${y}) scale(${h})"><circle cx="0" cy="-9" r="4.2"/><rect x="-5" y="-4" width="10" height="13" rx="4"/></g>`);
    }
    html = personas.join("");
    svg.innerHTML = `<g fill="#cbd5e1">${html}</g>`;
    const nodos = Array.from(svg.querySelectorAll(".p"));
    function elegir() {
      nodos.forEach((g) => g.setAttribute("fill", "#cbd5e1"));
      const idx = new Set();
      while (idx.size < 9) idx.add(Math.floor(Math.random() * nodos.length));
      idx.forEach((i) => nodos[i].setAttribute("fill", C.accent));
    }
    elegir();
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setInterval(elegir, 2200);
  })();

  /* demo interactiva */
  const demo = { b: board($("#dartCanvas")), n: 0, inn: 0, hist: [], busy: false };
  function demoRender() {
    $("#dTotal").textContent = int(demo.n);
    $("#dIn").textContent = int(demo.inn);
    if (demo.n) {
      const est = 4 * demo.inn / demo.n, e = est - Math.PI;
      $("#dPi").textContent = nf(est, 4);
      $("#dErr").textContent = `π real = 3,14159…  ·  diferencia ${e >= 0 ? "+" : "−"}${nf(Math.abs(e), 4)}`;
    } else {
      $("#dPi").textContent = "—";
      $("#dErr").textContent = "π real = 3,14159…";
    }
    Charts.plot($("#dartChart"), {
      xLog: true, yDomain: [2.4, 4.0], xDomain: [1, Math.max(10, demo.n)], xLabel: "Dardos lanzados",
      series: [{ type: "hline", y: Math.PI, color: C.ink, dash: "5 4", width: 1.2 },
        { type: "line", points: demo.hist, color: C.accent, width: 1.8 }],
      legend: [{ label: "Estimación", color: C.accent }, { label: "π real", color: C.ink, dash: "5 4" }],
    });
  }
  function demoThrow(k) {
    if (demo.busy) return;
    demo.busy = true;
    const r = demo.n + k > 3000 ? 1.6 : 3.6;
    const per = Math.max(1, Math.ceil(k / 30));
    let left = k;
    function frame() {
      const m = Math.min(per, left);
      for (let i = 0; i < m; i++) {
        const x = Math.random(), y = Math.random(), ins = x * x + y * y <= 1;
        demo.n++; if (ins) demo.inn++;
        demo.b.dot(x, y, ins, r);
        const last = demo.hist.length ? demo.hist[demo.hist.length - 1][0] : 0;
        if (demo.n >= last * 1.03 || demo.n < 50) demo.hist.push([demo.n, 4 * demo.inn / demo.n]);
      }
      left -= m;
      demoRender();
      if (left > 0) requestAnimationFrame(frame); else demo.busy = false;
    }
    requestAnimationFrame(frame);
  }
  $$("[data-darts]").forEach((b) => b.addEventListener("click", () => demoThrow(+b.dataset.darts)));
  $("#dReset").addEventListener("click", () => { demo.n = demo.inn = 0; demo.hist = []; demo.b.base(); demoRender(); });
  demoRender();
  alMostrar.demo = demoRender;

  /* --------------------------------------------------------------- calculadora */
  const est = { modo: "caso", caso: "x2", grafica: "area", ultimo: null, seq: 0, offline: false };

  function nDesdeSlider() {
    const v = Math.pow(10, +$("#nSlider").value);
    const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1));
    return Math.max(10, Math.round(v / mag) * mag);
  }
  function pintarSlider() {
    const s = $("#nSlider");
    s.style.setProperty("--p", ((s.value - s.min) / (s.max - s.min)) * 100 + "%");
    $("#nOut").textContent = int(nDesdeSlider());
  }

  function renderCasos(casos) {
    $("#fCaso").innerHTML = casos.map((c, i) => `
      <button type="button" class="case${c.clave === est.caso ? " active" : ""}" data-caso="${c.clave}" role="radio" aria-checked="${c.clave === est.caso}">
        <span class="case-n">${i + 1}</span>
        <span class="case-txt"><b>${c.expresion.replace(/\^(\S+)/, "<sup>$1</sup>")}</b><span>Exacto: ${nf(c.exacto, 6)}</span></span>
      </button>`).join("");
    $$(".case").forEach((b) => b.addEventListener("click", () => {
      est.caso = b.dataset.caso;
      $$(".case").forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-checked", x === b); });
      programar(0);
    }));
  }

  $$(".seg").forEach((s) => s.addEventListener("click", () => {
    est.modo = s.dataset.mode;
    $$(".seg").forEach((x) => x.classList.toggle("active", x === s));
    $("#fCaso").classList.toggle("hidden", est.modo !== "caso");
    $("#fPropia").classList.toggle("hidden", est.modo === "caso");
    programar(0);
  }));

  $$("#keys button").forEach((b) => b.addEventListener("click", () => {
    const inp = $("#expr"), k = b.dataset.k;
    const ini = inp.selectionStart ?? inp.value.length, fin = inp.selectionEnd ?? inp.value.length;
    if (k === "back") {
      const desde = ini === fin ? Math.max(0, ini - 1) : ini;
      inp.value = inp.value.slice(0, desde) + inp.value.slice(fin);
      inp.setSelectionRange(desde, desde);
    } else {
      inp.value = inp.value.slice(0, ini) + k + inp.value.slice(fin);
      inp.setSelectionRange(ini + k.length, ini + k.length);
    }
    inp.focus({ preventScroll: true });
    programar();
  }));

  function leerFuncion() {
    if (est.modo === "caso") return { caso: est.caso };
    const ex = $("#exacto").value.trim();
    return { expresion: $("#expr").value, a: parseFloat($("#a").value), b: parseFloat($("#b").value), exacto: ex === "" ? null : parseFloat(ex) };
  }

  function validar() {
    $$(".ws-side input").forEach((i) => i.classList.remove("invalid"));
    $(".expr-box").classList.remove("invalid");
    const s = Number($("#semilla").value);
    if (!Number.isInteger(s) || s < 0) { $("#semilla").classList.add("invalid"); return "La semilla debe ser un entero no negativo."; }
    if (est.modo === "propia") {
      const a = parseFloat($("#a").value), b = parseFloat($("#b").value);
      if (!$("#expr").value.trim()) { $(".expr-box").classList.add("invalid"); return "Escriba una función de x."; }
      if (!(a < b)) { $("#a").classList.add("invalid"); $("#b").classList.add("invalid"); return "El límite inferior debe ser menor que el superior."; }
      try { Motor.compilar($("#expr").value); } catch (e) { $(".expr-box").classList.add("invalid"); return e.message; }
    }
    return "";
  }

  let temporizador;
  function programar(ms = 180) {
    pintarSlider();
    clearTimeout(temporizador);
    temporizador = setTimeout(calcular, ms);
  }

  async function calcular() {
    const err = validar();
    $("#calcError").textContent = err;
    if (err) return;
    const pedido = { ...leerFuncion(), n: nDesdeSlider(), semilla: Number($("#semilla").value) };
    const id = ++est.seq;
    $("#liveTag").classList.add("busy");
    let d;
    try {
      d = await api("api/estimar", pedido);
    } catch (e) {
      if (e instanceof ErrorEntrada) { if (id === est.seq) { $("#calcError").textContent = e.message; $("#liveTag").classList.remove("busy"); } return; }
      try { d = Motor.estimar(pedido); } catch (e2) { if (id === est.seq) { $("#calcError").textContent = e2.message; $("#liveTag").classList.remove("busy"); } return; }
    }
    if (id !== est.seq) return;
    $("#liveTag").classList.remove("busy");
    est.ultimo = { d, pedido };
    mostrar(d);
  }

  ["#expr", "#a", "#b", "#exacto", "#semilla"].forEach((s) => $(s).addEventListener("input", () => programar(320)));
  $("#nSlider").addEventListener("input", () => programar(140));
  $("#dado").addEventListener("click", () => { $("#semilla").value = Math.floor(Math.random() * 100000); programar(0); });

  $$(".ctab").forEach((t) => t.addEventListener("click", () => {
    est.grafica = t.dataset.chart;
    $$(".ctab").forEach((x) => x.classList.toggle("active", x === t));
    if (est.ultimo) dibujar(est.ultimo.d);
  }));

  function dibujar(d) {
    const r = d.resultado, c = d.caso;
    const area = est.grafica === "area" && d.curva;
    $("#chartSub").textContent = area
      ? "Alturas f(Xᵢ) en puntos al azar y el rectángulo de altura promedio. Su área es la estimación."
      : "Resultado al usar los primeros k puntos. Banda: intervalo de confianza aproximado al 95 %.";
    if (area) {
      const prom = r.estimacion / c.volumen;
      const a = d.curva[0][0], b = d.curva[d.curva.length - 1][0];
      Charts.plot($("#mainChart"), {
        xLabel: "x",
        series: [
          { type: "area", points: d.curva, color: C.accent, opacity: 0.1 },
          { type: "hrect", x0: a, x1: b, y: prom, color: C.amber, opacity: 0.18 },
          { type: "vlines", points: d.muestras, color: C.accent, opacity: 0.25 },
          { type: "scatter", points: d.muestras, color: C.accent, r: 2.2 },
          { type: "line", points: d.curva, color: C.ink, width: 2.2 },
          { type: "hline", y: prom, color: C.amber, width: 2.6 },
        ],
        legend: [{ label: "f(x)", color: C.ink }, { label: "Alturas f(Xᵢ)", color: C.accent, kind: "dot" }, { label: "Altura promedio", color: C.amber }],
      });
      return;
    }
    const conv = d.convergencia.filter((p) => p.k >= 10 && p.est != null);
    const tail = conv.filter((p) => p.k >= Math.min(50, r.n));
    const lo = Math.min(...tail.map((p) => p.inf ?? p.est)), hi = Math.max(...tail.map((p) => p.sup ?? p.est));
    const yd = c.exacto != null ? [Math.min(lo, c.exacto), Math.max(hi, c.exacto)] : [lo, hi];
    const pad = (yd[1] - yd[0]) * 0.1 || 0.1;
    const series = [
      { type: "band", points: conv.filter((p) => p.inf != null).map((p) => [p.k, p.inf, p.sup]), color: C.accent, opacity: 0.14 },
      { type: "line", points: conv.map((p) => [p.k, p.est]), color: C.accent, width: 2 },
    ];
    const leg = [{ label: "Resultado con k puntos", color: C.accent }, { label: "IC 95 %", color: C.accent, kind: "band" }];
    if (c.exacto != null) { series.push({ type: "hline", y: c.exacto, color: C.ink, dash: "5 4", width: 1.3 }); leg.push({ label: "Exacto", color: C.ink, dash: "5 4" }); }
    Charts.plot($("#mainChart"), { xLog: true, xDomain: [10, Math.max(20, conv.length ? conv[conv.length - 1].k : 20)], yDomain: [yd[0] - pad, yd[1] + pad], xLabel: "Cantidad de puntos k", series, legend: leg });
  }

  function mostrar(d) {
    const r = d.resultado, c = d.caso;
    $("#offlineTag").classList.toggle("hidden", !d.offline);
    $("#expFuncion").textContent = c.nombre.replace(/^Caso \d+: /, "");
    $("#rTitulo").textContent = `${c.expresion}  ·  N = ${int(r.n)}  ·  semilla ${r.semilla}`;
    $("#rEst").textContent = nf(r.estimacion, 6);
    $("#rExacto").innerHTML = c.exacto != null ? `Valor exacto <b>${nf(c.exacto, 6)}</b> · ${c.deduccion}` : "Valor exacto desconocido";
    $("#rAbs").textContent = sci(r.error_absoluto);
    $("#rRel").textContent = r.error_relativo == null ? "—" : nf(100 * r.error_relativo, 3) + " %";
    $("#rEE").textContent = sci(r.error_estandar);
    $("#rIC").textContent = `[${nf(r.ic_inferior, 5)} ; ${nf(r.ic_superior, 5)}]` +
      (r.ic_contiene_exacto === true ? "  ✓ contiene el exacto" : r.ic_contiene_exacto === false ? "  ✗ no contiene el exacto" : "");
    $("#rICbox").className = "rchip rchip-wide" + (r.ic_contiene_exacto === true ? " rchip-ok" : r.ic_contiene_exacto === false ? " rchip-no" : "");
    dibujar(d);

    /* solución paso a paso */
    const V = c.volumen, N = r.n, media = r.estimacion / V, suma = media * N;
    const s = r.error_estandar * Math.sqrt(N) / V;
    const p3 = d.pasos.slice(0, 3);
    const dom = d.curva ? `[${nf(d.curva[0][0], 2)} ; ${nf(d.curva[d.curva.length - 1][0], 2)}]` : "[0 ; 1] × [0 ; 1]";
    const xs = p3.map((p) => `X${sub(p.i)} = ${p.x.length === 1 ? nf(p.x[0], 4) : "(" + p.x.map((v) => nf(v, 3)).join("; ") + ")"}`).join("  ·  ");
    const fs = p3.map((p) => `f(X${sub(p.i)}) = ${nf(p.fx, 4)}`).join("  ·  ");
    const pasos = [
      ["Generar puntos al azar", `Se generan ${int(N)} puntos uniformes en ${dom} con la semilla ${r.semilla}.`, `${xs}  ·  …`],
      ["Evaluar la función en cada punto", "Cada valor es la altura de la curva en ese punto.", `${fs}  ·  …`],
      ["Promediar las alturas", "Se suman los valores y se dividen por la cantidad de puntos.", `f̄ = Σ f(Xᵢ) / N = ${nf(suma, 3)} / ${int(N)} = <b>${nf(media, 6)}</b>`],
      ["Multiplicar por el ancho", "El área del rectángulo de altura promedio es la estimación de la integral.", `Î = (b − a) · f̄ = ${nf(V, 4)} × ${nf(media, 6)} = <b>${nf(r.estimacion, 6)}</b>`, true],
      ["Medir la confiabilidad", c.exacto != null
        ? `Error real: ${sci(r.error_absoluto)} (${nf(100 * r.error_relativo, 3)} %). El intervalo ${r.ic_contiene_exacto ? "sí" : "no"} contiene el valor exacto.`
        : "Sin valor exacto, la precisión se mide con el error estándar.",
      `EE = (b − a) · s / √N = ${nf(V, 4)} × ${nf(s, 4)} / √${int(N)} = <b>${nf(r.error_estandar, 6)}</b>  →  IC 95 %: [${nf(r.ic_inferior, 5)} ; ${nf(r.ic_superior, 5)}]`],
    ];
    $("#solSteps").innerHTML = pasos.map(([t, p, m, fin], i) => `
      <li class="sol-step${fin ? " final" : ""}"><span class="sol-n">${i + 1}</span>
        <div><h4>${t}</h4><p>${p}</p><div class="sol-math">${m}</div></div></li>`).join("");

    const dim = c.dimension;
    const cab = dim === 1 ? ["i", "Xᵢ", "f(Xᵢ)", "Resultado acumulado"] : ["i", "xᵢ", "yᵢ", "f(xᵢ, yᵢ)", "Resultado acumulado"];
    $("#pasosTabla").innerHTML = `<thead><tr>${cab.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>` +
      d.pasos.map((p) => `<tr><td>${p.i}</td>${p.x.map((v) => `<td>${nf(v, 4)}</td>`).join("")}<td>${nf(p.fx, 4)}</td><td>${nf(p.acumulado, 4)}</td></tr>`).join("") + "</tbody>";
  }
  alMostrar.calculadora = () => { if (est.ultimo) dibujar(est.ultimo.d); };

  /* historial (estilo workspace) */
  let historial = almacen.leer("mc-historial", []);
  function renderHist() {
    const t = $("#histTabla");
    if (!historial.length) { t.innerHTML = '<tbody><tr class="empty"><td>Todavía no guardaste cálculos.</td></tr></tbody>'; return; }
    t.innerHTML = "<thead><tr><th>Función</th><th>N</th><th>Semilla</th><th>Resultado</th><th>Error estándar</th><th>Error real</th></tr></thead><tbody>" +
      historial.map((h, i) => `<tr data-i="${i}"><td>${h.nombre}${h.offline ? " ·  sin conexión" : ""}</td><td>${int(h.n)}</td><td>${h.pedido.semilla}</td><td>${nf(h.est, 6)}</td><td>${sci(h.ee)}</td><td>${sci(h.abs)}</td></tr>`).join("") + "</tbody>";
    $$("#histTabla tbody tr").forEach((tr) => tr.addEventListener("click", () => restaurar(historial[+tr.dataset.i])));
  }
  function restaurar(h) {
    const p = h.pedido;
    if (p.caso) { $$(".seg")[0].click(); est.caso = p.caso; $$(".case").forEach((x) => x.classList.toggle("active", x.dataset.caso === p.caso)); }
    else { $$(".seg")[1].click(); $("#expr").value = p.expresion; $("#a").value = p.a; $("#b").value = p.b; $("#exacto").value = p.exacto ?? ""; }
    $("#nSlider").value = Math.log10(p.n);
    $("#semilla").value = p.semilla;
    programar(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $("#saveBtn").addEventListener("click", () => {
    if (!est.ultimo) return;
    const { d, pedido } = est.ultimo;
    historial.unshift({ pedido, nombre: d.caso.nombre.replace(/^Caso \d+: /, ""), n: d.resultado.n, est: d.resultado.estimacion,
      ee: d.resultado.error_estandar, abs: d.resultado.error_absoluto, offline: !!d.offline });
    historial = historial.slice(0, 15);
    almacen.guardar("mc-historial", historial);
    renderHist();
    toast("Guardado en el historial");
  });
  $("#histClear").addEventListener("click", () => { historial = []; almacen.guardar("mc-historial", historial); renderHist(); });
  renderHist();

  /* --------------------------------------------------------------- experimentos */
  let csv = { res: "", all: "" }, ultimoExp = null;
  $$("#expChips button").forEach((b) => b.addEventListener("click", () => b.classList.toggle("active")));
  $("#expBtn").addEventListener("click", async () => {
    const tam = $$("#expChips button.active").map((b) => +b.dataset.n);
    const reps = Number($("#reps").value);
    $("#expError").textContent = "";
    if (!tam.length) { $("#expError").textContent = "Elija al menos una cantidad de puntos."; return; }
    if (!Number.isInteger(reps) || reps < 1 || reps > 200) { $("#expError").textContent = "Las repeticiones deben estar entre 1 y 200."; return; }
    const f = est.ultimo ? (({ n, semilla, ...resto }) => resto)(est.ultimo.pedido) : leerFuncion();
    const btn = $("#expBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Ejecutando';
    try {
      const pedido = { ...f, tamanios: tam, repeticiones: reps, semilla: Number($("#semilla").value) || 0 };
      let d;
      try {
        d = await api("api/experimentos", pedido);
      } catch (e) {
        if (e instanceof ErrorEntrada) throw e;
        await new Promise((r) => setTimeout(r, 30));  // deja dibujar el indicador de carga
        d = Motor.experimentos(pedido);
      }
      csv = { res: d.csv_resumen, all: d.csv_completo };
      mostrarExp(d);
    } catch (e) {
      $("#expError").textContent = e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "Ejecutar experimentos";
    }
  });

  const etiqueta = (n) => n >= 1e6 ? n / 1e6 + " M" : n >= 1e3 ? n / 1e3 + " mil" : String(n);
  function mostrarExp(d) {
    ultimoExp = d;
    $("#expOut").classList.remove("hidden");
    const total = d.resumen.length ? d.resumen[0].repeticiones * d.resumen.length : 0;
    $("#expCallout").innerHTML = d.peores != null
      ? `Se hicieron <b>${int(total)}</b> estimaciones. En <b>${d.peores} de ${d.comparaciones}</b> comparaciones, la misma repetición tuvo <b>mayor</b> error al usar más puntos: aumentar N mejora en promedio, no en cada ejecución.`
      : `Se hicieron <b>${int(total)}</b> estimaciones. Sin valor exacto, la precisión se evalúa con el error estándar.`;
    if (d.offline) $("#expCallout").innerHTML += "<br><small>Calculado en el navegador (motor JavaScript); los números de la monografía provienen del núcleo en Python.</small>";
    Charts.boxes($("#boxChart"), {
      boxes: d.cajas.map((b) => ({ ...b, label: etiqueta(b.n) })), color: C.accent, ref: d.exacto,
      xLabel: "Cantidad de puntos N", legend: d.exacto != null ? [{ label: "Valor exacto", color: C.ink, dash: "5 4" }] : null,
    });
    const ns = d.resumen.map((r) => r.n), ee = d.resumen.map((r) => r.media_error_estandar);
    const series = [{ type: "line", points: ns.map((n, i) => [n, ee[i]]), color: C.accent, markers: true }];
    const leg = [{ label: "Error estándar", color: C.accent }];
    if (d.exacto != null) { series.push({ type: "line", points: d.resumen.map((r) => [r.n, r.rmse]), color: C.amber, markers: true }); leg.push({ label: "Error real (RMSE)", color: C.amber }); }
    if (ns.length > 1) { series.push({ type: "line", points: ns.map((n) => [n, ee[0] * Math.sqrt(ns[0] / n)]), color: C.ink, dash: "4 4", width: 1.2 }); leg.push({ label: "−1/2", color: C.ink, dash: "4 4" }); }
    const xd = ns.length > 1 ? [ns[0] / 1.5, ns[ns.length - 1] * 1.5] : [ns[0] / 3, ns[0] * 3];
    Charts.plot($("#errChart"), { xLog: true, yLog: true, xDomain: xd, xLabel: "Cantidad de puntos N", series, legend: leg });
    const cols = [["n", "N", (v) => int(v)], ["media_estimacion", "Media", (v) => nf(v, 5)],
      ["desv_estimaciones", "Desv.", (v) => nf(v, 5)], ["media_error_estandar", "EE medio", (v) => nf(v, 5)]];
    if (d.exacto != null) cols.push(["rmse", "RMSE", (v) => nf(v, 5)], ["media_error_rel", "Error rel.", (v) => v == null ? "—" : nf(100 * v, 3) + " %"], ["cobertura_ic95", "Cobertura IC", (v) => nf(100 * v, 1) + " %"]);
    cols.push(["media_tiempo_s", "Tiempo", (v) => nf(1000 * v, 3) + " ms"]);
    $("#expTabla").innerHTML = `<thead><tr>${cols.map((c) => `<th>${c[1]}</th>`).join("")}</tr></thead><tbody>` +
      d.resumen.map((r) => `<tr>${cols.map((c) => `<td>${c[2](r[c[0]])}</td>`).join("")}</tr>`).join("") + "</tbody>";
  }
  alMostrar.experimentos = () => { if (ultimoExp) mostrarExp(ultimoExp); };

  function descargar(texto, nombre) {
    const url = URL.createObjectURL(new Blob([texto], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("Descargado: " + nombre);
  }
  $("#csvRes").addEventListener("click", () => descargar(csv.res, "resumen_experimento.csv"));
  $("#csvAll").addEventListener("click", () => descargar(csv.all, "experimento_completo.csv"));

  /* --------------------------------------------------------------- PWA */
  let instalar = null;
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); instalar = e; $("#installBtn").classList.remove("hidden"); });
  $("#installBtn").addEventListener("click", async () => {
    if (!instalar) return;
    instalar.prompt();
    await instalar.userChoice.catch(() => null);
    instalar = null;
    $("#installBtn").classList.add("hidden");
  });
  addEventListener("appinstalled", () => toast("App instalada"));
  if ("serviceWorker" in navigator && (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname))) {
    navigator.serviceWorker.register("sw.js").catch(() => { /* sin service worker */ });
  }

  /* --------------------------------------------------------------- inicio */
  pintarSlider();
  api("api/casos").catch(() => Motor.casos()).then((casos) => { renderCasos(casos); calcular(); });

  let rz;
  addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { const f = alMostrar[ruta()]; if (f) f(); }, 200); });
  irA();
})();
