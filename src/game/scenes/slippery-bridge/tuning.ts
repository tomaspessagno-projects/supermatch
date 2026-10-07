/**
 * Todas las perillas de "feel" del Puente Resbaladizo.
 * Unidades: píxeles y segundos; ángulos en grados. El eje Y crece hacia abajo.
 */
export const TUNING = {
  // Hielo / jabón
  groundAccel: 650, // px/s² al apretar una dirección en el piso
  groundFriction: 40, // px/s² de frenado sin input: casi nada
  maxRunSpeed: 620, // el input no acelera más allá de esto (los golpes sí)
  skidFriction: 1200, // px/s² tirado en el piso o por encima de maxRunSpeed
  airAccel: 160, // control en el aire: muy poco

  // Salto y caída
  gravity: 2400,
  jumpSpeed: 900,
  jumpBuffer: 0.12, // s: un salto apretado justo antes de aterrizar no se pierde
  floorRestitution: 0.45, // rebote gomoso del cuerpo en ragdoll
  minBounceSpeed: 260, // por debajo de esto deja de rebotar

  // Rodillos de goma: fuerza desmedida
  knockbackBase: 600, // px/s hacia atrás, aunque vengas despacio
  knockbackCarry: 0.3, // + esta fracción de la velocidad con la que chocaste
  knockbackLift: 600, // px/s hacia arriba
  knockbackSpin: 900, // °/s de giro del cuerpo
  getUpTime: 0.35, // s tirado en el piso, frenando, antes de recuperar el control
  hitCooldown: 0.35,

  // Pared de largada (bumper de pinball)
  wallRestitution: 0.8,

  // Ragdoll falso: resorte que intenta enderezar el torso
  leanStiffness: 90,
  leanDamping: 9,
  leanPerSpeed: 0.012, // °/(px/s): se inclina hacia donde va
  leanPerAccel: 0.022, // °/(px/s²): el torso se atrasa al acelerar
  maxLean: 40,
  lyingLean: 85, // tirado en el piso
  landingWobble: 0.25, // °/s de sacudón por cada px/s de impacto
  tumbleDrag: 0.5, // freno del giro mientras da vueltas en el aire

  // Charcos
  fallCommitDepth: 10, // px bajo el piso: desde acá ya no hay salvación
  drownDepth: 140, // px bajo el piso: splash
  respawnDelay: 1.5, // s bajo el agua antes de volver a la última bandera
  respawnGrace: 0.5, // s sin que los rodillos lo golpeen al reaparecer

  // Partida
  timeLimit: 45, // s
  endDelay: 1.2, // s entre el final y avisar a la UI, para ver el desenlace
} as const;

export const PLAYER_SIZE = { width: 36, height: 88 } as const;

export const SCORING = {
  distancePoints: 600, // proporcional a lo más lejos que llegaste
  finishPoints: 150, // por cruzar la meta
  timeBonusPoints: 250, // proporcional al tiempo que sobró
} as const;

/**
 * Espejo de public.minigames para 'slippery_bridge'. Si cambian acá, va una
 * migración nueva; los tests garantizan que la simulación los respeta.
 */
export const SERVER_LIMITS = { maxScore: 1000, minDurationMs: 1000 } as const;
