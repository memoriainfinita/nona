---
created: 2026-09-29
last_updated: 2026-09-29
---

# nona — state

Qué es verdad ahora. Lo que ya pasó vive en `state-history.md`.

## Project

App de sudoku. Punto de partida: "Zen Sudoku Master", generada con Google AI Studio
(Build) y exportada como ZIP el 2026-09-29.

## Status

- Import de AI Studio tal cual en el primer commit (`5f3fa40`): React 19 + Vite 6 +
  TypeScript, recharts para las gráficas de Stats
- Arranca con `pnpm dev` en el puerto 3000. Probada por mykl en el navegador: funciona
- Sin decidir: aprovechar el código de AI Studio o empezar de cero
- Restos de AI Studio sin limpiar:
  - `index.html` lleva un `importmap` a esm.sh (react, recharts, `@google/genai`, vite)
    que duplica lo que resuelve Vite
  - `services/geminiService.ts` vacío: la dependencia de Gemini se quitó en AI Studio
  - `components/Navigation.tsx` vacío
  - `README.md` es la plantilla genérica de AI Studio y pide una `GEMINI_API_KEY` que
    la app ya no usa
  - Tailwind, Font Awesome e Inter se cargan por CDN

## Patterns

- [pnpm] `esbuild: false` en `allowBuilds` de `pnpm-workspace.yaml`: el binario llega
  como paquete aparte y Vite funciona sin el script de instalación. Mismo criterio que
  sadhana. Confirmed 2026-09.

## Preferences

- pnpm, no npm

## TODO

- [ ] Decidir si se aprovecha el código de AI Studio o se empieza de cero
