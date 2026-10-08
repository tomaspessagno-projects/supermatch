# Arquitectura

La versión 2D anterior (KAPLAY, rollback, carreras online) está en el commit
**`a4b0b9c`** (tag local `minijuegos-2d`), con su arquitectura documentada en ese mismo
archivo.

## Decisiones

| Tema | Decisión |
|---|---|
| 3D | **three.js** 0.186 con **@react-three/fiber** 9 y **@react-three/drei** 10 |
| Estilo | Toon: `MeshToonMaterial` con un degradé de 3 tonos + contornos de tinta (`Outlines` de drei) |
| Física | **Simulación propia**: TypeScript puro, determinista, paso fijo de 120 Hz, cajas alineadas a los ejes. Sin motor de física |
| Progreso | Zustand con `persist` en `localStorage` (clave `supermatch:torre`). A Supabase en la fase 2 |
| Facción | **Bloqueada** una vez elegida (en el store y en la base) |
| Auth | Supabase Anonymous Sign-in |
| Ranking y misiones | `team_totals` y `today_missions` (por ahora no reciben puntos de La Torre) |

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
    │   ├── tuning.ts         Todos los números del movimiento
    │   ├── level.ts          buildTower(seed): bloques, camino, obstáculos, cornisas
    │   ├── items.ts          Objetos, rarezas, mutaciones
    │   ├── progression.ts    Mejoras del kiosco, precios y stats
    │   ├── sim.ts            createWorld / step / summarize / applyStats
    │   └── autopilot.ts      Piloto automático para los tests de alcance
    ├── store.ts              Fama, mejoras, récord, colección (persistido)
    ├── view/                 three.js (solo dibuja y suena)
    │   ├── TowerCanvas.tsx   <Canvas>, bucle, cámara, eventos → sonido/store
    │   ├── Player.tsx        Concursante procedural (grupos articulados)
    │   ├── Tower.tsx         Bloques instanciados, columna, obstáculos, regalos, carteles
    │   ├── Stage.tsx         Pileta, estudio, reflectores, luces
    │   ├── Effects.tsx       Partículas y carteles flotantes
    │   ├── toon.ts           Paleta, materiales toon cacheados
    │   ├── input.ts  bus.ts  frame.ts  sfx.ts
    └── ui/                   HUD, tarjeta del intento, kiosco, colección, joystick
```

## La simulación

- **Mundo:** cajas (`Box`) alineadas a los ejes. El jugador es un cilindro (radio 0,35,
  alto 1,6) para la columna y una caja para los bloques.
- **Colisiones** por eje y con la posición anterior: solo aterriza si en el paso anterior
  estaba por encima del bloque; solo golpea el techo si estaba por debajo; de costado solo
  si antes estaba afuera. Eso evita "teletransportes" cuando un salto roza una esquina.
- **Suelos:** normal, jabón (aceleración y frenado bajos), burbuja (rebote), descanso
  (recarga), nube (te lleva), orilla y ascensor.
- **Obstáculos:** barredoras y nubes son `Mover` con movimiento senoidal en función del
  tiempo (`moverBox(m, t)`); el viento es una caja que, mientras sopla, suma una deriva
  de velocidad hacia afuera (menor si estás parado).
- **Energía:** baja con el tiempo y con cada salto, salvo en lugares seguros (`safe`:
  la orilla y los descansos). Sin energía, al rato te resbalás para afuera.
- **Intento:** al tocar el agua, `summarize` calcula la fama y aparece `splash`; a los
  1,6 s, `respawn` en la orilla (o en el descanso más alto con el Ascensor).
- **Determinismo:** misma semilla y mismos inputs = mismo resultado (hay test).
- **Tests de alcance:** `level.test.ts` sube cada piso con el piloto automático sobre la
  simulación real y verifica qué nivel de Salto pide cada uno.

### Cómo ajustar el feel

Todo está en `sim/tuning.ts` (gravedad, velocidades, aceleraciones en el piso, en el aire
y en el jabón, salto, coyote time, energía, viento, barredoras) y en `FLOOR_DEFS` de
`level.ts` (subida, giro y tamaño de los escalones de cada piso). Después de tocar algo:
`npm test` dice si algún piso dejó de poder subirse o pasó a ser trivial.

## Render

- `TowerCanvas` crea el mundo en un efecto (la semilla de las fichas sale de
  `Math.random`, que no puede ir en el render) y lo guarda en un ref (`Frame`).
- El bucle corre en `useFrame` con prioridad -1 (antes que todo lo demás) y vive en una
  función de módulo (`advance`) para no chocar con las reglas del compilador de React
  (no se pueden mutar props ni valores de hooks dentro de un componente).
- Bloques: un `InstancedMesh` por tipo con `RoundedBoxGeometry` de 1×1×1 escalada por
  instancia, colores por instancia y contorno.
- Cámara: afuera de la torre, del lado del jugador, mirándolo contra la columna; se
  suaviza con `1 - exp(-dt·k)`. Arrastrar gira (`input.yaw/pitch`).
- Con `?debug` en la URL queda `window.__torre` (el `Frame`) para las pruebas e2e.

## Infraestructura

| Pieza | Dónde |
|---|---|
| Hosting | Netlify, despliega solo la rama de trabajo |
| Supabase | Proyecto `supermatch` (ref `qhbvhefrcijtnaurnoxn`), región `sa-east-1`, plan gratuito |
| Migraciones | `supabase/migrations/`, ya aplicadas (las de los minijuegos 2D siguen ahí: la base no se tocó) |
| Credenciales del cliente | URL + publishable key en `src/lib/supabase/client.ts` (públicas por diseño; se pueden pisar con `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) |

La secret key (ex *service_role*) no se usa en ningún lado: todo lo que escribe el
cliente pasa por RLS o por RPC.

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
