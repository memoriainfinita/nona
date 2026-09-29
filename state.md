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

- Se empieza de cero. El código de AI Studio queda como boceto de la interacción en el
  primer commit (`5f3fa40`): React 19 + Vite 6 + TypeScript. Motivo en `state-history.md`
- Del boceto se aprovechan ideas, no código:
  - Clic en celda con número: seleccionar → resaltar ese número en el tablero → borrar
  - Al colocar un número, se quita de las notas de su fila, columna y caja
  - Contador de cuántos quedan por colocar de cada número
  - Deshacer y rehacer; teclado: flechas, 1-9, M para notas, Espacio
  - Estadísticas diarias y mejores tiempos en localStorage
- Motor elegido: [kcirtapfromspace/sudoku-core](https://github.com/kcirtapfromspace/sudoku-core)
  (Rust, MIT), commit probado `84696be`. 45 técnicas humanas, pista con explicación y
  celdas implicadas, calificación por técnica y en escala SE, generador con solución única
- La versión WASM del repo hermano `kcirtapfromspace/sudoku` es un juego completo en
  canvas, no una librería: hay que escribir un puente wasm-bindgen propio
- Sin diseño de app todavía

### Pruebas del motor (2026-09-29, nativo, release)

| Nivel pedido | Generación | Nivel que da `analyze` |
|---|---|---|
| medium | 10–14 ms | Medium, Easy |
| hard | 0,5–1,4 s | Hard, Intermediate |
| expert | 0,9–3,2 s | Expert, Expert |
| master | 13–43 s | Master, Expert |

- 13 puzzles × 20 transformaciones (rotación, bandas, pilas, filas, columnas,
  permutación de dígitos): 260/260 con el mismo nivel, el mismo SE, pista, solución y
  solución única
- `analyze` + `get_hint`: menos de 11 ms, salvo un master a 1,6 s
- `generate` no siempre entrega el nivel pedido
- Los "expert" de sudoku-gen salen Intermediate o Hard
- Sin medir en WASM

### Validación del motor (2026-09-29)

- **Escala SE:** no es la de Sudoku Explainer. Contra 1858 puzzles calificados por el SE
  real (corpus de TSudoku, SE 1.0–4.4): 30,7% exacta, 47,6% a ±0,3. Las técnicas
  directas del SE (1.0–2.5) no existen en kcirtap: 0 aciertos. Usar sus niveles propios;
  no presentar su valor como SE
- **Corrección de las pistas:** 1881 puzzles (corpus + 20 expert + 3 master generados),
  117.660 deducciones contrastadas con la solución, 0 incorrectas. Todos resueltos solo
  con técnicas. Probadas 21 de 45 técnicas; sin ejercitar las avanzadas (ALS, cadenas,
  forcing chains, 3D Medusa, Death Blossom...)
- `get_hint` recalcula candidatos desde cero en cada llamada: ignora las eliminaciones
  previas y puede devolver la misma eliminación en bucle. `get_next_placement` encadena
  eliminaciones hasta una colocación y descarta en silencio, contra la solución por
  backtracking, los pasos que la contradigan
- Arnés de prueba en el scratchpad de la sesión: copia del motor con un `raw_step`
  público añadido; no se conserva

## Patterns

- [pnpm] `esbuild: false` en `allowBuilds` de `pnpm-workspace.yaml`: el binario llega
  como paquete aparte y Vite funciona sin el script de instalación. Mismo criterio que
  sadhana. Confirmed 2026-09.
- [bench] Toda prueba de generación lleva tope de tiempo por llamada (worker o hilo con
  timeout) y tope global: sin él, sudoku-core (npm) en master corrió más de 1 h 40 min
  sin terminar. Confirmed 2026-09.

## Preferences

- pnpm, no npm

## TODO

- [ ] Diseñar la app: puente WASM, motor en Web Worker, banco pregenerado al menos para
      master, qué ideas del boceto entran
- [ ] Medir generación, `analyze` y `get_hint` en WASM
