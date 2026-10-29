/* Gráficas SVG mínimas, sin dependencias externas. */
(function () {
  const NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function niceTicks(min, max, count = 5) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const step0 = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const err = step0 / mag;
    const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
    const t = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) t.push(+v.toPrecision(12));
    return t;
  }

  function logTicks(min, max) {
    const t = [];
    for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
      const v = Math.pow(10, e);
      if (v >= min * 0.999 && v <= max * 1.001) t.push(v);
    }
    return t;
  }

  function fmtTick(v, log) {
    if (log) {
      const e = Math.round(Math.log10(v));
      if (e >= 3 && e < 6) return (v / 1e3).toLocaleString("es") + " mil";
      if (e >= 6) return (v / 1e6).toLocaleString("es") + " M";
      if (e < -2) return "10" + toSup(e);
      return v.toLocaleString("es");
    }
    const a = Math.abs(v);
    if (a !== 0 && (a < 1e-3 || a >= 1e5)) return v.toExponential(1).replace(".", ",");
    return v.toLocaleString("es", { maximumFractionDigits: 4, useGrouping: "always" });
  }

  function toSup(n) {
    const m = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
    return String(n).split("").map((c) => m[c]).join("");
  }

  function frame(svg, opts) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const W = svg.clientWidth || 600;
    const H = svg.clientHeight || 280;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const m = { t: opts.legend ? 30 : 10, r: 14, b: opts.xLabel ? 42 : 26, l: 58 };
    return { W, H, m, iw: W - m.l - m.r, ih: H - m.t - m.b };
  }

  function legend(svg, items, W) {
    const g = el("g", { class: "legend" }, svg);
    let x = 0;
    const parts = items.map((it) => {
      const gi = el("g", {}, g);
      if (it.kind === "band") el("rect", { x: 0, y: -6, width: 14, height: 10, rx: 2, fill: it.color, opacity: 0.22 }, gi);
      else if (it.kind === "dot") el("circle", { cx: 7, cy: -1, r: 4, fill: it.color }, gi);
      else el("line", { x1: 0, x2: 14, y1: -1, y2: -1, stroke: it.color, "stroke-width": 2.2, "stroke-dasharray": it.dash || "" }, gi);
      const t = el("text", { x: 19, y: 3 }, gi);
      t.textContent = it.label;
      return gi;
    });
    requestAnimationFrame(() => {
      parts.forEach((gi) => {
        gi.setAttribute("transform", `translate(${x},0)`);
        x += gi.getBBox().width + 18;
      });
      g.setAttribute("transform", `translate(${Math.max(0, W - x - 4)},12)`);
    });
  }

  /** Gráfica de líneas/bandas/puntos con ejes lineales o logarítmicos. */
  function plot(svg, opts) {
    const f = frame(svg, opts);
    const xs = [], ys = [];
    opts.series.forEach((s) => {
      if (s.type === "hline") { ys.push(s.y); return; }
      if (s.type === "hrect") { xs.push(s.x0, s.x1); ys.push(0, s.y); return; }
      (s.points || []).forEach((p) => {
        if (p[1] == null) return;
        xs.push(p[0]);
        if (s.type === "band") ys.push(p[1], p[2]); else ys.push(p[1]);
        if (s.type === "area" || s.type === "vlines") ys.push(0);
      });
    });
    let [x0, x1] = opts.xDomain || [Math.min(...xs), Math.max(...xs)];
    let [y0, y1] = opts.yDomain || [Math.min(...ys), Math.max(...ys)];
    if (!opts.yDomain && !opts.yLog) { const pad = (y1 - y0 || Math.abs(y1) || 1) * 0.08; y0 -= pad; y1 += pad; }
    if (opts.yLog) { y0 *= 0.8; y1 *= 1.25; }
    const sx = opts.xLog
      ? (v) => f.m.l + (Math.log10(v) - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0)) * f.iw
      : (v) => f.m.l + (v - x0) / (x1 - x0 || 1) * f.iw;
    const sy = opts.yLog
      ? (v) => f.m.t + f.ih - (Math.log10(v) - Math.log10(y0)) / (Math.log10(y1) - Math.log10(y0)) * f.ih
      : (v) => f.m.t + f.ih - (v - y0) / (y1 - y0 || 1) * f.ih;

    const grid = el("g", { class: "grid" }, svg);
    const axis = el("g", { class: "axis" }, svg);
    const yt = opts.yLog ? logTicks(y0, y1) : niceTicks(y0, y1, Math.max(3, Math.round(f.ih / 48)));
    yt.forEach((v) => {
      el("line", { x1: f.m.l, x2: f.m.l + f.iw, y1: sy(v), y2: sy(v) }, grid);
      const t = el("text", { x: f.m.l - 8, y: sy(v) + 4, "text-anchor": "end" }, axis);
      t.textContent = fmtTick(v, opts.yLog);
    });
    const xt = opts.xLog ? logTicks(x0, x1) : niceTicks(x0, x1, Math.max(3, Math.round(f.iw / 90)));
    xt.forEach((v) => {
      const t = el("text", { x: sx(v), y: f.m.t + f.ih + 18, "text-anchor": "middle" }, axis);
      t.textContent = fmtTick(v, opts.xLog);
    });
    el("line", { x1: f.m.l, x2: f.m.l + f.iw, y1: f.m.t + f.ih, y2: f.m.t + f.ih }, axis);
    if (opts.xLabel) {
      const t = el("text", { x: f.m.l + f.iw / 2, y: f.H - 6, "text-anchor": "middle" }, axis);
      t.textContent = opts.xLabel;
    }

    const clipId = "c" + Math.random().toString(36).slice(2);
    const defs = el("defs", {}, svg);
    const cp = el("clipPath", { id: clipId }, defs);
    el("rect", { x: f.m.l, y: f.m.t, width: f.iw, height: f.ih }, cp);
    const body = el("g", { "clip-path": `url(#${clipId})` }, svg);
    const yBase = sy(opts.yLog ? y0 : Math.max(y0, Math.min(0, y1)));

    opts.series.forEach((s) => {
      const pts = (s.points || []).filter((p) => p[1] != null && (!opts.xLog || p[0] > 0));
      if (s.type !== "hline" && s.type !== "hrect" && !pts.length) return;
      if (s.type === "line") {
        el("path", { d: "M" + pts.map((p) => `${sx(p[0])},${sy(p[1])}`).join("L"), fill: "none",
          stroke: s.color, "stroke-width": s.width || 2, "stroke-dasharray": s.dash || "",
          "stroke-linejoin": "round" }, body);
        if (s.markers) pts.forEach((p) => el("circle", { cx: sx(p[0]), cy: sy(p[1]), r: 3.5, fill: "#fff", stroke: s.color, "stroke-width": 2 }, body));
      } else if (s.type === "band") {
        const up = pts.map((p) => `${sx(p[0])},${sy(p[2])}`);
        const lo = pts.slice().reverse().map((p) => `${sx(p[0])},${sy(p[1])}`);
        el("path", { d: "M" + up.join("L") + "L" + lo.join("L") + "Z", fill: s.color, opacity: s.opacity || 0.16 }, body);
      } else if (s.type === "area") {
        const d = `M${sx(pts[0][0])},${yBase}L` + pts.map((p) => `${sx(p[0])},${sy(p[1])}`).join("L") + `L${sx(pts[pts.length - 1][0])},${yBase}Z`;
        el("path", { d, fill: s.color, opacity: s.opacity || 0.12 }, body);
      } else if (s.type === "vlines") {
        pts.forEach((p) => el("line", { x1: sx(p[0]), x2: sx(p[0]), y1: yBase, y2: sy(p[1]), stroke: s.color, "stroke-width": 1, opacity: s.opacity || 0.35 }, body));
      } else if (s.type === "scatter") {
        pts.forEach((p) => el("circle", { cx: sx(p[0]), cy: sy(p[1]), r: s.r || 2.5, fill: s.color, opacity: s.opacity || 0.8 }, body));
      } else if (s.type === "hline") {
        el("line", { x1: f.m.l, x2: f.m.l + f.iw, y1: sy(s.y), y2: sy(s.y), stroke: s.color, "stroke-width": s.width || 1.5, "stroke-dasharray": s.dash || "" }, body);
      } else if (s.type === "hrect") {
        el("rect", { x: sx(s.x0), width: sx(s.x1) - sx(s.x0), y: sy(s.y), height: Math.max(0, yBase - sy(s.y)), fill: s.color, opacity: s.opacity || 0.15 }, body);
      }
    });
    if (opts.legend) legend(svg, opts.legend, f.W);
  }

  /** Diagrama de cajas por categoría. */
  function boxes(svg, opts) {
    const f = frame(svg, opts);
    const vals = opts.boxes.flatMap((b) => [b.min, b.max]);
    if (opts.ref != null) vals.push(opts.ref);
    let y0 = Math.min(...vals), y1 = Math.max(...vals);
    const pad = (y1 - y0 || 1) * 0.08; y0 -= pad; y1 += pad;
    const sy = (v) => f.m.t + f.ih - (v - y0) / (y1 - y0) * f.ih;
    const grid = el("g", { class: "grid" }, svg);
    const axis = el("g", { class: "axis" }, svg);
    niceTicks(y0, y1, 5).forEach((v) => {
      el("line", { x1: f.m.l, x2: f.m.l + f.iw, y1: sy(v), y2: sy(v) }, grid);
      el("text", { x: f.m.l - 8, y: sy(v) + 4, "text-anchor": "end" }, axis).textContent = fmtTick(v);
    });
    const bw = f.iw / opts.boxes.length;
    opts.boxes.forEach((b, i) => {
      const cx = f.m.l + bw * (i + 0.5), w = Math.min(46, bw * 0.45);
      el("line", { x1: cx, x2: cx, y1: sy(b.max), y2: sy(b.min), stroke: opts.color, "stroke-width": 1.4 }, svg);
      [b.min, b.max].forEach((v) => el("line", { x1: cx - w / 4, x2: cx + w / 4, y1: sy(v), y2: sy(v), stroke: opts.color, "stroke-width": 1.4 }, svg));
      el("rect", { x: cx - w / 2, y: sy(b.q3), width: w, height: Math.max(1.5, sy(b.q1) - sy(b.q3)), rx: 4, fill: "#eef2ff", stroke: opts.color, "stroke-width": 1.4 }, svg);
      el("line", { x1: cx - w / 2, x2: cx + w / 2, y1: sy(b.mediana), y2: sy(b.mediana), stroke: opts.color, "stroke-width": 2.4 }, svg);
      el("text", { x: cx, y: f.m.t + f.ih + 18, "text-anchor": "middle" }, axis).textContent = b.label;
    });
    el("line", { x1: f.m.l, x2: f.m.l + f.iw, y1: f.m.t + f.ih, y2: f.m.t + f.ih }, axis);
    if (opts.xLabel) el("text", { x: f.m.l + f.iw / 2, y: f.H - 6, "text-anchor": "middle" }, axis).textContent = opts.xLabel;
    if (opts.ref != null) el("line", { x1: f.m.l, x2: f.m.l + f.iw, y1: sy(opts.ref), y2: sy(opts.ref), stroke: "#0b1220", "stroke-dasharray": "5 4", "stroke-width": 1.3 }, svg);
    if (opts.legend) legend(svg, opts.legend, f.W);
  }

  window.Charts = { plot, boxes };
})();
