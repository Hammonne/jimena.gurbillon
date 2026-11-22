/* Punto de entrada: carga textos y datos, y arranca cada visualización cuando su sección
   se acerca a la pantalla (así la página carga rápido). */
import { redraw, reduce } from './core.js';
import { loadI18n, setLang, initLangToggle } from './i18n.js';
import { initTheme, initReveal } from './ui.js';
import { initHero } from './viz/hero.js';
import { initMap } from './viz/map.js';
import { initGinia } from './viz/ginia.js';
import { initVanDerPol } from './viz/vanderpol.js';
import { initNetwork } from './viz/network.js';
import { initEegJoyplot, initEegTopomap } from './viz/eeg.js';
import { initInterests } from './viz/interests.js';
import { initBundle } from './viz/bundle.js';
import { initTimeline } from './viz/timeline.js';
import { initTeaching } from './viz/teaching.js';

initLangToggle();
initTheme();

try {
  const [, interests, tools, timeline, teaching] = await Promise.all([
    loadI18n(),
    d3.json('data/interests.json'),
    d3.json('data/tools.json'),
    d3.json('data/timeline.json'),
    d3.json('data/teaching.json')
  ]);
  setLang('en');        // inglés por defecto
  initHero();           // grafo decorativo, tenue, detrás de la portada

  /* Qué arranca cada sección (por su id). */
  const views = {
    places: () => initMap(),
    research: () => { initGinia(); initVanDerPol(); initNetwork(); initEegJoyplot(); initEegTopomap(); },
    interests: () => initInterests(interests),
    tools: () => initBundle(tools),
    path: () => initTimeline(timeline),
    teaching: () => initTeaching(teaching)
  };
  const done = new Set();
  const run = (id) => { if (done.has(id)) return; done.add(id); lazy.unobserve(document.getElementById(id)); views[id](); };
  const lazy = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) run(e.target.id); }), { rootMargin: '400px 0px' });
  Object.keys(views).forEach((id) => lazy.observe(document.getElementById(id)));

  /* Al saltar a una sección (menú, link directo o botón atrás), algunas viz cambian de alto al iniciarse
     y moverían el destino: se inician todas primero y luego se vuelve a apuntar a la sección. */
  const jump = (smooth) => {
    const el = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!el) return;
    Object.keys(views).forEach(run);
    requestAnimationFrame(() => el.scrollIntoView({ behavior: smooth && !reduce ? 'smooth' : 'auto' }));
  };
  addEventListener('hashchange', () => jump(true));
  jump(false);

  if (document.fonts) document.fonts.ready.then(() => redraw('lang'));
} catch (err) {
  console.error('No se pudo iniciar la página:', err);
} finally {
  initReveal();         // siempre, para que nada quede invisible aunque falle un JSON
}
