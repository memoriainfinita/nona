---
created: 2026-09-29
last_updated: 2026-09-30
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
- Herramientas: Undo, Redo, Notes, Color, Erase, Fill notes, Hint
- Fill notes pasa a Clear notes cuando todas las celdas vacías tienen notas: borra todas las
  notas en una jugada, que Undo revierte
- Teclado: flechas, 1-9, N notas, E goma, Espacio pausa y reanuda, Retroceso/Supr,
  Ctrl+Z / Ctrl+Y, H pista, C modo color
- Clic derecho (ratón): hace lo contrario del modo de notas. Número primero: sobre una celda, con el
  dígito fijado. Celda primero: sobre un número de la botonera, en la celda seleccionada. Sin menú
  del navegador sobre tablero y botonera
- Los botones del juego no se quedan con el foco al pincharlos: Enter y Espacio no repiten el
  último clic. Con Tab, el tablero es una sola parada (la celda seleccionada) y el foco sigue a
  las flechas; Enter en el tablero no hace nada salvo con la pista abierta

## Colorear casillas

- Casillas enteras
- Herramienta Color: mientras está activa, la botonera pasa a ser paleta de 8 colores y
  "sin color"
- Teclado en modo color: 1-8 elige color, 9 o 0 sin color
- Entran en deshacer/rehacer y se guardan con la partida
- Sobre casilla coloreada, las notas se aclaran para que se lean

## Reglas

- Errores marcados según el ajuste de errores
- Bloquear un dígito que ya tiene sus 9: siempre activo
- Escribir en una celda el número que ya tiene la deja vacía. En "número primero", tocar
  una celda que ya tiene el número fijado la vacía, también con el dígito completo: el
  bloqueo impide añadir, no quitar

## Partidas

- Varias en curso, guardado automático, se reanudan desde el menú y desde estadísticas
- Pantalla de victoria: tiempo, nivel, aviso de mejor tiempo si lo es, jugar otro del
  mismo nivel o volver al menú
- Cronómetro: el tiempo se guarda con la partida y sobrevive a recargar. Corre solo con la
  pantalla de juego visible y sin pausa; al salir al menú se detiene y al reanudar sigue.
  Con la pausa automática desactivada, sigue corriendo al cambiar de pestaña
- Pausa: detiene el cronómetro y oculta el tablero
- Autocompletar notas
- Sudoku del día: el mismo para cualquiera ese día; su nivel lo da la lista del día y es
  visible antes de empezar (ver Banco)

## Reglas de registro

- Partida resuelta con pistas: cuenta como completada y suma XP, no marca mejor tiempo; la
  victoria indica "solved with hints"
- Una pista cuenta como usada cuando la tarjeta muestra el paso 1 (ya revela la técnica) o
  el paso de números erróneos, salvo con "Errores contra la solución" activo
- "Errores contra la solución" y autocompletar notas no afectan al mejor tiempo
- Apply de una eliminación: quita esos candidatos de las notas del jugador si los tiene; sin
  notas en la celda, no cambia nada visible y la pista queda aplicada
- Autocompletar notas: solo celdas vacías sin notas; las anotadas no se tocan; se deshace
  como una sola jugada
- Deshacer/rehacer: todo cambio del tablero (números, notas, colores, autocompletar, Apply).
  Pausa y abrir o cerrar la pista no entran
- Deshacer un Apply de eliminación revierte las notas y los candidatos del motor
- Sudoku del día: manda la fecha UTC. Sin terminar ese día, sigue como partida en curso
  normal; solo cuenta como "del día" si se resuelve dentro de su fecha

## Datos locales

- IndexedDB: partidas en curso (con deshacer, colores y candidatos del motor), historial
  completo y ajustes. La pantalla muestra los 10 últimos completados
- Mejores tiempos: se calculan del historial (mínimo sin pistas, por nivel); no se guardan aparte
- Cada partida y cada entrada del historial llevan un id único (UUID) desde que se crean
- Cada partida y cada entrada del historial guardan la semilla de su puzzle base
- Exportación: JSON con versión de formato; incluye partidas, historial y ajustes; nombre
  `nona-backup-AAAA-MM-DD.json`. Versión más nueva: se rechaza. Versión anterior: se migra
  al importar, con una función por versión
- Merge: partidas en curso unidas por id, y con el mismo id gana la modificada más
  recientemente; historial unido por id; ajustes del dispositivo. Replace: ajustes del archivo

## Web

- Rutas con `#`: `#/play`, `#/stats`, `#/settings`. Sin enlaces para compartir puzzles
- Icono de la app, "novena llena con 9": cuadrícula 3×3 en una baldosa redondeada; ocho
  casillas apagadas y la novena (abajo a la derecha) rellena del acento con un 9 trazado
  del color de la baldosa, siempre en índigo (marca; no sigue el acento del jugador).
  9 en forma "diagonal" (círculo y cola recta en diagonal),
  tamaño 0,3, grosor 1,15 (parámetros de `Logo.dc.html` en la página "Logo" del lienzo).
  Oscuro: baldosa `#1B1E1D`, casillas `#353A38`, novena `#8C95F6`. Claro: baldosa blanca
  con borde `#DAD6CC`, casillas `#D5D0C4`, novena `#4B55C4`
- El icono va también en la app: a 28 px delante de "nona" en la cabecera de inicio (móvil y
  tablet) y a 36 px con "nona" debajo arriba de la barra lateral (escritorio)
- Descartados: cuadrícula entera, novena lisa, 9 sin relleno, IX, n sobre rejilla,
  dígito 9 suelto; formas del 9 round, straight, hook, angular; resto de la familia del
  violeta (periwinkle, violet, iris, lavender, purple, orchid, magenta)

## Niveles

- Easy, Medium, Intermediate, Hard, Expert, Master
- Un puzzle entra en el banco de un nivel solo si `analyze` da ese nivel (ver Banco)

## Pistas

- Progresivas: 1) técnica, 2) celdas implicadas, 3) conclusión y explicación
- Paso 3: botón Apply aplica la conclusión
- Siguiente deducción: colocar un número o quitar candidatos
- Sobre los candidatos del motor, no sobre las notas del jugador (ver Motor)
- Si hay números que no coinciden con la solución, la pista los marca y ofrece quitarlos,
  en un paso, antes de la siguiente deducción
- La tarjeta ocupa el sitio de la fila de herramientas; la botonera sigue visible
- Se cierra con Close o Esc, con Apply, con cualquier jugada en el tablero o con Ctrl+Z.
  Abierta, no hay herramientas en pantalla
- Teclado: H abre, Enter siguiente paso (en el paso 3, Apply), Esc cierra
- Sin técnica (el motor recurre a backtracking): paso 1 "No logical step found", paso 2 la
  celda, paso 3 el valor con Apply y sin explicación. Cuenta como pista
- Si el motor no carga: la tarjeta muestra "Couldn't load the hint engine" con Retry y
  Close; la partida sigue normal y la pista no cuenta

## Estadísticas

- Completados en total y XP (100 por sudoku)
- Partidas en curso: nivel, tiempo, celdas que faltan y Continue; vacío, "No games in progress."
- Actividad de los últimos 7 días
- Mejor tiempo por nivel
- Historial de los 10 últimos completados
- Tocar una entrada del historial abre el tablero resuelto en solo lectura (pistas iniciales como
  en el juego, lo demás en el acento), con tiempo, pistas y fecha, y Play again: partida normal
  nueva con el mismo puzzle y la misma transformación, también si era un sudoku del día
- Las entradas guardan la transformación; las anteriores a eso muestran el puzzle base, con aviso
- Actividad e historial en fecha local del dispositivo; solo el sudoku del día usa UTC

## Ajustes

| Ajuste | Valores | Por defecto |
|---|---|---|
| Errores | no marcar / conflictos (repetidos en fila, columna o caja) / contra la solución | contra la solución |
| Notas autolimpiables | sí / no | sí |
| Contador por dígito | sí / no | sí |
| Dígitos completos en la botonera | atenuar / ocultar | atenuar |
| Modo de entrada | número primero / celda primero | número primero |
| Sombreado de zona | sí / no | sí |
| Resaltado de dígito | sí / no | sí |
| Cronómetro visible | sí / no; mide igual oculto | sí |
| Botón de pista | sí / no | sí |
| Botón de autocompletar notas | sí / no | sí |
| Pausa automática al cambiar de pestaña o bloquear el móvil | sí / no | sí |
| Tema | claro / oscuro / sistema | sistema |
| Acento | índigo / ámbar / rosa / violeta / azul / turquesa / verde | índigo |
| Tamaño de números y notas | S / M / L | M |
| Vibración en móvil al colocar o al cometer un error | sí / no | sí |

- Sección Data al final de Ajustes: Export, Import y Clear history
- Índigo: color de marca y acento por defecto. Oscuro `#8C95F6`, claro `#4B55C4`; ≥6:1 en los dos
- Ámbar deja de ser el color de marca porque ya lo usa sadhana; queda como acento elegible
- Coral descartado como acento: se confunde con el rojo de los errores

## Interfaz

- Maquetas: lienzo de Claude Design https://claude.ai/artifact/YE8Y6Qxn6K4PEQdsze4nGX
- Estilo oscuro con acento
- Móvil: botonera en fila de 9
- Móvil y tablet en vertical: tablero, botonera y debajo las herramientas (o la tarjeta de pista)
- Tablet: vertical y horizontal
- Escritorio: barra lateral con Play, Stats, Settings
- Menú: Continue (partidas en curso), sudoku del día, nuevo juego (6 niveles + Start)
- Pausa en tablet y escritorio: pantalla completa sin tablero
- Móvil en horizontal: tablero a la izquierda; botonera 3×3 y herramientas a la derecha
- Modo notas activo: los dígitos de la botonera se muestran pequeños y a un lado
- Primera pista: la tarjeta muestra la carga del motor en su sitio, solo esa vez
- Partidas en curso: botón para descartar cada una, sin confirmación, con aviso "Undo"
- Sudoku del día resuelto: la tarjeta muestra el tiempo y "a new puzzle tomorrow"; no se
  vuelve a jugar
- Importar: resumen del archivo; Merge (por defecto, conserva todo), Replace (borra antes
  lo del dispositivo) o Cancel. Archivo no válido: aviso, nada cambia
- Borrar historial: borra partidas e historial (y con él los mejores tiempos); conserva los ajustes;
  confirmación que recuerda exportar antes
- Diálogos: hoja inferior en móvil, tarjeta centrada en tablet y escritorio

## Tema claro

- Fondo crema claro, tablero blanco
- Acentos oscurecidos, todos ≥5:1 sobre blanco y con texto blanco encima: ámbar `#8A5A00`,
  índigo `#4B55C4`, rosa `#AD3A6C`, violeta `#6450C0`, azul `#23609F`, turquesa `#17766A`, verde `#3B7327`
- Casillas coloreadas en tonos pastel: números dados ≥12:1, notas ≥4,5:1
- Rosa, en claro y en oscuro, con luminosidad parecida al rojo de los errores; los
  distingue el subrayado del error

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
- size-limit: dos topes, JS inicial y WASM, en gzip. Se fijan en la primera compilación
  completa (con `wasm-opt`) con un 10% de margen sobre lo medido
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
- El puente devuelve con cada pista el nombre legible de la técnica (`Display` de Rust)

## Banco

- Dos conjuntos sin puzzles en común: banco normal por nivel y lista del día
- Cada puzzle con su solución; su semilla es su id
- Entra un puzzle solo si `analyze` da su nivel
- Generado en local, con las semillas registradas, y subido al repo como datos
- Generación: se pide a varios niveles y cada puzzle va al nivel que da `analyze`. Tope de
  tiempo por llamada, varios hilos, semilla por puzzle, reanudable
- Antes de la generación completa, tanda piloto que mide puzzles por hora en cada nivel
- Los dos crecen solo por el final: lo publicado no cambia ni se reordena. Cada tanda nueva
  se añade detrás
- Cada partida aplica una transformación aleatoria: rotación, bandas, pilas, filas,
  columnas, permutación de dígitos
- Banco normal: 500 puzzles por nivel en la primera tanda. La partida elige primero
  bases que no estén en el historial del dispositivo para ese nivel; con todas jugadas,
  repite base con otra transformación
- Lista del día: una sola lista ordenada. El día n desde la fecha de lanzamiento (UTC) juega la
  entrada n; la transformación sale de un PRNG determinista en JS sembrado con la fecha UTC
  (`AAAA-MM-DD`). Cada tanda lleva el mismo número de puzzles de cada nivel, barajados al
  generarla. Si la lista se acaba, vuelve a empezar por el principio (con otra transformación)
- Lista del día: primera tanda de 732 (122 por nivel), dos años
- Fecha de lanzamiento: [PENDIENTE: se fija al publicar]
