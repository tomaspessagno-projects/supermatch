# Diseño de juego — Supermatch: La Torre

> Una torre inflable gigante, enjabonada, en medio de una pileta. Subís todo lo que
> podés, te caés al agua (siempre te caés), cobrás la fama de lo que subiste y juntaste,
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
5. **Cuatro equipos.** Elegís color para siempre; la fama va a sumar para tu equipo
   (fase 2).

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

## 4. El loop

1. **En la orilla** (el muelle): kiosco, ascensor, cartel del piso 1. Acá no se gasta
   energía.
2. **Subís** por el caracol de escalones alrededor de la columna inflable. Cada salto y
   cada segundo arriba gastan **energía**.
3. **Juntás** fichas en el camino y regalos en las cornisas (si te entran en la mochila).
4. **Sin energía** el concursante se cansa, se resbala para afuera y cae a la pileta.
   También caés si errás un salto o te tira una barredora.
5. **Al caer se cobra** (tarjeta "¡AL AGUA!"):
   - 1 de fama por metro subido en el intento,
   - 3 de fama por cada metro por encima de tu récord,
   - las fichas,
   - el valor de los objetos de la mochila (que van a la colección),
   - 500 extra si llegaste a la cima.
6. **Kiosco**: gastás la fama en mejoras. Volvés a la orilla y arrancás otro intento.

Los **descansos** (un anillo cada 12 m) recargan 12 de energía la primera vez que los
pisás en cada intento, y quedan guardados: con el **Ascensor** arrancás desde el más alto.

## 5. La torre

Seis pisos de 12 m (72 m en total), generados con semilla fija (todos ven la misma
torre). Cada piso termina en un anillo de descanso; el último es la **cima**, con la
Copa.

| Piso | Tema | Qué cambia | Para pasarlo |
|---|---|---|---|
| 1 | Calentamiento | Escalones anchos y bajos | Nada |
| 2 | Jabón | 3 de cada 4 escalones resbalan (frenás tarde) | Nada (Agarre ayuda) |
| 3 | Viento | Ráfagas que empujan para afuera; parado empujan menos (0,45×) | Salto nivel 1 |
| 4 | Barredoras | Brazos que barren el escalón; si te tocan, volás | Salto nivel 2 |
| 5 | Burbujas | Una de cada tres es una burbuja que te rebota bien alto | Salto nivel 2 |
| 6 | Nubes | Escalones que se mueven y te llevan | Salto nivel 2 |

Las alturas de cada piso están **verificadas con tests**: los pisos 1–2 se suben sin
mejoras, el 3 pide Salto 1 y del 4 al 6, Salto 2 (con piloto automático sobre la
simulación real). El límite principal es la energía: al principio alcanza para uno o
dos pisos.

Cornisas: cada 5 escalones hay una cornisa afuera del camino con un regalo. Pisos más
altos, regalos más raros.

## 6. Objetos, rarezas y mutaciones

14 objetos del programa en 5 rarezas: común (6), raro (25), épico (90), legendario (350)
y mítico (1500; solo **La Copa Supermatch**, arriba de todo). El valor crece un 25 % por
piso.

| Mutación | Chance | Multiplica |
|---|---|---|
| Mojado | 20 % | ×1,5 |
| Dorado | 3 % | ×5 |
| Arcoíris | 0,4 % | ×20 |

La **colección** (álbum) muestra los encontrados, con insignias de mutación; los que
faltan aparecen como "???".

## 7. El kiosco

Precio de cada nivel: `base × crecimiento^nivel`.

| Mejora | Efecto | Base | Crec. | Máx. |
|---|---|---|---|---|
| Energía | +8 por nivel (empieza en 30) | 15 | 1,55 | 15 |
| Salto | +0,45 m/s de impulso por nivel | 25 | 1,7 | 8 |
| Mochila | +2 lugares (empieza en 3) | 20 | 1,6 | 8 |
| Agarre | Menos resbalón en jabón y viento | 40 | 1,9 | 3 |
| Imán | +0,6 m de radio para agarrar | 60 | 2 | 4 |
| Ascensor | Arrancás en el descanso más alto | 250 | — | 1 |
| Flotador | Manteniendo el salto, caés despacito | 300 | — | 1 |
| Doble salto | Un segundo salto en el aire | 400 | — | 1 |

## 8. Controles

- **Teclado:** WASD o flechas para caminar (relativo a la cámara), Espacio para saltar
  (mantenerlo = flotador), E o Enter en el kiosco, Escape cierra paneles.
- **Táctil:** joystick a la izquierda, botón de salto a la derecha.
- **Cámara:** sigue al jugador desde afuera de la torre; arrastrando se gira. En
  pantallas angostas se abre el lente y se aleja.
- Coyote time (0,1 s) y salto anticipado (0,12 s) para que el control perdone.

## 9. Show y sensación

- Presentador con frases por piso, récord, mochila llena, sin nafta, la cima.
- Carteles 3D que flotan ("¡PLAF!", "+3", "¡PUM!", "¡BOING!", nombre del objeto).
- Partículas: salpicón, confeti, estrellas; aplastamiento al aterrizar.
- Sonidos: salto, aterrizaje, rebote, golpe, ficha, objeto, cascada de "¡PLAF!" y risas.

## 10. Plan

### Fase 1 — La Torre jugable ✅
Simulación con tests, torre de 6 pisos, progresión y kiosco, colección, render 3D toon,
HUD, controles de teclado y táctiles. El progreso se guarda en el navegador.

### Fase 2 — Que sume para el equipo
- Guardar el progreso en Supabase (perfil anónimo) y no solo en el navegador.
- La fama cobrada suma a la Misión del día y al ranking de tu color (RPC con topes de
  plausibilidad, como `finish_run`).
- Personaje 3D de verdad (modelo + animaciones, ver `ART_DIRECTION.md`).

### Fase 3 — Que vuelvan todos los días
- **Eventos en vivo:** "hora del jabón doble", "lluvia de patitos dorados", viento loco.
- **Mascotas** que siguen al concursante y dan bonus (más imán, menos gasto).
- **Ver a otros** subiendo en tiempo real (presencia por Supabase Realtime).

### Fase 4 — Temporadas
- **Renacer** ("nueva temporada"): reiniciás mejoras a cambio de un multiplicador de
  fama permanente y cosméticos.
- Más pisos y el misterio de arriba de la Copa ("¿?").

## 11. Riesgos

- **Rendimiento en celulares viejos:** sombras de una sola luz, pixel ratio tope 1,75,
  geometría instanciada. Si hace falta, se apagan sombras y contornos.
- **Trampas:** todo lo que calcula el cliente se puede falsificar. Mientras el progreso
  sea local no importa; cuando sume al equipo (fase 2) va con topes en el servidor.
- **Que se sienta repetitivo:** por eso los pisos cambian de tema, las rarezas y
  mutaciones, y los eventos de la fase 3.
