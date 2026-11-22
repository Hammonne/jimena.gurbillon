/* Hierarchical edge bundling "Herramientas y proyectos": qué herramienta usé en qué proyecto.
   Datos en data/tools.json. */
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
  g.append('g').selectAll('path').data(root.children).join('path').attr('d', (d) => { const ls = d.leaves(); return arc({ startAngle: ls[0].x - .04, endAngle: ls[ls.length - 1].x + .04 }); }).style('fill', (d) => `var(${groups[d.data.gi].v})`).attr('opacity', .9);
  const glab = g.append('g').selectAll('text').data(root.children).join('text').attr('dy', '0.32em').style('fill', (d) => `var(${groups[d.data.gi].v})`).style('font', '600 14px var(--mono)').style('text-transform', 'uppercase').style('letter-spacing', '.06em')
    .attr('transform', (d) => { const ls = d.leaves(); const a = (ls[0].x + ls[ls.length - 1].x) / 2; const rr = R + 172; return `translate(${Math.sin(a) * rr},${-Math.cos(a) * rr})`; }).attr('text-anchor', (d) => { const ls = d.leaves(); const a = (ls[0].x + ls[ls.length - 1].x) / 2; return Math.sin(a) > .35 ? 'start' : Math.sin(a) < -.35 ? 'end' : 'middle'; });
  const line = d3.lineRadial().curve(d3.curveBundle.beta(.85)).radius((d) => d.y).angle((d) => d.x);
  const paths = g.append('g').attr('fill', 'none').selectAll('path').data(edges).join('path').attr('d', ([a, b]) => line(a.path(b)))
    .style('stroke', () => 'var(--accent)').attr('stroke-opacity', .35).attr('stroke-width', 1.3).style('mix-blend-mode', 'normal');
  const deg = new Map(); edges.forEach(([a, b]) => { deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1); });
  const nodes = g.append('g').selectAll('g').data(leaves).join('g').attr('transform', (d) => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`);
  nodes.append('circle').attr('r', (d) => 3 + Math.sqrt(deg.get(d) || 0) * 1.6).style('fill', (d) => `var(${groups[d.data.gi].v})`).style('stroke', 'var(--bg2)').attr('stroke-width', 1.5);
  nodes.append('text').attr('dy', '0.31em').attr('x', (d) => d.x < Math.PI ? 18 : -18).attr('text-anchor', (d) => d.x < Math.PI ? 'start' : 'end').attr('transform', (d) => d.x >= Math.PI ? 'rotate(180)' : null)
    .style('fill', 'var(--text)').style('font', (d) => d.data.gi === 0 ? '600 16px var(--font)' : '400 15px var(--font)').style('cursor', 'pointer');
  const nodeT = nodes.select('text');
  function hl(n) {
    if (!n) { paths.attr('stroke-opacity', .35).style('stroke', 'var(--accent)').attr('stroke-width', 1.3); nodes.attr('opacity', 1); return; }
    const near = new Set([n]); edges.forEach(([a, b]) => { if (a === n) near.add(b); if (b === n) near.add(a); });
    paths.attr('stroke-opacity', ([a, b]) => a === n || b === n ? .95 : .04).style('stroke', ([a, b]) => a === n || b === n ? `var(${groups[(a === n ? b : a).data.gi].v})` : 'var(--muted)').attr('stroke-width', ([a, b]) => a === n || b === n ? 2.2 : 1).filter(([a, b]) => a === n || b === n).raise();
    nodes.attr('opacity', (d) => near.has(d) ? 1 : .25);
  }
  nodes.on('pointerenter', (e, d) => hl(d)).on('pointerleave', () => hl(null));
  const setL = () => { glab.text((d) => groups[d.data.gi][lang]); nodeT.text((d) => lang === 'en' && NM_EN[d.data.name] ? NM_EN[d.data.name] : d.data.name); };
  setL(); onRedraw((w) => { if (w === 'lang') setL(); });
}
