/* Mapa "De dónde soy": dot map del Perú por departamentos + vista Mundo.
   Lugares y estados en data/places.json; geometrías en data/peru.json y data/world.json. */
import { reduce, showTip, hideTip, onRedraw } from '../core.js';
import { t } from '../i18n.js';

const PRETTY = { ANCASH:'Áncash', APURIMAC:'Apurímac', HUANUCO:'Huánuco', JUNIN:'Junín', 'SAN MARTIN':'San Martín', 'LA LIBERTAD':'La Libertad', 'MADRE DE DIOS':'Madre de Dios' };
const pretty = (n) => PRETTY[n] || n.charAt(0) + n.slice(1).toLowerCase();
const SV = { home:'--accent', visited:'--coral', want:'--teal', dream:'--yel', unknown:'--unv' };
const cat = (s) => t('cat_' + s);
const rewind = (f) => { if (d3.geoArea(f) > 2 * Math.PI) { const rev = (g) => g.type === 'Polygon' ? g.coordinates.forEach((r) => r.reverse()) : g.coordinates.forEach((p) => p.forEach((r) => r.reverse())); rev(f.geometry); } return f; };

export function initMap() {
  return Promise.all([d3.json('data/peru.json'), d3.json('data/world.json'), d3.json('data/places.json')]).then(([peru, wtopo, places]) => {
    const STATUS = Object.fromEntries(Object.entries(places.peru).map(([k, p]) => [k, p.status]));
    const CITIES = Object.fromEntries(Object.entries(places.peru).filter(([, p]) => p.city).map(([k, p]) => [k, p.city]));
    const WORLD = places.world;
    const active = new Set(['home','visited','want','dream','unknown']);

    peru.features.forEach(rewind);
    const world = topojson.feature(wtopo, wtopo.objects.countries).features.filter((f) => f.properties.name !== 'Antarctica');
    const W = 800, H = 900;
    const svg = d3.select('#map');
    const g = svg.append('g');
    const proj = d3.geoMercator().fitExtent([[30, 70], [W - 30, H - 30]], peru);
    const path = d3.geoPath(proj);
    const gw = g.append('g'), gd = g.append('g'), gdots = g.append('g'), gc = g.append('g');
    const stOf = (f) => STATUS[f.properties.n] || 'want';
    const wst = (f) => f.properties.name === 'Peru' ? 'home' : (WORLD[f.properties.name] || 'unknown');

    const wPaths = gw.selectAll('path').data(world).join('path').attr('d', path).style('fill', (d) => `var(${SV[wst(d)]})`).style('stroke', 'var(--bg2)').attr('stroke-width', .6).attr('opacity', 0)
      .on('pointermove', (e, d) => showTip(e, `<b>${d.properties.name}</b><span class="st" style="color:var(${SV[wst(d)]})">${cat(wst(d))}</span>`)).on('pointerleave', hideTip);
    const deps = gd.selectAll('path').data(peru.features).join('path').attr('d', path)
      .style('fill', (d) => `var(${SV[stOf(d)]})`).style('stroke', 'var(--bg2)').attr('stroke-width', 1.2).style('cursor', 'pointer')
      .on('pointermove', function (e, d) {
        d3.select(this).style('stroke', 'var(--text)').attr('stroke-width', 2).raise();
        const s = stOf(d); showTip(e, `<b>${pretty(d.properties.n)}</b><span class="st" style="color:var(${SV[s] === '--unv' ? '--muted' : SV[s]})">${cat(s)}</span>${CITIES[d.properties.n] ? `<br>${CITIES[d.properties.n]}` : ''}`);
      })
      .on('pointerleave', function () { d3.select(this).style('stroke', 'var(--bg2)').attr('stroke-width', 1.2); hideTip(); });

    // dot-map points
    const pts = [];
    peru.features.forEach((f) => {
      const [[x0, y0], [x1, y1]] = path.bounds(f); const s = stOf(f);
      const n = Math.max(6, Math.round(d3.geoArea(f) * 4.5e4));
      for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) { const x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0); if (d3.geoContains(f, proj.invert([x, y]))) { pts.push({ x, y, s }); i++; } }
    });
    const dots = gdots.selectAll('circle').data(pts).join('circle').attr('cx', (d) => d.x).attr('cy', (d) => d.y).attr('r', 0).style('fill', (d) => `var(${SV[d.s] === '--unv' ? '--unv-line' : SV[d.s]})`).style('pointer-events', 'none');

    // city markers
    const cityLL = Object.fromEntries(Object.values(places.peru).filter((p) => p.coords).map((p) => [p.city, p.coords]));
    const cm = gc.selectAll('g').data(Object.entries(cityLL)).join('g').attr('transform', (d) => `translate(${proj(d[1])})`).style('pointer-events', 'none');
    cm.append('circle').attr('r', (d) => d[0] === 'Lima' ? 6 : 3.2).style('fill', 'var(--bg)').style('stroke', 'var(--text)').attr('stroke-width', 1.5);
    const lima = cm.filter((d) => d[0] === 'Lima');
    const pulse = lima.append('circle').attr('r', 6).style('fill', 'none').style('stroke', 'var(--accent)').attr('stroke-width', 2);
    (function loop() { if (reduce) return; pulse.attr('r', 6).attr('opacity', 1).transition().duration(1800).ease(d3.easeCubicOut).attr('r', 26).attr('opacity', 0).on('end', loop); })();
    lima.append('text').attr('x', -12).attr('y', 4).attr('text-anchor', 'end').style('fill', 'var(--text)').style('font', '600 14px var(--font)').text('Lima');

    // dream pins (world)
    const dreams = places.dreams.map((d) => [d.label, d.coords]);
    const dp = gc.selectAll('g.dream').data(dreams).join('g').attr('class', 'dream').attr('opacity', 0).style('pointer-events', 'none');
    dp.append('circle').attr('r', 5).style('fill', 'var(--yel)').style('stroke', 'var(--bg)').attr('stroke-width', 1.5);
    dp.append('text').attr('x', 9).attr('y', -8).style('fill', 'var(--text)').style('font', '600 12px var(--font)').text((d) => d[0]);

    let view = 'peru', enc = 'dots', k = 1;
    const zoom = d3.zoom().scaleExtent([.25, 14]).on('zoom', (e) => {
      g.attr('transform', e.transform); k = e.transform.k;
      cm.selectAll('circle').attr('transform', `scale(${1 / k})`); cm.selectAll('text').attr('transform', `scale(${1 / k})`);
      dp.attr('transform', (d) => `translate(${proj(d[1])}) scale(${1 / k})`);
      dots.attr('r', enc === 'dots' ? 2.6 / Math.sqrt(k) : 0);
      deps.attr('stroke-width', 1.2 / k); wPaths.attr('stroke-width', .6 / k);
    });
    // La rueda sola no hace zoom (para no estorbar el scroll): solo Ctrl/Cmd + rueda.
    zoom.filter((e) => e.type !== 'wheel' || e.ctrlKey || e.metaKey);
    svg.call(zoom).on('dblclick.zoom', null);
    dp.attr('transform', (d) => `translate(${proj(d[1])})`);

    function fitTo(fc, pad, dur) {
      const [[x0, y0], [x1, y1]] = path.bounds(fc); const s = Math.min(8, .92 / Math.max((x1 - x0) / W, (y1 - y0) / H));
      const tr = d3.zoomIdentity.translate(W / 2, H / 2 + pad).scale(s).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
      svg.transition().duration(reduce ? 0 : dur).ease(d3.easeCubicInOut).call(zoom.transform, tr);
    }
    function apply() {
      const vis = (s) => active.has(s);
      deps.transition().duration(400).style('fill-opacity', (d) => enc === 'dots' ? (vis(stOf(d)) ? .12 : .04) : (vis(stOf(d)) ? 1 : .12));
      dots.transition().duration(reduce ? 0 : 600).delay(() => reduce ? 0 : Math.random() * 500).attr('r', (d) => enc === 'dots' && vis(d.s) ? 2.6 / Math.sqrt(k) : 0);
      wPaths.transition().duration(500).attr('opacity', (d) => view === 'world' ? 1 : d.properties.name === 'Ecuador' ? 1 : 0).style('fill-opacity', (d) => vis(wst(d)) ? 1 : .15);
      gd.transition().duration(500).attr('opacity', 1);
      dp.transition().duration(500).attr('opacity', view === 'world' ? 1 : 0);
      gc.selectAll('g:not(.dream)').transition().duration(400).attr('opacity', view === 'world' ? 0 : 1);
    }
    document.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => {
      view = b.dataset.view; document.querySelectorAll('[data-view]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      apply(); fitTo(view === 'world' ? { type: 'FeatureCollection', features: world } : peru, view === 'world' ? 20 : 20, 1400);
    });
    document.querySelectorAll('[data-enc]').forEach((b) => b.onclick = () => { enc = b.dataset.enc; document.querySelectorAll('[data-enc]').forEach((x) => x.setAttribute('aria-pressed', x === b)); apply(); });

    // legend (los números se calculan desde data/places.json)
    const nDeps = (s) => peru.features.filter((f) => stOf(f) === s).length;
    const counts = { home: nDeps('home'), visited: nDeps('visited'), want: nDeps('want'), dream: dreams.length };
    const nWantCountries = Object.values(WORLD).filter((s) => s === 'want').length;
    function legend() {
      const desc = { home: t('map_lg_home'), visited: t('map_lg_visited'), want: t('map_lg_want').replace('{n}', nWantCountries), dream: t('map_lg_dream') };
      d3.select('#legend').selectAll('button').data(['home','visited','want','dream']).join('button').attr('class', 'lg').attr('type', 'button')
        .attr('aria-pressed', (d) => active.has(d))
        .html((d) => `<span class="sw" style="background:var(${SV[d]});${d === 'unknown' ? 'outline:1px solid var(--unv-line)' : ''}"></span><span><b style="font-weight:600">${cat(d)}</b><br><span style="color:var(--muted);font-size:13px">${desc[d]}</span></span><span class="n">${counts[d]}</span>`)
        .on('click', (e, d) => { active.has(d) ? active.delete(d) : active.add(d); legend(); apply(); });
    }
    legend(); apply();
    onRedraw((why) => { if (why === 'lang') legend(); });
    // initial reveal animation
    if (!reduce) deps.attr('opacity', 0).transition().duration(700).delay((d, i) => 150 + i * 45).attr('opacity', 1);
  }).catch((err) => { console.error(err); d3.select('#map').append('text').attr('x', 40).attr('y', 80).style('fill', 'var(--muted)').text(t('map_error')); });
}
