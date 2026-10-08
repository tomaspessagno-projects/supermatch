/**
 * Perillas de La Torre. Unidades: metros y segundos, con el eje y para arriba.
 * Los tests de sim.test.ts y level.test.ts dicen qué tiene que pasar.
 */
export const TUNING = {
  gravity: 26,
  maxFallSpeed: 32,
  moveSpeed: 6.2,
  groundAccel: 46,
  groundDecel: 40,
  airAccel: 18,
  airDecel: 3,
  /** Sobre el jabón cuesta arrancar y casi no se frena. */
  soapAccel: 7,
  soapDecel: 1.4,
  /** Velocidad de salto sin mejoras (≈1,6 m de alto). */
  jumpSpeed: 9.2,
  /** El doble salto (mejora) es un poco más corto. */
  doubleJumpFactor: 0.82,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,

  playerRadius: 0.35,
  playerHeight: 1.6,

  /** Energía: se gasta por segundo arriba de la torre y por cada salto. */
  drainPerSecond: 1,
  jumpCost: 1,
  /** Sin energía, las piernas aguantan esto y después se resbala. */
  exhaustedFor: 1.2,
  slipSpeed: 3.5,

  /** Pileta: con los pies abajo de esto, chapuzón. */
  waterY: -0.6,
  /** Tiempo entre el chapuzón y volver a la orilla. */
  splashTime: 1.6,

  /** Burbujas: rebotan solas. */
  bounceSpeed: 14,
  /** Viento: cuando sopla, te arrastra para afuera a esta velocidad. */
  windDrift: 4,
  /** Parado, el viento empuja menos: da tiempo a reaccionar caminando para adentro. */
  windGroundFactor: 0.45,
  /** Martillo: te tira y no podés moverte un rato. */
  knockSpeed: 9,
  knockLift: 6,
  stunTime: 0.6,
  /** Flotador: manteniendo el salto, caés despacio. */
  glideFallSpeed: 3,

  /** Radio para agarrar fichas y objetos (el imán lo agranda). */
  pickRadius: 0.9,
} as const;
