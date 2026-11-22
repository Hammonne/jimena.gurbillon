/* Tema claro/oscuro y aparición al hacer scroll. */
import { redraw } from './core.js';

export function initTheme() {
  document.getElementById('themeBtn').onclick = () => {
    const r = document.documentElement; r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark';
    redraw('theme');
  };
}

export function initReveal() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); e.target.dispatchEvent(new Event('seen')); io.unobserve(e.target); } }), { threshold: .15 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}
