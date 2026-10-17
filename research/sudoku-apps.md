---
date: 2026-10-17
scope: apps cercanas a nona en el enfoque de aprender técnicas (Good Sudoku, sudoku.coach, Enjoy Sudoku, HoDoKu, SudokuWiki) más Lichess y Sudoku.com como referencia
---

# Apps hermanas: hallazgos

Origen: búsquedas web (URLs en Fuentes); este entorno no abre páginas. Las comparaciones con nona salen
del código y `design.md` de nona.

## Resumen

- sudoku.coach ya hace casi lo que se planteaba con el Learning Path (ver `research/chess-com.md`):
  es el competidor más directo de nona

## Qué hace cada una

### sudoku.coach

- Web gratis y sin anuncios; versión Android que empaqueta la web y funciona sin conexión
- Campaña paso a paso por técnicas, de básicas a avanzadas: niveles de práctica, puzzles "jefe" y modo
  infinito
- Dice enseñar más de 40 técnicas
- Pistas cada vez más precisas; solucionador que enseña la técnica de cada paso
- 11 niveles, variantes, editor, impresión
- Otras apps llevan "Sudoku Coach" en el nombre; una de ellas es de suscripción

### Good Sudoku (Zach Gage, iOS)

- Enfoque: quitar trabajo mecánico para centrarse en razonar
- Rellenar todas las notas de un toque
- Si a una fila, columna o caja le queda una celda, tocarla escribe el número
- Pistas que a veces solo nombran la técnica, sin señalar la celda
- Dos tipos de nota más tachado
- "Focus mode": resalta dónde puede ir un número
- Dificultad ligada a las técnicas que pide el puzzle
- Crítica: las pistas dan por hecho que tus notas coinciden con las del motor

### Enjoy Sudoku

- Pistas por etapas: de un recordatorio suave a la ilustración completa de la técnica
- Usar una pista suma tiempo al reloj, más cuanto más difícil es la técnica (al menos en la web)
- Tutorial con puzzles de práctica, puzzles propios, 16 niveles

### HoDoKu (escritorio, libre)

- Entrenador y analizador
- Tres modos: jugar, aprender (cada puzzle generado contiene al menos una de las técnicas elegidas) y
  practicar
- Muestra todos los pasos posibles en la posición actual, ordenados por tipo, celda o candidato
- Puntos de guardado: probar una hipótesis y volver atrás
- Pistas vaga, concreta y completa

### SudokuWiki (Andrew Stuart)

- Referencia de contenido de las técnicas
- Solucionador con "Take Step" para avanzar paso a paso
- Estrategias en tres escalones: básicas, duras, diabólicas
- "Weekly Unsolvable": puzzle semanal que su solucionador no resuelve

### Lichess (ajedrez, libre)

- Puzzles por tema, que se pueden incluir o excluir
- Panel con puntos fuertes y áreas de mejora en un periodo de 1 a 90 días; repetir puzzles
- Storm (3 minutos), Streak (sin tiempo, dificultad creciente), Racer (multijugador)

### Sudoku.com (Easybrain)

- App de masas
- Retos diarios con trofeos; eventos de temporada con medallas
- Pistas a cambio de ver anuncios; quitar anuncios: 4,99 $/mes o 14,99 $ una vez
- Comprobación automática; estadísticas por nivel
- Más de 10.000 puzzles en 6 niveles

## Qué confirma y qué añade

- Learning Path validado en sudoku: sudoku.coach lo tiene, y HoDoKu tiene su modo "aprender"
- Puzzle jefe al final de cada tramo del camino: un puzzle completo que obliga a usar la técnica. El
  motor ya sabe qué técnicas pide cada puzzle
- Panel por técnica (como Lichess): puntos fuertes y áreas de mejora según las pistas pedidas y los
  aciertos en la práctica. Recomienda qué nodo del camino toca
- El paso 1 de la pista de nona ya es la "pista suave" de Good Sudoku y Enjoy Sudoku: nombra la técnica
  sin señalar celdas
- La crítica a Good Sudoku no afecta a nona: los pasos 2 y 3 muestran los candidatos del motor aparte de
  las notas del jugador

### Mejoras pequeñas y aisladas

| Mejora | De |
|---|---|
| Tocar la última celda vacía de una fila, columna o caja la rellena | Good Sudoku |
| Puntos de guardado para probar una hipótesis | HoDoKu |
| Penalizar las pistas con tiempo según la técnica, como alternativa a "sin mejor tiempo" | Enjoy Sudoku |

### No encaja con nona

- Trofeos, eventos, anuncios, modos multijugador

## nona frente a sudoku.coach

- En común: gratis, web, sin conexión, pistas por técnica
- Propio de nona:
  - Pista en 3 pasos con patrón, celdas afectadas y conclusión marcadas en el tablero
  - Explicaciones generadas desde la prueba del motor
  - Sudoku del día con calendario
  - Diseño cuidado para móvil
- Con el Learning Path, nona igualaría su propuesta principal; la diferencia tendría que estar en la
  calidad de las explicaciones y en la experiencia
- Antes de diseñar el camino: probar sudoku.coach a fondo [PENDIENTE: no se pudo abrir desde este entorno]

## Fuentes

- [Good Sudoku (TouchArcade thread)](https://toucharcade.com/community/threads/good-sudoku-by-zach-gage-by-zach-gage.410206/)
- [Good Sudoku reviews (App Store)](https://apps.apple.com/gb/app/good-sudoku-by-zach-gage/id1489118195?see-all=reviews&platform=iphone)
- [Good Sudoku is a Roguelike (Medium)](https://medium.com/from-the-aether/good-sudoku-is-a-roguelike-11dcc2e92baa)
- [Good Sudoku is a Roguelike (copia)](https://intothecast.online/blog/voa4l0tycb9hu078sw0b3o4wmgkvag)
- [iMore: Zach Gage releases Good Sudoku](https://www.imore.com/zach-gage-releases-good-sudoku-reimagined-and-fun-take-classic)
- [Tools and Toys: Good Sudoku](https://toolsandtoys.net/good-sudoku-for-ios-by-zach-gage-and-jack-schlesinger/)
- [sudoku.coach (Google Play)](https://play.google.com/store/apps/details?id=coach.sudoku.twa&hl=en_US)
- [sudoku.coach (Product Hunt)](https://www.producthunt.com/products/sudoku-coach)
- [Sudoku Coach: Trainer (App Store)](https://apps.apple.com/us/app/sudoku-coach-trainer/id6758725909)
- [Sudoku Coach - Play and Learn (Google Play)](https://play.google.com/store/apps/details?id=com.floppeyapps.infinite_sudoku&hl=en)
- [Enjoy Sudoku (Amazon)](https://www.amazon.com/Jason-Linhart-Enjoy-Sudoku/dp/B004AZH4C8)
- [Enjoy Sudoku Daily (Amazon)](https://www.amazon.com/Jason-Linhart-Enjoy-Sudoku-Daily/dp/B004LPBTAA)
- [Web Enjoy Sudoku](http://www.enjoysudoku.com/webplay/)
- [HoDoKu](https://hodoku.sourceforge.net/)
- [HoDoKu manual: Playing the Game](https://hodoku.sourceforge.net/en/docs_play.php)
- [HoDoKu manual: Introduction](https://hodoku.sourceforge.net/en/docs_intro.php)
- [SudokuWiki solver](https://www.sudokuwiki.org/sudoku.htm)
- [SudokuWiki Killer solver](https://www.sudokuwiki.org/killersudoku.aspx)
- [SudokuWiki Weekly Unsolvable](https://www.sudokuwiki.org/Weekly-Sudoku.aspx?weeklypuznum=4)
- [Lichess Puzzles (fandom)](https://lichess.fandom.com/wiki/Puzzles)
- [Dorset Chess bulletin on Lichess](https://www.dorsetchess.co.uk/bulletin-no-61-lichess/)
- [Lichess forum: puzzle features in mobile app](https://lichess.org/forum/lichess-feedback/need-all-puzzle-features-in-mobile-app-as-in-website)
- [Lichess forum: Puzzle Storm](https://lichess.org/forum/general-chess-discussion/stuck-at-low-level-on-puzzle-storm)
- [Chess Lessons Pro: Lichess puzzles](https://www.chesslessonspro.com/2026/02/11/chess-puzzles-on-lichess-with-me-road-to-2500-rating/)
- [Sudoku.com (App Store)](https://apps.apple.com/us/app/sudoku-com-number-games/id1193508329)
- [Sudoku.com (Easybrain)](https://easybrain.com/sudoku)
- [Sudoku.com (Google Play)](https://play.google.com/store/apps/details?id=com.easybrain.sudoku.android&hl=en_CA)
- [Sudoku Times: best Android sudoku apps](https://sudokutimes.com/best-sudoku-apps-for-android/)
