// Helpers de física puros (sin KAPLAY), compartidos por todos los minijuegos.

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Acerca `value` a `target` como mucho `maxDelta`, sin pasarse. */
export function approach(value: number, target: number, maxDelta: number): number {
  return value < target
    ? Math.min(value + maxDelta, target)
    : Math.max(value - maxDelta, target);
}

/** Paso máximo del resorte: con pasos más largos, Euler semi-implícito explota. */
const MAX_SPRING_STEP = 1 / 60;

/**
 * Resorte amortiguado (Euler semi-implícito). Devuelve [valor, velocidad].
 * Con damping < 2·√stiffness oscila antes de asentarse: ese es el tambaleo.
 * Si `dt` es largo (un frame lento) lo subdivide, así nunca se dispara; con
 * el paso fijo de la simulación (1/120 s) da exactamente lo mismo.
 */
export function spring(
  value: number,
  velocity: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): [number, number] {
  const steps = Math.max(1, Math.ceil(dt / MAX_SPRING_STEP));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const accel = -stiffness * (value - target) - damping * velocity;
    velocity += accel * h;
    value += velocity * h;
  }
  return [value, velocity];
}

/** Lleva un ángulo en grados a (-180, 180]. */
export function wrapDegrees(degrees: number): number {
  const wrapped = ((degrees + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
}

/** ¿Se tocan un círculo y un rectángulo alineado a los ejes? */
export function circleIntersectsRect(
  cx: number,
  cy: number,
  radius: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): boolean {
  const dx = cx - clamp(cx, left, right);
  const dy = cy - clamp(cy, top, bottom);
  return dx * dx + dy * dy < radius * radius;
}
