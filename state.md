---
created: 2026-09-29
last_updated: 2026-10-01
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
- Plan de implementación en `plan.md`, fases 0–7
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
  capturas de Playwright Firefox en los cuatro formatos y los dos temas. 12 tests de interacción en
  Firefox sobre la app real (número primero con sus tres estados, celda primero, teclado, color, Fill y
  Clear notes, clic derecho, foco y Enter, ajuste de vibración, la pista se cierra con una jugada,
  partida completa con pistas hasta la victoria e historial, recarga y descartar con Undo). 88 tests
  en total. Build medido en la fase 5: JS inicial 87 KB gzip; WASM 152 KB gzip; worker y WASM incluidos por Vite
- Comprobado en la interfaz con un script de Playwright Firefox, sin test fijo (2026-09-30): pausa al
  ocultar la pestaña (y sin ella con el ajuste apagado; el reloj se para y reanuda), tarjeta del
  sudoku del día resuelto, ocultar dígitos completos, Export, Import con Merge y con Replace, archivo
  no válido, tarjeta de error del motor con Retry, y que esa pista fallida no cuenta
- Vibración: probada por el usuario en Chrome para Android, vibra. Firefox para Android no vibra en
  ninguna web (Mozilla la dejó sin efecto); el ajuste lo avisa y no aparece sin `navigator.vibrate`
- Prueba manual en Firefox (2026-09-30), dada por buena por el usuario. Salió el problema de Fill
  notes, resuelto: el botón pasa a Clear notes (`design.md`). Tras ella: en móvil y tablet en
  vertical, los números van antes que las herramientas
- Icono de la app en la cabecera de inicio (móvil y tablet) y en la barra lateral con "nona" debajo
- Historial: cada entrada abre el tablero resuelto en solo lectura y Play again. Las entradas guardan
  `transform` (opcional en el esquema, `BACKUP_VERSION` sigue en 1); las anteriores muestran el
  puzzle base
- Probado por el usuario por la IP de la LAN (`pnpm dev --host`): funciona
- Tras la segunda prueba manual (2026-09-30), en `design.md`. Probados por el usuario: clic derecho en
  el modo contrario de notas; tocar el número fijado activa las notas y una tercera vez lo suelta;
  tablero de borde a borde en el móvil, con números y notas más grandes y finos y notas más
  contrastadas. Solo en tests: Enter y Espacio no repiten el último clic, el tablero es una sola
  parada de Tab, notas con N
- Fase 6 terminada (2026-09-30): publicada en https://memoriainfinita.github.io/nona/ desde la CI.
  `DAILY_EPOCH` fijado en `2026-09-30`. size-limit en gzip: JS inicial 88,08 kB (tope 97), WASM
  151,17 kB (tope 167). Comprobada la web publicada en Playwright Firefox: inicio, partida, pista
  con worker y WASM, sudoku del día; sin errores de página ni peticiones fallidas
- README con capturas en `docs/` (móvil oscuro con pista, escritorio oscuro, historial en claro),
  sacadas de la web publicada. About del repo: descripción "Sudoku with hints that show you how to
  solve it, not just the answer" (igual en README e `index.html`), homepage a Pages y 10 topics
- Sin probar: la marca `backtracking` (ningún puzzle de prueba la necesita)
- Fase 7 (pistas legibles) implementada el 2026-10-01 y publicada.
  Puente nuevo en `engine/src/lib.rs` (singles visibles primero, eliminaciones agrupadas, papeles,
  `detail` por familia desde `ProofCertificate`); textos en `src/app/game/hintText.ts`; tablero con
  papeles y candidatos del motor; Fill notes con candidatos del motor
- Arnés `engine/examples/survey.rs`, 60 puzzles por nivel (20.210 pistas): 0 incorrectas, 0 patrones
  repetidos, 0 sin plantilla, 0 cadenas con extremos falsos. Singles que dependen de eliminaciones
  anteriores: 538, todas con aviso en la tarjeta. Menos pistas de eliminación: Box/Line 167 → 75,
  Pointing 460 → 287 + 16 Pointing Triple, Naked Pair 760 → 348
- Motivo de la fase (revisión del 2026-10-01, con el puente anterior): singles sobre candidatos que
  el jugador no ve, una eliminación por pista, celdas sin papel, explicaciones del motor pobres o
  mal formadas, Fill notes devolvía lo que quitaba una pista
- Tests: 124 (Node y Firefox), typecheck y build en verde. size-limit: JS inicial 90,12 kB (tope 97),
  WASM 166,73 kB (tope subido de 167 a 183 kB, 10% sobre lo medido)
- Revisado con capturas de Playwright Firefox (móvil oscuro, escritorio claro, móvil claro): pasos 2
  y 3 de Naked Pair y de Hidden Single

### Motor: lo que sigue vigente

Mediciones del 2026-09-29 y 30 en `state-history.md` (entrada del 2026-10-01).

- `generate` no siempre entrega el nivel pedido
- WASM no es más lento que el nativo en esta máquina; carga del módulo por worker 6–82 ms
- Pistas a mitad de partida en WASM (fork `f56364e`): mediana de 0,07 a 0,13 ms. Peor caso en master:
  184 ms nativo con 3 puzzles; con 60 puzzles, 0,5–1 s nativo en AIC, XYZ-Wing y ALS-XZ (motor solo,
  sin el puente; medido el 2026-10-01)
- `get_hint` del motor original devuelve la misma eliminación en bucle; el fork añade
  `Solver::get_hint_with_candidates`, que usa los candidatos de la rejilla. La app guarda los
  candidatos del motor aparte de las notas del jugador
- El camino de pistas varía entre ejecuciones nativas (causa probable, sin confirmar: HashMap/HashSet
  en AIC y ALS); Node y Firefox coinciden entre sí
- Arnés en `bench/`: `examples/native.rs`, `examples/play.rs`, `js/bench.mjs`, `js/play.mjs`,
  `js/serve.mjs`. Compilar y ejecutar: cabecera de `bench/Cargo.toml`

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
- [web] Nada que exija contexto seguro (`crypto.randomUUID` y similares): la app también se sirve por
  HTTP en la LAN. Ids con `newId()` de `src/app/id.ts`. Confirmed 2026-09.
- [ci] Se publica en Pages solo con push a `main` y si pasa el job `test` entero (typecheck, tests,
  build, `pnpm size`). Pages con `build_type=workflow`. Confirmed 2026-09.
- [daily] `DAILY_EPOCH` (`2026-09-30`) no se cambia nunca: de él sale el sudoku del día de todos.
  Confirmed 2026-09.
- [size] Topes de size-limit en gzip (`"gzip": true`; sin él mide brotli), un 10% sobre lo medido.
  Confirmed 2026-09.
- [hints] Regenerar `src/app/hint-samples.json` (una pista real por técnica para los tests de textos)
  tras cambiar el puente: desde `engine/`, `cargo run --release --example survey -- 60 --dump
  ../src/app/hint-samples.json`. Confirmed 2026-10.
- [test] Tests de interfaz: `StoreProvider` cierra su conexión al desmontar (si no, `deleteDB` se
  bloquea); `optimizeDeps.include` evita que Vite recargue a mitad de test. Confirmed 2026-09.

## Preferences

- pnpm, no npm

## TODO

- [ ] Fase 7: prueba manual del usuario en Firefox (Hard, una pista de Pair o Pointing: patrón, candidatos y tachados legibles)
- [ ] Después de la fase 7: una frase fija por técnica en el paso 1, que diga qué es
