/* Grafo de fondo del hero (decorativo): 8 comunidades de colores que flotan.
   Es independiente de data/interests.json, así que cambiar los intereses no lo altera. */
import { reduce } from '../core.js';

/* Colores de las 8 comunidades y pares de comunidades conectadas (índices). */
const COLORS = ['--accent', '--vio', '--blue', '--teal', '--mint', '--yel', '--grey', '--coral'];
const CROSS = [[5,3],[3,2],[2,1],[4,2],[6,0],[0,5],[6,2],[0,3],[1,3],[5,3],[3,2],[2,1],[7,2],[7,2],[7,5]];
const PER = 14; // nodos por comunidad

function buildGraph() {
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const nodes = [], links = [];
  COLORS.forEach((_, ci) => {
    const hub = nodes.length; nodes.push({ id: hub, c: ci, hub: true });
    for (let k = 0; k < PER; k++) {
      const id = nodes.length; nodes.push({ id, c: ci, r: 2.5 + rnd() * 3 });
      links.push({ source: hub, target: id });
      if (k > 1) links.push({ source: id, target: hub + 1 + Math.floor(rnd() * k) });
    }
  });
  CROSS.forEach(([a, b]) => { for (let i = 0; i < 3; i++) { const A = nodes.filter((n) => n.c === a && !n.hub), B = nodes.filter((n) => n.c === b && !n.hub); links.push({ source: A[Math.floor(rnd()*A.length)].id, target: B[Math.floor(rnd()*B.length)].id, x: true }); } });
  return { nodes, links };
}

export function initHero() {
  const svg = d3.select('#heroGraph'); const box = svg.node().getBoundingClientRect();
  const W = box.width, H = box.height;
  svg.attr('viewBox', `0 0 ${W} ${H}`);
  const { nodes, links } = buildGraph();
  const K = COLORS.length, cx = (i) => W * (0.5 + 0.45 * Math.cos(i / K * 2 * Math.PI)), cy = (i) => H * (0.5 + 0.4 * Math.sin(i / K * 2 * Math.PI));
  const sim = d3.forceSimulation(nodes).force('link', d3.forceLink(links).id((d) => d.id).distance((l) => l.x ? 140 : 26).strength((l) => l.x ? .02 : .4))
    .force('charge', d3.forceManyBody().strength(-30)).force('x', d3.forceX((d) => cx(d.c)).strength(.05)).force('y', d3.forceY((d) => cy(d.c)).strength(.05)).alphaDecay(0).velocityDecay(.6);
  const l = svg.append('g').selectAll('line').data(links).join('line').style('stroke', (d) => `var(${COLORS[d.source.c ?? nodes[d.source].c]})`).attr('stroke-opacity', .18).attr('stroke-width', .8);
  const n = svg.append('g').selectAll('circle').data(nodes).join('circle').attr('r', (d) => d.hub ? 5 : d.r * .7).style('fill', (d) => `var(${COLORS[d.c]})`).attr('fill-opacity', .7);
  let t = 0;
  sim.on('tick', () => {
    t += .003;
    nodes.forEach((d) => { if (!reduce) { d.vx += Math.sin(t + d.id) * .02; d.vy += Math.cos(t * 1.3 + d.id) * .02; } });
    l.attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y).attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
    n.attr('cx', (d) => d.x).attr('cy', (d) => d.y);
  });
  if (reduce) { sim.alphaDecay(.05); }
  document.querySelector('.hero').addEventListener('pointermove', (e) => {
    const r = svg.node().getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    nodes.forEach((d) => { const dx = d.x - mx, dy = d.y - my, dd = dx*dx + dy*dy; if (dd < 14000) { d.vx += dx / Math.sqrt(dd) * 1.2; d.vy += dy / Math.sqrt(dd) * 1.2; } });
  });
}
