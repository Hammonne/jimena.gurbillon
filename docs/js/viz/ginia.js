/* Tarjeta GINIA: grafo espacial con mensajes que viajan entre nodos (message passing de una GNN). */
import { reduce } from '../core.js';

export function initGinia() {
  const svg = d3.select('#vGeo'); let W, H;
  const init = () => {
    const r = svg.node().getBoundingClientRect(); W = r.width; H = r.height; svg.attr('viewBox', `0 0 ${W} ${H}`); svg.selectAll('*').remove();
    const pts = []; let s2 = 5; const rr = () => (s2 = (s2 * 16807) % 2147483647) / 2147483647;
    while (pts.length < 55) { const x = 20 + rr() * (W - 40), y = 16 + rr() * (H - 70); const b = ((x - W * .5) / (W * .48)) ** 2 + ((y - H * .42) / (H * .42)) ** 2; if (b < 1) pts.push({ x, y, v: rr() ** 2 }); }
    const edges = [];
    pts.forEach((p, i) => pts.map((q, j) => [j, (q.x - p.x) ** 2 + (q.y - p.y) ** 2]).sort((a, b) => a[1] - b[1]).slice(1, 4).forEach(([j]) => { if (j > i) edges.push([p, pts[j]]); }));
    for (let i = 0; i < 9; i++) svg.append('path').attr('d', `M0,${H * i / 9} C${W / 3},${H * i / 9 + 14} ${2 * W / 3},${H * i / 9 - 14} ${W},${H * i / 9}`).style('stroke', 'var(--line2)').attr('fill', 'none').attr('stroke-width', .6);
    svg.append('g').selectAll('line').data(edges).join('line').attr('x1', (d) => d[0].x).attr('y1', (d) => d[0].y).attr('x2', (d) => d[1].x).attr('y2', (d) => d[1].y).style('stroke', 'var(--muted)').attr('stroke-opacity', .35);
    const nodes = svg.append('g').selectAll('circle').data(pts).join('circle').attr('cx', (d) => d.x).attr('cy', (d) => d.y).attr('r', (d) => 3 + d.v * 9)
      .style('fill', (d) => d.v > .5 ? 'var(--accent)' : d.v > .2 ? 'var(--coral)' : 'var(--yel)').attr('fill-opacity', .85);
    const msg = svg.append('g');
    function send() {
      if (!document.body.contains(svg.node())) return;
      const e = edges[Math.floor(Math.random() * edges.length)]; const [a, b] = Math.random() < .5 ? e : [e[1], e[0]];
      msg.append('circle').attr('r', 2.6).attr('cx', a.x).attr('cy', a.y).style('fill', 'var(--text)')
        .transition().duration(900).ease(d3.easeCubicInOut).attr('cx', b.x).attr('cy', b.y).remove();
      nodes.filter((d) => d === b).transition().delay(850).duration(200).attr('r', (d) => 6 + d.v * 9).transition().duration(400).attr('r', (d) => 3 + d.v * 9);
    }
    if (!reduce) d3.interval(send, 140);
  };
  init();
}
