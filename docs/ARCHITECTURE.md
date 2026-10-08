# Arquitectura

La versión 2D anterior (KAPLAY, rollback, carreras online) está en el commit
**`a4b0b9c`** (tag local `minijuegos-2d`), con su arquitectura documentada en ese mismo
archivo.

## Decisiones

| Tema | Decisión |
|---|---|
| 3D | **three.js** 0.186 con **@react-three/fiber** 9 y **@react-three/drei** 10 |
| Estilo | Toon: `MeshToonMaterial` con un degradé de 3 tonos + contornos de tinta (`Outlines` de drei) |
| Cámara | Fija de frente a la fachada (la versión en espiral mareaba) |
| Física | **Simulación propia**: TypeScript puro, determinista, paso fijo de 120 Hz, cajas alineadas a los ejes. Sin motor de física |
| Progreso | Zustand con `persist` en `localStorage` (clave `supermatch:torre`): fama, mejoras, mascotas, temporada, récord, colección. A Supabase en la fase 2 |
| Eventos en vivo | Por reloj (cada 5 min, 90 s): iguales para todos sin servidor |
| Facción | **Bloqueada** una vez elegida (en el store y en la base) |
| Auth | Supabase Anonymous Sign-in |
| Ranking y misiones | `team_totals` y `team_missions`: La Torre suma 10 puntos por metro vía la RPC `tower_cash` (con topes) |

## Principio rector

**La simulación no sabe que existe three.js, y el render no decide nada.**

```
 teclado / táctil ──► view/input.ts ──┐
                                      ▼
                      view/TowerCanvas.tsx (Loop, useFrame prioridad -1)
                        │  pasos fijos de 1/120 s
                        ▼
                      sim/sim.ts  step(world, input, dt) → SimEvent[]
                        │                         │
       ┌────────────────┘                         ▼
       ▼                                  view/bus.ts (eventos)
 Frame { world, prev, alpha, clock }        │        │         │
       │                                    ▼        ▼         ▼
       ▼                              Effects.tsx  sonidos  store.ts → ui/ (HUD, tarjeta)
 Player / Tower / Stage (leen el mundo e interpolan)
```

- `sim/` no importa nada de afuera de `sim/` (lo hace cumplir ESLint).
- El render lee `Frame` en cada cuadro e interpola la posición del jugador entre el paso
  anterior y el actual (`alpha`), así se ve fluido a 60, 90 o 144 Hz.
- La UI de React no se re-renderiza por cuadro: el bucle publica el HUD unas 10 veces por
  segundo (`setHud`) y los eventos importantes por el bus.

## Estructura de carpetas

```
src/
├── app/
│   ├── page.tsx              Portada: equipo + "¡A LA TORRE!" + misión del día
│   ├── torre/page.tsx        El juego
│   └── leaderboard/          Ranking por equipo en vivo
├── components/
│   ├── Host.tsx              El presentador con globo de diálogo
│   ├── TeamPicker.tsx        Los cuatro escudos
│   ├── home/PlayMenu.tsx     Tarjeta del equipo y botón a la torre (con récord y fama)
│   ├── leaderboard/  mission/
├── lib/                      teams, nicknames, supabase (cliente + api)
├── store/session.ts          Perfil: equipo y apodo
└── tower/
    ├── sim/                  TypeScript puro + tests
    │   ├── tuning.ts         Todos los números del movimiento y las mecánicas
    │   ├── level.ts          buildTower(seed): fachada, camino en zigzag, mecánicas por piso
    │   ├── items.ts          Objetos, rarezas, mutaciones
    │   ├── progression.ts    Mejoras, mascotas, temporadas y stats
    │   ├── events.ts         Eventos en vivo (elegidos por el reloj)
    │   ├── goals.ts          Misión del programa, misiones del día, premios de estrellas
    │   ├── cosmetics.ts      Sombreros y estelas
    │   ├── sim.ts            createWorld / step / summarize / applyStats
    │   └── autopilot.ts      Piloto automático para los tests de alcance
    ├── store.ts              Fama, mejoras, mascotas, temporada, récord, colección,
    │                         contadores, misiones, estrellas, cosméticos (persistido)
    ├── team.ts               Manda los metros de cada intento al equipo (RPC tower_cash)
    ├── view/                 three.js (solo dibuja y suena)
    │   ├── TowerCanvas.tsx   <Canvas>, bucle, cámara, evento en vivo, eventos → sonido/store
    │   ├── Player.tsx        El concursante: muñeco por código o modelo GLB, y su sombra
    │   ├── character/        Animación: state.ts (qué hace, mezcla, resortes), poses.ts,
    │   │                     rig.ts, Procedural.tsx (el muñeco), Model.tsx (GLB),
    │   │                     clips.ts (nombres de animaciones del GLB), Hat.tsx
    │   ├── Pet.tsx           La mascota que te sigue
    │   ├── Tower.tsx         Junta todo + fichas, regalos y el muelle
    │   ├── tower/            Facade (fachada, corona, carteles), Blocks (estáticos),
    │   │                     Dynamic (se desinflan, titilan, giran), Hazards (lo que te tira)
    │   ├── Stage.tsx         Pileta, estudio, reflectores, luces
    │   ├── Effects.tsx       Partículas y carteles flotantes
    │   ├── toon.ts           Paleta, materiales toon cacheados
    │   ├── input.ts  bus.ts  frame.ts  sfx.ts
    └── ui/                   HUD (misión activa, barra de la torre, equipo, evento en vivo),
                              festejos, panel de misiones, tarjeta del intento, kiosco
                              (mejoras, mascotas, vestuario, temporada), colección, joystick
```

## La simulación

- **Mundo:** cajas (`Box`) alineadas a los ejes: x a lo largo de la fachada, y para
  arriba, z hacia afuera (la pileta y la cámara). La fachada es un bloque más (no se
  atraviesa). El jugador es una caja de 0,7 × 1,6.
- **Nivel:** el camino sube en zigzag de un costado al otro; en cada vuelta cambia de
  carril (z ≈ 1,5 o ≈ 4,7) y de sentido. Los descansos ocupan todo su carril; si quedan
  en una punta, dan la vuelta (otro sentido y otro carril). Cada piso tiene su lista de
  especiales en ronda; los que lanzan (cama elástica, géiser, burbuja) y las redes solo
  van si después queda lugar en el piso, y después de un lanzamiento el hueco es más
  grande para no darse la cabeza.
- **Colisiones** por eje y con la posición anterior: solo aterriza si en el paso anterior
  estaba por encima del bloque; solo golpea el techo si estaba por debajo; de costado solo
  si antes estaba afuera. Eso evita "teletransportes" cuando un salto roza una esquina.
- **Suelos:** normal, jabón (aceleración y frenado bajos), cinta (te corre en x), cama
  elástica y burbuja (rebote; con el salto apretado al caer, ×1,22), bola (resbalosa y
  te empuja para afuera del centro), calesita (te gira alrededor del centro),
  desinflable (a los 0,55 s de pisarla deja de ser sólida por 2,6 s; el estado vive en
  `world.crumbles`), parpadeante (sólida un 68 % del ciclo), columna (con red y baranda
  atrás), descanso, cima, orilla y ascensor.
- **Lo que te tira:** barredoras, martillos (péndulo: la cabeza sube en las puntas) y
  guantes (salen rápido de la pared, esperan y vuelven) son `Mover`; `moverBox(m, t)` da
  dónde están y `moverVelocity` para dónde van. Los cañones tiran pelotas en línea recta
  (`cannonBall(c, t)`). Todo es función del tiempo: no hay estado.
- **Redes:** dentro de la zona de la red y apretando hacia la pared, se trepa (sin
  gravedad, gasta más energía); cerca de arriba, un saltito para adentro te deja sobre
  la columna. Saltando te soltás para atrás (y por 0,35 s no te agarrás).
- **Bordes:** cayendo (o en lo más alto) con las manos (`p.y + hangReach`) cerca del
  borde de un bloque que tenés al lado, te colgás (`player.hang`: bloque, cara, tiempo).
  Colgado no hay gravedad; de costado avanzás por la cara, empujando hacia el bloque (o
  saltando) empieza `player.pullUp` (0,55 s: primero sube, después entra) y para atrás
  te soltás (`grabCooldown` evita reengancharse). Antes de colgarse y de subirse se
  verifica que haya lugar para el cuerpo (`roomFor`). Eventos: `grab`, `pullUp`, `letGo`.
- **Géiseres y ventiladores:** zonas que, mientras están activas, te suben (velocidad
  mínima hacia arriba) o te arrastran (deriva de velocidad, menor si estás parado).
- **Eventos en vivo:** `world.modifier` (lo pone la vista según el reloj) cambia la
  gravedad, el valor de las fichas, la fama total o lo que se sortea al empezar el
  intento.
- **Energía:** baja con el tiempo y con cada salto (multiplicado por la mascota), salvo
  en lugares seguros (`safe`: la orilla y los descansos). Sin energía, al rato te
  resbalás hacia la pileta.
- **Intento:** al tocar el agua, `summarize` calcula la fama (con el bonus de temporada,
  mascota y evento) y aparece `splash`; a los 1,6 s, `respawn` en la orilla (o en el
  descanso más alto con el Ascensor).
- **Determinismo:** misma semilla, mismos inputs y mismo evento = mismo resultado.
- **Tests de alcance:** `level.test.ts` sube cada paso del camino con el piloto
  automático sobre la simulación real (sin lo que empuja) y verifica qué nivel de Salto
  pide cada piso con saltos limpios (agarrarse cuenta como no llegar), que colgándose se
  sube sin mejoras salvo en el piso 8, que no haya techos sobre el camino ni bloques
  encimados.

### Objetivos

- `goals.ts` es puro: la cadena `MAIN_QUEST`, `advanceQuest(index, contadores)`, las
  misiones del día (`dailyMissions(día)`: 3 elegidas con una semilla de la fecha de
  Argentina) y `STAR_REWARDS`.
- El store lleva **contadores** (algunos suman, otros guardan el máximo) y
  `progressWith` cobra todo lo que se cumpla y encola festejos. Lo alimentan las
  acciones del store (cobrar, comprar, descansos) y los eventos de la simulación
  (`onSimEvent`: aterrizar, fichas, regalos, estrellas, súper rebotes, redes, géiseres,
  golpes, la cima).
- Las partidas viejas (sin contadores) se migran al cargar: los contadores salen de lo
  que ya habías hecho y las misiones cumplidas se saltean sin premio.
- Las estrellas encontradas viven en el store y en `world.progress.stars` (la simulación
  no las vuelve a contar).

### Cómo ajustar el feel

Todo está en `sim/tuning.ts` (gravedad, velocidades, aceleraciones en el piso, en el aire,
en el jabón y en las bolas, salto, rebotes, redes, géiseres, golpes, energía) y en
`FLOOR_DEFS` de `level.ts` (alto, subidas comunes y altas, huecos, tamaños y la ronda de
especiales de cada piso). Después de tocar algo: `npm test` dice si algún piso dejó de
poder subirse o pasó a ser trivial.

## Render

- `TowerCanvas` crea el mundo en un efecto (la semilla de las fichas sale de
  `Math.random`, que no puede ir en el render) y lo guarda en un ref (`Frame`).
- El bucle corre en `useFrame` con prioridad -1 (antes que todo lo demás) y vive en una
  función de módulo (`advance`) para no chocar con las reglas del compilador de React
  (no se pueden mutar props ni valores de hooks dentro de un componente).
- Bloques fijos: un `InstancedMesh` por tipo con `RoundedBoxGeometry` de 1×1×1 escalada
  por instancia, colores por instancia y contorno. Los que cambian (desinflables,
  parpadeantes, calesitas) son mallas sueltas que leen el mundo en cada cuadro.
- Cámara: **siempre de frente** (sin giros, para no marear); sigue al jugador en x e y,
  mira un poco hacia donde va y se suaviza con `1 - exp(-dt·k)`. Arrastrar deja espiar
  de costado (`input.yaw/pitch`). El fondo del estudio sube con la cámara.
- La luz principal viene de adelante y arriba: la sombra de cada plataforma cae sobre la
  fachada, y eso ayuda mucho a leer la profundidad.
- Con `?debug` en la URL queda `window.__torre` (el `Frame`) para las pruebas e2e;
  `?zoom=0.4` acerca la cámara (para mirar animaciones o grabar).

### El concursante y sus animaciones

- `character/state.ts` (puro, con tests): `pickClip` elige una de 17 animaciones según la
  simulación (idle, run, skate, jump, fall, flip, glide, hang, shimmy, pullUp, climb,
  lifted, slip, hit, swim, cheer, teeter). `CharacterDriver` las **mezcla con pesos**
  (la nueva sube a 1 y las otras bajan, con un tiempo por animación: así nunca salta de
  una pose a otra, y los ciclos no pierden amplitud como pasaría suavizando la pose),
  lleva los resortes (aplastarse al caer según el impacto, estirarse al saltar, el
  péndulo al colgarse, las cintas de la vincha), el parpadeo, el mortal del doble salto
  y las vueltas del golpe (se suman aparte para no mezclar ángulos de 2π).
- `poses.ts`: una función por animación que da el ángulo de cada articulación
  (`rig.ts`: cadera, columna, cabeza, hombros, codos, muslos, rodillas, tobillos y la
  cara). Correr tiene cadencia según la velocidad, rodilla que se dobla al pasar,
  contra-giro de torso y cadera, rebote y se inclina al acelerar y en las curvas.
  Encima va el agachado con las piernas que se doblan de verdad (los pies quedan en el
  piso). Un test verifica que colgado las manos caen sobre el borde que usa la
  simulación.
- `Procedural.tsx` dibuja el muñeco con esas poses; `Model.tsx` carga un GLB con
  esqueleto (`useGLTF`, `SkeletonUtils.clone`), lo escala a la altura del jugador, pasa
  los materiales a toon, pinta el material `shirt` del color del equipo, saca el avance
  del hueso raíz (animaciones en el lugar), mide a qué altura quedan las manos en `hang`
  para colgarlo justo, pone el sombrero en el hueso de la cabeza y hace crossfade entre
  clips (correr se acelera con la velocidad; `pullup` lo maneja la simulación).
  `clips.ts` reconoce nuestros nombres y los de Mixamo, y si falta uno usa el más
  parecido. Si el GLB falla, un error boundary vuelve al muñeco.

## Infraestructura

| Pieza | Dónde |
|---|---|
| Hosting | Netlify, despliega solo la rama de trabajo |
| Supabase | Proyecto `supermatch` (ref `qhbvhefrcijtnaurnoxn`), región `sa-east-1`, plan gratuito |
| Migraciones | `supabase/migrations/`, ya aplicadas (las de los minijuegos 2D siguen ahí: la base no se tocó) |
| Credenciales del cliente | URL + publishable key en `src/lib/supabase/client.ts` (públicas por diseño; se pueden pisar con `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) |

La secret key (ex *service_role*) no se usa en ningún lado: todo lo que escribe el
cliente pasa por RLS o por RPC.

**`tower_cash(p_climbed)`** (migración `20261012000000_tower_cash.sql`): guarda el cobro
en `tower_cashes` y suma `metros × 10` al equipo. Rechaza más de 98 m, cobros más
rápidos que subir esos metros a 4 m/s (+3 s), y corta en 5.000 puntos por jugador por
día. Bloquea la fila del jugador para que dos cobros simultáneos vayan de a uno. Se
probó contra un Postgres local con los mismos stubs de `auth` que las migraciones
anteriores.

## Trampas conocidas (verificadas)

**Next 16 + `cacheComponents`**
- Al navegar, Next no desmonta la ruta: la oculta con `<Activity>` y vuelve a correr los
  efectos al mostrarla. El teclado, el audio y el mundo se arman y desarman en efectos.

**React 19 (compilador y reglas de hooks)**
- No se puede leer un ref durante el render, ni mutar props o valores que devuelve un
  hook (`useThree().camera`, un objeto de `useMemo`). Lo que muta por cuadro va dentro de
  `useFrame` con la cámara del estado (`state.camera`) o en funciones de módulo.
- `Math.random()` no puede ir en el render: va en efectos o en manejadores.

**three.js / drei**
- Un resorte integrado con el `delta` del cuadro explota a pocos fps (con 0,1 s de paso,
  el aplastamiento del aterrizaje divergía y el personaje desaparecía). Los resortes del
  render se integran en pasos de 1/120 s.
- `Text` de drei (troika) baja fuentes de un CDN si un carácter no está en la fuente
  (por ejemplo un emoji). Los textos 3D usan solo letras que tiene Luckiest Guy.
- `Outlines` de drei es una cáscara opaca: si la malla se vuelve transparente, la
  cáscara se ve como una mancha oscura. Lo que se desvanece (las parpadeantes) usa otra
  malla sin contorno para el estado "fantasma".
- `THREE.Clock` está deprecado (aviso de consola que viene de fiber) y
  `PCFSoftShadowMap` cae a `PCFShadowMap`: son avisos inofensivos.

**Pruebas en el contenedor**
- El Chromium del contenedor no llega a Supabase: las e2e simulan las respuestas con
  `context.route`. Sin GPU el WebGL va por software (unos 6 fps).
- Playwright no emula `pointer: coarse`: para ver los controles táctiles se lanza
  Chromium con `--blink-settings=primaryPointerType=2,availablePointerTypes=2`.

**Anti-trampas**
- Cualquier puntaje que calcula el cliente se puede falsificar. Cuando la fama sume al
  equipo (fase 2) va con topes de plausibilidad en el servidor.
