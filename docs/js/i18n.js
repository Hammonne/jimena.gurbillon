/* Textos ES/EN. Los textos viven en i18n/es.json e i18n/en.json.
   En el HTML, data-i18n="clave" reemplaza el texto, data-i18n-html="clave" el HTML y data-i18n-alt="clave" el texto alternativo de una imagen. */
import { redraw } from './core.js';

const dict = { es: {}, en: {} };
export let lang = 'en';

export async function loadI18n() {
  const [es, en] = await Promise.all([d3.json('i18n/es.json'), d3.json('i18n/en.json')]);
  dict.es = es; dict.en = en;
}

/* Texto de la interfaz en el idioma actual. */
export const t = (k) => dict[lang][k] ?? dict.es[k] ?? k;

export function setLang(l) {
  lang = l; document.documentElement.lang = l;
  const D = dict[l];
  document.querySelectorAll('[data-i18n]').forEach((el) => { if (D[el.dataset.i18n] != null) el.textContent = D[el.dataset.i18n]; });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { if (D[el.dataset.i18nHtml] != null) el.innerHTML = D[el.dataset.i18nHtml]; });
  document.querySelectorAll('[data-i18n-alt]').forEach((el) => { if (D[el.dataset.i18nAlt] != null) el.alt = D[el.dataset.i18nAlt]; });
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === l));
  redraw('lang');
}

export function initLangToggle() {
  document.querySelectorAll('[data-lang]').forEach((b) => b.onclick = () => setLang(b.dataset.lang));
}
