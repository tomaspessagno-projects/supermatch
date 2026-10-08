# Diseño de juego — Supermatch: La Torre

> Una torre inflable gigante, enjabonada, en medio de una pileta. Subís su fachada
> todo lo que podés, te caés al agua (siempre te caés), cobrás la fama de lo que subiste y juntaste,
> mejorás al concursante en el kiosco y volvés a subir más alto.

La versión anterior (minijuegos 2D: El Puente Resbaladizo, El Tronco Loco, El Colchón y
las carreras online) quedó archivada en el commit **`a4b0b9c`** (tag local `minijuegos-2d`), con su diseño
completo en ese mismo archivo.

## 1. Pilares

1. **Un loop corto que se repite.** Un intento dura de 20 s a 2 min: subir → caer →
   cobrar → mejorar → subir. Siempre hay "uno más".
2. **Progreso que se acumula.** Cada intento deja algo (fama, objetos, récord, un
   descanso nuevo). Nada se pierde al caer: caer *es* cobrar.
3. **Torpeza cómica.** Jabón, viento, barredoras y burbujas. Caerse al agua es el chiste,
   no un castigo.
4. **Es un show.** Presentador que relata, carteles que flotan, público que se ríe,
   la Copa arriba de todo.
5. **Cuatro equipos.** Elegís color para siempre; cada metro que subís suma para tu
   equipo (misión del día y ranking).
6. **Siempre un objetivo claro.** Una misión activa a la vista, misiones del día,
   estrellas para encontrar y La Copa arriba.

## 2. Referencias (los "juegos de ahora")

| Juego | Qué tomamos |
|---|---|
| Los de cavar un pozo (*Dig*) | Acción simple en loop, un límite que te obliga a volver (energía) y mejoras que te dejan llegar más lejos |
| *Grow a Garden* | Rarezas y **mutaciones** que multiplican el valor; eventos en vivo y mascotas (más adelante) |
| *Steal a Brainrot*, *Pet Simulator 99* | Precios que escalan, colección para completar, coleccionables raros que dan ganas de mostrar |
| *Tower of Hell* y los *obbies* | La torre por pisos con obstáculos, cada piso un tema |

Anatomía común: **acción corta repetible → un tope que te hace volver → vender →
mejorar → zonas nuevas → rarezas y mutaciones → eventos → mascotas → renacer (temporada)
→ un misterio arriba de todo.**

## 3. Qué tomamos del programa original (y qué no)

Supermatch (Telefe, 1992–2010) emitía la versión australiana de *It's a Knockout*:
cuatro equipos (azul, verde, amarillo y colorado) en pruebas físicas absurdas, con
inflables, piletas, espuma y disfraces gigantes.

| Tomamos (formato, que no tiene dueño) | No tomamos (tiene dueño) |
|---|---|
| 4 equipos por color, relato, público | Logos, música y grafismos de Telefe |
| Inflables, agua, jabón, espuma | Nombres o personajes del programa |
| El tono: caerse es el espectáculo | Imágenes o clips originales |

**Ojo con el nombre:** "Supermatch" es una marca del canal. Para un lanzamiento público o
comercial conviene consultarlo o elegir un nombre propio que haga el guiño.

## 4. Objetivos: siempre hay uno claro

Un juego progresivo necesita que en todo momento sepas **qué hacer ahora** y **para
qué**. Por eso hay metas en cuatro escalas, todas a la vista:

| Escala | Qué es | Dónde se ve |
|---|---|---|
| Ahora | **La misión del programa**: una sola activa, en cadena (24), que te lleva de la orilla a La Copa y después a las temporadas | Tarjeta fija arriba a la izquierda, con barra de avance y premio |
| Hoy | **3 misiones del día**, iguales para todos, cambian a la medianoche (Argentina) | En la tarjeta ("DEL DÍA 1/3") y en el panel 🎯 |
| Para juntar | **24 estrellas doradas** escondidas (3 por piso) y la colección de objetos | Barra de la torre (estrellas por piso) y panel 🎯 |
| Con tu equipo | **Cada metro que subís suma 10 puntos a tu color**: misión del día del equipo y ranking | Línea del equipo arriba al centro y en la tarjeta del intento |

Y la **barra de la torre** (a la derecha) muestra los 8 pisos, dónde estás, tu récord y
La Copa arriba: siempre se ve cuánto falta.

### La misión del programa

Cada misión cumplida paga fama y, algunas, un título o un cosmético. Salen con festejo
("¡MISIÓN CUMPLIDA!") y el presentador anuncia la siguiente. El orden enseña el juego:

1. Subí al primer escalón · 2. Caete y cobrá · 3. Comprá una mejora · 4. Descanso del
piso 1 (título *Aprendiz*) · 5. 10 fichas en un intento · 6. Un regalo · 7. Una estrella
(🧢 gorra) · 8. Descanso del piso 2 · 9. Súper rebote (🥳 gorrito) · 10. Descanso del
piso 3 (*Escalador*) · 11. Adoptá una mascota · 12. Descanso del piso 4 (🫧 estela de
burbujas) · 13. 300 de fama en un intento · 14. Descanso del piso 5 · 15. Trepá una red
(*Acróbata*) · 16. 6 estrellas · 17. Volá en un géiser · 18. Descanso del piso 7 (⛑️
casco vikingo) · 19. Un regalo dorado o arcoíris · 20. **¡La Copa!** (*Campeón*, 👑
corona) · 21. Temporada nueva (*Leyenda*, 🌈 estela arcoíris) · 22. Las 24 estrellas ·
23. La Copa 3 veces · 24. Temporada 3 (*Leyenda del Supermatch*).

### Misiones del día

Salen de una lista (5 intentos, 40 fichas, 3 regalos, 20 m, 3 súper rebotes, 2 redes,
"que te tiren 3 veces", 500 de fama, 2 géiseres, una estrella). La fecha elige 3, así
que son las mismas para todos ese día.

### Estrellas doradas

Tres por piso: una **alta** (saltá desde la plataforma de abajo), una **afuera**
(flotando sobre la pileta: te tirás por ella y seguro caés, pero queda contada) y una
**de destreza** (arriba de la cama elástica, solo con súper rebote, o arriba de una
cornisa). Quedan encontradas para siempre, también entre temporadas. Cada 6, un premio:
✨ estela de estrellas, 🎩 galera, 🎊 estela de confeti y 😇 aureola dorada.

### Cosméticos y títulos

Sombreros (gorra, gorrito de fiesta, casco vikingo, galera, corona, aureola) y estelas
(burbujas, estrellas, confeti, arcoíris). No se compran: se ganan. Se eligen en el
**Vestuario** del kiosco; los que faltan dicen cómo se consiguen. El título aparece al
lado de tu fama.

### Para tu equipo

Al cobrar un intento, los metros que subiste van al servidor (`tower_cash`): 10 puntos
por metro para la misión del día de tu color (10.000 entre todos) y para el ranking. El
servidor pone topes: no más que el alto de la torre por intento, un ritmo máximo de
subida entre cobros y 5.000 puntos por jugador por día.

## 5. El loop

1. **En la orilla** (el muelle, a la izquierda de la torre): kiosco, ascensor y el
   primer escalón a la derecha. Acá no se gasta energía.
2. **Subís** la fachada de la torre en zigzag, de un costado al otro. Cada salto y cada
   segundo arriba gastan **energía** (trepar redes, un poco más).
3. **Juntás** fichas en el camino y regalos en las cornisas (si te entran en la mochila).
4. **Sin energía** el concursante se cansa, se resbala hacia la pileta y cae al agua.
   También caés si errás un salto, si se desinfla o desaparece lo que pisás, o si te
   tira un martillo, un guante, una barredora o un cañonazo.
5. **Al caer se cobra** (tarjeta "¡AL AGUA!"):
   - 1 de fama por metro subido en el intento,
   - 3 de fama por cada metro por encima de tu récord,
   - las fichas,
   - el valor de los objetos de la mochila (que van a la colección),
   - 500 extra si llegaste a la cima,
   - y el bonus de la temporada, la mascota y el evento en vivo.
6. **Kiosco**: gastás la fama en mejoras y mascotas. Volvés a la orilla y arrancás otro
   intento.

Los **descansos** (una plataforma ancha al final de cada piso) recargan 12 de energía
la primera vez que los pisás en cada intento, y quedan guardados: con el **Ascensor**
arrancás desde el más alto.

## 6. La torre

**Vista de frente, sin caracol.** La primera versión subía en espiral alrededor de una
columna y la cámara giraba todo el tiempo: mareaba. Ahora la torre es una fachada
inflable enorme y la cámara la mira siempre de frente (solo sigue al jugador de costado
y para arriba). El camino sube en zigzag de un costado al otro, y en cada vuelta cambia
de **carril** (pegado a la pared o más afuera), así una fila nunca queda justo encima de
la anterior y casi siempre que te caés, caés al agua.

Ocho pisos (98 m en total), generados con semilla fija (todos ven la misma torre). El
primer paso de cada piso es común; después lo especial del piso va en ronda (si algo no
entra donde toca, pasa al paso siguiente). Cada piso termina en un descanso; el último
es la **cima**, con la Copa.

| Piso | Tema | Alto | Qué tiene | Para pasarlo |
|---|---|---|---|---|
| 1 | Calentamiento | 10 m | Escalones anchos y bajos | Nada |
| 2 | Jabón y cintas | 10 m | Jabón (frenás tarde) y cintas que te llevan (a favor o en contra) | Nada (Agarre ayuda) |
| 3 | Camas elásticas | 14 m | Camas que te tiran 3 m para arriba (saltando justo al caer, más) y plataformas naranjas que se desinflan a los 0,55 s | Nada |
| 4 | Bolas rojas | 10 m | Bolas gigantes redondas: si no caés en el medio, te vas para el costado. Ventiladores en contra o para afuera | Nada |
| 5 | Martillos y guantes | 12 m | Martillos-péndulo, guantes de box que salen de la pared y te mandan a la pileta, barredoras | Salto nivel 1 |
| 6 | Redes y cañones | 15 m | Columnas con red: apretando hacia la pared se trepa y arriba te subís solo. Cañones de espuma en la pared | Salto nivel 2 |
| 7 | Géiseres y burbujas | 15 m | Chorros que salen cada 3 s y te suben; burbujas que rebotan | Salto nivel 2 |
| 8 | Nubes y calesitas | 12 m | Nubes que te llevan, calesitas que giran, plataformas que titilan y desaparecen | Salto nivel 2 |

Todo está **verificado con tests** (piloto automático sobre la simulación real): los
pisos 1 a 4 se suben sin mejoras, el 5 pide Salto 1 y del 6 al 8, Salto 2; ningún bloque
hace de techo sobre el camino y ninguno se pisa con otro. El límite principal es la
energía: al principio alcanza para un piso y algo.

Cornisas: cada 5 pasos, cerca del medio de la fachada, una cornisa en el otro carril con
un regalo. Pisos más altos, regalos más raros.

## 7. Objetos, rarezas y mutaciones

19 objetos del programa en 5 rarezas: común (6), raro (25), épico (90), legendario (350)
y mítico (1500; solo **La Copa Supermatch**, arriba de todo). El valor crece un 20 % por
piso.

| Mutación | Chance | Multiplica |
|---|---|---|
| Mojado | 20 % | ×1,5 |
| Dorado | 3 % | ×5 |
| Arcoíris | 0,4 % | ×20 |

La **colección** (álbum) muestra los encontrados, con insignias de mutación; los que
faltan aparecen como "???".

## 8. El kiosco

Cuatro pestañas: **Mejoras**, **Mascotas**, **Vestuario** (los cosméticos ganados) y
**Temporada**.

### Mejoras

Precio de cada nivel: `base × crecimiento^nivel`.

| Mejora | Efecto | Base | Crec. | Máx. |
|---|---|---|---|---|
| Energía | +10 por nivel (empieza en 40) | 15 | 1,55 | 15 |
| Salto | +0,45 m/s de impulso por nivel | 25 | 1,7 | 8 |
| Mochila | +2 lugares (empieza en 3) | 20 | 1,6 | 8 |
| Agarre | Menos resbalón en jabón, bolas y viento | 40 | 1,9 | 3 |
| Imán | +0,6 m de radio para agarrar | 60 | 2 | 4 |
| Ascensor | Arrancás en el descanso más alto | 250 | — | 1 |
| Flotador | Manteniendo el salto, caés despacito | 300 | — | 1 |
| Doble salto | Un segundo salto en el aire | 400 | — | 1 |

### Mascotas

Te siguen por toda la torre (flotando atrás tuyo) y dan un bonus. Se compran una vez;
te acompaña una sola.

| Mascota | Bonus | Precio |
|---|---|---|
| 🐥 Patito | Las fichas valen 50 % más | 400 |
| 🐶 Perrito | Agarra fichas y regalos desde 1,2 m más lejos | 900 |
| ☁️ Nubecita | Gastás 25 % menos energía | 1.500 |
| 🐙 Pulpito | 3 lugares más en la mochila | 2.500 |
| 🐲 Dragoncito | Toda la fama ×1,5 | 6.000 |

### Temporada (renacer)

Después de llegar a la cima, podés empezar una **temporada nueva**: volvés a cero
(mejoras, fama, récord y descansos) pero toda la fama que cobres vale **50 % más para
siempre** (temporada 2: ×1,5; temporada 3: ×2…). Te quedás con la colección y las
mascotas. Es el clásico "rebirth" de los juegos progresivos: volver a subir es más
rápido y cada vuelta rinde más.

## 9. Eventos en vivo

Cada 5 minutos, durante 90 segundos, hay un evento que cambia las reglas. Los elige el
reloj (no hace falta servidor), así que **son los mismos para todos los que están
jugando** en ese momento. El marcador avisa cuál viene y cuánto falta; cuando empieza,
suena el silbato y el presentador lo anuncia.

| Evento | Qué cambia |
|---|---|
| ⭐ ¡Fama doble! | Todo lo que cobrás vale el doble |
| 🌙 ¡Gravedad lunar! | Gravedad al 72 %: saltás mucho más alto |
| 🪙 ¡Fichas dobles! | Cada ficha vale el doble |
| 🎁 ¡Lluvia de regalos! | Los intentos que empiezan durante el evento tienen premio en todas las cornisas y el triple de chance de mutación |

## 10. Controles

- **Teclado:** flechas o WASD. Izquierda/derecha para ir de costado; adelante es hacia
  la torre (y en las redes, trepar); atrás, hacia la pileta. Espacio para saltar
  (mantenerlo = flotador; al caer en una cama elástica = súper rebote). E o Enter en el
  kiosco, Escape cierra paneles.
- **Táctil:** joystick a la izquierda, botón de salto a la derecha.
- **Cámara:** siempre de frente a la torre, sigue al jugador y mira un poco hacia donde
  va. Arrastrando se puede espiar de costado. En pantallas angostas se abre el lente y
  se aleja.
- Coyote time (0,1 s) y salto anticipado (0,12 s) para que el control perdone.

## 11. Show y sensación

- Presentador con frases por piso (que explican el truco de cada uno), récord, mochila
  llena, sin nafta, la cima y los eventos en vivo.
- Carteles 3D que flotan ("¡PLAF!", "+3", "¡BOING!", "¡SÚPER BOING!", "¡PIÑA!",
  "¡TOING!", "¡PAF!", "¡FSSS!", "¡FIUUU!", nombre del objeto).
- Partículas: salpicón, confeti, estrellas, espuma; aplastamiento al aterrizar.
- Sonidos: salto, aterrizaje, rebote, golpe, cañonazo, crujido al desinflarse, ficha,
  objeto, silbato de evento, "¡PLAF!" y risas.

## 12. Plan

### Fase 1 — La Torre jugable ✅
Simulación con tests, torre de 8 pisos vista de frente, mecánicas por piso, progresión
y kiosco, mascotas, temporadas, eventos en vivo, colección, render 3D toon, HUD,
controles de teclado y táctiles. Objetivos: misión del programa en cadena, misiones del
día, 24 estrellas, cosméticos, títulos, barra de la torre. Los metros suman al equipo.
El progreso personal se guarda en el navegador.

### Fase 2 — Que no se pierda nada
- Guardar el progreso personal en Supabase (perfil anónimo) y no solo en el navegador.
- Personaje 3D de verdad (modelo + animaciones, ver `ART_DIRECTION.md`).
- Ranking de jugadores dentro de tu equipo (los que más metros sumaron hoy).

### Fase 3 — Que vuelvan todos los días
- **Ver a otros** subiendo en tiempo real (presencia por Supabase Realtime).
- Más eventos (jabón en toda la torre, viento loco, lluvia de patitos dorados).
- Cosméticos por temporada (vinchas, camisetas, estelas).
- Más pisos y el misterio de arriba de la Copa ("¿?").

## 13. Riesgos

- **Rendimiento en celulares viejos:** sombras de una sola luz, pixel ratio tope 1,75,
  geometría instanciada. Si hace falta, se apagan sombras y contornos.
- **Trampas:** todo lo que calcula el cliente se puede falsificar. Mientras el progreso
  sea local no importa; cuando sume al equipo (fase 2) va con topes en el servidor.
- **Que se sienta repetitivo:** por eso cada piso tiene sus mecánicas, las rarezas y
  mutaciones, los eventos en vivo, las mascotas y las temporadas.
- **Mareo:** cámara fija de frente (sin giros) y movimiento suavizado; el viento y los
  golpes empujan, pero la cámara no se sacude.
