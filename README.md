# Supermatch

Juego web 2D de minijuegos físicos torpes y caóticos, inspirado en el programa de TV.
Single-player asíncrono: elegís facción (Rojo, Azul, Amarillo o Verde), jugás un
episodio de 3 pruebas contra los otros equipos y tu puntaje suma al leaderboard
global de tu color. Pruebas: El Puente Resbaladizo y El Tronco Loco (Baldes al
Tanque en camino).

**Stack:** Next.js 16 (App Router) + React 19 + TailwindCSS 4 · KAPLAY · Zustand · Supabase

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint     # incluye las fronteras React ⇄ KAPLAY
npm test         # física y reglas de los minijuegos (sin navegador)
npm run build
python3 scripts/process_art.py   # regenera los sprites desde art/source/
python3 scripts/make_sfx.py      # sonidos provisorios sintetizados
python3 scripts/process_audio.py # audios de Flow (art/source/audio/) → public/game/sfx/
```

## Docs

- [Diseño de juego y plan de ejecución](docs/GAME_DESIGN.md)
- [Arquitectura, decisiones y trampas conocidas](docs/ARCHITECTURE.md)
- [Dirección de arte y prompts de imágenes](docs/ART_DIRECTION.md)
- [Migraciones de base de datos](supabase/migrations/)
