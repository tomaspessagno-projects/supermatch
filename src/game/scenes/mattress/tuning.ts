/**
 * Perillas de El Colchón. Unidades: px, segundos.
 * Los tests de sim.test.ts describen qué tiene que pasar con estos valores.
 */
export const TUNING = {
  /** Cada ronda dura esto; los saltadores dejan de salir un poco antes. */
  duration: 40,
  spawnStop: 35,
  endDelay: 1.5,
  /** Los saltadores esperan esto arriba de la torre antes de tirarse (aviso). */
  readyTime: 0.8,

  // Portadores (los que llevan el colchón).
  walkSpeed: 330,
  accel: 2600,
  decel: 3200,
  /** Sobre el jabón (ronda 3): cuesta arrancar y más frenar. */
  soapAccel: 700,
  soapDecel: 260,
  jumpSpeed: 540,
  holderGravity: 1900,
  jumpBuffer: 0.1,
  /** Altura del colchón sobre los pies de quien lo lleva. */
  holdHeight: 62,
  /** El colchón empieza esto adelante de cada portador (manos). */
  handReach: 14,
  /** Distancia entre los dos portadores: ni más cerca ni más lejos. */
  minSpread: 120,
  maxSpread: 210,
  /** Golpeado (rodillo o globo en la cabeza): no se mueve y suelta su punta. */
  stunTime: 1,
  stunDrop: 38,
  /** Empapado por un globo: más lento un rato. */
  soakTime: 1.3,
  soakSpeed: 0.55,
  /** Si los dos saltan con menos de esto de diferencia, el colchón "bombea". */
  pumpWindow: 0.18,
  /** Un saltador que rebota hasta esto después del bombeo sale con súper rebote. */
  pumpTime: 0.4,

  // Saltadores.
  gravity: 900,
  jumperRadius: 18,
  /** Se perdona un poco de colchón de más a cada lado. */
  catchMargin: 10,
  bounceSpeed: 600,
  superSpeed: 760,
  /** Las puntas del colchón rebotan un poco menos. */
  edgeSoftness: 0.15,
  /** Dónde cae sobre el colchón cambia hacia dónde sale (px/s por unidad). */
  edgeAim: 70,
  /** Colchón inclinado: sale para el lado de la punta baja. */
  slopeAim: 260,
  minForwardSpeed: 90,
  /** Tiempo que el que cayó (o llegó) sigue en pantalla antes de irse. */
  goneAfter: 1.2,

  balloonRadius: 16,
  balloonGravity: 700,
  rollerRadius: 22,
} as const;

/** Puntaje de una ronda: todo el equipo comparte el mismo. Tope 1000. */
export const SCORING = {
  bounce: 5,
  super: 15,
  deliver: 35,
  golden: 40,
  /** Llegó directo desde el primer colchón (súper rebote que se saltea el segundo). */
  direct: 15,
  /** Racha de llegadas sin que se caiga nadie: +5 por cada una, hasta 3. */
  streakStep: 5,
  streakMax: 3,
  max: 1000,
} as const;
