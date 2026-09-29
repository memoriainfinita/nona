---
created: 2026-09-29
last_updated: 2026-09-29
---

# nona — design

## Plataforma y datos

- Navegador de escritorio, móvil y tablet
- Sin modo offline
- GitHub Pages, web estática
- Partidas y estadísticas por dispositivo
- Exportar e importar los datos a mano para llevarlos a otro dispositivo

## Idioma

- Interfaz en inglés
- Explicaciones de las pistas tal cual las da el motor

## Tablero e interacción

- Modo de entrada configurable (ver Ajustes):
  - Número primero: tocar un número en la botonera lo deja fijado; cada celda vacía que
    se toque lo recibe
  - Celda primero: seleccionar la celda y luego el número
- Seleccionar una celda con número resalta sus iguales en el tablero y en las notas
- Sombreado de fila, columna y caja de la celda seleccionada
- Modo goma
- Sin toques progresivos: ni ciclo de tres toques en celda con número ni segundo toque
  en celda vacía para notas
- Notas autolimpiables: al colocar un número, se quita de las notas de su fila, columna
  y caja
- Contador de cuántos quedan de cada dígito en la botonera
- Deshacer y rehacer
- Teclado: flechas, 1-9, M notas, Espacio, Retroceso/Supr, Ctrl+Z / Ctrl+Y

## Reglas

- Errores marcados según el ajuste de errores
- Bloquear un dígito que ya tiene sus 9: siempre activo
- Escribir en una celda el número que ya tiene la vacía

## Partidas

- Varias en curso, guardado automático, se reanudan desde estadísticas
- Pantalla de victoria: jugar otro del mismo nivel o volver al menú
- Cronómetro
- Pausa: detiene el cronómetro y oculta el tablero
- Autocompletar notas
- Sudoku del día: el mismo para cualquiera ese día; nivel aleatorio entre los seis
  (ver Banco)

## Niveles

- Easy, Medium, Intermediate, Hard, Expert, Master
- Un puzzle entra en el banco de un nivel solo si `analyze` da ese nivel (ver Banco)

## Pistas

- Progresivas: 1) celdas implicadas, 2) técnica, 3) conclusión y explicación
- Siguiente deducción: colocar un número o quitar candidatos
- Sobre los candidatos del motor, no sobre las notas del jugador (ver Motor)

## Estadísticas

- Completados en total y XP (100 por sudoku)
- Actividad de los últimos 7 días
- Mejor tiempo por nivel
- Historial de los 10 últimos completados
- Borrar historial

## Ajustes

| Ajuste | Valores |
|---|---|
| Errores | no marcar / conflictos (repetidos en fila, columna o caja) / contra la solución |
| Notas autolimpiables | sí / no |
| Contador por dígito | sí / no |
| Dígitos completos en la botonera | atenuar / ocultar |
| Modo de entrada | número primero / celda primero |
| Sombreado de zona | sí / no |
| Resaltado de dígito | sí / no |
| Cronómetro visible | sí / no; mide igual oculto |
| Botón de pista | sí / no |
| Botón de autocompletar notas | sí / no |
| Pausa automática al cambiar de pestaña o bloquear el móvil | sí / no |
| Tema | claro / oscuro / sistema |
| Tamaño de números y notas | [PENDIENTE: punto 5] |
| Vibración en móvil al colocar o al cometer un error | sí / no |

- [PENDIENTE: punto 5] Valor por defecto de cada ajuste

## Stack

- React + TypeScript + Vite, versiones actuales al empezar
- pnpm
- CSS propio con tokens (variables CSS)
- Iconos: lucide-react
- Fuente del sistema
- Gráfica de actividad: SVG propio
- Zod para validar los datos importados
- Tests: Vitest, fast-check (propiedades), modo navegador de Vitest sobre Firefox
  (`@vitest/browser-playwright`)
- size-limit: tope de tamaño de JS y WASM
- Repo `memoriainfinita/nona`, público, GPL-3.0
- GitHub Pages por GitHub Actions: compila el WASM (Rust, wasm-bindgen-cli, wasm-opt),
  pasa todos los tests y size-limit, construye y publica. Si algo falla, no publica

## Motor

- Fork de sudoku-core en memoriainfinita, fijado a un commit, con una función pública más:
  pista sobre los candidatos recibidos, sin recalcularlos
- La app lleva los candidatos del motor: todos menos los eliminados por pistas ya dadas
- En un Web Worker
- En la app solo se usa para pistas. El WASM se carga al pedir la primera
- Errores, conflictos y autocompletar notas se calculan en JS

## Banco

- 200 puzzles base por nivel, con su solución
- Entra un puzzle solo si `analyze` da el nivel de su grupo
- Generado en local, con las semillas registradas, y subido al repo como datos
- Cada partida aplica una transformación aleatoria: rotación, bandas, pilas, filas,
  columnas, permutación de dígitos
- Sudoku del día: la fecha elige nivel, puzzle y transformación

## Pendiente

- 5) Interfaz
