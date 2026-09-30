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
- Fase 0 terminada: esqueleto Vite 8 + React 19.3 + TS 7, tests en Node y Firefox. Repo público
  https://github.com/memoriainfinita/nona con CI en verde (typecheck, tests, build)
- Fase 1 terminada: crate `engine/` (puente del fork `f56364e`, `hint` sobre candidatos y `analyze`),
  `HintEngine` en `src/engine/` (worker y WASM cargados en la primera pista; fallo de carga
  descarta el worker y el siguiente intento arranca otro). WASM tras wasm-opt: 375 KiB.
  Tests en Firefox: los cuatro puzzles de semilla 1 resueltos solo con pistas (48, 55, 59 y 68,
  las mismas que el bench), EngineError y EngineLoadError. CI compila el WASM y queda en verde
- Fase 2 terminada: banco en `bank/`, 500 puzzles por nivel y lista del día de 732 (122 por nivel).
  `gen-bank verify` sobre los 3732: nivel de `analyze`, solución única y guardada, sin repetidos.
  Generación: 3,3 h de CPU, unos 50 min con 3 procesos; 5086 intentos, 0 timeouts (tope 180 s)
- Coste por puzzle aceptado (piloto y tanda completa): easy y medium ~0,01 s; intermediate
  ~0,2 s (sale de los hard pedidos); hard ~2 s (1 de cada 4 hard pedidos); expert ~2,4 s;
  master ~15 s (9 de cada 10 master pedidos). Los intermediate pedidos salen medium (197/210)
- Fase 3 terminada: lógica de juego pura en `src/game/` (partida con jugadas y deshacer por
  cambios, errores, pista por etapas con su cómputo, registro y estadísticas, sudoku del día,
  elección de puzzle no jugado, transformaciones, PRNG, ajustes). 63 tests, con propiedades
  fast-check; un test en Firefox juega partidas transformadas de medium, expert y master solo
  con pistas a través del módulo y deshace hasta el inicio
- Fase 4 terminada: `src/storage/` con IndexedDB (`idb`): partidas, historial y ajustes; terminar
  una partida la pasa al historial en una transacción. Copia de seguridad JSON versionada
  (`BACKUP_VERSION` 1, migraciones por versión), validada con Zod; Merge y Replace en una
  transacción cada uno. 9 tests en Firefox contra IndexedDB real, una base por test
- Fase 5 terminada: interfaz en `src/app/` a partir del lienzo (tokens oscuro/claro, 7 acentos,
  tamaños S/M/L; móvil, móvil en horizontal, tablet y escritorio con barra lateral). Revisada con
  capturas de Playwright Firefox en los cuatro formatos y los dos temas. 8 tests de interacción en
  Firefox sobre la app real (número primero, celda primero, teclado, color, Fill y Clear notes, la pista se cierra con
  una jugada, partida completa con pistas hasta la victoria, recarga y descartar con Undo). 80 tests
  en total. Build: JS inicial 87 KB gzip; WASM 152 KB gzip; worker y WASM incluidos por Vite
- Sin probar en la interfaz: flujo de Import (sí en los tests de storage), pausa automática al
  ocultar la pestaña, tarjeta del sudoku del día resuelto, vibración, dígitos completos ocultos,
  tarjeta de error del motor (sí en los tests del cliente)
- Prueba manual en Firefox (2026-09-30), dada por buena por el usuario. Salió el problema de Fill
  notes, resuelto: el botón pasa a Clear notes (`design.md`). Tras ella: en móvil y tablet en
  vertical, los números van antes que las herramientas
- `DAILY_EPOCH` en `src/game/pick.ts` es provisional (`2026-10-01`): se fija al publicar
- Sin probar: la marca `backtracking` (ningún puzzle de prueba la necesita)

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

- [engine] `pnpm build:engine` antes de typecheck, test o dev: `src/engine` importa `engine/pkg`,
  que no se versiona. wasm-bindgen fijado a `=0.2.129` en `engine/Cargo.toml`; la CI instala el CLI
  de esa versión. wasm-opt sale del paquete npm `binaryen`, igual en local y en CI. Confirmed 2026-09.
- [bank] Ampliar el banco: `gen-bank run --target N` (reanuda de `bank/work/log.jsonl`),
  `assemble --normal A --daily B` (totales por nivel; solo añade por el final y registra la tanda
  en `meta.json`), `verify`. `bank/work/` no se versiona. Confirmed 2026-09.
- [test] Tests de interfaz: `StoreProvider` cierra su conexión al desmontar (si no, `deleteDB` se
  bloquea); `optimizeDeps.include` evita que Vite recargue a mitad de test. Confirmed 2026-09.

## Preferences

- pnpm, no npm

## TODO

- [ ] Propuesta: clic derecho en escritorio invierte el modo de notas (Notas apagado: pone o quita
  la nota; Notas encendido: escribe el número). En número primero, con el dígito fijado
- [ ] Fijar `DAILY_EPOCH` con la fecha de publicación (provisional `2026-10-01`)
- [ ] Fase 6 de `plan.md`: publicación en GitHub Pages
