/* Utilidades compartidas: colores del tema, movimiento reducido, tooltip y redibujado. */

export const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const tip = document.getElementById('tip');
export const showTip = (e, html) => { tip.innerHTML = html; tip.style.opacity = 1; const x = Math.min(e.clientX + 14, innerWidth - 260); tip.style.left = x + 'px'; tip.style.top = (e.clientY + 14) + 'px'; };
export const hideTip = () => tip.style.opacity = 0;

/* Cada viz registra aquí qué hacer cuando cambia el idioma ('lang') o el tema ('theme'). */
const redraws = [];
export const onRedraw = (f) => redraws.push(f);
export const redraw = (why) => redraws.forEach((f) => f(why));
