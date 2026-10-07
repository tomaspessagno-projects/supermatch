# Dirección de arte

## Estilo

Cartoon 2D de party game de TV: contornos gruesos violeta oscuro, colores planos y
saturados, una sola sombra suave, formas redondeadas y proporciones exageradas.

| Uso | Color |
|---|---|
| Contornos / tinta | `#1F1147` |
| Estudio (fondo) | `#1A1033` |
| Agua | `#22D3EE` |
| Goma de los rodillos | `#F472B6` |
| Acento / estrellas | `#FACC15` |
| Puente con jabón | `#E0F2FE` / `#7DD3FC` |
| Equipos | Rojo `#E63946` · Azul `#1D4ED8` · Amarillo `#FACC15` · Verde `#16A34A` |

## Reglas técnicas para generar assets

- **Personaje en piezas (títere de cartón):** cabeza, torso, brazo y pierna por separado.
  La animación es procedural: el código rota y mueve las piezas (correr, revolear,
  ragdoll). Nada de sprite sheets cuadro por cuadro.
- **Camiseta blanca:** el torso se tiñe en el juego con el color del equipo.
- **Fondo croma:** sprites sobre verde plano `#00FF00` (sin verde en los objetos);
  logo y escudos sobre magenta `#FF00FF`, porque el escudo verde se borraría. El
  recorte, el escalado y los pivotes se hacen por script.
- **Vista lateral mirando a la DERECHA** (el jugador avanza hacia la derecha).
- **Sin texto en los sprites:** los carteles ("¡BOING!", "META") se dibujan con una
  fuente cartoon cargada en el juego.
- **Prompts en inglés:** los generadores responden mejor.
- **Referencia:** la imagen 1 se usa como referencia en todas las demás para mantener
  el estilo.

## Prompts

Formato sugerido entre paréntesis. Nombre de archivo en negrita.

### 1. Personaje de referencia (16:9) — **ref-personaje.png**

```
Character design sheet for the playable contestant of a 2D side-scrolling party game.
Style: 2D cartoon game art for a goofy TV game-show party game. Thick dark-purple outlines (#1F1147), flat saturated colors with a single soft cel-shading tone, chunky rounded shapes, exaggerated comedic proportions, clean vector look. No text, no watermark.
The character: a clumsy but enthusiastic game-show contestant. Big round head (about one third of the total height), messy brown hair, white sweatband, huge expressive eyes, small chubby body, skinny arms with white cartoon gloves, skinny legs with striped knee-high socks and chunky sneakers. Wears a plain WHITE sports jersey and WHITE shorts (pure white, no logos; it will be recolored in-game).
Show side by side, at the same scale: full-body side profile facing RIGHT (most important), 3/4 view and front view. Below them, three small head close-ups: determined, screaming in panic with the mouth wide open, dizzy with spiral eyes.
Isolated on a perfectly flat pure green (#00FF00) background with no shadows and no gradient; nothing touching the image edges; do not use green anywhere on the character.
```

### 2. Piezas del personaje (16:9, con la 1 como referencia) — **personaje-piezas.png**

```
Using the attached character as the exact reference (same design, proportions, colors and line style), create a cut-out puppet parts sheet for 2D rigged animation. All pieces in side profile facing RIGHT, at the same scale, laid out in a grid with generous empty space between them, nothing overlapping or touching:
1. the head with a determined expression, no neck
2. the same head screaming in panic, mouth wide open
3. the same head dizzy, spiral eyes, tongue out
4. the torso with the WHITE jersey and WHITE shorts only: no head, no arms, no legs, with clean rounded joints where they attach
5. one arm hanging straight down, from a round shoulder joint to the white-gloved hand
6. one leg straight down, from a round hip joint to the sneaker pointing right, with the striped sock
Style: thick dark-purple outlines (#1F1147), flat saturated colors with a single soft cel-shading tone, clean vector look. No text, no watermark.
Isolated on a perfectly flat pure green (#00FF00) background with no shadows and no gradient; nothing touching the image edges; do not use green anywhere on the pieces.
```

### 3. Fondo del estudio (16:9) — **fondo-estudio.png**

```
Wide panoramic background for a 2D side-scrolling game: the inside of a huge, colorful TV game-show studio at night.
Style: 2D cartoon game background, flat colors, soft shapes, low detail, slightly hazy so it reads as a background. No text, no logos, no watermark.
Dark purple ambience (#1A1033); big spotlight beams in pink (#F472B6), cyan (#22D3EE) and yellow (#FACC15); a cheering audience drawn as simple silhouettes in the stands; giant screens showing abstract shapes; a little confetti in the air.
Keep the bottom third dark and empty (the game draws the bridge and the pool there). No characters or objects in the foreground. The left and right edges must match so the image can tile horizontally.
```

### 4. Tramo del puente (16:9) — **puente-tramo.png**

```
A long segment of a slippery obstacle-course bridge for a 2D platformer, seen exactly from the side (orthographic, no perspective), as a horizontal strip filling the full width of the image.
Style: 2D cartoon game art, thick dark-purple outlines (#1F1147), flat saturated colors with a single soft cel-shading tone, clean vector look. No text, no watermark.
A thick glossy white plastic panel (#E0F2FE) with a light-blue trim (#7DD3FC) and a thin metal edge; the top surface is covered in soap foam and bubbles, with some foam dripping off the front edge and shiny highlights. It must tile seamlessly from left to right.
Perfectly flat pure green (#00FF00) above and below the strip, no shadows; do not use green on the bridge.
```

### 5. Objetos del recorrido (16:9) — **props.png**

```
Props sheet for a 2D side-scrolling game-show obstacle course. Each object isolated with generous empty space between them, nothing overlapping:
1. a giant rubber roller seen straight-on from its end: a perfect circle of pink foam rubber (#F472B6) with bold yellow (#FACC15) spiral stripes and a dark magenta axle cap in the center
2. a tall inflatable start bumper column with red and white horizontal stripes
3. an inflatable finish arch with a black-and-white checkered banner on top (no text)
4. a simple vertical metal support pillar for the bridge
5. a short strip of soapy cyan water (#22D3EE) seen from the side, with foam and bubbles on top, for a puddle
Style: 2D cartoon game art for a goofy TV game-show party game. Thick dark-purple outlines (#1F1147), flat saturated colors with a single soft cel-shading tone, chunky rounded shapes, clean vector look. No text, no watermark.
Isolated on a perfectly flat pure green (#00FF00) background with no shadows and no gradient; nothing touching the image edges; do not use green anywhere on the objects.
```

### 6. Efectos (1:1) — **efectos.png**

```
Cartoon VFX sprite sheet for a comedic 2D game. Each effect isolated with generous empty space between them, nothing overlapping:
1. a big yellow comic impact starburst, empty inside (no text)
2. a big blue water splash burst
3. a white dust and foam puff cloud
4. three small yellow cartoon stars
5. a cluster of soap bubbles
6. a handful of confetti pieces in pink, yellow, cyan and white
Style: thick dark-purple outlines (#1F1147), flat saturated colors with a single soft cel-shading tone, chunky rounded shapes, clean vector look. No text, no watermark.
Isolated on a perfectly flat pure green (#00FF00) background with no shadows and no gradient; nothing touching the image edges; do not use green anywhere on the effects.
```

### 7. Logo (16:9) — **logo.png**

```
Game logo that reads exactly "SUPERMATCH" (one word, all caps). Big chunky bouncy cartoon letters, each letter slightly tilted as if it were slipping on soap, filled with yellow (#FACC15) fading to orange, glossy highlights, thick dark-purple outline (#1F1147), a few soap bubbles and a small water splash around it. No other text, no watermark.
Isolated on a perfectly flat pure magenta (#FF00FF) background, nothing touching the image edges.
```

### 8. Escudos de equipos (16:9) — **escudos-equipos.png**

```
Four round team emblems for a TV game show, the same design in four colors, laid out in a single row with space between them: red (#E63946), blue (#1D4ED8), yellow (#FACC15), green (#16A34A). Each one is a chunky glossy round badge with a white star and a lightning bolt, thick dark-purple outline (#1F1147). No text, no watermark.
Isolated on a perfectly flat pure magenta (#FF00FF) background, nothing touching the image edges.
```

Variante con mascotas: reemplazar "a white star and a lightning bolt" por
"a cartoon mascot: a bull (red), a shark (blue), a bee (yellow), a frog (green)".

## Pipeline (cuando llegan las imágenes)

1. Recorte del fondo croma y limpieza del borde verde/magenta.
2. Separación de piezas por regiones, recorte y escalado a la medida del juego.
3. Pivotes del rig (hombro, cadera, cuello) definidos por pieza.
4. Export a `public/game/` y carga con `loadSprite` en KAPLAY.
