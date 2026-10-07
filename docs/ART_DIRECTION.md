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


## Animaciones con video (Google Flow / Veo)

Los modelos de video mantienen al personaje igual de un cuadro a otro, algo que los
de imagen no logran. De cada clip se extraen cuadros a 12 por segundo (animación "en
dos", estilo dibujo animado), se saca el verde, se fija el personaje por los pies y la
camiseta se separa para teñirla por equipo. El juego elige el clip según el estado de
la física (corre, patina, vuela, golpe, se levanta, cae al agua, festeja) y la
inclinación del ragdoll se sigue aplicando encima. El audio de los clips se usa como
efectos de sonido.

**En Flow:** modo *Frames to Video*, 16:9, 8 segundos, el modelo Veo de mejor calidad.
Como cuadro de inicio usá `art/flow/inicio-perfil.png` (o `inicio-frente.png` donde se
indica). En los clips que dicen **loop**, si Flow permite cuadro final, usá el mismo
cuadro de inicio: así el ciclo cierra perfecto. Si genera audio, dejalo.

**Entrega:** los `.mp4` van en `art/source/clips/` con el nombre de cada clip.

### Personaje (cuadro de inicio: `inicio-perfil.png`)

#### correr.mp4 (loop)

```
2D hand-drawn cartoon animation in exactly the same style as the start frame (thick dark-purple outlines, flat colors, simple cel shading; not 3D, not realistic). Keep the exact same character, proportions and plain white clothes. Side view, the character faces RIGHT the whole time. Static locked-off camera: no zoom, no pan, no camera movement. The character stays in the same spot, full body always inside the frame with margin. The background stays flat pure green (#00FF00) for the whole video: no floor, no shadows, no props, no text. Cartoon sound effects only, no music, no dialogue.
Action: The character runs IN PLACE on a slippery soapy floor: legs pedal super fast like an old cartoon, arms pump, body leans forward with a goofy determined face and small wobbles. A repeating run cycle that loops seamlessly.
```

#### patinar.mp4 (loop)

```
2D hand-drawn cartoon animation in exactly the same style as the start frame (thick dark-purple outlines, flat colors, simple cel shading; not 3D, not realistic). Keep the exact same character, proportions and plain white clothes. Side view, the character faces RIGHT the whole time. Static locked-off camera: no zoom, no pan, no camera movement. The character stays in the same spot, full body always inside the frame with margin. The background stays flat pure green (#00FF00) for the whole video: no floor, no shadows, no props, no text. Cartoon sound effects only, no music, no dialogue.
Action: The character stands on an extremely slippery floor and struggles to keep its balance: feet slide back and forth, arms windmill wildly, the body tips backward and forward, panicked face. Loops seamlessly.
```

#### salto.mp4 (una vez)

```
2D hand-drawn cartoon animation in exactly the same style as the start frame (thick dark-purple outlines, flat colors, simple cel shading; not 3D, not realistic). Keep the exact same character, proportions and plain white clothes. Side view, the character faces RIGHT the whole time. Static locked-off camera: no zoom, no pan, no camera movement. The character stays in the same spot, full body always inside the frame with margin. The background stays flat pure green (#00FF00) for the whole video: no floor, no shadows, no props, no text. Cartoon sound effects only, no music, no dialogue.
Action: The character crouches, jumps straight up high with arms raised, flails in the air with a surprised face, and lands back on the same spot with a wobbly knee bend.
```

#### golpe.mp4 (una vez)

```
2D hand-drawn cartoon animation in exactly the same style as the start frame (thick dark-purple outlines, flat colors, simple cel shading; not 3D, not realistic). Keep the exact same character, proportions and plain white clothes. Side view, the character faces RIGHT the whole time. Static locked-off camera: no zoom, no pan, no camera movement. The character stays in the same spot, full body always inside the frame with margin. The background stays flat pure green (#00FF00) for the whole video: no floor, no shadows, no props, no text. Cartoon sound effects only, no music, no dialogue.
Action: The character gets hit by something coming from the right and turns into a limp ragdoll: it tumbles and spins in place in mid-air with floppy arms and legs, dizzy spiral eyes and little stars around the head.
```

#### levantarse.mp4 (una vez)

```
2D hand-drawn cartoon animation in exactly the same style as the start frame (thick dark-purple outlines, flat colors, simple cel shading; not 3D, not realistic). Keep the exact same character, proportions and plain white clothes. Side view, the character faces RIGHT the whole time. Static locked-off camera: no zoom, no pan, no camera movement. The character stays in the same spot, full body always inside the frame with margin. The background stays flat pure green (#00FF00) for the whole video: no floor, no shadows, no props, no text. Cartoon sound effects only, no music, no dialogue.
Action: The character lies flat on its back at the bottom of the frame, dizzy with spiral eyes, then clumsily gets up, shakes its head and recovers its balance.
```

#### caer-agua.mp4 (una vez)

```
2D hand-drawn cartoon animation in exactly the same style as the start frame (thick dark-purple outlines, flat colors, simple cel shading; not 3D, not realistic). Keep the exact same character, proportions and plain white clothes. Side view, the character faces RIGHT the whole time. Static locked-off camera: no zoom, no pan, no camera movement. The character stays in the same spot, full body always inside the frame with margin. The background stays flat pure green (#00FF00) for the whole video: no floor, no shadows, no props, no text. Cartoon sound effects only, no music, no dialogue.
Action: The floor vanishes: the character hangs in the air for a moment like in old cartoons, looks down, panics and screams, then drops straight down out of the bottom of the frame.
```

#### festejo.mp4 (loop)

```
2D hand-drawn cartoon animation in exactly the same style as the start frame (thick dark-purple outlines, flat colors, simple cel shading; not 3D, not realistic). Keep the exact same character, proportions and plain white clothes. Side view, the character faces RIGHT the whole time. Static locked-off camera: no zoom, no pan, no camera movement. The character stays in the same spot, full body always inside the frame with margin. The background stays flat pure green (#00FF00) for the whole video: no floor, no shadows, no props, no text. Cartoon sound effects only, no music, no dialogue.
Action: The character celebrates winning: hops with joy, pumps its fists, big open-mouth smile, a silly happy dance. Loops seamlessly.
```

### Portada (cuadro de inicio: `inicio-frente.png`)

#### saludo.mp4 (loop)

```
2D hand-drawn cartoon animation in exactly the same style as the start frame (thick dark-purple outlines, flat colors, simple cel shading; not 3D). Keep the exact same character and plain white clothes. Front view facing the camera. Static locked-off camera, no zoom or pan. The character stays in the same spot, full body always inside the frame. Flat pure green (#00FF00) background for the whole video, no floor, no shadows, no text. No music, no dialogue.
Action: the character waves at the viewer with one gloved hand, bounces happily on its feet and blinks. Loops seamlessly.
```

### Efectos (sin cuadro de inicio: *Text to Video*)

#### salpicon.mp4

```
2D cartoon visual effect animation. Static locked-off camera. Flat pure green (#00FF00) background for the whole video, no text, no other objects. A cartoon water splash erupts upward from the bottom center of the frame and falls back down: cyan (#22D3EE) water with white foam and droplets, thick dark-purple outlines, flat colors, side view. It ends with the frame empty. A splash sound effect.
```

#### impacto.mp4

```
2D cartoon visual effect animation. Static locked-off camera. Flat pure green (#00FF00) background for the whole video, no text, no other objects. A yellow comic-book impact starburst pops out from the center with small yellow stars flying outward, then shrinks and disappears. Thick dark-purple outlines, flat colors. A rubbery cartoon 'boing' sound effect.
```

#### espuma.mp4

```
2D cartoon visual effect animation. Static locked-off camera. Flat pure green (#00FF00) background for the whole video, no text, no other objects. A puff of white soap foam and bubbles bursts out from the bottom center and quickly dissipates. Thick dark-purple outlines, flat colors. A soft cartoon 'poof' sound effect.
```

#### confeti.mp4

```
2D cartoon visual effect animation. Static locked-off camera. Flat pure green (#00FF00) background for the whole video, no text, no other objects. A burst of confetti (pink, yellow, cyan and white pieces, nothing green) shoots up from the bottom center and rains down until the frame is empty. Thick outlines, flat colors. A party horn and a short crowd cheer.
```

### Ambiente (cuadro de inicio: `art/source/fondo-estudio.jpg`)

#### estudio.mp4 (loop)

```
Animate this exact 2D cartoon TV studio background without changing its framing or style. Static locked-off camera: no zoom, no pan. The colored spotlights slowly sweep left and right, the crowd silhouettes cheer and wave their arms, confetti falls gently and the giant screens shimmer. The bottom third stays dark and empty. Seamless loop. Crowd cheering ambience sound, no music.
```


## Pruebas nuevas y show (ver docs/GAME_DESIGN.md)

Imágenes (no video). Mismas reglas: fondo verde plano, vista lateral, sin texto.

### Baldes al Tanque (16:9) — **props-baldes.png**

```
Props sheet for a 2D side-scrolling TV game-show obstacle course. Each object isolated with generous empty space between them, nothing overlapping:
1. a dented metal bucket seen from the side with a handle, EMPTY (no water inside)
2. a cheerful cartoon fountain spouting a column of cyan (#22D3EE) water, side view
3. a tall glass water tank seen from the front, EMPTY, with big measuring tick marks on the side and a thick white frame; draw the glass only as an outline with a few reflections
4. a giant soft foam hammer hanging from a rope, pink (#F472B6) with yellow (#FACC15) stripes
5. an inflatable step block with red and white stripes
6. a short soapy puddle seen from the side, cyan water with white foam
Style: 2D cartoon game art for a goofy TV game-show party game. Thick dark-purple outlines (#1F1147), flat saturated colors with a single soft cel-shading tone, chunky rounded shapes, clean vector look. No text, no watermark.
Isolated on a perfectly flat pure green (#00FF00) background with no shadows and no gradient; nothing touching the image edges; do not use green anywhere on the objects.
```

### El Tronco Loco (16:9) — **props-tronco.png**

```
Props sheet for a 2D side-scrolling TV game-show obstacle course. Each object isolated with generous empty space between them, nothing overlapping:
1. a giant wooden log seen straight-on from its end: a perfect circle with tree rings, a thick bark rim and a few knots
2. a sturdy wooden A-frame stand that holds the log, side view
3. a cartoon foam-ball cannon, pink (#F472B6), side view, barrel pointing LEFT
4. a big soft foam ball, yellow (#FACC15)
5. a golden floating bubble with a shine, bonus pickup
6. a giant inflatable rubber duck, decoration
Style: 2D cartoon game art for a goofy TV game-show party game. Thick dark-purple outlines (#1F1147), flat saturated colors with a single soft cel-shading tone, chunky rounded shapes, clean vector look. No text, no watermark.
Isolated on a perfectly flat pure green (#00FF00) background with no shadows and no gradient; nothing touching the image edges; do not use green anywhere on the objects.
```

### Puente v2 (16:9) — **props-puente-v2.png**

```
Props sheet for a 2D side-scrolling TV game-show obstacle course. Each object isolated with generous empty space between them, nothing overlapping:
1. an inflatable trampoline pad, side view, pink and yellow stripes
2. a conveyor belt segment seen exactly from the side: gray rubber belt with yellow arrow marks pointing LEFT, rollers visible; it must tile seamlessly left to right
3. a checkpoint flag on a short pole: white flag with a black-and-white checkered border, no text
4. a golden soap bubble pickup with a sparkle
5. a big swinging foam pendulum hammer on a long rope, pink and yellow
6. a giant inflatable shark, decoration
Style: 2D cartoon game art for a goofy TV game-show party game. Thick dark-purple outlines (#1F1147), flat saturated colors with a single soft cel-shading tone, chunky rounded shapes, clean vector look. No text, no watermark.
Isolated on a perfectly flat pure green (#00FF00) background with no shadows and no gradient; nothing touching the image edges; do not use green anywhere on the objects.
```

### Presentador/a (16:9) — **presentador.png**

```
Character design sheet of an original cheerful TV game-show host for a 2D party game. Big expressive face, flashy sequined purple jacket, huge hair, holding a microphone, very energetic pose. Show side by side at the same scale: front view, 3/4 view, and below two head close-ups of the same character: smiling with mouth closed, and talking with mouth wide open.
Style: 2D cartoon game art for a goofy TV game-show party game. Thick dark-purple outlines (#1F1147), flat saturated colors with a single soft cel-shading tone, chunky rounded shapes, clean vector look. No text, no watermark.
Isolated on a perfectly flat pure green (#00FF00) background with no shadows and no gradient; nothing touching the image edges; do not use green anywhere on the objects.
```

### Árbitro (16:9) — **arbitro.png**

```
Character design sheet of an original game-show referee for a 2D party game: black-and-white striped shirt, cap, whistle on a cord, chunky sneakers, comically serious face. Show side by side at the same scale: front view blowing the whistle, side view facing RIGHT holding up a red card, and side view waving a checkered flag.
Style: 2D cartoon game art for a goofy TV game-show party game. Thick dark-purple outlines (#1F1147), flat saturated colors with a single soft cel-shading tone, chunky rounded shapes, clean vector look. No text, no watermark.
Isolated on a perfectly flat pure green (#00FF00) background with no shadows and no gradient; nothing touching the image edges; do not use green anywhere on the objects.
```

### Música (video, solo se usa el audio) — **musica.mp4**

```
A simple looping animation of a spinning disco ball on a flat pure green (#00FF00) background, static camera. Audio: upbeat, goofy TV game-show music with brass, drums and claps, energetic, no vocals, loops seamlessly.
```

## Pipeline

Las hojas originales viven en `art/source/` con el nombre de cada prompt
(`personaje-piezas.jpg`, `props.jpg`…). Para regenerar los sprites:

```bash
python3 scripts/process_art.py   # requiere Pillow y numpy
```

El script:

1. Quita el fondo croma con alpha suave y des-mezcla el borde (sin halo verde).
2. Corta cada objeto según las cajas de `CONFIG`, lo recorta al contenido y lo escala.
   Las piezas del personaje comparten escala para conservar sus proporciones.
3. En el torso y la manga separa la tela blanca en una capa `-tint` que el juego
   multiplica por el color del equipo.
4. Escribe `public/game/sprites/` (juego), `public/ui/` (React) y el manifiesto
   `src/game/assets/manifest.ts` con el tamaño de cada sprite.

Si se regenera una hoja con otro layout, hay que ajustar sus cajas en `CONFIG`. Las
articulaciones del rig (cuello, hombro, cadera) están en `src/game/engine/contestant.ts`.

## Estado

| Asset | Estado |
|---|---|
| Personaje (piezas y referencia) | Integrado: rig en el juego y concursante en la portada |
| Objetos (rodillo, bumper, arco, pilar, agua) | Integrado |
| Efectos | Integrado (carteles, salpicón, polvo, estrellas, burbujas, confeti) |
| Escudos | Integrado en la UI (selector, HUD, resultados) |
| Fondo del estudio | Integrado: parallax espejado detrás del puente |
| Tramo del puente | Integrado: textura repetida y recortada en cada charco |
| Logo | Integrado en la portada |
| Fuente | Luckiest Guy (Apache 2.0) en `public/game/fonts/` y vía `next/font` |
