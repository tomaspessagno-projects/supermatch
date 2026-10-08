# Supermatch: La Torre

Juego web 3D progresivo, inspirado en el programa de TV. Una torre inflable gigante y
enjabonada en medio de una pileta, vista de frente: subís su fachada en zigzag todo lo
que podés, te caés al agua, cobrás la fama de lo que subiste y juntaste, mejorás al
concursante en el kiosco y volvés a subir más alto. Ocho pisos con sus cosas (jabón y
cintas, camas elásticas, bolas rojas, martillos y guantes, redes y cañones, géiseres,
nubes y calesitas), objetos con rarezas y mutaciones, mascotas, temporadas, eventos en
vivo cada 5 minutos y La Copa arriba de todo. Siempre hay un objetivo a la vista: la
misión del programa (en cadena), tres misiones del día, 24 estrellas doradas escondidas
y cosméticos para ganar. Elegís facción (Rojo, Azul, Amarillo o Verde) para siempre, y
cada metro que subís suma para tu equipo.

Los minijuegos 2D anteriores (El Puente Resbaladizo, El Tronco Loco, El Colchón y las
carreras online) están archivados en el commit `a4b0b9c` (tag local `minijuegos-2d`).

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
