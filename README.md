# Jimena Gurbillon · página personal

Sitio estático (HTML + CSS + D3.js v7) para GitHub Pages. No hay build ni dependencias que instalar: D3 y topojson-client se cargan desde CDN.

## Verla en local

Los módulos de JS y los `fetch` de los JSON no funcionan abriendo `index.html` con doble clic (`file://`). Hay que levantar un servidor:

```bash
cd Hammonne.github.io
python3 -m http.server 8000
```

Y abrir <http://localhost:8000>.

## Estructura

```
index.html            estructura de la página (sin textos fijos: salen de i18n/)
css/style.css         estilos y colores de los temas oscuro/claro
js/main.js            carga datos y arranca todo
js/i18n.js            cambio de idioma ES/EN
js/ui.js              tema, aparición al hacer scroll, contadores
js/viz/*.js           una visualización por archivo (hero, map, interests, bundle, timeline, teaching, ginia, vanderpol, network, eeg)
i18n/es.json, en.json textos de la página
data/*.json           datos de las visualizaciones
img/                  fotos
cv.pdf                tu CV (el botón "CV" apunta aquí)
```

## Editar textos (`i18n/`)

`i18n/es.json` e `i18n/en.json` tienen las mismas claves. En el HTML, cada texto está marcado con `data-i18n="clave"` (o `data-i18n-html="clave"` si lleva negritas o enlaces). Para cambiar un texto, edita el valor de esa clave en **los dos** archivos. Si el texto tiene `<b>` o `<a>`, mantén las etiquetas.

## Editar datos (`data/`)

Todos los nombres van en dos idiomas (`"es"` y `"en"`). Los colores son variables del tema (`--accent`, `--teal`, `--yel`, `--vio`, `--coral`, `--blue`, `--mint`, `--grey`, `--text`).

| Archivo | Qué controla |
|---|---|
| `places.json` | Mapa. `peru`: departamentos con estado (`home`, `visited`, `want`), ciudad y coordenadas `[lon, lat]` del marcador. Los departamentos que no aparecen cuentan como `want`. `world`: estado de cada país (nombre en inglés, como en `world.json`). `dreams`: los pines de Tsinghua/PKU y ETH. Los números de la leyenda se calculan solos. |
| `interests.json` | Grafo "How it all connects": métodos, modelos y conceptos (no herramientas; esas van en `tools.json`). `communities`: cada comunidad con un `id`, su color y sus temas (cada tema con su propio `id`). `links`: pares de `id` con una conexión real entre conceptos (también puede ser el `id` de una comunidad, como `"gnn"`). Las etiquetas se acomodan solas para no pisarse. El fondo del hero no depende de este archivo. |
| `tools.json` | Edge bundling "Tools & projects". `groups`: grupos y sus elementos. `uses`: qué herramientas usa cada proyecto. `english`: traducción de los nombres que cambian en inglés. |
| `timeline.json` | Trayectoria. Un carril por área; cada fila es una lista de elementos. Con `end` es una barra; sin `end`, un punto. `"end": "now"` llega hasta hoy (`now` arriba del archivo). `label`: `"in"` (dentro de la barra), `"left"` (a la izquierda) u omitido (a la derecha). |
| `teaching.json` | Árbol de docencia: cursos y sus temas. |
| `eeg_topo.json` | Topomapa EEG (61 electrodos, datos reales de BATIMIX). |
| `peru.json`, `world.json` | Geometrías del mapa. No hace falta tocarlas. |

**Fechas de la línea de tiempo:** van como año con decimales. El mes que muestra el tooltip es `redondear(decimal × 12)`: ene `.0`, feb `.08`, mar `.17`, abr `.25`, may `.33`, jun `.42`, jul `.5`, ago `.58`, sep `.67`, oct `.75`, nov `.83`, dic `.92`. Ejemplo: marzo 2024 = `2024.17`.

Si un JSON tiene un error de sintaxis (una coma de más, comillas faltantes), la visualización no carga y el error sale en la consola del navegador (F12). Puedes validar el archivo en <https://jsonlint.com>.

## Publicar

El repo `Hammonne.github.io` se publica solo en <https://hammonne.github.io> desde la rama `main` (en Settings, sección Pages: "Deploy from a branch", rama `main`, carpeta `/ (root)`). Recuerda subir `cv.pdf` a la raíz.
