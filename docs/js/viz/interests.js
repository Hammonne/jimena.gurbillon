/* Grafo "How it all connects": métodos, modelos y conceptos (no herramientas),
   con Jimena al centro. Datos en data/interests.json.
   - Pasar el cursor por un hub ilumina su comunidad; hacer clic la deja fijada.
   - Las etiquetas no se pisan: se miden en ES y EN y una fuerza de colisión
     de rectángulos separa nodos, temas y nombres de comunidad. */
import { showTip, hideTip, onRedraw } from '../core.js';
import { lang } from '../i18n.js';

const FS_HUB = 13.5, FS_TOPIC = 12;
const FONT_HUB = `600 ${FS_HUB}px Inter`, FONT_TOPIC = `500 ${FS_TOPIC}px Inter`;
const LH_HUB = 17, LH_TOPIC = 15;   // alto de línea
const GAP = 4;                       // aire entre nodo y su etiqueta
const HUB_M = 10;                    // margen entre el cluster y el nombre de la comunidad
const PAD = 5;                       // separación mínima entre cajas

const mctx = document.createElement('canvas').getContext('2d');
const measure = (s, font) => { mctx.font = font; return mctx.measureText(s).width; };
/* Parte un texto en líneas de ancho máximo maxW. */
function wrap(text, font, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (cur && measure(t, font) > maxW) { lines.push(cur); cur = w; } else cur = t; }
  lines.push(cur);
  return { lines, w: Math.max(...lines.map((l) => measure(l, font))) };
}

export function initInterests(data) {
  const ready = document.fonts ? Promise.all([document.fonts.load(FONT_HUB), document.fonts.load(FONT_TOPIC)]).catch(() => {}) : Promise.resolve();
  return ready.then(() => build(data));
}

function build(data) {
  const COMM = data.communities.map((c) => ({ id: c.id, es: c.es, en: c.en, v: c.color, topics: c.topics }));
  const K = COMM.length;
  const svg = d3.select('#graph');
  const W = svg.node().getBoundingClientRect().width;
  const narrow = W < 640;
  const ROW = 190, EGO_GAP = 70, MARGIN = 70;   // celular: una comunidad por fila y un hueco al medio para Jimena
  const H = narrow ? 2 * MARGIN + K * ROW + EGO_GAP : 680;
  svg.style('height', H + 'px').attr('viewBox', `0 0 ${W} ${H}`);
  const maxTopicW = narrow ? Math.min(150, W * .42) : 175;
  const maxHubW = narrow ? Math.min(180, W * .55) : 230;

  /* ---- nodos y aristas ---- */
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  /* Escritorio: anillo alrededor de Jimena. Celular: zigzag suave, una comunidad por fila. */
  const centers = COMM.map((_, i) => { const a = i / K * 2 * Math.PI - Math.PI / 2; return narrow ? [W * (i % 2 ? .6 : .4), MARGIN + (i + .5) * ROW + (i >= K / 2 ? EGO_GAP : 0)] : [W / 2 + Math.cos(a) * W * .33, H / 2 + Math.sin(a) * H * .29]; });
  const labelOf = (o, font, lh, maxW) => { const es = wrap(o.es, font, maxW), en = wrap(o.en, font, maxW); return { es, en, bw: Math.max(es.w, en.w) + 2, bh: Math.max(es.lines.length, en.lines.length) * lh, lh, fs: font === FONT_HUB ? FS_HUB : FS_TOPIC }; };
  const nodes = [], byId = new Map();
  const ego = { id: '__ego', ego: true, c: -1, r: 9, fx: W / 2, fy: H / 2, x: W / 2, y: H / 2 };
  COMM.forEach((c, ci) => {
    const [cx, cy] = centers[ci];
    const hub = { id: c.id, hub: true, c: ci, r: 11, x: cx, y: cy, name: { es: c.es, en: c.en }, lab: labelOf(c, FONT_HUB, LH_HUB, maxHubW) };
    nodes.push(hub); byId.set(hub.id, hub); c.hubNode = hub; c.nodes = [hub];
    c.topics.forEach((tp, k) => {
      const a = k / c.topics.length * 2 * Math.PI;
      const n = { id: tp.id, c: ci, r: 5 + rnd() * 2, ang: a - Math.PI / 2, x: cx + Math.cos(a) * 50, y: cy + Math.sin(a) * 50, label: { es: tp.es, en: tp.en }, lab: labelOf(tp, FONT_TOPIC, LH_TOPIC, maxTopicW), hubNode: hub };
      nodes.push(n); byId.set(n.id, n); c.nodes.push(n);
    });
  });
  nodes.push(ego);
  const links = [];
  COMM.forEach((c) => { links.push({ source: ego, target: c.hubNode, e: true }); c.nodes.slice(1).forEach((n) => links.push({ source: c.hubNode, target: n })); });
  data.links.forEach(([a, b]) => {
    const A = byId.get(a), B = byId.get(b);
    if (!A || !B) { console.warn(`interests.json: no existe "${!A ? a : b}"`); return; }
    links.push({ source: A, target: B, x: true, intra: A.c === B.c });
  });

  /* ---- geometría de etiquetas (se recalcula en cada tick) ---- */
  const egoLab = { w: measure('Jimena', '700 13px Inter') };
  const egoRect = () => [W / 2 - egoLab.w / 2, H / 2 + 14, W / 2 + egoLab.w / 2, H / 2 + 31];
  /* Tema: del lado opuesto a su hub, en dirección radial. */
  function placeTopic(n) {
    const h = n.hubNode; let ux = n.x - h.x, uy = n.y - h.y; const m = Math.hypot(ux, uy) || 1; ux /= m; uy /= m;
    const { bw, bh } = n.lab, d = n.r + GAP;
    let anchor, px, py, x0, y0, mode;
    if (Math.abs(ux) > .38) {          // a un costado: el texto empieza pasado el borde del círculo
      anchor = ux > 0 ? 'start' : 'end'; px = n.x + Math.sign(ux) * d; py = n.y + uy * d;
      x0 = ux > 0 ? px : px - bw; mode = 'mid'; y0 = py + uy * bh * .3 - bh / 2;
    } else {                           // arriba o abajo, centrado
      anchor = 'middle'; px = n.x + ux * d; py = n.y + Math.sign(uy || 1) * d;
      x0 = px - bw / 2; mode = uy < 0 ? 'up' : 'down'; y0 = uy < 0 ? py - bh : py;
    }
    n.pl = { anchor, px, py, mode, yc: y0 + bh / 2, y0, y1: y0 + bh, rect: [x0, y0, x0 + bw, y0 + bh] };
  }
  /* Comunidad: fuera de la caja de los nodos de su cluster, del lado que mira hacia afuera del centro (lejos de Jimena). */
  function placeHub(c) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of c.nodes) { x0 = Math.min(x0, n.x - n.r); y0 = Math.min(y0, n.y - n.r); x1 = Math.max(x1, n.x + n.r); y1 = Math.max(y1, n.y + n.r); }
    const h = c.hubNode, { bw, bh } = h.lab, dx = ((x0 + x1) / 2 - W / 2) / W, dy = ((y0 + y1) / 2 - H / 2) / H;
    let anchor, px, rx0, ry0, mode;
    if (!narrow && Math.abs(dx) > Math.abs(dy)) {
      mode = 'mid'; ry0 = h.y - bh / 2;
      if (dx > 0) { anchor = 'start'; px = x1 + HUB_M; rx0 = px; } else { anchor = 'end'; px = x0 - HUB_M; rx0 = px - bw; }
    } else {
      anchor = 'middle'; px = h.x; rx0 = px - bw / 2;
      if (dy < 0) { mode = 'up'; ry0 = y0 - HUB_M - bh; } else { mode = 'down'; ry0 = y1 + HUB_M; }
    }
    // Si choca con la etiqueta de uno de sus propios temas, se aleja más hacia afuera hasta librarla.
    for (const n of c.nodes) {
      if (n.hub) continue; const r = n.pl.rect;
      if (mode === 'up' && r[0] < rx0 + bw + PAD && r[2] > rx0 - PAD && r[1] < ry0 + bh + PAD) ry0 = Math.min(ry0, r[1] - PAD - bh);
      if (mode === 'down' && r[0] < rx0 + bw + PAD && r[2] > rx0 - PAD && r[3] > ry0 - PAD) ry0 = Math.max(ry0, r[3] + PAD);
      if (mode === 'mid' && r[1] < ry0 + bh + PAD && r[3] > ry0 - PAD) {
        if (anchor === 'start' && r[2] > rx0 - PAD) { rx0 = Math.max(rx0, r[2] + PAD); px = rx0; }
        if (anchor === 'end' && r[0] < rx0 + bw + PAD) { rx0 = Math.min(rx0, r[0] - PAD - bw); px = rx0 + bw; }
      }
    }
    h.pl = { anchor, px, mode, yc: ry0 + bh / 2, y0: ry0, y1: ry0 + bh, rect: [rx0, ry0, rx0 + bw, ry0 + bh] };
  }
  const placeAll = () => { for (const n of nodes) if (!n.hub && !n.ego) placeTopic(n); COMM.forEach(placeHub); };

  /* ---- fuerza de colisión entre cajas (nodos + texto) ---- */
  function items() {
    const it = [];
    for (const n of nodes) it.push({ k: 'node', c: n.c, r: [n.x - n.r, n.y - n.r, n.x + n.r, n.y + n.r], own: n.ego ? [] : [n], src: n });
    for (const n of nodes) if (!n.hub && !n.ego) it.push({ k: 'tl', c: n.c, r: n.pl.rect, own: [n], src: n });
    COMM.forEach((c, ci) => it.push({ k: 'hl', c: ci, r: c.hubNode.pl.rect, own: c.nodes, src: c.hubNode }));
    it.push({ k: 'el', c: -1, r: egoRect(), own: [], src: ego });
    return it;
  }
  /* ¿Este par de cajas puede verse a la vez y debe separarse? */
  function relevant(a, b) {
    if (a.k === 'node' && b.k === 'node') return false;            // eso lo hace forceCollide
    if (a.src === b.src) return false;                              // un nodo y su propia etiqueta
    if (a.k === 'tl' && b.k === 'tl' && a.c !== b.c) return false;  // los temas de dos comunidades nunca se ven juntos
    if ((a.k === 'hl' && b.c === a.c) || (b.k === 'hl' && a.c === b.c)) return false; // placeHub ya la deja fuera de su cluster
    if ((a.k === 'el' && b.src === ego) || (b.k === 'el' && a.src === ego)) return false;
    return true;
  }
  const overlap = (a, b, pad = PAD) => [Math.min(a[2], b[2]) - Math.max(a[0], b[0]) + pad, Math.min(a[3], b[3]) - Math.max(a[1], b[1]) + pad];
  function rectForce() {
    placeAll();
    const it = items(), S = .3;
    for (let i = 0; i < it.length; i++) for (let j = i + 1; j < it.length; j++) {
      const a = it[i], b = it[j]; if (!relevant(a, b)) continue;
      const [ox, oy] = overlap(a.r, b.r); if (ox <= 0 || oy <= 0) continue;
      const sx = (a.r[0] + a.r[2]) < (b.r[0] + b.r[2]) ? -1 : 1, sy = (a.r[1] + a.r[3]) < (b.r[1] + b.r[3]) ? -1 : 1;
      const wa = a.own.length ? (b.own.length ? .5 : 1) : 0, wb = 1 - wa;
      const [dx, dy] = ox < oy ? [Math.min(ox * S, 6) * sx, 0] : [0, Math.min(oy * S, 6) * sy];   // empujón acotado: estable
      for (const n of a.own) { n.vx += dx * wa; n.vy += dy * wa; }
      for (const n of b.own) { n.vx -= dx * wb; n.vy -= dy * wb; }
    }
    // contención suave (sin clamp): si una caja se sale, se empuja hacia adentro
    for (const a of it) {
      const m = 6, [x0, y0, x1, y1] = a.r, push = [x0 < m ? m - x0 : x1 > W - m ? W - m - x1 : 0, y0 < m ? m - y0 : y1 > H - m ? H - m - y1 : 0];
      if (push[0] || push[1]) for (const n of a.own) { n.vx += push[0] * .1; n.vy += push[1] * .1; }
    }
  }

  /* Órbita: cada tema tiene su propio ángulo alrededor de su hub, repartidos en todo el círculo,
     así las etiquetas (que van hacia afuera) apuntan a direcciones distintas. */
  const ORBIT = narrow ? 62 : 52;
  function orbit(alpha) {
    for (const n of nodes) {
      if (n.hub || n.ego) continue; const h = n.hubNode;
      n.vx += (h.x + Math.cos(n.ang) * ORBIT - n.x) * .5 * alpha;
      n.vy += (h.y + Math.sin(n.ang) * ORBIT - n.y) * .5 * alpha;
    }
  }
  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).distance((l) => l.e ? 150 : l.x ? (l.intra ? 60 : 220) : narrow ? 62 : 52).strength((l) => l.e ? .03 : l.x ? (l.intra ? .1 : .01) : .5))
    .force('charge', d3.forceManyBody().strength((d) => d.hub ? -260 : -40).distanceMax(220))
    .force('x', d3.forceX((d) => d.ego ? W / 2 : centers[d.c][0]).strength((d) => d.hub || d.ego ? .12 : 0)).force('y', d3.forceY((d) => d.ego ? H / 2 : centers[d.c][1]).strength((d) => d.hub || d.ego ? .12 : 0))
    .force('orbit', orbit)
    .force('col', d3.forceCollide((d) => d.r + 6))
    .force('rect', rectForce)
    .stop();
  for (let i = 0; i < 700; i++) sim.tick();   // el grafo aparece ya acomodado (congelado)
  placeAll();
  if (narrow) {   // en celular, el alto se ajusta al contenido (sin franjas vacías arriba y abajo)
    const rs = items().map((it) => it.r), y0 = Math.min(...rs.map((r) => r[1])) - 16, y1 = Math.max(...rs.map((r) => r[3])) + 16;
    svg.attr('viewBox', `0 ${y0} ${W} ${y1 - y0}`).style('height', (y1 - y0) + 'px');
  }

  /* ---- dibujo ---- */
  const col = (d) => d.c < 0 ? 'var(--text)' : `var(${COMM[d.c].v})`;
  const lk = svg.append('g').attr('fill', 'none').selectAll('path').data(links).join('path')
    .style('stroke', (d) => d.e ? `var(${COMM[d.target.c].v})` : col(d.source)).attr('stroke-opacity', (d) => d.e ? .35 : d.x ? .2 : .28).attr('stroke-width', (d) => d.e ? 1.4 : .8);
  const nd = svg.append('g').selectAll('circle').data(nodes).join('circle').attr('r', (d) => d.r)
    .style('fill', col).style('stroke', (d) => d.hub || d.ego ? 'var(--bg2)' : 'none').attr('stroke-width', 2).style('cursor', (d) => d.ego ? 'default' : 'grab');
  const lb = svg.append('g').style('pointer-events', 'none');
  const egoL = lb.append('text').attr('text-anchor', 'middle').style('fill', 'var(--text)').style('font', '700 13px var(--font)').text('Jimena');
  const hubL = lb.selectAll('text.h').data(nodes.filter((d) => d.hub)).join('text').attr('class', 'h').style('fill', 'var(--text)').style('font', `600 ${FS_HUB}px var(--font)`);
  const satL = lb.selectAll('text.s').data(nodes.filter((d) => d.label)).join('text').attr('class', 's').attr('opacity', 0).style('fill', 'var(--muted)').style('font', `500 ${FS_TOPIC}px var(--font)`);
  const setLabels = () => {
    const lines = function (d) { d3.select(this).selectAll('tspan').data(d.lab[lang].lines).join('tspan').text((l) => l); };
    hubL.each(lines); satL.each(lines);
  };
  /* Coloca las líneas de una etiqueta dentro de su caja, según el idioma actual. */
  function drawText(sel) {
    sel.attr('text-anchor', (d) => d.pl.anchor).each(function (d) {
      const { lh, fs } = d.lab, n = d.lab[lang].lines.length, h = n * lh, p = d.pl;
      const top = p.mode === 'up' ? p.y1 - h : p.mode === 'down' ? p.y0 : p.yc - h / 2;
      d3.select(this).selectAll('tspan').attr('x', p.px).attr('y', (_, i) => top + i * lh + (lh + fs * .72) / 2);
    });
  }
  const curve = (d) => { const sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y, k = d.x ? .25 : d.e ? .12 : .18; return `M${sx},${sy}Q${(sx + tx) / 2 + (sy - ty) * k},${(sy + ty) / 2 + (tx - sx) * k} ${tx},${ty}`; };
  function draw() {
    placeAll();
    lk.attr('d', curve);
    nd.attr('cx', (d) => d.x).attr('cy', (d) => d.y);
    egoL.attr('x', W / 2).attr('y', H / 2 + 27);
    drawText(hubL); drawText(satL);
  }
  setLabels(); draw();
  sim.on('tick', draw);
  onRedraw((w) => { if (w === 'lang') { setLabels(); draw(); legend(); } });

  /* ---- interacción ---- */
  function highlight(c) {
    nd.transition().duration(200).attr('opacity', (d) => c == null || d.c === c || d.ego ? 1 : .12);
    lk.transition().duration(200).attr('stroke-opacity', (d) => c == null ? (d.e ? .35 : d.x ? .2 : .28) : (d.source.c === c || d.target.c === c ? .6 : .03));
    satL.transition().duration(200).attr('opacity', (d) => c != null && d.c === c ? 1 : 0);
    satL.style('fill', (d) => c != null && d.c === c ? 'var(--text)' : 'var(--muted)');
    hubL.transition().duration(200).attr('opacity', (d) => c == null || d.c === c ? 1 : .25);
    d3.selectAll('#glegend button').classed('on', (d, i) => i === c);
  }
  let locked = null;
  nd.on('pointerenter', (e, d) => { if (d.hub) { if (locked == null) highlight(d.c); } else if (d.label) showTip(e, `<b>${d.label[lang]}</b><span class="st" style="color:var(${COMM[d.c].v})">${COMM[d.c][lang]}</span>`); })
    .on('pointerleave', (e, d) => { hideTip(); if (d.hub) highlight(locked); })
    .on('click', (e, d) => { if (!d.hub) return; locked = locked === d.c ? null : d.c; highlight(locked); })
    .filter((d) => !d.ego).call(d3.drag().on('start', (e, d) => { if (!e.active) sim.alphaTarget(.25).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; }).on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));
  svg.on('click', (e) => { if (e.target === svg.node()) { locked = null; highlight(null); } });
  function legend() {
    d3.select('#glegend').selectAll('button').data(COMM).join('button').attr('type', 'button')
      .html((d) => `<span class="sw" style="background:var(${d.v})"></span>${d[lang]}`)
      .on('click', (e, d) => { const i = COMM.indexOf(d); locked = locked === i ? null : i; highlight(locked); });
  }
  legend();
}
