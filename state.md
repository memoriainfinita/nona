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
- Del boceto se aprovechan ideas, no código. Las que entran están en `design.md`
- Motor elegido: [kcirtapfromspace/sudoku-core](https://github.com/kcirtapfromspace/sudoku-core)
  (Rust, MIT), commit probado `84696be`. 45 técnicas humanas, pista con explicación y
  celdas implicadas, calificación por técnica y en escala SE, generador con solución única
- La versión WASM del repo hermano `kcirtapfromspace/sudoku` es un juego completo en
  canvas, no una librería: hay que escribir un puente wasm-bindgen propio
- Diseño en `design.md`: decididos plataforma, datos, idioma, funciones del juego, stack,
  motor y banco. Falta la interfaz

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

### Pruebas en WASM (2026-09-29)

Puente provisional wasm-bindgen 0.2.129, sin wasm-opt: 492 KiB. Un Web Worker por
puzzle. Semillas 1..n por nivel (`Generator::with_seed`): los 23 puzzles salen idénticos
en los tres entornos. Una pasada por entorno.

| Nivel | n | Generación nativa | Node 24 | Firefox 156 |
|---|---|---|---|---|
| medium | 10 | 7–20 ms | 12–21 ms | 8–19 ms |
| hard | 5 | 30–451 ms | 34–326 ms | 23–659 ms |
| expert | 5 | 55 ms–6,8 s | 93 ms–2,5 s | 57 ms–2,8 s |
| master | 3 | 3,2–29,6 s | 1,5–13,5 s | 2,3–19,8 s |

- WASM no es más lento que el nativo en esta máquina; en los casos largos, más rápido.
  Causa sin averiguar
- `analyze`: menos de 27 ms salvo master. Peor caso, el mismo master en los tres:
  1280 ms nativo, 714 ms Node, 631 ms Firefox
- `get_hint` medido solo sobre el puzzle inicial (siempre un single): menos de 12 ms.
  Sin medir a mitad de partida
- Carga e instanciación del módulo en cada worker: 6–82 ms
- Con estas semillas, los hard pedidos salen Intermediate (5/5); expert y master, su nivel
- Arnés en `bench/`: puente, `js/bench.mjs` (Node), `js/serve.mjs` + página (Firefox
  headless con perfil temporal), `examples/native.rs`. Motor por git fijado a `84696be`.
  Compilar y ejecutar: cabecera de `bench/Cargo.toml`

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
- [bench] Comparar entornos con `Generator::with_seed`: la misma semilla da el mismo
  puzzle en nativo y WASM. Sin semilla, el tiempo de generación varía demasiado entre
  puzzles para comparar tandas. Confirmed 2026-09.
- [bench] Medir en Firefox con COOP/COEP (`crossOriginIsolated`): sin ellas
  `performance.now()` pierde resolución y un `get_hint` marcó 0,0 ms. Confirmed 2026-09.

## Preferences

- pnpm, no npm

## TODO

- [ ] Diseño de la interfaz: pantallas, disposición, estilo, tamaños y valores por defecto
      de los ajustes. Ver `design.md`
- [ ] Medir `get_hint` a mitad de partida en WASM
