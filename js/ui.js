/* Tema claro/oscuro, aparición al hacer scroll y contadores de la barra de stats. */
import { reduce, redraw } from './core.js';

export function initTheme() {
  document.getElementById('themeBtn').onclick = () => {
    const r = document.documentElement; r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark';
    redraw('theme');
  };
}

export function initReveal() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); e.target.dispatchEvent(new Event('seen')); io.unobserve(e.target); } }), { threshold: .15 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  document.getElementById('stats').addEventListener('seen', () => {
    document.querySelectorAll('[data-count]').forEach((el) => { const to = +el.dataset.count; d3.select(el).transition().duration(reduce ? 0 : 1200).tween('t', () => (t) => el.textContent = Math.round(to * t)); });
  });
}
