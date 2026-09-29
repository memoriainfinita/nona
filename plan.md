---
created: 2026-09-30
last_updated: 2026-09-30
---

# nona — plan

Implementación de `design.md`. Estado de cada fase en `state.md`.

## Fase 0: base

- Archivar el boceto de AI Studio en `.backups/2026-09-30-ai-studio-sketch/` y sacarlo del árbol de git (sigue en `5f3fa40`)
  - `App.tsx`, `components/`, `services/`, `types.ts`, `index.html`, `index.tsx`, `metadata.json`, `README.md`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vite.config.ts`
  - `node_modules/` no se archiva: se regenera
  - `pnpm-workspace.yaml` se queda (`esbuild: false`)
- Proyecto nuevo: Vite 8, React 19, TypeScript 7, pnpm
- Comprobar que `tsc` de TypeScript 7 (compilador nativo) funciona con la configuración de Vite 8; si no, última 6.x
- Dependencias: lucide-react, Zod, idb; dev: Vitest, `@vitest/browser-playwright`, fast-check, size-limit
- CSS propio con tokens, fuente del sistema
- Repo `memoriainfinita/nona`, público, GPL-3.0
- CI en GitHub Actions: pasa los tests de TS. Sin publicar todavía

**Terminado:** `pnpm dev` arranca, un test pasa en Vitest y en Firefox, la CI queda en verde.

## Fase 1: motor

- Crate `engine/` en la raíz, separado de `bench/` (que se queda como arnés)
- Dependencia: fork `memoriainfinita/sudoku-core`, rama `nona`, fijado a commit (`f56364e`)
- Puente wasm-bindgen: pista sobre candidatos recibidos (81 máscaras, bit v = dígito v), `analyze`
- Cada pista devuelve el nombre legible de la técnica (`Display`), las celdas implicadas y la conclusión
- Sin técnica (backtracking): la pista lo indica para mostrar "No logical step found"
- Web Worker; el WASM se carga al pedir la primera pista
- Fallo de carga: error distinguible para "Couldn't load the hint engine" con Retry
- CI: compila el WASM (Rust, wasm-bindgen-cli, wasm-opt) antes de los tests

**Terminado:** desde JS, en el worker, una partida se resuelve solo con pistas en Firefox con los candidatos llevados en JS; fallo de carga simulado devuelve el error.

## Fase 2: banco

- Binario `gen-bank` en `engine/`
- Pide a varios niveles; cada puzzle va al nivel que da `analyze`, hasta 200 por nivel
- Varios hilos, tope de tiempo por llamada, semilla por puzzle, reanudable
- Tanda piloto: puzzles por hora en cada nivel. Con eso se estima la generación completa
  - Easy sin generar hasta ahora; medir también cuántos "easy" pedidos salen Beginner (fuera de los seis niveles)
- Formato: `bank/v1/<nivel>.json`, lista de `{seed, puzzle, solution}` en cadenas de 81 caracteres, `.` en casillas vacías (formato `to_string_compact` del motor)
- `bank/v1/meta.json`: commit del motor, versión del generador y nivel pedido por semilla
- La app carga cada nivel con import dinámico al empezar partida
- `bank/v1` es inmutable una vez publicado; el sudoku del día sale siempre de él
- La generación completa corre en segundo plano durante las fases 3 y 4

**Terminado:** 200 puzzles por nivel en los seis niveles, cada uno con `analyze` igual a su nivel y solución única, subidos al repo con `meta.json`.

## Fase 3: lógica de juego (TS, sin UI)

- Estado: números dados y del jugador, notas, colores, candidatos del motor aparte de las notas
- Deshacer/rehacer de todo cambio del tablero, incluidos colores, autocompletar y Apply
- Errores: no marcar / conflictos / contra la solución
- Notas autolimpiables, autocompletar notas (solo celdas vacías sin notas, una jugada)
- Bloqueo de dígito completo; mismo número vacía la celda
- Apply de pista: colocación o eliminación, y su deshacer (notas y candidatos del motor)
- Pista con números que no coinciden con la solución: los marca y ofrece quitarlos, en un paso, antes de la siguiente deducción
- Pista usada: al mostrar el paso 1 o el de números erróneos, salvo con "Errores contra la solución" activo. Sin técnica también cuenta; con el motor sin cargar, no
- Transformación aleatoria por partida, aplicada a puzzle y solución a la vez: rotación, bandas, pilas, filas, columnas, permutación de dígitos
- Sudoku del día: PRNG determinista sembrado con la fecha UTC (`AAAA-MM-DD`) elige nivel, puzzle y transformación
- Reglas de registro: pistas usadas, mejor tiempo, "solved with hints", sudoku del día en su fecha UTC
- Cronómetro como estado de la partida
- Modelo de ajustes: los 15 de `design.md` con sus valores por defecto
- Tests de propiedades con fast-check

**Terminado:** cada regla de `design.md` (Tablero, Colorear, Reglas, Reglas de registro, Pistas, Banco) tiene su test y pasan.

## Fase 4: persistencia

- IndexedDB con `idb`: partidas en curso, historial completo, ajustes (con sus valores por defecto si no hay guardados); UUID en partidas e historial
- Mejores tiempos derivados del historial
- Export JSON con versión de formato, `nona-backup-AAAA-MM-DD.json`
- Import: validación con Zod, migración por versión, versión más nueva rechazada, Merge y Replace
- Clear history
- Tests en Firefox (modo navegador de Vitest) contra IndexedDB real

**Terminado:** exportar, borrar e importar devuelve los mismos datos; Merge y Replace cumplen las reglas de `design.md`.

## Fase 5: interfaz

- Leer el lienzo de Claude Design al empezar la fase
- Rutas `#/play`, `#/stats`, `#/settings`
- Móvil (vertical y horizontal), tablet (vertical y horizontal), escritorio con barra lateral
- Tema claro/oscuro/sistema, siete acentos, tamaños S/M/L
- Menú, juego, pausa, teclado, tarjeta de pista, victoria, estadísticas con gráfica SVG, ajustes con Data, diálogos
- Primera pista: la tarjeta muestra la carga del motor en su sitio
- Sudoku del día resuelto: la tarjeta muestra el tiempo y "a new puzzle tomorrow"
- Descartar partida en curso sin confirmación, con aviso "Undo"
- Import: resumen del archivo antes de Merge, Replace o Cancel
- Pausa automática al cambiar de pestaña o bloquear el móvil, según el ajuste
- Vibración en móvil al colocar o al cometer un error, según el ajuste
- Icono de la app
- Tests de interacción en Firefox: los dos modos de entrada, el teclado y el modo color

**Terminado:** las 28 pantallas del lienzo reproducidas en los tres dispositivos; una partida completa jugable con ratón, táctil y teclado; los tests de interacción pasan.

## Fase 6: publicación

- Primera compilación completa con `wasm-opt`: medir JS inicial y WASM en gzip, fijar los topes de size-limit con un 10% de margen
- CI: compila el WASM, pasa todos los tests y size-limit, construye y publica en GitHub Pages. Si algo falla, no publica

**Terminado:** la app publicada en Pages desde la CI.
