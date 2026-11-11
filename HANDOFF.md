# Better SED — Handoff

Extensión Chromium (Manifest V3) para la plataforma SED (ex CUV) de FCEyT-UNSE.
Objetivo: interfaz más limpia, modo oscuro y evitar el cierre de sesión por inactividad.

## Hallazgos del sitio

- Moodle **4.5.x**, tema **Boost**, Bootstrap 4. No tiene modo oscuro nativo
  (`prefers-color-scheme` y `.dark` no aparecen en su CSS). El modo oscuro se hace con CSS propio.
- `M.cfg` declara `sessiontimeout: 28800` (8 h) y `sessiontimeoutwarning: 1200` (20 min).
  Moodle cierra la sesión cuando el registro de sesión no se toca en 8 h.
- La cookie `MoodleSession` es de sesión, `Secure` y sin `SameSite` (Lax por defecto).
  Por eso el keepalive **debe correr desde el content script** (mismo origen): un fetch desde
  un service worker no enviaría la cookie.
- Hay contenido guardado con estilos inline de Dark Reader (bloque "Recursos"), que va a
  necesitar overrides puntuales en el CSS oscuro.
- Dominio actual: `https://cuv-fceyt.unse.edu.ar/*`.

## Stack

- **Vite + TypeScript + Manifest V3**. Es el stack correcto para este proyecto.
- **Sin React**: el popup son dos checkboxes y una línea de estado. React no afectaba el
  rendimiento del sitio (el popup solo carga al abrirlo), pero eliminarlo deja menos
  dependencias y menos configuración. El popup es TS plano y el content script no comparte
  código con él.
- **Sin service worker y sin mensajería**: el popup escribe settings en `chrome.storage.sync`
  y el content script escucha `chrome.storage.onChanged`. No hacen falta `tabs`, `scripting`
  ni `activeTab`.
- El content script debe quedar autocontenido (sin imports compartidos) para que Vite lo emita
  como script clásico. Si en el futuro necesita compartir código, hay que agregar un build
  aparte en formato IIFE.

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

- Solo corre en el frame principal, con sesión iniciada (`body.loggedin`) y si el setting está activo.
- Lee `M.cfg.sesskey` del HTML y cada **10 minutos** hace:

```
POST /lib/ajax/service.php?sesskey=<sesskey>&info=core_session_touch
Content-Type: application/json
[{"index":0,"methodname":"core_session_touch","args":{}}]
```

- Es el mismo mecanismo que usa Moodle internamente. Si la respuesta es correcta, guarda
  `lastTouch` en `chrome.storage.local` para mostrarlo en el popup.
- Límites reales: funciona con Chrome abierto y una pestaña de SED viva. No sobrevive a cerrar
  Chrome ni a dormir la máquina más de 8 h. Es un bypass del logout por inactividad, con el
  costo de seguridad que eso implica.

## Fases

### Fase 1 — Base (completa)

- [x] Manifest v0.1, permisos mínimos, `run_at: document_start`, `all_frames`.
- [x] Settings persistentes en `storage.sync`; fin del estado que se reseteaba al reabrir el popup.
- [x] Content script aplica `.bettercuv-dark` y escucha cambios.
- [x] Popup en TS plano (sin React), con dark + keepalive + estado de sesión.
- [x] Limpieza: `chrome-types`, permisos sin uso, CSS del popup, README.
- [x] CSS oscuro: selectores pasados de `body.bettercuv-dark` a `.bettercuv-dark` y fix del
      `.popover-body` que se aplicaba siempre.

### Fase 2 — Modo oscuro

- [ ] Reescribir `darkmode.css` con variables, todo scopeado a `.bettercuv-dark`,
      `color-scheme: dark` y cobertura de navbar, drawers, cards, tablas, formularios,
      dropdowns, modales, calendario, foro y quiz.
- [ ] Iterar con capturas de páginas logueadas (home del curso, actividad, cuestionario/foro).

### Fase 3 — Minimalista

- [ ] Un toggle con lista fija de elementos a ocultar (CSS puro).
- [ ] Definir preset: **A - Limpieza** (footer, selector de idioma, menú "More", bloques
      repetidos; mantener navegación) o **B - Enfoque** (A + navbar, drawers, breadcrumbs y
      encabezado; queda solo el contenido).

### Fase 4 — Pulido

- [ ] Iconos de la extensión.
- [ ] Checklist de pruebas manuales.
- [ ] Evaluar `build --watch`.

## Cómo probar

1. `npm install`
2. `npm run build`
3. `chrome://extensions` → modo desarrollador → "Cargar descomprimida" → carpeta `dist`.
4. Abrir `https://cuv-fceyt.unse.edu.ar/`, iniciar sesión y verificar:
   - El toggle de modo oscuro persiste al recargar y se sincroniza entre pestañas.
   - En DevTools → Network aparece `core_session_touch` cada 10 min con respuesta
     `[{"error":false,"data":true}]`.
   - Consola sin errores.

## Capturas revisadas (nov 2026)

- `screenshots/image.png`: My courses. Navbar azul, cards de cursos, mucho espacio vacío.
- `screenshots/image (1).png`: Dashboard. Categorías, novedades del sitio.
- `screenshots/image (2).png`: Curso `course/view.php?id=3521`. Navbar azul, tabs del curso,
  alerta violeta con estilos inline, tabs verdes del formato onetopic y toggles de drawers.
- Para la Fase 2/3 faltan: una actividad, cuestionario/foro y calificaciones.

El modo oscuro tiene que cubrir esos componentes (navbar, drawer toggles, alertas inline y
tabs de onetopic), no solo el `body`.

## Pendientes / decisiones abiertas

- Capturas de una actividad, cuestionario/foro y calificaciones para terminar Fase 2/3.
- Medir el tiempo real de cierre de sesión: el servidor declara 8 h.
- Elegir preset minimalista A o B.
- Confirmar nombre "Better SED" y dominio único.
- Node no está instalado en el entorno de desarrollo actual; se usó un Node portátil para
  compilar. Para el uso diario conviene instalarlo.
