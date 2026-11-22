/* Trayectoria: línea de tiempo tipo LifeLines, un carril por área.
   Barras = procesos que duran; puntos = momentos. Datos en data/timeline.json. */
import { reduce, showTip, hideTip, onRedraw } from '../core.js';
import { lang, t } from '../i18n.js';

export function initTimeline(data) {
  const NOW = data.now;
  const item = (it) => ({ t: [it.es, it.en], a: it.start, ...(it.end != null && { b: it.end === 'now' ? NOW : it.end }), ...(it.label && { lab: it.label }) });
  const LANES = data.lanes.map((ln) => ({ es: ln.es, en: ln.en, v: ln.color, rows: ln.rows.map((row) => row.map(item)) }));
  const W = 1160, L = 150, Rm = 20, RH = 34, LG = 22;
  let y = 40; LANES.forEach((ln) => { ln.y0 = y; ln.rows.forEach((r, k) => r.forEach((it) => it.y = y + k * RH + RH / 2)); y += ln.rows.length * RH + LG; ln.y1 = y - LG; });
  const H = y + 10;
  const svg = d3.select('#life').attr('viewBox', `0 0 ${W} ${H}`);
  const x = d3.scaleLinear().domain([2022, 2027.05]).range([L, W - Rm]);
  const ax = svg.append('g');
  [2022, 2023, 2024, 2025, 2026, 2027].forEach((yr) => {
    ax.append('line').attr('x1', x(yr)).attr('x2', x(yr)).attr('y1', 24).attr('y2', H - 6).style('stroke', 'var(--line)');
    if (yr < 2027) ax.append('text').attr('x', x(yr + .5)).attr('y', 18).attr('text-anchor', 'middle').style('fill', 'var(--faint)').style('font', '500 12px var(--mono)').text(yr);
  });
  ax.append('line').attr('x1', x(NOW)).attr('x2', x(NOW)).attr('y1', 24).attr('y2', H - 6).style('stroke', 'var(--accent)').attr('stroke-dasharray', '3 4');
  const nowT = ax.append('text').attr('x', x(NOW) + 6).attr('y', H - 8).style('fill', 'var(--accent-ink)').style('font', '500 11px var(--mono)');
  const laneL = svg.append('g').selectAll('text').data(LANES).join('text').attr('x', 0).attr('y', (d) => (d.y0 + d.y1) / 2 + 5).style('fill', (d) => `var(${d.v})`).style('font', '600 14px var(--font)');
  const items = LANES.flatMap((ln) => ln.rows.flat().map((it) => ({ ...it, v: ln.v })));
  const g = svg.append('g');
  const bars = items.filter((d) => d.b != null), pts = items.filter((d) => d.b == null);
  const bg = g.selectAll('g.bar').data(bars).join('g').attr('class', 'bar');
  const rects = bg.append('rect').attr('x', (d) => x(d.a)).attr('y', (d) => d.y - 9).attr('height', 18).attr('rx', 9).attr('width', 0)
    .style('fill', (d) => `var(${d.v})`).attr('fill-opacity', (d) => d.v === '--text' ? .18 : .28).style('stroke', (d) => `var(${d.v})`).attr('stroke-width', 1.2);
  const bl = bg.append('text').attr('y', (d) => d.lab === 'below' ? d.y + 24 : d.y + 4.5).style('fill', 'var(--text)').style('font', '500 12.5px var(--font)').style('pointer-events', 'none').attr('opacity', 0)
    .attr('x', (d) => d.lab === 'left' ? x(d.a) - 8 : d.lab === 'below' ? x(d.a) : d.lab === 'in' ? x(d.a) + 12 : x(d.b) + 8).attr('text-anchor', (d) => d.lab === 'left' ? 'end' : 'start');
  const pg = g.selectAll('g.pt').data(pts).join('g').attr('class', 'pt').attr('transform', (d) => `translate(${x(d.a)},${d.y})`);
  pg.append('circle').attr('r', 0).style('fill', (d) => `var(${d.v})`).style('stroke', 'var(--bg)').attr('stroke-width', 2);
  const pl = pg.append('text').attr('x', 11).attr('y', 4.5).style('fill', 'var(--text)').style('font', '500 12.5px var(--font)');
  const ym = (v) => { const yr = Math.floor(v), m = Math.round((v - yr) * 12); const M = t('months'); return `${M[Math.min(11, m)]} ${yr}`; };
  const tipOf = (d) => `<b>${d.t[lang === 'es' ? 0 : 1]}</b>${ym(d.a)}${d.b != null ? ' – ' + (d.b >= NOW ? t('now') : ym(d.b)) : ''}`;
  bg.on('pointermove', (e, d) => showTip(e, tipOf(d))).on('pointerleave', hideTip);
  pg.on('pointermove', (e, d) => showTip(e, tipOf(d))).on('pointerleave', hideTip);
  const setText = () => { laneL.text((d) => d[lang]); bl.text((d) => d.t[lang === 'es' ? 0 : 1]); pl.text((d) => d.t[lang === 'es' ? 0 : 1]); nowT.text(t('now')); bl.each(function (d) { d.minW = d.lab === 'in' ? this.getComputedTextLength() + 24 : 0; }); if (grown) rects.attr('width', wOf); };
  let grown = false; const wOf = (d) => Math.max(10, x(d.b) - x(d.a), d.minW || 0);
  setText(); onRedraw((w) => { if (w === 'lang') setText(); });
  const grow = () => {
    grown = true; rects.transition().duration(reduce ? 0 : 1100).delay((d, i) => reduce ? 0 : i * 70).ease(d3.easeCubicOut).attr('width', wOf);
    bl.transition().duration(400).delay((d, i) => reduce ? 0 : 500 + i * 70).attr('opacity', 1);
    pg.select('circle').transition().duration(reduce ? 0 : 500).delay((d, i) => reduce ? 0 : 600 + i * 90).attr('r', 7);
  };
  const rv = svg.node().closest('.reveal');
  if (rv.classList.contains('in')) grow(); else rv.addEventListener('seen', grow);
}
