/* Navegación de una sola página: portada "mapa de mí" + una sección abierta a la vez.
   Rutas por hash (#about, #places, …): el botón atrás del navegador, los links directos
   y la recarga abren la misma sección. Cada visualización se inicia solo la primera vez
   que se abre su sección. */
import { reduce, hideTip, onRedraw } from './core.js';
import { lang, t } from './i18n.js';

export function initRouter({ sitemap, views, egomap }) {
  const S = sitemap.sections, ids = S.map((s) => s.id);
  const secEl = (id) => document.querySelector(`[data-route="${id}"]`);
  const body = document.body, inited = new Set();
  let current = null, seq = 0;

  ids.forEach((id) => secEl(id).querySelector('h2').setAttribute('tabindex', '-1'));

  /* ---- textos que dependen del idioma: lista de secciones, Previous / Next, botón ---- */
  function setTexts() {
    d3.select('#secnav ul').selectAll('li').data(S).join('li')
      .html((s) => `<a href="#${s.id}">${s[lang]}</a>`);
    ids.forEach((id, i) => {
      const prev = S[i - 1], next = S[i + 1];
      secEl(id).querySelector('.pn').innerHTML =
        (prev ? `<a class="prev" href="#${prev.id}"><span class="k">${t('prev')}</span>${prev[lang]}</a>` : '') +
        (next ? `<a class="next" href="#${next.id}"><span class="k">${t('next')}</span>${next[lang]}</a>` : '');
      secEl(id).querySelector('.pn').setAttribute('aria-label', t('pn_aria'));
    });
    document.getElementById('secnav').setAttribute('aria-label', t('all_sections'));
    document.getElementById('egomap').setAttribute('aria-label', t('map_aria'));
    document.querySelector('.intro img').alt = t('photo_alt');
    markCurrent();
  }
  const markCurrent = () => d3.selectAll('#secnav a').attr('aria-current', function () { return this.getAttribute('href') === '#' + current ? 'page' : null; });
  setTexts(); onRedraw((w) => { if (w === 'lang') setTexts(); });

  /* ---- abrir / cerrar ---- */
  async function show(id, animate) {
    if (id === current) return;
    const tok = ++seq, from = current;
    current = id; hideTip(); markCurrent();
    animate = animate && !reduce;
    if (id == null) {                                   // volver a la portada
      if (from) secEl(from).hidden = true;
      body.classList.remove('in-section');
      window.scrollTo({ top: 0, behavior: 'instant' });
      await egomap.setMode('home', null, animate);
      if (tok === seq && from) egomap.focusSection(from);
      return;
    }
    body.classList.add('in-section');
    const fromHome = from == null;
    const shrink = egomap.setMode('mini', id, animate && fromHome);
    if (from) secEl(from).hidden = true;
    if (animate && fromHome && !egomap.narrow) await Promise.race([shrink, new Promise((r) => setTimeout(r, 420))]);
    if (tok !== seq) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    const el = secEl(id);
    el.hidden = false;
    // la viz se inicia con la sección ya visible (así mide bien su contenedor)
    if (!inited.has(id)) { inited.add(id); views[id]?.init?.(); } else views[id]?.show?.();
    el.classList.remove('entering');
    if (animate) { void el.offsetWidth; el.classList.add('entering'); }
    el.querySelector('h2').focus({ preventScroll: true });
  }

  const parse = () => { const h = decodeURIComponent(location.hash.slice(1)); return ids.includes(h) ? h : h === '' ? null : undefined; };
  const onNav = () => { const r = parse(); if (r !== undefined) show(r, true); };   // otros hashes (#contact, #main) se ignoran
  addEventListener('hashchange', onNav);
  addEventListener('popstate', onNav);
  const goHome = () => { if (current == null) return; history.pushState(null, '', location.pathname + location.search); show(null, true); };
  document.getElementById('backBtn').addEventListener('click', goHome);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && current && !e.defaultPrevented) goHome(); });

  const first = parse();
  if (first) show(first, false);
  return { open: (id) => { if (location.hash !== '#' + id) location.hash = id; else show(id, true); } };
}
