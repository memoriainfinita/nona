---
date: 2026-10-17
scope: funciones de aprendizaje de chess.com (puzzles, lecciones, Learning Path, revisión de partida, puzzle del día) comparadas con nona
---

# chess.com: hallazgos

Origen de cada afirmación:
- **[B]** búsqueda web (URLs en Fuentes)
- **[U]** dicho por el usuario en la conversación
- **[N]** código y `design.md` de nona

Método: búsquedas web (este entorno no abre páginas).

## Learning Path

- Cuatro niveles: New to Chess, Beginner, Intermediate, Advanced [B]
- Rehecho hace poco con contenido interactivo [B]
- Según usuarios del foro: cada paso es un reto en lugar de un vídeo; el camino es más corto que antes [B]
- Según usuarios del foro: el progreso se reinició con el cambio [B]
- Los vídeos antiguos siguen en la biblioteca de lecciones [B]
- Los pasos son pequeños juegos que piden encontrar 2 o 3 movimientos para explicar un concepto [U]

## Lecciones [B]

- Agrupadas en cursos, desde el menú "Learn"
- Explicación del Coach más retos interactivos para practicar lo aprendido
- Gratis: el curso de iniciación y una lección más a la semana (otra fuente: una al día); Premium: todas
- Drills: ejercicios repetibles de patrones (finales, mates); práctica contra bots

## Puzzles [B]

| Función | Cómo funciona |
|---|---|
| Valoración | Sube o baja según aciertes, en función de la dificultad del puzzle frente a la tuya. Desde 10-2025, tipo Glicko, con todo re-valorado; tres niveles de dificultad |
| Pistas | Cuentan como intento fallido: baja la valoración. Si la primera jugada correcta llega después de la pista, no suma progreso |
| Puzzles personalizados | Antes "Learning mode". Eliges tema y rango de dificultad; resultados por tema, con los más flojos arriba |
| Puzzle Rush | 3 o 5 minutos; tres fallos y se acaba; no afecta a la valoración |
| Puzzle Battle | La misma serie que un rival, 3 minutos, valoración propia |
| Puzzle Points | 8 rangos (de Madera a Leyenda) de 20 niveles cada uno |
| Cuenta gratis | 3 puzzles al día, un Rush y una Battle (las fuentes no coinciden) |

## Puzzle del día [B]

- Calendario con marca en los días resueltos; el día que estás viendo, en verde
- Racha con icono de llama; 48 horas para resolver cada puzzle; los días perdidos se recuperan dentro de
  ese plazo
- Disponible a medianoche, hora del Pacífico

## Revisión de partida [B]

- El Coach recorre los momentos clave: apertura, puntos de inflexión, buenas jugadas y errores
- Retry Mistakes: repetir los errores, con una precisión recalculada
- Explica por qué cada jugada fue buena o mala; las explicaciones completas, en el plan Diamond
- Recomienda cursos según los momentos de la partida

## Comparativa con nona

- Bucle de chess.com: lección → puzzles del tema → jugar → revisión → recomendación. nona tiene jugar y
  pistas [B][N]
- Ya parecido [N]:
  - Pista = sin mejor tiempo (en chess.com, pista = fallo)
  - Calendario del sudoku del día (chess.com añade racha y 48 h)
- Activos de nona para lo que falta [N]:
  - El motor conoce la técnica de cada paso
  - Pista en 3 pasos: patrón, celdas afectadas, conclusión
  - Frases por técnica (`TECHNIQUE_INTRO`)
  - Arnés `survey`: encuentra posiciones donde aparece cada técnica
- Choque: racha de 48 h frente a la regla de nona de que el sudoku del día solo cuenta si se resuelve en
  su fecha [N]
- Hoy solo se guarda cuántas pistas se pidieron, no de qué técnica era cada una [N]

## Propuesta: Learning Path para nona

- Cada nodo es una técnica, con 2 o 3 pasos a encontrar sobre una posición real
- Ejemplo, Naked Pair: tocar las dos celdas de la pareja → marcar las eliminaciones → colocar el número
  que queda
- Es la pista de 3 pasos al revés; la corrección usa los mismos datos del motor
- Posiciones generadas una vez con `survey` y guardadas como datos, como el banco
- Progreso en IndexedDB, incluido en la copia de seguridad, con ids de nodo estables

| Tramo del camino | Técnicas |
|---|---|
| Easy | Singles |
| Medium | Parejas, intersecciones |
| Hard | Tríos, X-Wing |
| Expert | Wings |
| Master | Cadenas, ALS |

## Otras ideas, como piezas del camino

| Prioridad | Idea |
|---|---|
| 1 | "Encuentra el siguiente paso": la base de los nodos |
| 2 | Práctica por técnica: nodos repetibles, con estadísticas de acierto y las más flojas arriba |
| 3 | Revisión al terminar: técnicas que necesitó el puzzle, repetir los pasos en los que pediste pista, recomendar el nodo. Requiere guardar la técnica de cada pista |
| 4 | Racha del sudoku del día |
| 5 | Valoración y contrarreloj: más competición que aprendizaje |

## Relación con la investigación de CTC

- La propuesta 5 de `research/cracking-the-cryptic.md` (practicar una técnica) pasa a ser parte del
  Learning Path
- Hueco frente a CTC: sus explicaciones están escritas a mano y solo en algunos puzzles

## Fuentes

- [How do Puzzles work on Chess.com?](https://support.chess.com/en/articles/8608686-how-do-puzzles-work-on-chess-com)
- [How do Puzzle ratings work?](https://support.chess.com/en/articles/8602396-how-do-puzzle-ratings-work)
- [New Puzzles Ratings, Difficulty Settings](https://www.chess.com/news/view/announcing-new-puzzles-rating-system)
- [What are Puzzle points on Chess.com?](https://support.chess.com/en/articles/9681952-what-are-puzzle-points-on-chess-com)
- [Puzzle Tiers / Leagues explained](https://www.chess.com/blog/nerlin/puzzle-tiers-leagues-explained)
- [New Feature: Puzzle Battle!](https://www.chess.com/news/view/new-feature-puzzle-battle)
- [Announcing The Updated Puzzle Rush](https://www.chess.com/news/view/new-puzzle-rush-chess)
- [Chess Puzzles](https://www.chess.com/puzzles)
- [How do Lessons work on Chess.com?](https://support.chess.com/en/articles/8609703-how-do-lessons-work-on-chess-com)
- [Chess.com Lessons Guide](https://www.chess.com/blog/TheChessPhilospher/chess-com-lessons-guide)
- [A New Year's Resolution: Improve Your Chess With New Lessons](https://www.chess.com/news/view/a-new-years-resolution-improve-your-chess-with-new-lessons)
- [Is Chess.com Worth It in 2026?](https://circlechess.com/blog/is-chesscom-worth-it-for-serious-chess-improvement-in-2026)
- [Is a Chess.com Premium Membership Worth It?](https://www.chess.com/blog/speedyg2/is-a-premium-chess-com-membership-worth-it-2021)
- [Chess.com Premium review (Chess Goals)](https://chessgoals.com/chess-com-membership/)
- [How does Game Review work?](https://support.chess.com/en/articles/8584089-how-does-game-review-work)
- [Game Review now available for all members](https://www.chess.com/news/view/chesscom-releases-new-game-review)
- [Game Review now on mobile](https://www.chess.com/news/view/chesscom-releases-new-mobile-game-review)
- [Key Moments forum announcement](https://www.chess.com/forum/view/community/new-feature-key-moments-post-game-analysis-fully-released)
- [How does the Daily Puzzle work?](https://support.chess.com/en/articles/8708990-how-does-the-daily-puzzle-work)
