/* Tarjeta "Ver aprender a una red": activaciones ocultas que se separan por clase
   a lo largo de las épocas (al estilo de Rauber et al., 2017). Canvas. */
import { css, reduce, onRedraw } from '../core.js';

export function initNetwork() {
  const cv = document.getElementById('vAct'), ctx = cv.getContext('2d'); let W, H, dpr = devicePixelRatio || 1;
  const size = () => { const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener('resize', size);
  const palV = ['--accent','--coral','--yel','--teal','--blue','--vio','--grey','--accent-ink','--muted','--text'];
  let pal = palV.map(css);
  onRedraw((w) => { if (w === 'theme') pal = palV.map(css); });
  const pts = []; for (let c = 0; c < 10; c++) { const ang = c / 10 * 2 * Math.PI; for (let i = 0; i < 80; i++) { const g = d3.randomNormal(0, 1); pts.push({ c, x0: g() * .35, y0: g() * .35, t: Math.random(), w: g() * .12, ang }); } }
  let ep = 0, playing = !reduce;
  const slider = document.getElementById('epoch'), epv = document.getElementById('epv'), btn = document.getElementById('actPlay');
  slider.oninput = () => { ep = +slider.value; playing = false; btn.textContent = '▶'; };
  btn.onclick = () => { playing = !playing; if (ep >= 100) ep = 0; btn.textContent = playing ? '❚❚' : '▶'; };
  btn.textContent = playing ? '❚❚' : '▶';
  function pos(p, e) {
    const s = d3.easeCubicInOut(e / 100), r = s * (.25 + p.t * .7);
    const a = p.ang + p.w * (1 - s * .5) + Math.sin(p.t * 6 + p.c) * .08 * s;
    return [p.x0 * (1 - s) + Math.cos(a) * r, p.y0 * (1 - s) + Math.sin(a) * r];
  }
  function frame() {
    if (playing) { ep = Math.min(100, ep + .25); slider.value = ep; if (ep >= 100) { playing = false; btn.textContent = '▶'; } }
    epv.textContent = Math.round(ep);
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2 - 16, R = Math.min(W, H) * .46;
    ctx.lineWidth = .6;
    for (const p of pts) {
      ctx.strokeStyle = pal[p.c]; ctx.globalAlpha = .28; ctx.beginPath();
      for (let e = 0; e <= ep; e += 4) { const [x, y] = pos(p, e); e ? ctx.lineTo(cx + x * R, cy + y * R) : ctx.moveTo(cx + x * R, cy + y * R); }
      ctx.stroke();
      const [x, y] = pos(p, ep); ctx.globalAlpha = .9; ctx.fillStyle = pal[p.c]; ctx.beginPath(); ctx.arc(cx + x * R, cy + y * R, 1.6, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  frame();
}
