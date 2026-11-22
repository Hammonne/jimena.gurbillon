/* Punto de entrada: carga textos y datos, dibuja el "mapa de mí" y arranca el router.
   Cada visualización se inicia solo cuando su sección se abre por primera vez. */
import { redraw } from './core.js';
import { loadI18n, setLang, initLangToggle } from './i18n.js';
import { initTheme, initReveal } from './ui.js';
import { initRouter } from './router.js';
import { initEgoMap } from './viz/egomap.js';
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
  const [, interests, tools, timeline, teaching, sitemap] = await Promise.all([
    loadI18n(),
    d3.json('data/interests.json'),
    d3.json('data/tools.json'),
    d3.json('data/timeline.json'),
    d3.json('data/teaching.json'),
    d3.json('data/sitemap.json')
  ]);
  setLang('en');        // inglés por defecto

  /* Qué arranca cada sección. init: la primera vez que se abre; show: las siguientes
     (para las viz que dependen del tamaño de su contenedor). */
  let graphW = 0;
  const widthOf = (sel) => Math.round(document.querySelector(sel).getBoundingClientRect().width);
  const views = {
    places: { init: () => initMap() },
    research: {
      init: () => { initGinia(); initVanDerPol(); initNetwork(); initEegJoyplot(); initEegTopomap(); },
      show: () => dispatchEvent(new Event('resize'))   // los canvas vuelven a medir su tarjeta
    },
    interests: {
      init: () => { graphW = widthOf('#graph'); initInterests(interests); },
      show: () => {   // si cambió el ancho mientras estaba oculta, se vuelve a calcular el layout
        const w = widthOf('#graph');
        if (Math.abs(w - graphW) > 2) { graphW = w; d3.select('#graph').selectAll('*').remove(); d3.select('#glegend').selectAll('*').remove(); initInterests(interests); }
      }
    },
    tools: { init: () => initBundle(tools) },
    path: { init: () => initTimeline(timeline) },
    teaching: { init: () => initTeaching(teaching) }
  };

  let router;
  const egomap = await initEgoMap(sitemap, { onOpen: (id) => router.open(id) });
  router = initRouter({ sitemap, views, egomap });
  if (document.fonts) document.fonts.ready.then(() => redraw('lang'));
} catch (err) {
  console.error('No se pudo iniciar la página:', err);
} finally {
  initReveal();         // siempre, para que nada quede invisible aunque falle un JSON
}
