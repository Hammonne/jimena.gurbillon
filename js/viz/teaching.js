/* Árbol colapsable de docencia: cada curso a la izquierda y sus temas a la derecha.
   Datos en data/teaching.json. */
import { reduce, onRedraw } from '../core.js';
import { lang } from '../i18n.js';

export function initTeaching(src) {
  const data = { n: src.root, children: src.courses.map((c) => ({ n: { es: c.es, en: c.en }, v: c.color, children: c.topics.map((tp) => ({ n: { es: tp.es, en: tp.en }, v: c.color })) })) };
  const H = 440, svg = d3.select('#teach'), g = svg.append('g').attr('transform', 'translate(20,0)');
  const root = d3.hierarchy(data); root.x0 = H / 2; root.y0 = 0;
  root.descendants().forEach((d) => { d._children = d.children; });
  const tr = d3.tree().size([H - 40, 440]).separation((a, b) => a.parent === b.parent ? 1 : 1.6);
  const lk = d3.linkHorizontal().x((d) => d.y).y((d) => d.x);
  const gl = g.append('g'), gn = g.append('g');
  function update(src) {
    tr(root); root.descendants().forEach((d) => d.x += 20);
    const dur = reduce ? 0 : 450;
    const node = gn.selectAll('g.n').data(root.descendants(), (d) => d.data.n.es);
    const ne = node.enter().append('g').attr('class', 'n').attr('transform', `translate(${src.y0},${src.x0})`).attr('opacity', 0)
      .style('cursor', (d) => d._children ? 'pointer' : 'default').on('click', (e, d) => { if (!d._children || d.depth === 0) return; d.children = d.children ? null : d._children; update(d); });
    ne.append('circle').attr('r', (d) => d.depth === 2 ? 4 : 7).attr('stroke-width', 2);
    ne.style('display', (d) => d.depth === 0 ? 'none' : null);
    ne.append('text').attr('dy', '0.32em').attr('x', (d) => d.depth === 2 ? 10 : -14).attr('text-anchor', (d) => d.depth === 2 ? 'start' : 'end')
      .style('font', (d) => d.depth === 2 ? '400 12.5px var(--font)' : '600 14px var(--font)').style('fill', 'var(--text)');
    const nu = ne.merge(node);
    nu.select('text').text((d) => d.data.n[lang]);
    nu.select('circle').style('fill', (d) => d.depth === 0 ? 'var(--text)' : d.depth === 1 && !d.children ? `var(${d.data.v})` : 'var(--card)').style('stroke', (d) => d.depth === 0 ? 'var(--text)' : `var(${d.data.v})`);
    nu.transition().duration(dur).attr('transform', (d) => `translate(${d.y},${d.x})`).attr('opacity', 1);
    node.exit().transition().duration(dur).attr('transform', `translate(${src.y},${src.x})`).attr('opacity', 0).remove();
    const link = gl.selectAll('path').data(root.links().filter((l) => l.source.depth > 0), (d) => d.target.data.n.es);
    link.enter().append('path').style('fill', 'none').attr('stroke-width', 1.6).style('stroke', (d) => `var(${d.target.data.v})`).attr('stroke-opacity', .6)
      .attr('d', () => { const o = { x: src.x0, y: src.y0 }; return lk({ source: o, target: o }); })
      .merge(link).transition().duration(dur).attr('d', lk);
    link.exit().transition().duration(dur).attr('d', () => { const o = { x: src.x, y: src.y }; return lk({ source: o, target: o }); }).remove();
    root.descendants().forEach((d) => { d.x0 = d.x; d.y0 = d.y; });
  }
  update(root);
  onRedraw((w) => { if (w === 'lang') update(root); });
}
