# Diseño de juego — Supermatch

## 1. Visión

> Un episodio de un programa de juegos de TV en 3 minutos: tu equipo contra los otros
> tres, pruebas disparatadas y cada caída es un chiste.

**Pilares** (toda decisión se mide contra esto):

1. **Torpeza cómica.** El control es físico e impreciso a propósito, y fallar da gracia,
   no bronca. Cada prueba tiene **una sola** restricción física cómica, y es distinta en
   cada una (hielo, balde que chapotea, tronco que gira…).
2. **Es un show.** Presentación, silbato, relato, tabla entre pruebas, podio final.
3. **Cuatro equipos.** El color del equipo está en todos lados, y los rivales se ven
   compitiendo al mismo tiempo, aunque el juego sea asincrónico.
4. **Sesiones cortas.** Un episodio de unos 3 minutos; cada prueba de 35 a 45 s; volver
   a jugar al instante.
5. **Justo.** Simulaciones deterministas, mismo episodio para todos el mismo día, y el
   puntaje se valida en el servidor.

## 2. Qué tomamos del programa original (y qué no)

Supermatch (Telefe, 1992–2010) emitía la versión australiana de *It's a Knockout*:
cuatro equipos (azul, verde, amarillo y colorado) en pruebas físicas absurdas, con
muñecos gigantes, escenografías enormes, piletas, disfraces y una tabla de puntos.

| Tomamos (formato, que no tiene dueño) | No tomamos (tiene dueño) |
|---|---|
| 4 equipos por color, tabla, relato | Logos, música y grafismos de Telefe |
| Pruebas con agua, espuma, inflables, disfraces gigantes | Nombres o personajes del programa |
| El tono: caerse es el espectáculo | Imágenes o clips originales |

**Ojo con el nombre:** "Supermatch" es una marca del canal. Para un lanzamiento público o
comercial conviene consultarlo o elegir un nombre propio que haga el guiño.

## 3. Diagnóstico de hoy

- **Un solo verbo:** correr y saltar. **Un solo suelo:** jabón. **Una sola prueba,**
  repetida 3 veces.
- **Caer al agua termina la prueba de golpe:** partidas de 3 s, poca agencia.
- **No hay rivales a la vista,** así que no se siente que "competís con los otros equipos".
- **No hay show:** ni presentación, ni cuenta regresiva, ni tabla, ni podio. **No hay sonido.**
- **El puntaje premia solo llegar lejos:** no hay decisiones de riesgo/recompensa.

## 4. Estructura de un episodio

| Momento | Duración | Qué pasa |
|---|---|---|
| Apertura | 5 s | Presentador/a: "¡Bienvenidos!" Tu equipo y los rivales en pantalla |
| Presentación de prueba | 4 s | Nombre, una regla en una línea y los controles con un mini demo |
| 3, 2, 1, silbato | 3 s | El árbitro da la largada |
| Prueba | 35–45 s | Jugás contra los 3 rivales (bots, después fantasmas reales) |
| Fin de prueba | 3 s | "¡Tiempo!" o "¡Llegó!": puntos de la prueba |
| Tabla | 4 s | Los puntos "vuelan" a la tabla del episodio; posiciones de los 4 equipos |
| (×3 pruebas) | | |
| Final | 8 s | Podio de equipos, tu aporte al ranking global, "la caída del episodio" (repetición) |

Total: unos 3 minutos. Se puede saltear todo menos las pruebas.

## 5. Catálogo de pruebas

Cada prueba cambia al menos dos de estos ejes: **verbo, control, cámara, física cómica,
forma de puntuar**.

| Prueba | Verbo | Control | Cámara | Gracia física | Puntaje | Inspiración |
|---|---|---|---|---|---|---|
| **El Puente Resbaladizo** (v2) | Correr | ←→ + salto | Lateral con scroll | Piso de jabón | Distancia + tiempo + pompas | Pasarelas enjabonadas |
| **Baldes al Tanque** | Cargar con cuidado | ←→ + salto, ↓ = paso cuidadoso | Lateral, 2 pantallas | El agua chapotea y se derrama | Litros entregados | Relevos llenando baldes |
| **El Tronco Loco** | Equilibrar | ←→ + salto | Fija | El tronco gira y cambia de sentido | Segundos arriba + burbujas | Troncos giratorios sobre pileta |
| *Justa en la Pileta* (después) | Duelo | Ataque alto/bajo, bloqueo | Fija | Garrote de espuma, viga angosta | Rounds ganados | Duelo de garrotes sobre el agua |
| *La Catapulta* (después) | Apuntar | Mantener para cargar, ↑↓ ángulo | Fija | Viento, blancos que se mueven | Impactos | Tiro de globos de agua |
| *Disfraz Gigante* (después) | Caminar | ←→ para contrapesar | Lateral | Disfraz de 3 m que se bambolea; la alfombra se mueve | Distancia | Carreras con disfraces gigantes |

**MVP del episodio:** Puente v2, Baldes al Tanque y Tronco Loco. Son tres verbos
distintos (velocidad, cuidado, ritmo) con controles que entran en tres botones, ideal
para el celular. Las otras tres entran en la rotación del "episodio del día".

### 5.1 El Puente Resbaladizo v2: carrera

- **Cambio de regla:** caer al agua **no termina la prueba**. El jugador vuelve a la
  última bandera con 1,5 s de penalización (salpicón, chapuzón y vuelta). La prueba dura
  hasta la meta o 45 s. Más intentos, más caídas, más risa.
- **Obstáculos nuevos:**
  - **trampolín inflable:** te lanza alto; atajo o trampa;
  - **cinta transportadora al revés:** un tramo que te empuja para atrás;
  - **martillo de espuma:** un péndulo que barre la pasarela con un ritmo fijo;
  - **cañón de espuma:** dispara pelotas en arco que te empujan.
- **Riesgo y recompensa:** pompas doradas (+puntos) puestas en los caminos peligrosos,
  como arriba de un rodillo o al borde de un charco.
- **Puntaje:** distancia (hasta 500) + llegar (150) + tiempo sobrante (hasta 200) +
  pompas (hasta 150). El máximo sigue siendo 1000.

### 5.2 Baldes al Tanque: cargar con cuidado

La contracara del Puente: acá el piso es normal y lo difícil es **no apurarse**.

- Vas y venís entre la **fuente** (izquierda), donde el balde se llena solo, y el
  **tanque de tu equipo** (derecha), que tiene un medidor gigante. Son 45 s.
- **El balde chapotea:** la superficie del agua es un resorte que reacciona a tu
  aceleración. Si el chapoteo pasa el borde, se derrama en proporción. Saltar o recibir un
  golpe derrama de golpe. **↓ = paso cuidadoso:** más lento y con menos chapoteo; la
  decisión de cuándo apurarse es la habilidad.
- **Obstáculos:**
  - martillos de espuma que cruzan el camino (timing);
  - escalones inflables (hay que saltar, y saltar derrama);
  - un charco de jabón corto, guiño al Puente;
  - rivales que te cruzan en el camino de vuelta.
- **Puntaje:** litros entregados, normalizado a 1000. **Falla:** perder agua o tropezar
  y soltar el balde (lo levantás vacío).
- **Arco del nivel:**
  1. ida plana para aprender el chapoteo;
  2. aparecen los martillos;
  3. escalones inflables;
  4. en los últimos 10 s el público cuenta en voz alta.

### 5.3 El Tronco Loco: equilibrio y ritmo

- Cámara fija. Un **tronco gigante** gira sobre la pileta, visto de frente (un círculo con
  anillos y corteza). Estás parado arriba.
- **La superficie del tronco te arrastra:** hay que correr en contra para quedarte arriba.
  Si te alejás demasiado de la cima, te caés.
- **El giro cambia:** acelera, frena y se invierte. Cada cambio se anuncia un segundo antes
  (crujido, el tronco tiembla) para que sea legible y justo.
- **Cañones de espuma** disparan pelotas a dos alturas: hay que saltar o agacharse. Las
  **burbujas doradas** que flotan dan puntos si saltás a reventarlas.
- **3 vidas,** 45 s. **Puntaje:** segundos arriba × 15 + burbujas, hasta 1000.
- **Rivales:** los troncos de los otros 3 equipos se ven atrás, más chicos, con sus
  concursantes cayéndose.

## 6. Diseño de niveles

**Principios:**

1. **Enseñar, desarrollar, sorprender, cerrar.** Cada obstáculo aparece primero solo y en
   un lugar seguro, después se combina, después tiene una vuelta de tuerca, y al final hay
   un sprint.
2. **Todo se telegrafía.** Sombras, temblores o sonido antes de cada peligro. Códigos de
   color fijos:
   - **cian** = agua (caída);
   - **rosa** = goma (rebota);
   - **amarillo/dorado** = premio;
   - **rojo** = peligro inminente.
3. **Riesgo y recompensa siempre presentes:** el camino seguro y el camino con pompas.
4. **Ritmo:** tensión y respiro. Nunca dos picos de dificultad seguidos sin un tramo
   tranquilo.
5. **Legible en el celular:** los obstáculos se reconocen por silueta, sin leer texto.

**Bloques y semilla diaria.** Cada prueba se arma con **bloques diseñados a mano**
(segmentos de 600 a 1200 px con un desafío cada uno) marcados por dificultad. El
**episodio del día** usa una semilla para elegir y ordenar bloques respetando la curva de
dificultad. Así todos juegan lo mismo ese día (el ranking es justo) y mañana es distinto.

**Medir para ajustar.** Registramos dónde cae la gente (posición, bloque, causa). Si más
del 40 % cae en el mismo bloque, ese bloque se rediseña. Los tests de intención (como los
del Puente) y un bot que tiene que poder ganar validan cada bloque nuevo.

## 7. Personajes

| Personaje | Rol | Dónde aparece |
|---|---|---|
| **Concursante** | El jugador. Camiseta del color del equipo | Todas las pruebas |
| **Rivales** | Concursantes de los otros 3 equipos. Bots con distinto nivel; después, fantasmas de la mejor partida del día de cada equipo | En las pruebas, semitransparentes, y en la barra de progreso |
| **Presentador/a** | Relata: abre, presenta cada prueba, festeja y se burla de las caídas | Pantallas entre pruebas (React), con burbujas de texto |
| **Árbitro** | Silbato, banderas, tarjeta en las caídas | Largada y final de cada prueba |
| **Muñecos gigantes** | Inflables de la escenografía (pato, tiburón, pulpo); algunos son obstáculos | Fondos y obstáculos |
| **Público** | Reacciona a lo que pasa ("¡uhhh!", risas, aplausos) | Fondo animado y sonido |

Más adelante: **4 concursantes para elegir** (distintos cuerpos, géneros y tonos de piel)
y **disfraces** cosméticos que se desbloquean jugando.

## 8. Puntaje, comodín y ranking

- Cada prueba da de **0 a 1000** (validado en el servidor con `max_score`).
- **Comodín:** antes del episodio elegís una prueba que vale **doble**. Es estrategia: ¿la
  que mejor jugás o la más riesgosa? El servidor lo valida.
- **Ranking:**
  - por equipo, **del día** (el episodio del día);
  - de la **temporada** (semanal, se reinicia los lunes);
  - **histórico.**
- **Récord personal** por prueba, y "tu aporte" al equipo en la pantalla final.

## 9. Sensación ("juice") y sonido

- **Pausa de impacto** (60–80 ms congelado) en cada golpe, **cámara lenta** en caídas
  espectaculares, sacudón de cámara (ya está), anticipación, y estirar y aplastar (ya está).
- **Sonido:** SFX para cada evento (boing, splash, silbato, chapoteo, crujido del
  tronco), música de programa de juegos en loop, público que reacciona y frases del
  presentador.
- **Repetición:** la simulación es determinista, así que grabando el input se puede
  repetir la mejor caída del episodio en cámara lenta y compartirla.

## 10. Plan de ejecución

Tamaños: **S** = 1 iteración, **M** = 1–2, **L** = 2–4.

### Fase 1 — "Esto es un show" (sin arte nuevo) ✅

Hecha. Los bots quedaron calibrados (puntaje medio en 12 carreras): as ≈ 900,
promedio ≈ 710, torpe ≈ 500; quien cruza en 30 s con una caída saca ≈ 830. El
sonido usa placeholders sintetizados hasta que lleguen los audios de Flow.

| # | Entregable | Tamaño | Terminado cuando |
|---|---|---|---|
| 1.1 | Formato episodio: presentación de cada prueba, 3-2-1 con silbato, tabla entre pruebas, podio final | M | Un episodio completo se juega de punta a punta con todas las pantallas |
| 1.2 | Puente: caer al agua = volver a la última bandera | S | Tests de intención actualizados; ninguna prueba dura menos de 30 s salvo llegando a la meta |
| 1.3 | Rivales bot de los otros 3 equipos + barra de progreso con 4 puntos | M | Bots con 3 niveles; el mejor gana a veces, ninguno es perfecto |
| 1.4 | Sonido (SFX, música, público) | M | Cada evento tiene sonido; se puede silenciar |
| 1.5 | Controles táctiles | S | Se juega entero en el celular en horizontal |

### Fase 2 — "Variedad"

| # | Entregable | Tamaño | Arte de Flow |
|---|---|---|---|
| 2.1 | Baldes al Tanque (simulación, nivel, render, tests, bot) | L | Hoja `props-baldes` (falta) |
| 2.2 | El Tronco Loco ✅ | L | Hoja `props-tronco` |
| 2.3 | Puente v2: trampolín, cinta, martillo, cañón, pompas, banderas ✅ | M | Hoja `props-puente-v2` |

**El Tronco Loco quedó así:** arranca quieto y el primer crujido enseña que cada
cambio de giro se avisa un segundo antes. Los cañones están a dos alturas: la pelota
baja se salta; la alta te pasa por arriba si no saltás. Bots calibrados (12
partidas): as ≈ 820, promedio ≈ 700, torpe ≈ 380. Un jugador perfecto saca ≈ 985.
Mientras falta Baldes al Tanque, el episodio es Puente → Tronco → Puente.

**El Puente v2 quedó así** (8450 px, por bloques): charco chico con pompa encima →
rodillo con pompa → trampolín que cruza un charco ancho (pompas en el arco) → cinta
de goma → dos martillos con un charco en el medio → rodillo que sube y baja con
pelotas de cañón cruzando → cadena de dos trampolines → cinta + martillo → último
charco y meta. Reglas que fijan los tests: el trampolín vuela siempre entre ~480 y
~600 px (aterriza en piso firme o en otro trampolín), nunca hay dos obstáculos que
empujan a menos de un vuelo de distancia (evita el pinball), hay una bandera cada
1600 px como mucho y las banderas están lejos de todo lo que empuja. Bots: as ≈ 805,
promedio ≈ 540, torpe ≈ 390; un jugador que planifica saca ≈ 876 en 21 s.

### Fase 3 — "Personajes"

| # | Entregable | Tamaño | Arte de Flow |
|---|---|---|---|
| 3.1 | Presentador/a y árbitro ✅ | M | Hoja de cada uno + boca abierta/cerrada |
| 3.2 | Concursante animado por clips de video | L | Clips ya pedidos (correr, patinar, golpe…) |
| 3.3 | 4 concursantes elegibles / disfraces | L | Hojas de personaje + clips |

### Fase 4 — "Que vuelvan todos los días"

| # | Entregable | Tamaño |
|---|---|---|
| 4.1 | Episodio del día: semilla + pruebas del día servidas por la base | M |
| 4.2 | Comodín ×2 | S |
| 4.3 | Repetición de la mejor caída + compartir | M |
| 4.4 | Fantasmas reales: la mejor partida del día de cada equipo como rival | M |
| 4.5 | Analítica de caídas + validación por re-simulación en el servidor (anti-trampa) | M |

**En paralelo:** mientras se programa una fase, se genera en Flow el arte de la
siguiente. Los prompts están en `docs/ART_DIRECTION.md`.

## 11. Riesgos y decisiones

| Riesgo | Mitigación |
|---|---|
| Que las pruebas nuevas no sean divertidas | Prototipo con formas simples primero, jugarlo, y recién después el arte |
| Controles en el celular | Tres botones grandes en todas las pruebas, el mismo esquema |
| El arte de IA sale inconsistente | Siempre usar la hoja de referencia del personaje como imagen de inicio |
| El nombre "Supermatch" | Consultarlo antes de un lanzamiento comercial |
| Trampas en el ranking | Topes por prueba hoy; re-simulación del input en el servidor (4.5) |

## 12. Por qué todavía se siente básico, y cómo seguir

Diagnóstico después de la Fase 1, el Tronco y el Puente v2:

| Qué falta | Por qué pesa | Cómo se resuelve |
|---|---|---|
| **Sonido de verdad** | Los efectos y la música son sintetizados: suenan a demo. Es lo que más "abarata" | Audios de Flow (prompts listos) + voces del presentador |
| **Personaje con más vida** | El títere de cartón tiene pocas poses | Clips de video de Flow por estado (Fase 3.2), más expresiones, ropa que se mueve |
| **Momentos para mostrar** | Lo más gracioso (una caída) pasa y se va | Repetición de la mejor caída en cámara lenta al final del episodio, para compartir |
| **Motivo para volver** | Cada partida es igual | Episodio del día, récords personales, medallas por prueba, comodín ×2 |
| **Variedad** | Dos pruebas | Baldes al Tanque y después Justa en la Pileta |

### Hecho en la pasada de "juice" y show

- Congelado de impacto en cada golpe y cámara lenta al caer al agua y al llegar.
- Cámara que sigue en altura (trampolines), se aleja al volar y da un golpe de zoom en
  los impactos; líneas de velocidad a fondo sobre el jabón.
- Hinchada de los 4 equipos en primer plano que salta con cada caída; luces que
  barren el estudio; cartel "EN VIVO".
- Tu puesto en vivo ("2º") y avisos de adelantamiento ("¡PASASTE A AZUL!").
- Brazos en molino al patinar sin control, festejo al ganar y reaparición cayendo
  desde arriba de la bandera.

### Orden propuesto

1. **Audios de Flow** (efectos, música, voces del presentador): el mayor salto de
   calidad por esfuerzo. Solo necesita los videos.
2. **Repetición de la mejor caída** al final del episodio (la simulación es
   determinista: se graba el input y se vuelve a jugar en cámara lenta). M.
3. **Baldes al Tanque**, la tercera prueba. L.
4. **Medallas y récords** (bronce, plata, oro por prueba) y episodio del día. M.
5. **Clips del concursante** (correr, patinar, golpe, festejo) en lugar del títere. L.

