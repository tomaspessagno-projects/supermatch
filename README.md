# Supermatch: La Torre

Juego web 3D progresivo, inspirado en el programa de TV. Una torre inflable gigante y
enjabonada en medio de una pileta: subís todo lo que podés, te caés al agua, cobrás la
fama de lo que subiste y juntaste, mejorás al concursante en el kiosco y volvés a subir
más alto. Seis pisos con temas (jabón, viento, barredoras, burbujas, nubes), objetos con
rarezas y mutaciones, y La Copa arriba de todo. Elegís facción (Rojo, Azul, Amarillo o
Verde) para siempre.

Los minijuegos 2D anteriores (El Puente Resbaladizo, El Tronco Loco, El Colchón y las
carreras online) están archivados en el tag `minijuegos-2d`.

**Stack:** Next.js 16 (App Router) + React 19 + TailwindCSS 4 · three.js + React Three
Fiber + drei · Zustand · Supabase

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000  (el juego en /torre)
npm run lint     # incluye la frontera de la simulación pura
npm test         # simulación, alcance de cada piso, progresión y stores (sin navegador)
npm run build
```

`/torre?debug` deja el estado del juego en `window.__torre` (para pruebas).

## Docs

- [Diseño de juego y plan](docs/GAME_DESIGN.md)
- [Arquitectura, decisiones y trampas conocidas](docs/ARCHITECTURE.md)
- [Dirección de arte y pedido del personaje 3D](docs/ART_DIRECTION.md)
- [Migraciones de base de datos](supabase/migrations/)
