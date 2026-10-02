# nona — history

Lo que salió de `state.md`. Se escribe solo si explica por qué las cosas son como son.

Más reciente arriba.

### 2026-10-02 — Con modo sin conexión

**Qué cambió:** `design.md` decía "Sin modo offline". La app pasa a ser instalable (PWA) y a funcionar
sin red.
**Por qué:** el usuario pidió poder instalarla. Todo lo que usa ya era local (motor WASM, banco,
IndexedDB), así que el service worker cubre también el uso sin conexión.

### 2026-10-01 — Mediciones del motor, fuera de `state.md`

**Qué cambió:** las tablas de pruebas del motor (nativo, WASM, bucle de pistas y pistas a mitad de
partida) salen de `state.md`; allí quedan sus conclusiones.
**Por qué:** son las mediciones que llevaron al motor elegido, al fork y al puente con candidatos. Se
guardan tal cual:

#### Pruebas del motor (2026-09-29, nativo, release)

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

#### Pruebas en WASM (2026-09-29)

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

#### Bucle de pistas (2026-09-29, nativo)

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

#### Pistas a mitad de partida en WASM (2026-09-30)

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

### 2026-09-30 — Banco: listas que crecen y sudoku del día en orden

**Qué cambió:** el banco inmutable de 200 por nivel, del que la fecha elegía al azar el sudoku del día, pasa a dos conjuntos que solo crecen por el final: banco normal (500 por nivel en la primera tanda) y lista del día ordenada (732 días), recorrida desde la fecha de lanzamiento. Las partidas normales eligen primero puzzles no jugados.
**Por qué:**
- 200 por nivel no daban ni para un año de diarios sin repetir base; con elección al azar, la base se repite a las pocas semanas
- Ampliar un banco inmutable no servía al diario, que salía siempre del primero
- Con la lista en orden, añadir puzzles no cambia los días ya publicados
- El piloto mostró que generar es barato: 3,3 h de CPU para los 3732

### 2026-09-29 — Marca y acento por defecto: índigo en vez de ámbar

**Qué cambió:** el acento por defecto y el color del icono pasan de ámbar (`#E6A63B`) a índigo (`#8C95F6` oscuro, `#4B55C4` claro). El ámbar queda como acento elegible.
**Por qué:** el ámbar ya es el color de sadhana. Índigo elegido entre ocho tonos de la familia del violeta; los del lado azul se separan más en tono del rojo de los errores.

### 2026-09-29 — Pista: técnica antes que celdas

**Qué cambió:** el orden de la pista pasa de celdas → técnica → conclusión a técnica → celdas → conclusión.
**Por qué:**
- En un single, las celdas implicadas son la propia celda: el paso 1 daba la respuesta
- En general, las celdas revelan más que el nombre de la técnica; lo que menos revela va primero
- Usa solo datos estructurados del motor (técnica y celdas); la zona solo existe dentro del texto de la explicación

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
