# nona — history

Lo que salió de `state.md`. Se escribe solo si explica por qué las cosas son como son.

Más reciente arriba.

### 2026-09-29 — Fuera los toques progresivos del boceto

**Qué cambió:** el ciclo de tres toques en celda con número (seleccionar → resaltar → borrar), listado como idea que entraba, queda fuera, y también el segundo toque en celda vacía para notas.
**Por qué:**
- Cada acción ya tiene otro camino: resaltado automático al seleccionar, número fijado en la botonera, goma, mismo número, Retroceso/Supr, botón Notas y M
- En táctil, un toque de más borra o cambia de modo sin aviso
- Choca con "número primero": con un número fijado, tocar una celda vacía lo escribe

### 2026-09-29 — Motor: descartados sudoku-core (npm), sudoku-gen y TSudoku

**Qué cambió:** se eligió kcirtapfromspace/sudoku-core (Rust) tras probar y descartar las opciones JS.
**Por qué:**
- `sudoku-core` 3.0.3 (npm, komeilmehranfar, sin cambios desde 2024-06): generación de 2 a 29 s en hard, de 6 a 156 s en expert, y master sin terminar 5 puzzles en más de 1 h 40 min. Sobre puzzles transformados (lógicamente idénticos, solución única comprobada) no resolvió 18/20 y 9/20, y cambió de nivel: su resolvedor depende del orden de recorrido. Con los hard y expert de sudoku-gen devolvió "No solution"
- `sudoku-gen` (MIT, mantenido): instantáneo, pero solo 10 semillas por nivel, sin resolvedor, pistas ni análisis
- TSudoku (port TS de Sudoku Explainer): solo técnicas directas (SE 1.0–2.5), generador en esqueleto, sin publicar en npm
- Emerentius/sudoku (Rust): resolvedor por técnicas en prototipo, AGPL

### 2026-09-29 — Se empieza de cero, no sobre el código de AI Studio

**Qué cambió:** el import de AI Studio (`5f3fa40`) deja de ser la base y queda como boceto de la interacción.
**Por qué:**
- El generador borra casillas al azar sin comprobar solución única (expert deja 19 pistas), y el juego valida contra una solución guardada: otra solución válida se marca como error y la partida no termina
- Dificultad solo por número de casillas borradas, no por técnica
- `mistakes` nunca se incrementa; la victoria se registra dentro de un updater de `setState`
- Restos de AI Studio: `importmap` a esm.sh en `index.html`, `geminiService.ts` y `Navigation.tsx` vacíos, README genérico con `GEMINI_API_KEY`, Tailwind, Font Awesome e Inter por CDN, componente de juego de 537 líneas
