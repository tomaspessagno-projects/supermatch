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
│   │   ├── page.tsx                  # Landing + selector de facción
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
│   │   │   ├── physics.ts            # Helpers puros: approach, spring, colisiones
│   │   │   ├── contestant.ts         # Rig del concursante (títere de cartón)
│   │   │   └── fx.ts                 # Partículas, carteles y destellos
│   │   └── scenes/
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
│   ├── store/session.ts              # Zustand: facción, fase del episodio, resultados, rivales, silencio
│   └── lib/
│       ├── teams.ts                  # Facciones (espejo de public.teams)
│       ├── minigames.ts              # Nombre, regla y controles de cada prueba
│       ├── host.ts                   # Lo que dice el presentador
│       ├── nicknames.ts              # Apodo al azar ("Pato Resbaloso")
│       └── supabase/
│           ├── client.ts             # Cliente del navegador (URL + publishable key)
│           └── api.ts                # loadProfile, joinTeam, startRun, finishRun, ranking
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
   - `between`: tabla de equipos con tus puntos y los de los bots. Sigue sola a
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
