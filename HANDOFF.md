# Better SED — Handoff

Extensión Chromium (Manifest V3) para la plataforma **SED** (ex CUV) de FCEyT-UNSE.
Objetivo: interfaz más limpia, modo oscuro y evitar el cierre de sesión por inactividad.

Estado: **Fase 1 completa**, **Fase 2 en progreso** (modo oscuro iterándose contra el sitio real).

## Hallazgos del sitio

- Moodle **4.5.x**, tema **Boost**, Bootstrap 4. No tiene modo oscuro nativo
  (`prefers-color-scheme` y `.dark` no aparecen en su CSS). El modo oscuro se hace con CSS propio.
- `M.cfg` declara `sessiontimeout: 28800` (8 h) y `sessiontimeoutwarning: 1200` (20 min).
  Moodle cierra la sesión cuando el registro de sesión no se toca en 8 h.
- La cookie `MoodleSession` es de sesión, `Secure` y sin `SameSite` (Lax por defecto).
  Por eso el keepalive **debe correr desde el content script** (mismo origen): un fetch desde
  un service worker no enviaría la cookie.
- **El tema no agrega la clase `loggedin` al `<body>`**, ni siquiera con sesión iniciada.
  La señal confiable es `M.cfg.userId > 0`. El keepalive usa eso (con `body.loggedin` como
  fallback) desde el fix del 11/11/2026.
- Hay contenido guardado con estilos inline de Dark Reader (bloque "Recursos"), que necesita
  overrides puntuales en el CSS oscuro.
- El footer flotante es `footer#page-footer.footer-popover.bg-white`. Para pisarlo hay que usar
  `#page-footer.footer-popover`: una regla con solo `.footer-popover` pierde por especificidad.
- **Cascada:** `.tertiary-navigation .btn` (misma especificidad que `.btn.search-icon`) pisaba
  el color del buscador por estar más abajo en el archivo. El override del nav ahora excluye
  `.search-icon` con `:not()`. Si un `!important` "no aplica", revisar reglas posteriores de
  igual especificidad antes de tocar el valor.
- **Filas blancas:** Moodle pinta `tbody tr:nth-of-type(2n)` y variantes como `.discussion.subscribed`
  en blanco. `darkmode.css` neutraliza las pares y agrega una zebra propia de 2 % de blanco.
- Dominio actual: `https://cuv-fceyt.unse.edu.ar/*`.

## Stack

- **Vite + TypeScript + Manifest V3**. Es el stack correcto para este proyecto.
- **Sin React**: el popup son dos checkboxes y una línea de estado. React no afectaba el
  rendimiento del sitio (el popup solo carga al abrirlo), pero eliminarlo deja menos
  dependencias y menos configuración.
- **Sin service worker y sin mensajería**: el popup escribe settings en `chrome.storage.sync`
  y el content script escucha `chrome.storage.onChanged`. No hacen falta `tabs`, `scripting`
  ni `activeTab`.
- El content script debe quedar autocontenido (sin imports compartidos) para que Vite lo emita
  como script clásico.

## Arquitectura

```
public/manifest.json     Manifest V3 (solo permiso storage)
public/darkmode.css      Tema oscuro (se inyecta siempre, scopeado a .bettercuv-dark)
src/content/content.ts   Aplica settings + keepalive de sesión
src/popup/Popup.ts       UI del popup (TS plano)
src/styles/Popup.css     Estilos del popup
index.html               Entrypoint del popup
vite.config.ts           Build de popup + content.js
```

### Settings (`chrome.storage.sync`, clave `settings`)

```ts
type Settings = {
    dark: boolean;       // default: true
    keepalive: boolean;  // default: true
};
```

Se aplican como clases en `<html>`:

- `.bettercuv-dark`
- `.bettercuv-minimal` (Fase 3)

El content script escucha cambios y actualiza todas las pestañas abiertas sin recargar.

### Keepalive de sesión

- Solo corre en el frame principal, con sesión iniciada y si el setting está activo.
- **Detección de sesión**: `M.cfg.userId > 0`, con fallback a `body.loggedin`. No usar solo
  `body.loggedin`: este tema no la agrega.
- Lee `M.cfg.sesskey` y cada **10 minutos** hace:

```
POST /lib/ajax/service.php?sesskey=<sesskey>&info=core_session_touch
Content-Type: application/json
[{"index":0,"methodname":"core_session_touch","args":{}}]
```

- Si la respuesta es `data === true`, guarda `lastTouch` en `chrome.storage.local` para el popup.
- Límites reales: funciona con Chrome abierto y una pestaña de SED viva. No sobrevive a cerrar
  Chrome ni a dormir la máquina más de 8 h. Es un bypass del logout por inactividad, con el
  costo de seguridad que eso implica.

## Modo oscuro

### Paleta

Definida como variables `--bcv-*` en `.bettercuv-dark`:

| Rol | Color |
| --- | --- |
| Fondo | `#101218` + halo radial azul muy sutil |
| Superficie / cards | `#1c202b` |
| Superficie 2 / inputs | `#232838` |
| Bordes | `#2c3244` |
| Texto | `#e6e9f2` |
| Texto muted | `#a6aec4` |
| Acento / links | `#9db4ff` |
| Acento hover | `#c2d0ff` |
| Acento fuerte | `#6f8dff` |
| Éxito / alerta / error | `#7fd6a0` / `#f0c674` / `#ff9a9a` |

La idea no es invertir colores: superficies con jerarquía, un solo acento lavanda, bordes
suaves y radios consistentes (8–12 px).

### Dirección de diseño

- **Estilo clean:** Moodle tiene ruido (líneas, cajas, dos filas de tabs, bordes internos).
  El tema quita lo que no comunica y deja jerarquía por superficie y espaciado.
- **Una sola profundidad:** bordes de 1 px y cambios de superficie. Sin sombras grandes.
- **Un solo acento:** el lavanda se usa para links, acciones y estado activo. El resto es
  gris/neutro; los colores semánticos (éxito, alerta, error) solo cuando significan algo.
- **Grilla de 4 px** para padding y márgenes; radios 8–12 px.
- **Sin JS para el tema:** si un patrón necesita estado (por ejemplo, scroll), se resuelve
  con CSS y, si no alcanza, se documenta el límite antes de agregar código.

### Cobertura actual de `darkmode.css`

Navbar, drawers y course index, cards de cursos y dashboard, tabs (incluido onetopic),
alerts (incluidos los inline), botones, formularios, tablas/generaltable, listas, paginación,
badges, breadcrumbs, actividades, bloques, progreso, dropdowns, popovers, tooltips, toasts,
notificaciones, drawer de mensajes, modales, footer, foro, cuestionarios, calendario y login.

### Iteración actual (11/11/2026)

- **My courses** revisada contra el sitio logueado.
- Corregido: subrayado del tab activo, fondo de bloques, botón flotante de ayuda, popover de
  notificaciones con ítems blancos, drawer de mensajes, tres puntos de las cards.
- **Course overview**: el tema deja el `.card-body` del bloque sin padding lateral. Se agregó
  padding 16 px, se ocultó el `<hr>` interno y el `.footer` vacío, y se quitó la línea superior
  del footer de cada card. Menos líneas y el título ya no está pegado a la esquina.
- **Página de curso** (`course/view.php?id=3521`, formato `onetopic`) revisada con el sitio real:
  - Tabs superiores del curso: se quitó el fondo blanco de `nav.moremenu` y del `ul`, tab activo
    con superficie 2 y texto de acento.
  - Tabs de onetopic: eran cajas con borde en dos filas. Ahora son una sola fila con scroll
    horizontal, sin bordes, texto muted y tab activo como pill de superficie 2 con acento.
    Como no hay JS, un degradado a la derecha insinúa que hay más tabs.
  - Alertas con `background` inline del docente: fondo superficie 2, texto claro y borde
    izquierdo info. Los títulos con `color` inline (verde oscuro) pasan a color de texto.
  - Actividades: se quitaron las líneas separadoras; quedan filas con padding y hover suave.
  - Drawer del course index verificado: fondo, ítems muted, secciones y scroll oscuros.
    Para abrirlo en el navegador de pruebas alcanza con un click real en "Open course index";
    forzar las clases (`show-drawer-left`, `drawer-open-left`, `.show`) sirve solo para mirar,
    pero deja el layout superpuesto.
- **Página de actividad** (`mod/page`) revisada: hereda el tema sin cambios extra. El contenido
  inline del docente, el breadcrumb y las tabs de onetopic ya quedan oscuros.
- **Dashboard** revisado: calendario, cursos recientes, timeline y el switch de "Edit mode"
  quedan oscuros; no hizo falta tocar nada.
- **Reporte de calificaciones** (`grade/report/user`): el tema pinta `.user-report-container`
  y los `tr`/`td` en blanco. Se pasó el contenedor a superficie, las filas a transparente y las
  categorías a superficie 2; links en acento. También se corrigió el borde claro y el texto
  oscuro de `.tertiary-navigation` (selector "User report").
- **Home** revisada contra el sitio real:
  - El árbol de categorías y los cursos ahora son **una sola tarjeta** (`.course_category_tree`)
    con "Expand all" adentro; `.subcategories` y `.courses.category-browse` quedaron planos.
  - Filas de categoría y de curso con padding y hover; conteos en muted.
  - El botón de búsqueda tiene el ícono oscuro sobre el acento; el submit de la barra superior
    (`.btn-submit`) se pasó a superficie 2.
- **Categoría de cursos** (`course/index.php?categoryid=30`): misma tarjeta única; la lista de
  cursos se separa con un borde superior en vez de una segunda caja.
- **Foro** (`mod/forum/view` y `discuss`): filas `.discussion.subscribed` y filas pares venían
  en blanco; ahora transparentes con zebra suave. `.activity-header` en superficie 2. La tarjeta
  del post ya hereda el tema.
- **Cuestionario** (`mod/quiz/view`): tabla de intentos con filas pares blancas, corregido con
  la regla general de `tbody tr:nth-of-type(even)`.
- **Tarea** (`mod/assign/view`), **calendario** (`calendar/view`) y **participantes**
  (`user/index.php`): revisados, sin fondos claros salvo acentos intencionales.
- **Mensajes** (`message/index.php`): listado y panel oscuros; el botón de búsqueda
  (`.btn-submit`) era el único gris claro.
- **Pulido 12/11/2026**:
  - Árbol de categorías: el chevron de Moodle es una imagen negra que no se puede recolorear.
    Se reemplazó por `::before` con `›` en color de texto; rota 90° cuando la categoría no está
    `.collapsed`. Solo aplica a `.category.with_children`.
  - Foro: `.forumpost .header` quedó transparente y sin borde; toda la carta es una superficie
    plana (el avatar y el título ya no viven en una banda más clara).
  - Tabs del curso (`.secondary-navigation .nav-tabs`): pills de 36 px, radio 8, hover suave y
    activo en superficie 2 + acento. Se eliminó el borde claro de `nav.moremenu` (el `ul` deja
    una línea muted).
  - Cartas de curso: padding 16 px uniforme, título 15 px/600 con interlineado 1.6. Se mantiene
    el `text-truncate` de Moodle para no exponer la categoría oculta de la carta.
  - Bloque Course overview: el tema de Moodle trae
    `.drawers .block_myoverview > .card-body { padding: 0 0 16px !important }`, misma especificidad
    que `.bettercuv-dark .block > .card-body`. El CSS de content script se inyecta antes de las
    hojas de la página, así que en un empate gana Moodle. Se subió la especificidad con
    `html.bettercuv-dark`.
- **Pulido 13/11/2026:**
  - Mensajes: la burbuja recibida (`.message.received`) venía blanca y con el texto ya claro
    encima. Ahora usa `--bcv-surface-2` con texto normal.
  - Página de curso formato weeks: `.section-item` traía borde claro `#dee2e6`, el círculo del
    desplegable `.icons-collapse-expand` fondo celeste, y `.activity-description` una línea
    superior clara. Los tres pasaron a `--bcv-border` / `--bcv-surface-2`.
  - Tarea: la tabla de Submission status venía con verdes/amarillos claros y texto negro
    (ilegible sobre el tema). Ahora es una tabla oscura con tintes suaves por estado
    (`.submissionstatussubmitted`, `.submissionstatusdraft`, `.latesubmission`). Al pasar el
    mouse, `.table-hover tbody tr:hover` de Bootstrap devolvía `color: #1d2125`: se fuerza
    `--bcv-text` en esa misma regla.
  - Entrega de tarea (`action=editsubmission`): el círculo del acordeón "Add submission" usa
    `.icons-collapse-expand.fheader` (no `.course-section-header`), misma regla que Redes.
    Se quitó el `border-bottom` del `fieldset.collapsible` dentro de `.editsubmissionform`
    (era la línea entre los archivos y Save changes).
  - File picker (diálogo YUI): `.moodle-dialogue-wrap`, `.moodle-dialogue-hd`, `.fp-content`,
    `.fp-thumbnail` y `.fp-filename` venían blancos. Ahora usan `--bcv-surface*`. Los iconos
    de tipo de archivo son SVG con `fill="#212529"` servidos desde `theme/image.php`: se
    invierten con `filter: invert(0.9)` apuntando a `img[src*="/theme/image.php/"]` para no
    tocar las miniaturas de imágenes reales.
  - Pathbar del file manager: el icono de carpeta es un `background-image` SVG negro
    (`theme/image.php/.../fp/path_folder`), no un `<img>`, así que no sirve `filter`. Se
    reemplazó el `background-image` por el mismo path como data URI con `fill` muted
    (`#a6aec4`). La zona de drop vacía (`.fm-empty-container`) tenía borde punteado
    `#bbb`: pasa a `--bcv-border-strong`.
  - Selección de texto: estaba en `--bcv-accent-strong` sólido y al clickear un link se
    seleccionaba el texto (bloque azul fuerte). Ahora es `rgba(157, 180, 255, 0.3)` con el
    texto normal, así el click no "flashea".
  - Iconos del tema: todo `img.icon` servido desde `theme/image.php` es un SVG negro; una
    sola regla lo invierte (`invert(0.9)`) y cubre chevrons, flechas, "Comments (0)", etc.
    Antes se arreglaban de a uno.
  - Iconos de actividad: Moodle los colorea con filtros CSS propios
    (`invert + sepia + saturate + hue-rotate`) por tipo (verde archivo, rosa tarea, celeste
    asistencia). Se pisan con `filter: grayscale(1) invert(0.72) !important` en
    `img.activityicon`, así quedan monocromáticos. Si algún día se quiere acento lavanda en
    lugar de gris, se cambia solo ese `invert`.
- Pendiente: lecciones, asistencia y estados vacíos de mensajes.

## Bucle de retroalimentación visual

Hay dos formas de ver el SED logueado. Preferir **browse**: maneja el Brave del usuario, con su
sesión y su extensión cargada, y permite capturas.

### A. browse (Brave del usuario, preferido)

Instalación y pareo, una sola vez:

```bash
curl -fsSL https://opencode.ai/browse/install | bash
browse pair        # imprime un código de 8 caracteres, válido 10 minutos
```

El usuario abre el menú de extensiones → browse → Options → "Pair with a code" e ingresa el
código. Verificar con `browse status`: `connected: true` y `browsers[0].connected: true`.

Si el instalador dice `Invalid .../opencode.json; left unchanged`, el JSON global tiene un error
de sintaxis: validarlo con `python3 -c "import json;json.load(open(...))"` antes de reintentar.

Uso desde `execute`:

```js
// page es la pestaña del navegador real; snapshot()/ref() vienen del contexto.
await page.goto('https://cuv-fceyt.unse.edu.ar/my/courses.php', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const s = await snapshot({ find: 'conversation' });   // refs para clickear
await ref('e12').click();
await page.evaluate(() => document.querySelector('h1').innerText);
```

- `browse.execute` corre JavaScript de Playwright sobre la página, no Node: no hay `fs`,
  `process` ni `document` global; lo del DOM va dentro de `page.evaluate`.
- Las capturas se guardan con `files.write(files.path('x.png'), buf)` y se leen desde
  `/tmp/opencode-browser-files-*/`. `files.path` no acepta `/tmp/opencode` (permisos 777).
- `page.screenshot({ clip })` desalinea el recorte; usar captura de viewport y `scrollIntoView`.
- Cada agente tiene su sesión. Al terminar: `session_reset` o `session_delete`.
- Si aparece login, 2FA o captcha: `handoff()` y esperar al usuario. Nunca manejar su clave.
- El usuario autorizó entrar a cualquier chat para revisar estilos.

### B. browser tools (fallback)

`browser.tabs.open`, `browser.evaluate`, `browser.screenshot` sobre un Chromium propio.
No tiene la extensión cargada ni la sesión del usuario. En este equipo las capturas fallan
("Screenshot needs a visible tab") porque exigen una ventana visible y enfocada; el resto
(navegar, evaluar) funciona. Sin capturas, validar por estilos computados y desconfiar del
resultado visual.

### Servir el CSS

```bash
cd /home/santino/Documents/code/better-cuv
setsid nohup python3 -m http.server 8765 --bind 127.0.0.1 --directory public \
    > /tmp/opencode/css-server.log 2>&1 < /dev/null &
```

Sirve `public/darkmode.css` en `http://127.0.0.1:8765/darkmode.css`. Es solo para iterar:
la extensión sigue empaquetando el CSS en `dist` con `npm run build`.

Si el CSS "no aplica" después de inyectarlo, primero verificar que el server siga vivo:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8765/darkmode.css
```

Un `000` significa que el proceso murió; volver a levantarlo. Es el error más común cuando
una página queda clara de golpe.

### Inyectar el tema

```js
document.documentElement.classList.add('bettercuv-dark');

let l = document.getElementById('bcv-css');
if (!l) {
    l = document.createElement('link');
    l.id = 'bcv-css';
    l.rel = 'stylesheet';
    document.head.appendChild(l);
}
l.href = 'http://127.0.0.1:8765/darkmode.css?v=' + Date.now();
```

Para cada cambio en `darkmode.css`, solo hay que cambiar el `href` con cache-bust y esperar
un segundo. No hace falta recargar la página ni reconstruir la extensión.

**Ojo con la extensión real:** en el Brave del usuario la extensión ya está cargada, así que
algunas reglas vienen de su copia en `dist`. Si una regla nueva no se ve, puede ser que el
`href` haya fallado (server muerto) y estés viendo el CSS viejo de la extensión: verificar con
un selector exclusivo (por ejemplo `.forumpost`) o comparar estilos computados.

### Auditar y capturar

- Para encontrar fondos claros que quedaron sin cubrir, recorrer el DOM y filtrar por
  `backgroundColor` con luminancia alta (evitar `IMG`, `SVG`, `IFRAME`). También sirve filtrar
  por `borderTopColor`/`borderBottomColor` claros con ancho > 0: así se encontraron las cartas
  de `.section-item` y las líneas de `.activity-description`.
- Para saber qué regla gana, recorrer `document.styleSheets` y probar `el.matches(selector)`.
  Las hojas `chrome-extension://` no se pueden leer desde la página (SecurityError): si una
  regla propia no aparece, sospechar de la copia `dist`.
- Cuando una regla propia pierde contra Moodle, casi siempre es especificidad + `!important`
  (ver el caso de `.block_myoverview` más arriba). Subir la especificidad con `html.` suele
  alcanzar.
- Mostrar la captura final al usuario con `browser.preview` o dejando la ruta del archivo.

### Cerrar el ciclo

- Recién al final: `npm run build` para actualizar `dist`.
- El usuario recarga la extensión en `chrome://extensions` y recarga la página.
- **No commitear ni pushear sin pedido explícito.** `screenshots/` es referencia local del
  usuario y no se trackea.

## Fases

### Fase 1 — Base (completa)

- [x] Manifest v0.1, permisos mínimos, `run_at: document_start`, `all_frames`.
- [x] Settings persistentes en `storage.sync`.
- [x] Content script aplica `.bettercuv-dark` y escucha cambios.
- [x] Popup en TS plano, con dark + keepalive + estado de sesión.
- [x] Limpieza: React, `chrome-types`, permisos sin uso, README.
- [x] Keepalive con `core_session_touch` cada 10 min.

### Fase 2 — Modo oscuro (en progreso)

- [x] Reescribir `darkmode.css` con variables y cobertura amplia de Boost.
- [x] Iterar My courses contra el sitio logueado.
- [x] Página de curso (onetopic) contra el sitio logueado.
- [x] Dashboard, página de actividad y reporte de calificaciones.
- [x] Home, categoría de cursos, foro, cuestionario, tarea, calendario, mensajes y participantes.
- [ ] Lecciones y asistencia.
- [ ] Revisar drawer de mensajes y estados vacíos.

### Fase 3 — Minimalista

- [ ] Un toggle con lista fija de elementos a ocultar (CSS puro).
- [ ] Preset: **A - Limpieza** o **B - Enfoque** (definir con el usuario).

### Fase 4 — Pulido

- [ ] Iconos de la extensión.
- [ ] Checklist de pruebas manuales.
- [ ] Evaluar `build --watch`.

### Futuro (idea del usuario, no implementar todavía)

- Sistema de temas: la paleta ya está tokenizada en `--bcv-*`, así que se podrían agregar
  variantes (por ejemplo claro, oscuro, alto contraste) sin reescribir selectores.

## Cómo probar la extensión

1. `npm install`
2. `npm run build`
3. `chrome://extensions` → modo desarrollador → "Cargar descomprimida" → carpeta `dist`.
4. Abrir el SED, iniciar sesión y verificar:
   - El modo oscuro persiste al recargar y se sincroniza entre pestañas.
   - En DevTools → Network aparece `core_session_touch` cada 10 min con
     `[{"error":false,"data":true}]`.
   - Consola sin errores.

## Capturas revisadas

- `screenshots/image.png`: My courses (claro).
- `screenshots/image (1).png`: Dashboard (claro).
- `screenshots/image (2).png`: Curso `course/view.php?id=3521` (claro).
- Capturas oscuras de My courses: generadas en la pestaña de OpenCode, no versionadas.

## Pendientes / decisiones abiertas

- Terminar la revisión visual de las páginas restantes.
- Medir el tiempo real de cierre de sesión: el servidor declara 8 h.
- Elegir preset minimalista A o B.
- Confirmar nombre "Better SED" y dominio único.
- Node no está instalado en el sistema; se usa un Node portátil en `/tmp/opencode/node`
  durante la sesión. Para uso diario conviene instalarlo.
- Evaluar `chrome.alarms` + service worker solo si el timer del content script falla en
  pestañas en segundo plano.
