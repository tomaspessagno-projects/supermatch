/**
 * Perillas de El Tronco Loco. Unidades: px, segundos, radianes.
 * Los tests de sim.test.ts describen qué tiene que pasar con estos valores.
 */
export const TUNING = {
  /** Velocidad a la que corre respecto de la corteza. */
  runSpeed: 300,
  /** Qué tan rápido la corteza le impone su velocidad (suelas contra madera). */
  grip: 1500,
  /**
   * Empuje de la pendiente: lejos de la cima, la gravedad lo tira para abajo.
   * Pasado asin(grip / slopeGravity) ≈ 39° ya no hay agarre que alcance.
   */
  slopeGravity: 2400,
  /** Más inclinado que esto (desde la cima) se le van los pies. */
  fallAngle: 1.05,
  airAccel: 300,
  gravity: 2400,
  jumpSpeed: 900,
  jumpBuffer: 0.12,

  /** Qué tan rápido el tronco llega a su nueva velocidad de giro (rad/s²). */
  spinAccel: 2.2,
  /** El crujido avisa cada cambio de giro con esta anticipación. */
  spinWarning: 1,

  ballSpeed: 560,
  ballRadius: 18,
  /** El cañón tiembla y apunta antes de disparar. */
  shotWarning: 0.8,
  knockbackSpeed: 420,
  knockbackLift: 420,
  knockbackSpin: 800,
  hitCooldown: 0.4,
  floorRestitution: 0.35,
  minBounceSpeed: 300,
  getUpTime: 0.45,

  bubbleRadius: 24,
  bubbleLife: 4,

  /** Bajo el nivel del agua más esto, es chapuzón. */
  drownDepth: 40,
  respawnDelay: 1.5,
  respawnGrace: 0.8,
  lives: 3,
  timeLimit: 45,
  endDelay: 1.2,

  // Inclinación (solo visual, pero vive en la simulación como en el Puente).
  leanPerSpeed: 0.05,
  leanPerAccel: 0.012,
  maxLean: 28,
  leanStiffness: 130,
  leanDamping: 9,
  tumbleDrag: 1.2,
  lyingLean: 85,
} as const;

export const PLAYER_SIZE = { width: 36, height: 88 } as const;

/** 45 s arriba × 15 = 675; 13 burbujas × 25 = 325. */
export const SCORING = {
  pointsPerSecond: 15,
  pointsPerBubble: 25,
  max: 1000,
} as const;

/**
 * Espejo de public.minigames para 'rolling_log'. Si cambian acá, va una
 * migración nueva; los tests garantizan que la simulación los respeta.
 */
export const SERVER_LIMITS = { maxScore: 1000, minDurationMs: 1000 } as const;
