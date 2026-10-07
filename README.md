# Supermatch

Juego web 2D de minijuegos físicos torpes y caóticos, inspirado en el programa de TV.
Single-player asíncrono: elegís facción (Rojo, Azul, Amarillo o Verde), jugás 3
minijuegos seguidos y tu puntaje suma al leaderboard global de tu color.

**Stack:** Next.js 16 (App Router) + React 19 + TailwindCSS 4 · KAPLAY · Zustand · Supabase

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint     # incluye las fronteras React ⇄ KAPLAY
npm run build
```

## Docs

- [Arquitectura, decisiones y trampas conocidas](docs/ARCHITECTURE.md)
- [Esquema inicial de base de datos](supabase/migrations/20261007000000_init.sql)
