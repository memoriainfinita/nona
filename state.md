---
created: 2026-09-29
last_updated: 2026-09-30
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
- Diseño completo en `design.md`. Maquetas en el lienzo de Claude Design enlazado desde
  `design.md`: 28 pantallas por dispositivo (móvil, tablet, escritorio), tema claro,
  acentos y componentes
- Plan de implementación en `plan.md`, fases 0–6
- Fase 0 en curso: esqueleto Vite 8 + React 19.3 + TS 7 con tests en Node y Firefox. Faltan repo, LICENSE y CI

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
- `analyze` es determinista: 23 puzzles de las semillas, 10 procesos nativos y 3 en Node,
  mismo nivel y SE en todos (2026-09-30). El no determinismo es del camino de pistas
- Arnés de prueba en el scratchpad de la sesión: copia del motor con un `raw_step`
  público añadido; no se conserva

### Bucle de pistas (2026-09-29, nativo)

- Con `get_hint`, tras aplicar una eliminación vuelve la misma (35/35). Pistas que
  son eliminación: medium 0%, hard 2%, expert 3%, master 12% del camino de solución
- Resuelto con fork: [memoriainfinita/sudoku-core](https://github.com/memoriainfinita/sudoku-core),
  rama `nona`, commit `f56364e` sobre `84696be`. Añade `Solver::get_hint_with_candidates`:
  usa los candidatos de la rejilla sin recalcular
- Probado jugando solo con pistas y aplicándolas todas: 23 puzzles (10 medium, 5 hard,
  5 expert, 3 master), 1365 pistas, 159 eliminaciones, 0 repetidas, 0 incorrectas,
  todos completados. Máximo 150 ms (master)
- Tests del solver del fork: 16/16, 1418 s en release (generan puzzles Extreme)
- La app guarda los candidatos del motor aparte de las notas del jugador

### Pistas a mitad de partida en WASM (2026-09-30)

Fork `f56364e`, puente con `hint_with_candidates(puzzle, masks)`: candidatos en JS,
81 máscaras (bit v = dígito v). Los 23 puzzles de las semillas jugados solo con
pistas, midiendo cada llamada desde JS.

| Nivel | n | Mediana | Máx. nativo | Máx. Node 24 | Máx. Firefox 156 |
|---|---|---|---|---|---|
| medium | 10 | 0,08–0,13 ms | 2,6 ms | 5,1 ms | 2,7 ms |
| hard | 5 | 0,07–0,10 ms | 3,4 ms | 4,1 ms | 0,8 ms |
| expert | 5 | 0,08–0,11 ms | 1,6 ms | 5,0 ms | 0,5 ms |
| master | 3 | 0,08–0,12 ms | 18–184 ms | 17,7–41,2 ms | 15,6–128,1 ms |

- 23/23 completados en los tres entornos, 0 eliminaciones repetidas, 0 colocaciones
  fuera de candidatos
- Node: el máximo de medium a expert es la primera llamada del worker (3–5 ms)
- El camino de pistas varía entre ejecuciones nativas (master 3: 102 o 103 pistas);
  Node y Firefox coinciden entre sí (99). Causa probable, sin confirmar: HashMap/HashSet
  de std en los motores AIC y ALS
- Arnés: `examples/play.rs` (`gen` escribe `js/puzzles-seeded.json`), `js/play.mjs`,
  `node js/serve.mjs "" play.html`

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

- [x] Plan de implementación a partir de `design.md`: `plan.md`
- [ ] Fase 0 de `plan.md`: base
- [x] Lienzo: pasar el acento por defecto a índigo
- [x] Decidir la salida al bucle de pistas: fork
- [x] Medir `get_hint_with_candidates` a mitad de partida en WASM
