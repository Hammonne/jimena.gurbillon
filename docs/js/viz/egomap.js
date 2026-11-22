/* "Mapa de mí": la portada. Grafo ego con Jimena al centro, un nodo grande por sección
   y una nube de satélites con su contenido real (data/sitemap.json).
   - Al cargar, las ramas crecen desde el centro; después se mueve lento y orgánico.
   - Hover/foco en una sección: se ilumina su cluster y aparece una línea de descripción.
   - Modo "mini": el grafo se encoge a una banda de navegación con la sección activa resaltada.
   Las etiquetas no se pisan: se miden en ES y EN y una fuerza de colisión de cajas las separa. */
import { reduce, showTip, hideTip, onRedraw } from '../core.js';
import { lang, t } from '../i18n.js';

const FS_HUB = 15, FS_SAT = 12, FS_MINI = 13;
const LH_HUB = 19, LH_SAT = 15, LH_MINI = 17;
const F = (w, s) => `${w} ${s}px Inter`;
const GAP = 4, HUB_M = 10, ORBIT = 58, HM = 150;
const PAD = 9;   // separación mínima entre cajas: cubre el vaivén del movimiento orgánico
const GROW_MS = 750;

const mctx = document.createElement('canvas').getContext('2d');
const measure = (s, font) => { mctx.font = font; return mctx.measureText(s).width; };
function wrap(text, font, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const s = cur ? cur + ' ' + w : w; if (cur && measure(s, font) > maxW) { lines.push(cur); cur = w; } else cur = s; }
  lines.push(cur);
  return { lines, w: Math.max(...lines.map((l) => measure(l, font))) };
}
const lerp = (a, b, k) => a + (b - a) * k;
const c01 = (v) => Math.max(0, Math.min(1, v));
const ease = d3.easeCubicOut;

export async function initEgoMap(data, { onOpen }) {
  if (document.fonts) await Promise.all([F(600, FS_HUB), F(500, FS_SAT), F(600, FS_MINI), F(700, FS_MINI), F(700, 13)].map((f) => document.fonts.load(f))).catch(() => {});
  const svg = d3.select('#egomap');
  const S = data.sections;
  const K = S.length;
  const st = { k: 0, active: null, hover: null, animating: false, g0: performance.now(), grown: reduce };
  let L = null, timer = null, el = null;

  /* ================= layout ================= */
  function computeLayout() {
    const W = Math.round(svg.node().parentNode.getBoundingClientRect().width) || 1000;
    const narrow = W < 640;
    // "a pantalla casi completa": el alto que queda debajo de la intro (con un mínimo y un máximo)
    const top = document.body.classList.contains('in-section') ? 64 + 200 : svg.node().getBoundingClientRect().top + scrollY;
    const H = narrow ? 560 : Math.round(Math.max(580, Math.min(820, innerHeight - top - 12)));
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const maxHubW = narrow ? 118 : 190, maxSatW = 150;
    const labelOf = (o, font, lh, fs, maxW) => { const es = wrap(o.es, font, maxW), en = wrap(o.en, font, maxW); return { es, en, bw: Math.max(es.w, en.w) + 2, bh: Math.max(es.lines.length, en.lines.length) * lh, lh, fs }; };
    const ego = { kind: 'ego', id: '__ego', c: -1, r: 10, x: W / 2, y: H / 2, fx: W / 2, fy: H / 2 };
    const nodes = [ego], hubs = [], sats = [], byId = new Map();
    const centers = S.map((_, i) => { const a = i / K * 2 * Math.PI - Math.PI / 2; return narrow ? [W / 2 + Math.cos(a) * W * .3, H / 2 + Math.sin(a) * H * .36] : [W / 2 + Math.cos(a) * W * .37, H / 2 + Math.sin(a) * H * .36]; });
    S.forEach((s, i) => {
      const [cx, cy] = centers[i];
      const hub = { kind: 'hub', id: s.id, c: i, r: 13, x: cx, y: cy, sats: [], lab: labelOf(s, F(600, FS_HUB), LH_HUB, FS_HUB, maxHubW), phase: rnd() * 6.28 };
      nodes.push(hub); hubs.push(hub); hub.nodes = [hub];
      if (!narrow) s.satellites.forEach((sat, k) => {
        const a = k / s.satellites.length * 2 * Math.PI;
        const n = { kind: 'sat', id: sat.id, c: i, r: 4 + rnd() * 2, ang: a - Math.PI / 2, x: cx + Math.cos(a - Math.PI / 2) * ORBIT, y: cy + Math.sin(a - Math.PI / 2) * ORBIT, hubNode: hub, label: { es: sat.es, en: sat.en }, lab: labelOf(sat, F(500, FS_SAT), LH_SAT, FS_SAT, maxSatW), phase: rnd() * 6.28, delay: rnd() };
        nodes.push(n); sats.push(n); hub.sats.push(n); hub.nodes.push(n); byId.set(n.id, n);
      });
    });
    const links = [];
    hubs.forEach((h) => { links.push({ source: ego, target: h, kind: 'e' }); h.sats.forEach((n) => links.push({ source: h, target: n, kind: 's' })); });
    (data.links || []).forEach(([a, b]) => { const A = byId.get(a), B = byId.get(b); if (A && B) links.push({ source: A, target: B, kind: 'w' }); });

    /* --- colocación de etiquetas (igual que en "How it all connects") --- */
    const egoW = measure('Jimena', F(700, 13));
    const egoRect = () => [W / 2 - egoW / 2, H / 2 + 14, W / 2 + egoW / 2, H / 2 + 31];
    function placeSat(n) {
      const h = n.hubNode; let ux = n.x - h.x, uy = n.y - h.y; const m = Math.hypot(ux, uy) || 1; ux /= m; uy /= m;
      const { bw, bh } = n.lab, d = n.r + GAP; let anchor, px, py, x0, y0, mode;
      if (Math.abs(ux) > .38) { anchor = ux > 0 ? 'start' : 'end'; px = n.x + Math.sign(ux) * d; py = n.y + uy * d; x0 = ux > 0 ? px : px - bw; mode = 'mid'; y0 = py + uy * bh * .3 - bh / 2; }
      else { anchor = 'middle'; px = n.x + ux * d; py = n.y + Math.sign(uy || 1) * d; x0 = px - bw / 2; mode = uy < 0 ? 'up' : 'down'; y0 = uy < 0 ? py - bh : py; }
      n.pl = { anchor, px, mode, yc: y0 + bh / 2, y0, y1: y0 + bh, rect: [x0, y0, x0 + bw, y0 + bh] };
    }
    function placeHub(h) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of h.nodes) { x0 = Math.min(x0, n.x - n.r); y0 = Math.min(y0, n.y - n.r); x1 = Math.max(x1, n.x + n.r); y1 = Math.max(y1, n.y + n.r); }
      const { bw, bh } = h.lab, dx = ((x0 + x1) / 2 - W / 2) / W, dy = ((y0 + y1) / 2 - H / 2) / H;
      let anchor, px, rx0, ry0, mode;
      if (!narrow && Math.abs(dx) > Math.abs(dy)) { mode = 'mid'; ry0 = h.y - bh / 2; if (dx > 0) { anchor = 'start'; px = x1 + HUB_M; rx0 = px; } else { anchor = 'end'; px = x0 - HUB_M; rx0 = px - bw; } }
      else { anchor = 'middle'; px = h.x; rx0 = px - bw / 2; if (dy < 0) { mode = 'up'; ry0 = y0 - HUB_M - bh; } else { mode = 'down'; ry0 = y1 + HUB_M; } }
      for (const n of h.sats) {   // si choca con un tema propio, se aleja más hacia afuera
        const r = n.pl.rect;
        if (mode === 'up' && r[0] < rx0 + bw + PAD && r[2] > rx0 - PAD && r[1] < ry0 + bh + PAD) ry0 = Math.min(ry0, r[1] - PAD - bh);
        if (mode === 'down' && r[0] < rx0 + bw + PAD && r[2] > rx0 - PAD && r[3] > ry0 - PAD) ry0 = Math.max(ry0, r[3] + PAD);
        if (mode === 'mid' && r[1] < ry0 + bh + PAD && r[3] > ry0 - PAD) {
          if (anchor === 'start' && r[2] > rx0 - PAD) { rx0 = Math.max(rx0, r[2] + PAD); px = rx0; }
          if (anchor === 'end' && r[0] < rx0 + bw + PAD) { rx0 = Math.min(rx0, r[0] - PAD - bw); px = rx0 + bw; }
        }
      }
      h.pl = { anchor, px, mode, yc: ry0 + bh / 2, y0: ry0, y1: ry0 + bh, rect: [rx0, ry0, rx0 + bw, ry0 + bh] };
    }
    const placeAll = () => { sats.forEach(placeSat); hubs.forEach(placeHub); };
    function items() {
      const it = [];
      for (const n of nodes) it.push({ k: 'node', c: n.c, r: [n.x - n.r, n.y - n.r, n.x + n.r, n.y + n.r], own: n.kind === 'ego' ? [] : [n], src: n });
      for (const n of sats) it.push({ k: 'tl', c: n.c, r: n.pl.rect, own: [n], src: n });
      for (const h of hubs) it.push({ k: 'hl', c: h.c, r: h.pl.rect, own: h.nodes, src: h });
      it.push({ k: 'el', c: -1, r: egoRect(), own: [], src: ego });
      return it;
    }
    function relevant(a, b) {
      if (a.k === 'node' && b.k === 'node') return false;
      if (a.src === b.src) return false;
      if (a.k === 'tl' && b.k === 'tl' && a.c !== b.c) return false;   // los satélites de dos secciones nunca se rotulan a la vez
      if ((a.k === 'hl' && b.c === a.c) || (b.k === 'hl' && a.c === b.c)) return false;
      if ((a.k === 'el' && b.src === ego) || (b.k === 'el' && a.src === ego)) return false;
      return true;
    }
    function rectForce() {
      placeAll();
      const it = items();
      for (let i = 0; i < it.length; i++) for (let j = i + 1; j < it.length; j++) {
        const a = it[i], b = it[j]; if (!relevant(a, b)) continue;
        const ox = Math.min(a.r[2], b.r[2]) - Math.max(a.r[0], b.r[0]) + PAD, oy = Math.min(a.r[3], b.r[3]) - Math.max(a.r[1], b.r[1]) + PAD;
        if (ox <= 0 || oy <= 0) continue;
        const sx = (a.r[0] + a.r[2]) < (b.r[0] + b.r[2]) ? -1 : 1, sy = (a.r[1] + a.r[3]) < (b.r[1] + b.r[3]) ? -1 : 1;
        const wa = a.own.length ? (b.own.length ? .5 : 1) : 0, wb = 1 - wa;
        const [dx, dy] = ox < oy ? [Math.min(ox * .3, 6) * sx, 0] : [0, Math.min(oy * .3, 6) * sy];
        for (const n of a.own) { n.vx += dx * wa; n.vy += dy * wa; }
        for (const n of b.own) { n.vx -= dx * wb; n.vy -= dy * wb; }
      }
      for (const a of it) {
        const m = 8, [x0, y0, x1, y1] = a.r, px = x0 < m ? m - x0 : x1 > W - m ? W - m - x1 : 0, py = y0 < m ? m - y0 : y1 > H - m ? H - m - y1 : 0;
        if (px || py) for (const n of a.own) { n.vx += px * .1; n.vy += py * .1; }
      }
    }
    function orbit(alpha) { for (const n of sats) { const h = n.hubNode; n.vx += (h.x + Math.cos(n.ang) * ORBIT - n.x) * .5 * alpha; n.vy += (h.y + Math.sin(n.ang) * ORBIT - n.y) * .5 * alpha; } }
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).distance((l) => l.kind === 'e' ? 200 : l.kind === 'w' ? 260 : ORBIT).strength((l) => l.kind === 'e' ? .03 : l.kind === 'w' ? .004 : .5))
      .force('charge', d3.forceManyBody().strength((d) => d.kind === 'hub' ? -300 : -40).distanceMax(240))
      .force('x', d3.forceX((d) => d.kind === 'ego' ? W / 2 : centers[d.c][0]).strength((d) => d.kind === 'sat' ? 0 : .14))
      .force('y', d3.forceY((d) => d.kind === 'ego' ? H / 2 : centers[d.c][1]).strength((d) => d.kind === 'sat' ? 0 : .14))
      .force('orbit', orbit).force('col', d3.forceCollide((d) => d.r + 6)).force('rect', rectForce).stop();
    for (let i = 0; i < 700; i++) sim.tick();
    placeAll();
    nodes.forEach((n) => { n.hx = n.x; n.hy = n.y; });

    /* --- modo mini (escritorio): banda de HM px, secciones en zigzag, Jimena a la izquierda --- */
    const step = (W - 170) / (K - 1);
    ego.mx = 36; ego.my = HM / 2;
    hubs.forEach((h, i) => {
      h.mx = 130 + i * step; h.my = i % 2 ? HM * .66 : HM * .34;
      const lab = labelOf(S[i], F(700, FS_MINI), LH_MINI, FS_MINI, 2 * step - 18), up = i % 2 === 0;
      const y0 = up ? h.my - 8 - 6 - lab.bh : h.my + 8 + 6;
      const px = Math.max(lab.bw / 2 + 4, Math.min(W - lab.bw / 2 - 4, h.mx));   // que no se salga por los bordes
      h.mlab = lab; h.mpl = { anchor: 'middle', px, mode: up ? 'up' : 'down', yc: y0 + lab.bh / 2, y0, y1: y0 + lab.bh, rect: [px - lab.bw / 2, y0, px + lab.bw / 2, y0 + lab.bh] };
    });
    sats.forEach((n) => { n.mx = n.hubNode.mx; n.my = n.hubNode.my; });
    // crecimiento: primero las secciones desde el centro, después sus satélites desde su sección
    hubs.forEach((h, i) => { h.gDelay = i * 70; });
    sats.forEach((n) => { n.gDelay = 380 + n.c * 70 + n.delay * 260; });
    return { W, H, narrow, nodes, hubs, sats, ego, links };
  }

  /* ================= dibujo ================= */
  function render() {
    svg.selectAll('*').remove();
    const gl = svg.append('g').attr('fill', 'none');
    const lk = gl.selectAll('path').data(L.links).join('path')
      .style('stroke', (d) => d.kind === 'w' ? 'var(--muted)' : `var(${S[d.target.c].color})`).attr('stroke-width', (d) => d.kind === 'e' ? 1.3 : d.kind === 'w' ? .8 : 1);
    const sat = svg.append('g').selectAll('circle').data(L.sats).join('circle').attr('class', 'sat').style('fill', (d) => `var(${S[d.c].color})`).style('cursor', 'pointer');
    const egoC = svg.append('circle').style('fill', 'var(--text)');
    const hub = svg.append('g').selectAll('g').data(L.hubs).join('g').attr('class', 'hub').attr('tabindex', 0).attr('role', 'link').style('cursor', 'pointer').style('outline', 'none');
    hub.append('circle').attr('class', 'hit').attr('r', 24).style('fill', 'transparent');
    const hubC = hub.append('circle').attr('class', 'dot').style('fill', (d) => `var(${S[d.c].color})`).style('stroke', 'var(--bg)').attr('stroke-width', 2);
    const ring = hub.append('circle').attr('class', 'ring').style('fill', 'none').style('stroke', (d) => `var(${S[d.c].color})`).attr('stroke-width', 1.5).style('pointer-events', 'none');
    const lb = svg.append('g').style('pointer-events', 'none');
    const egoL = lb.append('text').attr('text-anchor', 'middle').style('fill', 'var(--text)').style('font', '700 13px var(--font)').text('Jimena');
    const hubL = lb.selectAll('text.h').data(L.hubs).join('text').attr('class', 'h').style('fill', 'var(--text)').style('font', `600 ${FS_HUB}px var(--font)`);
    const satL = lb.selectAll('text.s').data(L.sats).join('text').attr('class', 's').style('fill', 'var(--text)').style('font', `500 ${FS_SAT}px var(--font)`);
    const miniL = lb.selectAll('text.m').data(L.narrow ? [] : L.hubs).join('text').attr('class', 'm').style('font', `600 ${FS_MINI}px var(--font)`);
    el = { lk, sat, egoC, hub, hubC, ring, egoL, hubL, satL, miniL };
    setText();
    bind();
  }
  function setText() {
    const lines = (key) => function (d) { d3.select(this).selectAll('tspan').data(d[key][lang].lines).join('tspan').text((l) => l); };
    el.hubL.each(lines('lab')); el.satL.each(lines('lab')); el.miniL.each(lines('mlab'));
    el.hub.attr('aria-label', (d) => `${S[d.c][lang]}. ${S[d.c].desc[lang]}`);
    const pos = (sel, key, plKey) => sel.attr('text-anchor', (d) => d[plKey].anchor).each(function (d) {
      const { lh, fs } = d[key], n = d[key][lang].lines.length, h = n * lh, p = d[plKey];
      const top = p.mode === 'up' ? p.y1 - h : p.mode === 'down' ? p.y0 : p.yc - h / 2;
      d3.select(this).selectAll('tspan').attr('x', p.px).attr('y', (_, i) => top + i * lh + (lh + fs * .72) / 2);
    });
    pos(el.hubL, 'lab', 'pl'); pos(el.satL, 'lab', 'pl'); pos(el.miniL, 'mlab', 'mpl');
  }
  const curve = (a, b, k) => `M${a[0]},${a[1]}Q${(a[0] + b[0]) / 2 + (a[1] - b[1]) * k},${(a[1] + b[1]) / 2 + (b[0] - a[0]) * k} ${b[0]},${b[1]}`;

  function draw(now = performance.now()) {
    if (!L) return;
    const k = L.narrow ? 0 : st.k, T = now / 1000, el0 = now - st.g0;
    const g = (n) => st.grown ? 1 : ease(c01((el0 - (n.gDelay || 0)) / GROW_MS));
    const drift = (n, a) => reduce ? [0, 0] : [Math.sin(T * .5 + n.phase) * a * (1 - k), Math.cos(T * .41 + n.phase * 1.3) * a * (1 - k)];
    const egoP = [lerp(L.ego.hx, L.ego.mx ?? L.ego.hx, k), lerp(L.ego.hy, L.ego.my ?? L.ego.hy, k)];
    for (const h of L.hubs) {
      const base = [lerp(h.hx, h.mx ?? h.hx, k), lerp(h.hy, h.my ?? h.hy, k)], d = drift(h, 2.5), gg = g(h);
      h.d = d; h.g = gg; h.p = [egoP[0] + (base[0] + d[0] - egoP[0]) * gg, egoP[1] + (base[1] + d[1] - egoP[1]) * gg];
    }
    for (const n of L.sats) {
      const h = n.hubNode, base = [lerp(n.hx, n.mx, k), lerp(n.hy, n.my, k)], own = drift(n, 1.5), d = [h.d[0] + own[0], h.d[1] + own[1]], gg = g(n);
      n.d = d; n.g = gg; n.p = [h.p[0] + (base[0] + d[0] - h.p[0]) * gg, h.p[1] + (base[1] + d[1] - h.p[1]) * gg];
    }
    L.ego.p = egoP;
    const Hc = lerp(L.H, HM, k);
    svg.attr('viewBox', `0 0 ${L.W} ${Hc}`).style('height', Hc + 'px');
    const hv = st.hover, act = k > .5 ? st.active : null;
    const lit = (c) => hv == null || c === hv;
    // aristas
    el.lk.attr('d', (d) => curve(d.source.p, d.target.p, d.kind === 'w' ? .28 : d.kind === 'e' ? .1 : .16))
      .style('opacity', (d) => {
        const gr = Math.min(d.source.g ?? 1, d.target.g ?? 1);
        if (d.kind === 'w') return gr * (1 - k) * (hv == null ? .22 : (d.source.c === hv || d.target.c === hv) ? .7 : .04);
        if (d.kind === 's') return gr * (1 - k) * (lit(d.target.c) ? (hv == null ? .4 : .8) : .05);
        const base = k > .5 ? (d.target.c === act || d.target.c === hv ? .7 : .22) : (lit(d.target.c) ? (hv == null ? .45 : .85) : .07);
        return gr * base;
      });
    el.sat.attr('cx', (d) => d.p[0]).attr('cy', (d) => d.p[1]).attr('r', (d) => lerp(d.r, 1.5, k) * Math.max(.2, d.g)).style('opacity', (d) => d.g * (1 - k) * (lit(d.c) ? 1 : .15));
    el.egoC.attr('cx', egoP[0]).attr('cy', egoP[1]).attr('r', lerp(10, 7, k));
    el.egoL.attr('x', egoP[0]).attr('y', lerp(L.H / 2 + 27, HM / 2 + 25, k));
    el.hub.attr('transform', (d) => `translate(${d.p[0]},${d.p[1]})`).attr('aria-current', (d) => d.c === st.active && k > .5 ? 'page' : null);
    el.hubC.attr('r', (d) => lerp(13, 8, k) * Math.max(.2, d.g))
      .style('opacity', (d) => k > .5 ? (d.c === act || d.c === hv ? 1 : .5) : (lit(d.c) ? 1 : .2));
    el.ring.attr('r', lerp(13, 8, k) + 5).style('opacity', (d) => (k > .5 && d.c === act) ? 1 : d.focus ? .6 : 0).attr('stroke-dasharray', (d) => (k > .5 && d.c === act) ? null : '2 3');
    // etiquetas de la vista grande: aparecen al terminar de crecer y se desvanecen rápido al encoger
    const homeA = c01(1 - k * 3);
    el.hubL.attr('transform', (d) => `translate(${d.d[0]},${d.d[1]})`)
      .style('opacity', (d) => c01((d.g - .7) / .3) * homeA * (lit(d.c) ? 1 : .3));
    el.satL.attr('transform', (d) => `translate(${d.d[0]},${d.d[1]})`).style('opacity', (d) => homeA * (hv === d.c ? d.g : 0));
    el.miniL.style('opacity', c01((k - .55) / .45)).style('fill', (d) => d.c === act || d.c === hv ? 'var(--text)' : 'var(--muted)').style('font-weight', (d) => d.c === act ? 700 : 600);
    el.egoL.style('opacity', L.narrow || k < .5 ? 1 : c01((k - .55) / .45));
  }

  /* ================= animación ================= */
  const growing = () => !st.grown && performance.now() - st.g0 < 380 + K * 70 + 260 + GROW_MS + 50;
  function kick() {
    if (reduce) { draw(); return; }
    if (timer) return;
    timer = d3.timer(() => {
      const now = performance.now(); draw(now);
      if (!growing()) st.grown = true;
      if ((st.k >= 1 && !st.animating && st.grown) || (L.narrow && st.grown && st.k >= 1)) { timer.stop(); timer = null; }
    });
  }

  /* ================= interacción ================= */
  const tipHtml = (c) => `<b>${S[c][lang]}</b>${S[c].desc[lang]}`;
  const tipAt = (node, html) => { const r = node.getBoundingClientRect(); showTip({ clientX: r.left + r.width / 2, clientY: r.bottom }, html); };
  function setHover(c) { st.hover = c; if (!timer) draw(); }
  function bind() {
    el.hub.on('pointerenter', (e, d) => { setHover(d.c); showTip(e, tipHtml(d.c)); })
      .on('pointermove', (e, d) => showTip(e, tipHtml(d.c)))
      .on('pointerleave', () => { setHover(null); hideTip(); })
      .on('click', (e, d) => { hideTip(); onOpen(S[d.c].id); })
      .on('keydown', (e, d) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hideTip(); onOpen(S[d.c].id); } })
      .on('focus', function (e, d) { d.focus = this.matches(':focus-visible'); setHover(d.c); if (d.focus) tipAt(this, tipHtml(d.c)); })
      .on('blur', (e, d) => { d.focus = false; setHover(null); hideTip(); });
    el.sat.on('pointerenter', (e, d) => { setHover(d.c); showTip(e, `<b>${d.label[lang]}</b><span class="st" style="color:var(${S[d.c].color})">${S[d.c][lang]}</span>`); })
      .on('pointerleave', () => { setHover(null); hideTip(); })
      .on('click', (e, d) => { hideTip(); onOpen(S[d.c].id); });
  }

  function build() { L = computeLayout(); render(); draw(); kick(); }
  build();
  onRedraw((w) => { if (w === 'lang' && L) { setText(); draw(); } });
  let lastW = L.W, rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => {
    const w = Math.round(svg.node().parentNode.getBoundingClientRect().width);
    if (w && Math.abs(w - lastW) > 2) { lastW = w; st.grown = true; build(); }
  }, 200); });

  return {
    /* mode: 'home' | 'mini'. Devuelve una promesa que termina con la animación. */
    setMode(mode, activeId, animate) {
      st.active = activeId == null ? null : S.findIndex((s) => s.id === activeId);
      const target = mode === 'mini' ? 1 : 0;
      if (!animate || reduce || L.narrow) { st.k = target; draw(); kick(); return Promise.resolve(); }
      st.animating = true; kick();
      const k0 = st.k;
      return new Promise((res) => {
        d3.transition('egomap').duration(750).ease(d3.easeCubicInOut)
          .tween('k', () => (tt) => { st.k = lerp(k0, target, tt); })
          .on('end interrupt', () => { st.animating = false; res(); kick(); });
      });
    },
    focusSection(id) { const n = el.hub.filter((d) => S[d.c].id === id).node(); if (n) n.focus({ preventScroll: true }); },
    get narrow() { return L.narrow; }
  };
}
