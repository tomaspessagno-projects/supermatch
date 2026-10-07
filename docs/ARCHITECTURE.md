# Arquitectura

## Decisiones

| Tema | Decisión |
|---|---|
| Motor 2D | **KAPLAY** 3001 (fork mantenido de Kaboom.js, misma API) |
| Ragdoll | **Falso**: un resorte inclina el torso, da vueltas en el aire tras un golpe y rebota como goma. Sin motor de cuerpos rígidos |
| Física | **Simulación propia por minijuego**: TypeScript puro, determinista, paso fijo de 120 Hz. KAPLAY solo lee input y dibuja |
| Facción | **Bloqueada** una vez elegida (en el store y en la base) |
| Auth | Supabase Anonymous Sign-in |
| Escritura de puntajes | Solo vía RPC `start_run` / `finish_run` |

## Principio rector

**React no sabe que existe KAPLAY, y KAPLAY no sabe que existe React.**
Se hablan por un único puente con un contrato tipado (`game/contract.ts`).

```
┌──────────── React / Next (UI) ────────────┐        ┌──── KAPLAY (canvas) ────┐
│ app/  components/  store/  lib/           │        │ game/                   │
└───────────────────────┬───────────────────┘        └────────────┬────────────┘
                        │                                         │
                        └── bridge/ (GameHost) ◄── contract.ts ───┘
```

## Estructura de carpetas

```
supermatch/
├── src/
│   ├── app/                          # Rutas (App Router). Solo UI.
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Landing: facción, modo de juego y Misión del equipo
│   │   ├── online/
│   │   │   ├── page.tsx
│   │   │   └── OnlineLobby.tsx       # Buscar rivales, crear sala, entrar con código
│   │   ├── play/
│   │   │   ├── page.tsx
│   │   │   └── PlayScreen.tsx        # GameHost + HUD + carteles del episodio + botones táctiles
│   │   ├── results/
│   │   │   ├── page.tsx
│   │   │   └── ResultsSummary.tsx
│   │   └── leaderboard/page.tsx      # Ranking por equipo en vivo
│   │
│   ├── components/
│   │   ├── ui/                       # (pendiente) Exportados de Figma
│   │   ├── hud/
│   │   │   ├── Hud.tsx               # Prueba n/3, puntaje en vivo, silencio
│   │   │   └── TouchControls.tsx     # ◀ ▶ ⤒ en pantallas táctiles + "girá el celular"
│   │   ├── episode/
│   │   │   ├── EpisodeOverlay.tsx    # Presentación, 3-2-1, "¡YA!", tabla entre pruebas
│   │   │   ├── Host.tsx              # El presentador: cabeza que habla + globo
│   │   │   └── TeamRow.tsx           # Fila de tabla de equipos (episodio y resultados)
│   │   ├── home/PlayMenu.tsx         # Elegir equipo y después: solo, carrera online o con amigos
│   │   ├── mission/MissionBoard.tsx  # Los 4 tanques de la misión del día, en vivo
│   │   └── TeamPicker.tsx            # Tarjetas con escudo por equipo
│   │
│   ├── game/                         # Mundo KAPLAY. TS puro.
│   │   ├── contract.ts               # GameEvent (juego→UI), GameCommand (UI→juego), GameHandle
│   │   ├── assets/
│   │   │   ├── manifest.ts           # Generado por scripts/process_art.py
│   │   │   └── index.ts              # loadAssets(): sprites + fuente
│   │   ├── engine/
│   │   │   ├── createGame.ts         # Crea/destruye la instancia de KAPLAY
│   │   │   ├── scene.ts              # SceneContext: lo que recibe cada minijuego
│   │   │   ├── audio.ts              # Efectos, música en loop, silencio
│   │   │   ├── animator.ts           # Animación de un concursante (cualquier prueba)
│   │   │   ├── referee.ts            # El árbitro: silbato, tarjeta roja, bandera
│   │   │   ├── show.ts               # Luces, hinchada, "EN VIVO", puesto y adelantamientos
│   │   │   ├── timefx.ts             # Congelado de impacto y cámara lenta
│   │   │   ├── random.ts             # Aleatorio con semilla (bots)
│   │   │   ├── rivals.ts             # Los 3 rivales de cualquier prueba: bots o remotos
│   │   │   ├── rollback.ts           # Mundo compartido (pruebas en equipo): confirmado + predicción
│   │   │   ├── interpolate.ts        # Dibuja al jugador entre dos pasos (pantallas de 90/144 Hz)
│   │   │   ├── physics.ts            # Helpers puros: approach, spring, colisiones
│   │   │   ├── contestant.ts         # Rig del concursante (títere de cartón)
│   │   │   └── fx.ts                 # Partículas, carteles y destellos
│   │   └── scenes/
│   │       ├── mattress/             # El Colchón (en equipo): mundo compartido, bots en la sim
│   │       ├── rolling-log/          # El Tronco Loco (mismos archivos que el Puente)
│   │       └── slippery-bridge/      # El Puente Resbaladizo
│   │           ├── tuning.ts         # Todas las perillas de feel
│   │           ├── level.ts          # Layout fijo (charcos, rodillos, meta)
│   │           ├── sim.ts            # Simulación pura: step(world, input, dt)
│   │           ├── sim.test.ts       # El feel y las reglas, como tests
│   │           ├── bot.ts            # Rivales: planificador + errores humanos por nivel
│   │           ├── bot.test.ts       # Calibración: que se les pueda ganar
│   │           ├── render.ts         # Dibuja el estado (cámara, ragdoll, rivales, efectos)
│   │           └── index.ts          # Escena KAPLAY: input + paso fijo + render
│   │
│   ├── bridge/                       # Único punto de contacto React ⇄ KAPLAY
│   │   ├── GameHost.tsx              # Monta el juego y traduce eventos ⇄ store
│   │   ├── input.ts                  # Juego activo: botones táctiles y pips de la cuenta
│   │   └── events.ts                 # Re-exporta los tipos del contrato para la UI
│   │
│   ├── store/session.ts              # Zustand: facción, modo, participantes, fase, puntajes, silencio
│   ├── online/                       # Carreras en vivo (no sabe de KAPLAY: usa el contrato)
│   │   ├── channel.ts                # Canal de sala: presencia + mensajes (Supabase o entre pestañas)
│   │   ├── protocol.ts               # Mensajes, tiempos, anfitrión, emparejamiento, participantes
│   │   ├── inputs.ts                 # Teclas por tick comprimidas ("4*40,5")
│   │   └── room.ts                   # Store de la sala + el episodio en vivo + NetLink para el juego
│   └── lib/
│       ├── teams.ts                  # Facciones (espejo de public.teams)
│       ├── minigames.ts              # Nombre, regla y controles de cada prueba
│       ├── host.ts                   # Lo que dice el presentador
│       ├── participants.ts           # Los 4 del episodio y la tabla
│       ├── nicknames.ts              # Apodo al azar ("Pato Resbaloso")
│       └── supabase/
│           ├── client.ts             # Cliente del navegador (URL + publishable key)
│           └── api.ts                # loadProfile, joinTeam, startRun, finishRun, ranking, misiones
│
├── art/source/                       # Hojas originales generadas (fuente de verdad del arte)
├── art/source/audio/                 # Audios de Flow (se procesan a public/game/sfx/)
├── scripts/process_art.py            # Hojas → sprites recortados + manifiesto
├── scripts/make_sfx.py               # Sonidos provisorios sintetizados
├── scripts/process_audio.py          # Audios de Flow → public/game/sfx/*.mp3
├── public/game/                      # Sprites, fuente y sonidos (sfx/) del juego
├── public/ui/                        # Imágenes de la UI (escudos, concursante)
├── supabase/migrations/              # Esquema versionado (fuente de verdad)
└── docs/
```

## Reglas de dependencia

Las fuerza ESLint (`no-restricted-imports` en `eslint.config.mjs`):

- **`src/game/**`** no puede importar `react`, `next`, `zustand`, `@supabase/*` ni nada de
  `@/*` que no sea `@/game/*`.
- **Todo `src/` salvo `game/` y `bridge/`** no puede importar `kaplay` ni `@/game/*`. Los
  tipos del contrato se toman de `@/bridge/events`.

## Flujo de un run

1. Landing: si el navegador ya tiene sesión, se carga el perfil (equipo bloqueado y
   apodo). Si no, al elegir facción se crea una sesión anónima y el perfil
   (`players`) con un apodo al azar. La base no deja cambiar el equipo después.
   Con el equipo elegido aparecen los modos: solo (sigue acá) u online (ver
   "Carreras online").
2. `GameHost` importa el motor, resetea el run en el store y manda
   `minigame:start { slot: 1 }`: la escena se carga quieta, con los rivales en la
   largada. En paralelo, el store llama a `start_run()` (el servidor fija la hora
   de inicio).
3. Cada prueba recorre las fases del store (`phase`), que dibuja `EpisodeOverlay`:
   - `intro`: presentación con la regla y los controles; "¡A JUGAR!" pasa a
   - `countdown`: 3-2-1, un `minigame:count` por número (pip y arranca la música);
   - `playing`: `GameHost` manda `minigame:go` (silbato) y la escena empieza a
     simular. El juego emite `minigame:score` (HUD en vivo, como mucho 10 por
     segundo) y al terminar, después de `endDelay`, `minigame:finished { result,
     rivals }`;
   - `between`: tabla con tus puntos y los de los otros tres. Sigue sola a
     los 7 s (o con el botón) a la `intro` de la prueba siguiente, que `GameHost`
     carga con `minigame:start`. En la tercera dice "TABLA FINAL" y lleva a `/results`.
4. Los rivales son bots de los otros 3 equipos que corren la misma simulación en la
   misma pista. Sus puntos son cosméticos: solo se muestran en las tablas.
5. `/results` muestra la tabla del episodio y llama una sola vez a
   `finish_run(run_id, results)`: la base valida y suma al equipo en la misma
   transacción. Volver a mostrar la pantalla no reenvía.
6. `/leaderboard` lee `team_totals` y escucha sus UPDATEs por Realtime.

**Sin conexión:** si Supabase no responde, se juega igual. El run no suma y la
pantalla de resultados lo avisa.

Cada run terminado también suma a la **Misión del equipo** del día
(`team_missions`, día de Argentina): `finish_run` hace el upsert en la misma
transacción y la portada, `/leaderboard` y `/results` la escuchan por Realtime.

## Carreras online

Tres modos, elegidos en la portada después del equipo:

Primero se elige **competir** (carrera) o **en equipo** (El Colchón); después:

| Modo | Con quién | Ruta |
|---|---|---|
| Solo | 3 bots (rivales o compañeros) | `/play` |
| Online rápido | Hasta 3 personas al azar; los huecos, bots | `/online?modo=rapida` (`&tipo=equipo`) |
| Con amigos | Sala con código de 5 letras / link; el anfitrión elige carrera o equipo | `/online` y `/online?sala=CÓDIGO` |

**Cómo funciona (input streaming determinista).** Las simulaciones son puras y
de paso fijo, así que no hace falta mandar posiciones: cada compu manda sus
**teclas por tick** y las demás re-simulan a esa persona igual que en su compu.

1. **Sala** = un canal de Supabase Realtime (`sm:room:CÓDIGO`) con *Presence*
   (quién está) y *Broadcast* (mensajes). El **anfitrión** es el que está hace
   más tiempo; si se va, toma la posta el siguiente.
2. **Emparejamiento**: todos los que buscan entran a `sm:matchmaking`. El que más
   espera arma la sala: con 4 enseguida, con 2 o 3 a los 10 s. A los 15 s solo
   se ofrece jugar contra la compu.
3. **`start`** (anfitrión): semilla del episodio, los jugadores y la largada de la
   prueba 1 (en 8 s). Todos arman los mismos 4 participantes
   (`buildParticipants`): las personas y bots de los colores libres.
4. Cada prueba arranca a la **hora que marca el anfitrión** (`go`, 9,5 s después
   de que llegaron todos los resultados, o a los 60 s como máximo). La cuenta
   regresiva está atada a esa hora: si una compu se atrasó, saltea lo que pasó.
5. **Durante la prueba**: cada compu junta sus teclas y las manda cada 250 ms
   (`in`, comprimidas: medio segundo con una flecha son 4 caracteres). A los
   remotos se los ve con **0,6 s de atraso** (`REMOTE_DELAY_TICKS`), así llegan
   fluidos.
6. **Bots**: salen de la semilla de cada prueba, así que son iguales en todas
   las compus. Su puntaje final depende de cuándo terminaste vos, por eso vale
   el del **árbitro** (el primero de la lista), que lo manda con su resultado.
7. **`res`**: cada uno manda su puntaje real; las tablas muestran "jugando…"
   hasta que llega. El que se va queda con 0 y "SE FUE".

El juego no sabe de la red: recibe un `NetLink` (`sendInput`, `remoteInput`,
`remoteTicks`) y `RivalSpec[]` con `control: "bot" | "remote"`. `engine/rivals.ts`
corre los bots a la par del jugador y avanza los remotos hasta donde llegaron
sus teclas.

**Puntaje y ranking**: lo tuyo se valida y suma igual que solo (`finish_run`).
Las salas no escriben nada en la base.

**Canales públicos**: las salas usan canales públicos de Realtime (alcanza con la
publishable key). Necesitan que en Supabase → Realtime → Settings siga activado
*Allow public access* (viene así). Si se apaga, las salas fallan con "No se pudo
conectar a la sala". Alguien con la key podría entrar a una sala adivinando el
código (32⁵ ≈ 33 millones) y molestar en esa carrera, pero no tocar el ranking:
cada puntaje se valida en `finish_run` con la sesión de su dueño. Si hace falta
cerrarlo: canales privados + políticas RLS en `realtime.messages`.

**Probar sin servidor**: `?red=local` usa `BroadcastChannel` entre pestañas del
mismo navegador (se recuerda en la pestaña). Ej.: abrir `/online?red=local`,
crear sala y en otra pestaña `/online?red=local&sala=CÓDIGO`.

**Cupos del plan gratis de Supabase Realtime** (todo el proyecto): 200
conexiones a la vez, **100 mensajes por segundo** (enviados + recibidos), 2
millones por mes, 20 mensajes de presencia por segundo. Una sala de 4 personas
usa ~64 mensajes por segundo durante una prueba (4 × 4 paquetes, cada uno lo
reciben 3); una de 2 personas, ~16. O sea: **una o dos salas llenas a la vez**.
Para más: plan Pro (500/s), bajar a 2 paquetes por segundo subiendo el atraso a
~0,9 s, o cambiar el transporte (`channel.ts`) por WebRTC o un servidor propio
(Cloudflare Durable Objects) sin tocar el resto.

**Limitaciones conocidas**: la simulación usa `Math.sin`/`cos`, que pueden diferir
en el último decimal entre navegadores distintos; en una carrera larga un remoto
podría verse un poco distinto de lo que hizo. No importa para el puntaje, que
llega aparte. Una pestaña en segundo plano no juega (el navegador la frena).

## Pruebas en equipo (El Colchón)

En carrera cada compu simula su propio mundo y a los demás como "fantasmas". En
equipo eso no alcanza: los 4 están en **el mismo mundo** (dos colchones de dos
portadores, saltadores, globos, rodillos). Se resuelve con **rollback**, sobre el
mismo envío de teclas de las carreras:

- Cada compu guarda el **mundo confirmado** (hasta el último tick del que tiene las
  teclas de todos) y el **presente**, que sigue desde el confirmado suponiendo que
  los demás siguen apretando lo último que apretaron. Se dibuja el presente: lo tuyo
  responde al instante.
- Cuando llegan teclas, el presente se rehace desde el confirmado (re-simular ~40
  ticks por frame es barato). Los eventos (sonidos, efectos) solo salen de ticks
  nuevos, así no se repiten.
- Si alguien deja de mandar, pasados 2 s se confirma igual con su última tecla.
- El puntaje final sale del mundo confirmado cuando están las teclas de todos hasta
  el final de la ronda: da igual en todas las compus. Por las dudas, vale el del
  árbitro (el primero de la lista).
- En equipo, un cambio de tecla se manda enseguida (con 100 ms de mínimo entre
  paquetes) en vez de esperar al lote de 250 ms: menos corrección del otro lado.

Para que el mundo compartido dé exactamente igual en Chrome, Safari y Firefox, la
simulación de El Colchón **no usa trigonometría** (solo sumas, productos y
`Math.sqrt`, que el estándar fija bit a bit) y los bots viven dentro de la simulación,
con su azar guardado en el mundo (se clonan con él).

Lo que llega corregido de la red se dibuja **persiguiendo** su posición real (70 ms
para los portadores remotos, 25 ms para los saltadores): una corrección se ve como un
deslizamiento corto, no como un teletransporte. No hay cámara lenta ni congelado:
todas las compus tienen que avanzar al mismo ritmo.

Episodio en equipo = las 3 rondas de El Colchón (`PLAYLISTS.coop`), cada una con su
vuelta de tuerca. El puntaje de la ronda es de los 4 y suma al equipo de cada uno en
`finish_run` (minijuego `mattress`, tope 1000, mínimo 30 s).

## Infraestructura

| Pieza | Dónde |
|---|---|
| Supabase | Proyecto `supermatch` (ref `qhbvhefrcijtnaurnoxn`), región `sa-east-1`, plan gratuito |
| Migraciones | `supabase/migrations/`, ya aplicadas al proyecto |
| Credenciales del cliente | URL + publishable key en `src/lib/supabase/client.ts` (públicas por diseño; se pueden pisar con `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) |
| Login anónimo | Se activa en el panel: Authentication → Sign In / Providers → Anonymous sign-ins |

La secret key (ex *service_role*) no se usa en ningún lado: todo lo que escribe el
cliente pasa por RLS o por las RPC `start_run` / `finish_run`.

Supabase limita los logins anónimos a 30 por hora por IP (ajustable en
Authentication → Rate Limits). Antes de un lanzamiento grande conviene sumar CAPTCHA
(Turnstile) para que no se llene la base de usuarios falsos.

## Minijuegos: simulación pura + render

Cada minijuego separa **qué pasa** de **cómo se ve**:

- `sim.ts` es TypeScript puro y determinista: `step(world, input, dt)` muta el mundo y
  devuelve eventos (`jump`, `land`, `bonk`, `splash`…). No importa KAPLAY.
- `render.ts` dibuja el estado y reacciona a los eventos con efectos (partículas,
  sacudón de cámara, carteles). Nunca modifica el mundo.
- `index.ts` (la escena) lee el teclado, avanza la simulación a paso fijo de 120 Hz y
  emite los eventos del contrato.

Así el feel se puede testear sin navegador, el resultado no depende de los FPS del
jugador y, más adelante, una partida se podría re-simular en el servidor a partir del
input grabado.

El congelado de impacto y la cámara lenta (`timefx.ts`) cambian cuánta simulación se
avanza por frame, nunca la simulación: el resultado es el mismo. Los resortes visuales
(`spring` en `physics.ts`) se subdividen en pasos de 1/60 s, así un frame lento no
los hace explotar.

Cada minijuego tiene además su `bot.ts` (los rivales, que corren la misma simulación)
y su `tuning.ts` con `SERVER_LIMITS`, el espejo de su fila en `public.minigames`.

**Agregar un minijuego:** carpeta en `scenes/` con esos archivos, su id en
`MinigameId` (`contract.ts`), registrarlo en `createGame.ts`, nombre/regla/controles
en `lib/minigames.ts`, una frase en `lib/host.ts` y una migración que lo inserte en
`public.minigames`.

### Cómo ajustar el feel

1. Cambiá números en `tuning.ts` (o el layout en `level.ts`).
2. Corré `npm test`. Los tests de `sim.test.ts` codifican la intención del diseño:
   - patina (conserva más del 90 % de la velocidad 1 s después de soltar);
   - frena mal (más de 0,8 s para frenar desde la velocidad máxima);
   - cae de pie sin rebotar, pero el ragdoll rebota como goma;
   - un rodillo a toda velocidad te salva si seguís apretando y te tira al agua si soltás;
   - un bot planificador puede cruzar el puente (imprime tiempo, puntaje y golpes);
   - con input aleatorio no explota, no hay pinball infinito y se respetan
     `max_score` / `min_duration_ms` del servidor.
3. Si un test falla, decidí si cambió la intención (se actualiza el test) o si el cambio
   rompió el feel (se revierte el número).

`SERVER_LIMITS` en `tuning.ts` es espejo de `public.minigames`: si cambia, va una
migración nueva.

## Trampas conocidas (verificadas)

**Next 16 + `cacheComponents`**
- Al navegar, Next no desmonta la ruta: la oculta con `<Activity>`. React corre los
  cleanups de los efectos al ocultarla y los vuelve a correr al mostrarla. `GameHost`
  destruye KAPLAY en el cleanup y arranca un run nuevo cada vez que `/play` reaparece.
- Por lo mismo, un efecto que decida navegar según el estado del store puede correr con
  valores viejos al reaparecer. La navegación al terminar un run se dispara desde el
  evento del juego (`useEffectEvent`), no desde un efecto que observe el store.

**KAPLAY 3001**
- `global` es `true` por defecto: hay que pasar `global: false` o expone `add()`, `pos()`…
  en `window`.
- Si no se pasa `root`, modifica los estilos de `<body>` aunque reciba un `canvas`.
- `quit()` es diferido (corre al final del frame siguiente) y hace `loseContext()` sobre
  el WebGL. Por eso cada instancia usa un canvas nuevo, y la siguiente espera a que la
  anterior termine (`k.onCleanup`).
- `quit()` no cierra el `AudioContext`; lo cerramos nosotros en `onCleanup`.
- Es un singleton a nivel de módulo que no se limpia al salir: desde el segundo run
  aparece el warning `KAPLAY already initialized…`. Es inofensivo, porque solo vuelve a
  pedir el quit de una instancia ya detenida.
- El motor se carga con `import()` dentro del efecto. No entra al render del servidor y,
  como el arranque es asíncrono, el doble montaje de StrictMode se cancela antes de crear
  una segunda instancia.
- Rotaciones (`pushRotate`, `angle`) en grados. Los `draw*` aplican la cámara salvo con
  `fixed: true` (útil para overlays).
- Para dibujar por escena se usa un game object con `draw()`: se destruye solo al cambiar
  de escena.
- El contorno del texto se define al cargar la fuente (`loadFont(…, { outline })`);
  el `outline` de `drawText` se ignora.
- `drawSprite` rota alrededor del punto `anchor` (un `Vec2` de -1 a 1), así que cada
  pieza del rig se ancla en su articulación. Con solo `width`, conserva la proporción.
- Las texturas que se repiten (puente, agua) se dibujan alineadas al mundo, espejando
  una de cada dos copias y recortando con `quad` en los bordes.
- La cámara usa zoom (`setCamScale`); los overlays van con `fixed: true` y no se ven
  afectados.

**Anti-trampas**
- Cualquier puntaje que calcula el cliente se puede falsificar. Las RPCs ponen topes de
  plausibilidad (puntaje máximo, duración mínima, reloj del servidor), pero eso desalienta
  las trampas, no las impide.
