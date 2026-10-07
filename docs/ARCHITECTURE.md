# Arquitectura

## Principio rector

**React no sabe que existe Kaboom, y Kaboom no sabe que existe React.**
Se hablan por un único puente con un contrato de eventos tipado.

```
┌──────────── React / Next (UI) ────────────┐        ┌──── Kaboom (canvas) ────┐
│ app/  components/  store/  lib/supabase   │ ◄────► │ game/                   │
└───────────────────────┬───────────────────┘ bridge └────────────┬────────────┘
                        │                                         │
                        └──────── bridge/ (GameHost + events) ────┘
```

## Estructura de carpetas

```
supermatch/
├── src/
│   ├── app/                         # Rutas (App Router). Solo UI.
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # Landing + selector de facción
│   │   ├── play/page.tsx            # Monta <GameHost/> (client-only)
│   │   ├── results/page.tsx         # Resumen del run + envío del puntaje
│   │   └── leaderboard/page.tsx     # SSR inicial + isla client con Realtime
│   │
│   ├── components/
│   │   ├── ui/                      # Exportados de Figma. Sin lógica de juego.
│   │   ├── hud/                     # Overlays React sobre el canvas (score, timer, countdown)
│   │   └── leaderboard/
│   │
│   ├── game/                        # Mundo Kaboom. TS puro: cero React/Next/Supabase.
│   │   ├── engine/
│   │   │   ├── createGame.ts        # kaboom({ canvas, global: false }) → { k, destroy }
│   │   │   └── physics.ts           # Inercia, fricción, rebote exagerado, impulsos
│   │   ├── components/              # Componentes Kaboom custom: slippery(), bouncy(), wobble()
│   │   ├── scenes/
│   │   │   ├── boot.ts              # Carga de assets
│   │   │   ├── transition.ts        # Pantalla entre minijuegos
│   │   │   └── slippery-bridge/     # Minijuego 1
│   │   │       ├── index.ts
│   │   │       ├── player.ts
│   │   │       ├── hazards.ts       # Charcos y rodillos
│   │   │       └── tuning.ts        # Todas las constantes de "feel" en un solo lugar
│   │   ├── assets.ts                # Manifest de sprites/sonidos (apunta a /public/game)
│   │   └── types.ts
│   │
│   ├── bridge/                      # Único punto de contacto React ⇄ Kaboom
│   │   ├── GameHost.tsx             # 'use client'. <canvas ref>, monta/desmonta en useEffect
│   │   ├── events.ts                # Contrato tipado: game→ui y ui→game
│   │   └── useGameEvents.ts
│   │
│   ├── store/
│   │   └── session.ts               # Zustand: facción, fase del run, puntajes por slot
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts            # Browser client (anon key): auth anónima, RPCs, Realtime
│   │   │   └── server.ts            # Server client para el SSR del leaderboard
│   │   └── teams.ts                 # Metadatos de facciones para la UI
│   │
│   └── types/
│       └── database.ts              # Generado: `supabase gen types typescript`
│
├── public/game/                     # Sprites y SFX, servidos estáticos
├── supabase/
│   ├── migrations/                  # Esquema versionado (fuente de verdad)
│   └── seed.sql                     # Datos falsos para desarrollo
└── docs/
```

## Reglas de dependencia

| Carpeta       | Puede importar                         | No puede importar                    |
|---------------|----------------------------------------|--------------------------------------|
| `game/`       | `kaboom`, otros archivos de `game/`    | `react`, `next/*`, `lib/`, `store/`  |
| `bridge/`     | `game/`, `store/`, `react`             | `components/`, `app/`                |
| `components/` | `store/`, `lib/`, `bridge/events` (tipos) | `kaboom`, `game/`                 |
| `app/`        | todo lo de UI + `bridge/GameHost`      | `kaboom`, `game/`                    |

Se van a forzar con `no-restricted-imports` de ESLint cuando montemos el scaffold.

## Flujo de un run

1. Landing: el jugador elige facción → `signInAnonymously()` + insert en `players`.
2. `/play`: `start_run()` devuelve `run_id` (el servidor fija la hora de inicio).
3. `GameHost` monta Kaboom y encadena los 3 minijuegos. Cada uno emite
   `minigame:finished { slot, minigameId, score, durationMs }` y el store lo guarda.
4. Al terminar el tercero, React navega a `/results` y llama a
   `finish_run(run_id, results)`, que valida y suma a `team_totals` en una sola transacción.
5. `/leaderboard` escucha UPDATEs de `team_totals` por Realtime.

## Trampas conocidas

- **SSR:** Kaboom toca `window` al importarse → `GameHost` se carga con
  `next/dynamic(..., { ssr: false })`.
- **StrictMode:** en dev React monta, desmonta y vuelve a montar. Si el cleanup del
  `useEffect` no destruye la instancia de Kaboom, quedan dos game loops sobre el mismo canvas.
- **`global: false`:** sin esto Kaboom ensucia `window` con `add`, `pos`, etc. y choca
  entre montajes.
- **Anti-trampas:** cualquier puntaje que calcula el cliente se puede falsificar. Las RPCs
  ponen topes de plausibilidad (puntaje máximo, duración mínima, reloj del servidor), pero
  eso desalienta las trampas, no las impide.
