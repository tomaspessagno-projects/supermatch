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
│   │   │   └── PlayScreen.tsx        # GameHost + HUD
│   │   ├── results/
│   │   │   ├── page.tsx
│   │   │   └── ResultsSummary.tsx
│   │   └── leaderboard/page.tsx      # Ranking por equipo en vivo
│   │
│   ├── components/
│   │   ├── ui/                       # (pendiente) Exportados de Figma
│   │   ├── hud/Hud.tsx               # Overlay React sobre el canvas
│   │   └── TeamPicker.tsx            # Tarjetas con escudo por equipo
│   │
│   ├── game/                         # Mundo KAPLAY. TS puro.
│   │   ├── contract.ts               # GameEvent (juego→UI), GameCommand (UI→juego), GameHandle
│   │   ├── assets/
│   │   │   ├── manifest.ts           # Generado por scripts/process_art.py
│   │   │   └── index.ts              # loadAssets(): sprites + fuente
│   │   ├── engine/
│   │   │   ├── createGame.ts         # Crea/destruye la instancia de KAPLAY
│   │   │   ├── physics.ts            # Helpers puros: approach, spring, colisiones
│   │   │   ├── contestant.ts         # Rig del concursante (títere de cartón)
│   │   │   └── fx.ts                 # Partículas, carteles y destellos
│   │   └── scenes/
│   │       └── slippery-bridge/      # Minijuego 1: El Puente Resbaladizo
│   │           ├── tuning.ts         # Todas las perillas de feel
│   │           ├── level.ts          # Layout fijo (charcos, rodillos, meta)
│   │           ├── sim.ts            # Simulación pura: step(world, input, dt)
│   │           ├── sim.test.ts       # El feel y las reglas, como tests
│   │           ├── render.ts         # Dibuja el estado (cámara, ragdoll, efectos)
│   │           └── index.ts          # Escena KAPLAY: input + paso fijo + render
│   │
│   ├── bridge/                       # Único punto de contacto React ⇄ KAPLAY
│   │   ├── GameHost.tsx              # Monta el juego y traduce eventos ⇄ store
│   │   └── events.ts                 # Re-exporta los tipos del contrato para la UI
│   │
│   ├── store/session.ts              # Zustand: facción, resultados, puntaje en vivo, playlist
│   └── lib/
│       ├── teams.ts                  # Facciones (espejo de public.teams)
│       ├── minigames.ts              # Nombres de los minijuegos para la UI
│       ├── nicknames.ts              # Apodo al azar ("Pato Resbaloso")
│       └── supabase/
│           ├── client.ts             # Cliente del navegador (URL + publishable key)
│           └── api.ts                # loadProfile, joinTeam, startRun, finishRun, ranking
│
├── art/source/                       # Hojas originales generadas (fuente de verdad del arte)
├── scripts/process_art.py            # Hojas → sprites recortados + manifiesto
├── public/game/                      # Sprites y fuente del juego
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
   `minigame:start { slot: 1 }`. En paralelo, el store llama a `start_run()`
   (el servidor fija la hora de inicio).
3. Durante el minijuego el juego emite `minigame:score` (HUD en vivo, como mucho 10 por
   segundo). Al terminar (y después de `endDelay` para ver el desenlace) emite
   `minigame:finished { result }`. El bridge lo guarda y manda el siguiente slot según
   `RUN_PLAYLIST`.
4. Tras el tercero, `GameHost` llama a `onRunFinished` y se navega a `/results`.
5. `/results` llama una sola vez a `finish_run(run_id, results)`: la base valida y suma
   al equipo en la misma transacción. Volver a mostrar la pantalla no reenvía.
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
