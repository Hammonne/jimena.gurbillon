/* Tarjeta El Popular: partículas que fluyen en el espacio de fase del oscilador de Van der Pol (canvas). */
import { css, reduce, onRedraw } from '../core.js';

export function initVanDerPol() {
  const cv = document.getElementById('vVdp'), ctx = cv.getContext('2d'); let W, H, dpr = devicePixelRatio || 1, mu = 1.4;
  const size = () => { const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener('resize', size);
  const N = 900; let P = Array.from({ length: N }, () => ({ x: (Math.random() - .5) * 8, y: (Math.random() - .5) * 10, a: Math.random() * 200 }));
  const sx = (x) => W / 2 + x * W / 9, sy = (y) => H / 2 - 14 - y * H / 14;
  document.getElementById('mu').oninput = (e) => { mu = +e.target.value; document.getElementById('muv').textContent = mu.toFixed(1); };
  let col = css('--accent'), bg = css('--bg2');
  onRedraw((w) => { if (w === 'theme') { col = css('--accent'); bg = css('--bg2'); } });
  function frame() {
    ctx.fillStyle = bg; ctx.globalAlpha = .12; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const p of P) {
      const h = .012; const x0 = p.x, y0 = p.y;
      for (let k = 0; k < 2; k++) { const dx = p.y, dy = mu * (1 - p.x * p.x) * p.y - p.x; p.x += h * dx; p.y += h * dy; }
      ctx.moveTo(sx(x0), sy(y0)); ctx.lineTo(sx(p.x), sy(p.y));
      if (++p.a > 260 || Math.abs(p.y) > 12) { p.x = (Math.random() - .5) * 8; p.y = (Math.random() - .5) * 10; p.a = 0; }
    }
    ctx.stroke();
    if (!reduce) requestAnimationFrame(frame);
  }
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  if (reduce) for (let i = 0; i < 300; i++) frame(); else frame();
}
