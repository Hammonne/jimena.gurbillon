/* Tarjeta "Watching a network learn": activaciones REALES de la última capa oculta de una MLP
   entrenada sobre sklearn digits (data/hidden_activity.json, generado con scripts/hidden_activity.py),
   proyectadas con t-SNE alineado entre épocas (Rauber et al., 2017).
   Se anima interpolando posiciones entre las épocas guardadas; cada punto deja una estela corta. Canvas. */
import { css, reduce, onRedraw } from '../core.js';
import { t } from '../i18n.js';

export function initNetwork() {
  const cv = document.getElementById('vAct'), ctx = cv.getContext('2d'); let W, H, dpr = devicePixelRatio || 1;
  const size = () => { const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener('resize', size);
  const palV = ['--accent','--coral','--yel','--teal','--blue','--vio','--grey','--accent-ink','--muted','--text'];
  let pal = palV.map(css);
  onRedraw((w) => { if (w === 'theme') pal = palV.map(css); });
  const slider = document.getElementById('epoch'), epv = document.getElementById('epv'), btn = document.getElementById('actPlay');

  d3.json('data/hidden_activity.json').then((D) => {
    const E = D.epochs.length, last = E - 1;
    const xr = d3.max(D.x.flat(), Math.abs) || 1, yr = d3.max(D.y.flat(), Math.abs) || 1;   // rango real de los datos
    const byClass = d3.range(10).map((c) => D.labels.flatMap((l, i) => (l === c ? [i] : [])));
    slider.min = 0; slider.max = last; slider.step = 'any'; slider.value = 0;
    let f = 0, playing = !reduce, shown = '';
    const SPEED = last / (14 * 60);            // ~14 s de la época 0 a la última
    const TRAIL = [0, .1, .2, .3];             // estela: dónde estaba el punto un poco antes
    const at = (i, g) => { g = Math.max(0, g); const a = Math.floor(g), b = Math.min(last, a + 1), u = g - a; return [D.x[a][i] + (D.x[b][i] - D.x[a][i]) * u, D.y[a][i] + (D.y[b][i] - D.y[a][i]) * u]; };
    const label = () => {   // "epoch 12 · test acc 0.94" (la época guardada más cercana)
      const k = Math.round(f), s = t('act_label').replace('{e}', D.epochs[k]).replace('{a}', D.acc[k].toFixed(2));
      if (s !== shown) { epv.textContent = s; shown = s; }
    };
    const setBtn = () => { btn.textContent = playing ? '❚❚' : '▶'; };
    slider.oninput = () => { f = +slider.value; playing = false; setBtn(); };
    btn.onclick = () => { playing = !playing; if (playing && f >= last) f = 0; setBtn(); };
    onRedraw((w) => { if (w === 'lang') { shown = ''; label(); } });
    setBtn();

    function frame() {
      if (playing) { f = Math.min(last, f + SPEED); slider.value = f; if (f >= last) { playing = false; setBtn(); } }
      label();
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = (H - 56) / 2, k = Math.min(W * .46 / xr, (H - 56) / 2 / yr - 7);   // con margen: nada toca los bordes ni la barra   // misma escala en x e y
      const P = (p) => [cx + p[0] * k, cy - p[1] * k];
      ctx.lineWidth = 1; ctx.globalAlpha = .22;
      for (let c = 0; c < 10; c++) {             // estelas cortas y tenues
        ctx.strokeStyle = pal[c]; ctx.beginPath();
        for (const i of byClass[c]) TRAIL.forEach((d, s) => { const [x, y] = P(at(i, f - d)); s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.stroke();
      }
      ctx.globalAlpha = .9;
      for (let c = 0; c < 10; c++) {             // puntos, coloreados por clase (dígito)
        ctx.fillStyle = pal[c]; ctx.beginPath();
        for (const i of byClass[c]) { const [x, y] = P(at(i, f)); ctx.moveTo(x + 1.8, y); ctx.arc(x, y, 1.8, 0, 7); }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }
    frame();
  }).catch((err) => console.error('No se pudieron cargar las activaciones:', err));
}
