/* Punto de entrada: carga textos y datos, y arranca cada visualización
   en el mismo orden que el prototipo original. */
import { redraw } from './core.js';
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
  initHero();           // fondo del hero (decorativo, no depende de los datos)
  initMap();            // mapa Perú / Mundo (carga sus propios datos)
  initGinia();          // tarjetas de investigación
  initVanDerPol();
  initNetwork();
  initEegJoyplot();
  initInterests(interests); // "How it all connects" (métodos y conceptos)
  initEegTopomap();
  initBundle(tools);    // "Herramientas y proyectos"
  initTimeline(timeline);
  initTeaching(teaching);

  setLang('en');        // inglés por defecto
  if (document.fonts) document.fonts.ready.then(() => redraw('lang'));
} catch (err) {
  console.error('No se pudo iniciar la página:', err);
} finally {
  initReveal();         // siempre, para que nada quede invisible aunque falle un JSON
}
