/* Hierarchical edge bundling "Herramientas y proyectos": qué herramienta usé en qué proyecto.
   Datos en data/tools.json.
   Hover resalta un nodo; clic (o Enter/Espacio) lo deja seleccionado; clic en el fondo o Escape limpia. */
import { onRedraw } from '../core.js';
import { lang } from '../i18n.js';

export function initBundle(data) {
  const groups = data.groups.map((g) => ({ es: g.es, en: g.en, v: g.color, items: g.items }));
  const uses = data.uses, NM_EN = data.english;
  const tree = { name: 'root', children: groups.map((g, gi) => ({ name: g.es, gi, children: g.items.map((it) => ({ name: it, gi })) })) };
  const root = d3.hierarchy(tree); const W = 900, R = 300;
  d3.cluster().size([2 * Math.PI, R - 40])(root);
  const leaves = root.leaves(); const byName = new Map(leaves.map((d) => [d.data.name, d]));
  const edges = []; Object.entries(uses).forEach(([p, ts]) => ts.forEach((t) => { if (byName.get(t)) edges.push([byName.get(p), byName.get(t)]); }));
  const svg = d3.select('#bundle'); const g = svg.append('g').attr('transform', `translate(${W / 2},${W / 2})`);
  // group arcs
  const arc = d3.arc().innerRadius(R - 62).outerRadius(R - 56);
  // margen del arco = media separación entre hojas vecinas: así los nodos de los extremos quedan
  // bien cubiertos (con un margen fijo de .04 rad quedaban justo en la punta del arco)
  const step = d3.min(root.children, (c) => { const ls = c.leaves(); return ls.length > 1 ? ls[1].x - ls[0].x : Infinity; });
  const pad = step / 2;
  g.append('g').selectAll('path').data(root.children).join('path').attr('d', (d) => { const ls = d.leaves(); return arc({ startAngle: ls[0].x - pad, endAngle: ls[ls.length - 1].x + pad }); }).style('fill', (d) => `var(${groups[d.data.gi].v})`).attr('opacity', .9);
  const glab = g.append('g').selectAll('text').data(root.children).join('text').attr('dy', '0.32em').style('fill', (d) => `var(${groups[d.data.gi].v})`).style('font', '600 14px var(--mono)').style('text-transform', 'uppercase').style('letter-spacing', '.06em')
    .attr('transform', (d) => { const ls = d.leaves(); const a = (ls[0].x + ls[ls.length - 1].x) / 2; const rr = R + 172; return `translate(${Math.sin(a) * rr},${-Math.cos(a) * rr})`; }).attr('text-anchor', (d) => { const ls = d.leaves(); const a = (ls[0].x + ls[ls.length - 1].x) / 2; return Math.sin(a) > .35 ? 'start' : Math.sin(a) < -.35 ? 'end' : 'middle'; });
  const line = d3.lineRadial().curve(d3.curveBundle.beta(.85)).radius((d) => d.y).angle((d) => d.x);
  const paths = g.append('g').attr('fill', 'none').selectAll('path').data(edges).join('path').attr('d', ([a, b]) => line(a.path(b)))
    .style('stroke', () => 'var(--accent)').attr('stroke-opacity', .35).attr('stroke-width', 1.3).style('mix-blend-mode', 'normal');
  const deg = new Map(); edges.forEach(([a, b]) => { deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1); });
  const nodes = g.append('g').selectAll('g').data(leaves).join('g').attr('transform', (d) => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`);
  const rOf = (d) => 3 + Math.sqrt(deg.get(d) || 0) * 1.6;
  nodes.append('circle').attr('r', rOf).style('fill', (d) => `var(${groups[d.data.gi].v})`).style('stroke', 'var(--bg2)').attr('stroke-width', 1.5);
  // anillo: indica la selección (sólido) y el foco del teclado (punteado)
  const ring = nodes.append('circle').attr('class', 'ring').attr('r', (d) => rOf(d) + 5).style('fill', 'none').style('stroke', (d) => `var(${groups[d.data.gi].v})`).attr('stroke-width', 1.5).attr('opacity', 0).style('pointer-events', 'none');
  // la orientación de la etiqueta (girar 180° o no) se decide por el ángulo medio de su GRUPO,
  // no por el del nodo: así todas las etiquetas de un grupo se leen en el mismo sentido
  const flip = (d) => { const ls = d.parent.leaves(); return (ls[0].x + ls[ls.length - 1].x) / 2 >= Math.PI; };
  nodes.append('text').attr('dy', '0.31em').attr('x', (d) => flip(d) ? -18 : 18).attr('text-anchor', (d) => flip(d) ? 'end' : 'start').attr('transform', (d) => flip(d) ? 'rotate(180)' : null)
    .style('fill', 'var(--text)').style('font', (d) => d.data.gi === 0 ? '600 16px var(--font)' : '400 15px var(--font)').style('cursor', 'pointer');
  nodes.attr('tabindex', 0).attr('role', 'button').attr('aria-pressed', 'false').style('cursor', 'pointer').style('outline', 'none');
  const nodeT = nodes.select('text');
  function hl(n) {
    if (!n) { paths.attr('stroke-opacity', .35).style('stroke', 'var(--accent)').attr('stroke-width', 1.3); nodes.attr('opacity', 1); return; }
    const near = new Set([n]); edges.forEach(([a, b]) => { if (a === n) near.add(b); if (b === n) near.add(a); });
    paths.attr('stroke-opacity', ([a, b]) => a === n || b === n ? .95 : .04).style('stroke', ([a, b]) => a === n || b === n ? `var(${groups[(a === n ? b : a).data.gi].v})` : 'var(--muted)').attr('stroke-width', ([a, b]) => a === n || b === n ? 2.2 : 1).filter(([a, b]) => a === n || b === n).raise();
    nodes.attr('opacity', (d) => near.has(d) ? 1 : .25);
  }
  /* Selección: igual que en "How it all connects". Mientras hay selección, el hover no cambia nada. */
  let selected = null, focused = null;
  const showRing = () => ring.attr('opacity', (d) => d === selected ? 1 : d === focused ? .6 : 0).attr('stroke-dasharray', (d) => d === selected ? null : '2 3');
  function select(n) {
    selected = n;
    hl(selected);
    nodes.attr('aria-pressed', (d) => d === selected ? 'true' : 'false');
    nodeT.style('font-weight', (d) => d === selected ? 700 : null);
    showRing();
  }
  nodes.on('pointerenter', (e, d) => { if (!selected) hl(d); }).on('pointerleave', () => { if (!selected) hl(null); })
    .on('click', (e, d) => { e.stopPropagation(); select(selected === d ? null : d); })
    .on('keydown', (e, d) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(selected === d ? null : d); }
    })
    .on('focus', (e, d) => { focused = e.currentTarget.matches(':focus-visible') ? d : null; showRing(); })   // anillo punteado solo con teclado.on('blur', () => { focused = null; showRing(); });
  svg.on('click', () => select(null))   // clic en el fondo (o en una arista) limpia la selección
    .on('keydown', (e) => { if (e.key === 'Escape' && selected) { e.preventDefault(); select(null); } });   // con selección, Escape solo limpia; sin selección, cierra la sección
  const nameOf = (d) => lang === 'en' && NM_EN[d.data.name] ? NM_EN[d.data.name] : d.data.name;
  const setL = () => {
    glab.text((d) => groups[d.data.gi][lang]); nodeT.text(nameOf);
    nodes.attr('aria-label', (d) => `${nameOf(d)} · ${groups[d.data.gi][lang]}`);
    fit();
  };
  /* Que ninguna etiqueta quede cortada: si algo se sale arriba o abajo, el viewBox crece solo en vertical
     (el ancho no cambia, así que el diagrama no se achica). */
  const vb0 = svg.attr('viewBox').split(/[ ,]+/).map(Number);
  function fit() {
    const b = svg.node().getBBox(), m = 12;
    const y0 = Math.min(vb0[1], b.y - m), y1 = Math.max(vb0[1] + vb0[3], b.y + b.height + m);
    svg.attr('viewBox', `${vb0[0]} ${y0} ${vb0[2]} ${y1 - y0}`);
  }
  setL(); onRedraw((w) => { if (w === 'lang') setL(); });
}
