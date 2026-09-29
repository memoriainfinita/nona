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
- Sudoku del día: el mismo para cualquiera ese día. Puzzle y nivel salen de la fecha como
  semilla; nivel aleatorio entre los seis

## Niveles

- Easy, Medium, Intermediate, Hard, Expert, Master
- Si el puzzle generado no es del nivel pedido, se genera otro hasta acertar

## Pistas

- Progresivas: 1) celdas implicadas, 2) técnica, 3) conclusión y explicación
- Siguiente deducción: colocar un número o quitar candidatos
- [PENDIENTE: punto 4] El motor ignora las notas del jugador y puede repetir la misma
  eliminación

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

## Pendiente

- 3) Stack
- 4) Motor: puente definitivo, Web Worker, banco pregenerado
- 5) Interfaz
