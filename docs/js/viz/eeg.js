/* Tarjeta BATIMIX (EEG): joyplot animado de fondo + topomapa real de potencia θ
   (61 electrodos, data/eeg_topo.json) con los botones Descansado / Sin dormir / Δ. */
import { css, reduce, showTip, hideTip, onRedraw } from '../core.js';
import { t } from '../i18n.js';

/* Joyplot de fondo (decorativo, canvas). */
export function initEegJoyplot() {
  const cv = document.getElementById('vEeg'), ctx = cv.getContext('2d'); let W, H, dpr = devicePixelRatio || 1;
  const size = () => { const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener('resize', size);
  const ch = ['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2','T3','T4']; const ph = ch.map(() => Math.random() * 9);
  let tt = 0, cols = { ink: css('--muted'), acc: css('--accent'), bg: css('--bg2'), txt: css('--faint') };
  onRedraw((w) => { if (w === 'theme') cols = { ink: css('--muted'), acc: css('--accent'), bg: css('--bg2'), txt: css('--faint') }; });
  const sig = (i, x) => { const occ = i === 8 || i === 9; const burst = Math.exp(-((((x % 600) - 380) / 70) ** 2)) * (occ ? 1.6 : .5); return Math.sin(x * .09 + ph[i]) * 2.4 + Math.sin(x * .023 + ph[i] * 2) * 3.4 + Math.sin(x * .31 + ph[i]) * .9 + burst * 9 * Math.sin(x * .2); };
  function frame() {
    tt += 1.2; ctx.fillStyle = cols.bg; ctx.fillRect(0, 0, W, H);
    const top = 22, gap = (H - 56) / ch.length;
    ch.forEach((c, i) => {
      const base = top + i * gap + gap / 2; ctx.beginPath();
      for (let x = 44; x <= W - 12; x += 2) { const y = base - sig(i, x + tt); x === 44 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.strokeStyle = (i === 8 || i === 9) ? cols.acc : cols.ink; ctx.lineWidth = (i === 8 || i === 9) ? 1.4 : 1; ctx.stroke();
      ctx.fillStyle = cols.txt; ctx.font = '500 10px JetBrains Mono, monospace'; ctx.fillText(c, 10, base + 3);
    });
    if (!reduce) requestAnimationFrame(frame);
  }
  frame();
}

/* Topomapa con isocontornos (interpolación por distancia inversa). */
export function initEegTopomap() {
  const svg = d3.select('#vTopo'); let cond = 'NS';
  return d3.json('data/eeg_topo.json').then((E) => {
    const r = svg.node().getBoundingClientRect(), W = r.width, H = r.height; svg.attr('viewBox', `0 0 ${W} ${H}`);
    const R = (H - 94) / 2, cx = W / 2, cy = 22 + R;
    const G = 56, xs = d3.range(G).map((i) => -1.05 + 2.1 * i / (G - 1));
    const grid = (key) => { const v = new Float64Array(G * G); for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const x = xs[i], y = -xs[j]; if (x * x + y * y > 1.1) { v[j * G + i] = NaN; continue; } let num = 0, den = 0; for (const e of E) { const dd = (e.x - x) ** 2 + (e.y - y) ** 2 + 1e-4; const wgt = 1 / (dd * Math.sqrt(dd)); num += wgt * e[key]; den += wgt; } v[j * G + i] = num / den; } return v; };
    const defs = svg.append('defs'); defs.append('clipPath').attr('id', 'headclip').append('circle').attr('cx', cx).attr('cy', cy).attr('r', R);
    const gC = svg.append('g').attr('clip-path', 'url(#headclip)');
    const head = svg.append('g').style('fill', 'none').style('stroke', 'var(--text)').attr('stroke-width', 1.5);
    head.append('circle').attr('cx', cx).attr('cy', cy).attr('r', R);
    head.append('path').attr('d', `M${cx - R * .12},${cy - R * .99} L${cx},${cy - R * 1.13} L${cx + R * .12},${cy - R * .99}`);
    svg.append('g').selectAll('circle').data(E).join('circle').attr('cx', (d) => cx + d.x * R).attr('cy', (d) => cy - d.y * R).attr('r', 2.2).style('fill', 'var(--text)').attr('opacity', .8)
      .on('pointermove', (e, d) => showTip(e, `<b>${d.ch}</b>θ NS ${d.NS.toFixed(3)} · SD ${d.SD.toFixed(3)}<br>Δ ${d.d >= 0 ? '+' : ''}${d.d.toFixed(4)} · p ${d.p.toFixed(2)}`)).on('pointerleave', hideTip);
    const cache = { NS: grid('NS'), SD: grid('SD'), d: grid('d') };
    const lab = svg.append('text').attr('x', 12).attr('y', 20).style('fill', 'var(--muted)').style('font', '500 11px var(--mono)');
    function render() {
      const v = cache[cond], vals = Array.from(v).filter((x) => !isNaN(x));
      let color, thr;
      if (cond === 'd') { const m = d3.max(vals, Math.abs); color = d3.scaleDiverging(d3.interpolateRdBu).domain([m, 0, -m]); thr = d3.range(-m, m, m / 7); }
      else { const ext = [d3.min(E, (e) => Math.min(e.NS, e.SD)), d3.max(E, (e) => Math.max(e.NS, e.SD))]; color = d3.scaleSequential(d3.interpolateMagma).domain([ext[0] * .95, ext[1] * 1.02]); thr = d3.range(ext[0], ext[1], (ext[1] - ext[0]) / 14); }
      const filled = Float64Array.from(v, (x) => isNaN(x) ? (cond === 'd' ? 0 : d3.mean(vals)) : x);
      const cs = d3.contours().size([G, G]).thresholds(thr)(filled);
      const tr = d3.geoTransform({ point(x, y) { this.stream.point(cx + (-1.05 + 2.1 * x / (G - 1)) * R, cy + (-1.05 + 2.1 * y / (G - 1)) * R); } });
      gC.selectAll('path').data(cs).join('path').attr('d', d3.geoPath(tr)).attr('fill', (d) => color(d.value)).style('stroke', 'rgba(0,0,0,.18)').attr('stroke-width', .5);
      lab.text(cond === 'd' ? t('topo_delta') : t('topo_rel') + (cond === 'NS' ? t('topo_ns') : t('topo_sd')));
    }
    render();
    document.querySelectorAll('[data-cond]').forEach((b) => b.onclick = () => { cond = b.dataset.cond; document.querySelectorAll('[data-cond]').forEach((x) => x.setAttribute('aria-pressed', x === b)); render(); });
    onRedraw((w) => { if (w === 'lang') render(); });
  });
}
