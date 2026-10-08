/**
 * Perillas de La Torre. Unidades: metros y segundos, con el eje y para arriba
 * (x a lo largo de la fachada, z hacia afuera: hacia la pileta y la cámara).
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
  drainPerSecond: 0.7,
  jumpCost: 1,
  /** Trepar cansa: gasta esto de más por segundo. */
  climbDrain: 0.8,
  /** Sin energía, las piernas aguantan esto y después se resbala (para afuera, a la pileta). */
  exhaustedFor: 1.2,
  slipSpeed: 3.5,

  /** Pileta: con los pies abajo de esto, chapuzón. */
  waterY: -0.6,
  /** Tiempo entre el chapuzón y volver a la orilla. */
  splashTime: 1.6,

  /** Burbujas: rebotan solas. */
  bounceSpeed: 14,
  /** Cama elástica: rebota más; si saltás justo al caer, todavía más. */
  trampolineSpeed: 15,
  superBounce: 1.22,
  /** Bola roja: redonda y algo resbalosa; te vas cayendo para el costado si no te acomodás. */
  ballRoll: 3,
  ballAccel: 22,
  ballDecel: 12,
  /** Plataforma que se desinfla: aguanta esto desde que la pisás y vuelve después. */
  crumbleDelay: 0.55,
  crumbleDown: 2.6,
  /** Redes: trepar, moverse de costado, subirse arriba y soltarse saltando. */
  climbSpeed: 3.2,
  climbSide: 2.2,
  mantleSpeed: 3.5,
  mantlePush: 2.5,
  netJumpOut: 4.5,
  netCooldown: 0.35,
  /** Géiser: mientras sale y estás adentro, te sube a esta velocidad. */
  geyserSpeed: 9.5,
  /** Ventilador: cuando sopla, te arrastra a esta velocidad. */
  windDrift: 4,
  /** Parado, el viento empuja menos: da tiempo a reaccionar. */
  windGroundFactor: 0.45,
  /** Golpes (barredora, martillo, cañón): te tira y no podés moverte un rato. */
  knockSpeed: 9,
  knockLift: 6,
  /** El guante de box te manda a la pileta. */
  pistonKnock: 10,
  stunTime: 0.6,
  /** Flotador: manteniendo el salto, caés despacio. */
  glideFallSpeed: 3,
  /** Evento "gravedad lunar". */
  lowGravity: 0.72,

  /** Radio para agarrar fichas y objetos (el imán lo agranda). */
  pickRadius: 0.9,
} as const;
