# Arquitectura

## Decisiones

| Tema | Decisión |
|---|---|
| Motor 2D | **KAPLAY** 3001 (fork mantenido de Kaboom.js, misma API) |
| Ragdoll | **Falso**: inercia, fricción y rebotes propios en `physics.ts`, y el ragdoll se simula con rotación y tambaleo. Sin motor de cuerpos rígidos |
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
│   │   └── leaderboard/              # (pendiente) SSR inicial + Realtime
│   │
│   ├── components/
│   │   ├── ui/                       # (pendiente) Exportados de Figma
│   │   ├── hud/Hud.tsx               # Overlay React sobre el canvas
│   │   └── TeamPicker.tsx
│   │
│   ├── game/                         # Mundo KAPLAY. TS puro.
│   │   ├── contract.ts               # GameEvent (juego→UI), GameCommand (UI→juego), GameHandle
│   │   ├── engine/
│   │   │   ├── createGame.ts         # Crea/destruye la instancia de KAPLAY
│   │   │   └── physics.ts            # (pendiente) Inercia, fricción, rebote, impulsos
│   │   ├── components/               # (pendiente) slippery(), bouncy(), wobble()
│   │   └── scenes/
│   │       ├── placeholder.ts        # Temporal: prueba el contrato sin jugabilidad
│   │       └── slippery-bridge/      # (pendiente) Minijuego 1
│   │
│   ├── bridge/                       # Único punto de contacto React ⇄ KAPLAY
│   │   ├── GameHost.tsx              # Monta el juego y traduce eventos ⇄ store
│   │   └── events.ts                 # Re-exporta los tipos del contrato para la UI
│   │
│   ├── store/session.ts              # Zustand: facción, resultados, puntaje en vivo, playlist
│   └── lib/
│       ├── teams.ts                  # Facciones (espejo de public.teams)
│       └── supabase/                 # (pendiente)
│
├── public/game/                      # (pendiente) Sprites y SFX
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

1. Landing: el jugador elige facción (queda bloqueada) y navega a `/play`.
2. `GameHost` importa el motor, resetea el run en el store y manda
   `minigame:start { slot: 1 }`.
3. Durante el minijuego el juego emite `minigame:score` (HUD en vivo). Al terminar emite
   `minigame:finished { result }`. El bridge lo guarda y manda el siguiente slot según
   `RUN_PLAYLIST`.
4. Tras el tercero, `GameHost` llama a `onRunFinished` y se navega a `/results`.
5. *(pendiente)* `/results` llama a `start_run` / `finish_run` en Supabase.
6. *(pendiente)* `/leaderboard` escucha UPDATEs de `team_totals` por Realtime.

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

**Anti-trampas**
- Cualquier puntaje que calcula el cliente se puede falsificar. Las RPCs ponen topes de
  plausibilidad (puntaje máximo, duración mínima, reloj del servidor), pero eso desalienta
  las trampas, no las impide.
