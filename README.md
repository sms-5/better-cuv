# Better SED

Extensión de Chromium para la plataforma **SED** (ex CUV) de la FCEyT-UNSE.

Hace tres cosas:

- **Modo oscuro** para Moodle/Boost.
- **Interfaz minimalista** (en desarrollo).
- **Mantiene la sesión activa** mientras Chrome esté abierto y haya una pestaña de SED.

## Instalar

```bash
npm install
npm run build
```

Después, en Chrome o Brave:

1. Abrir `chrome://extensions`.
2. Activar el modo desarrollador.
3. "Cargar descomprimida" y elegir la carpeta `dist`.

Para desarrollo: `npm run watch` recompila al guardar; hay que recargar la extensión desde
`chrome://extensions` para ver los cambios del content script.

## Estructura

```
public/manifest.json     Manifest V3 (solo permiso storage)
public/darkmode.css      Tema oscuro
src/content/content.ts   Settings + keepalive de sesión
src/popup/Popup.ts       Popup (TypeScript, sin framework)
src/styles/Popup.css     Estilos del popup
index.html               Entrypoint del popup
vite.config.ts           Build de popup + content.js
```

Los settings se guardan en `chrome.storage.sync` y se aplican como clases en `<html>`:
`.bettercuv-dark` y (próximamente) `.bettercuv-minimal`.

## Sesión

El content script llama a `core_session_touch` cada 10 minutos, el mismo endpoint que usa
Moodle. Solo funciona con Chrome abierto y una pestaña de SED cargada; no sobrevive a cerrar
el navegador ni a dormir la máquina más de 8 horas.

## Estado

Fase 1 completa: settings persistentes, popup sin React y keepalive. El plan completo está en
[`HANDOFF.md`](./HANDOFF.md).
