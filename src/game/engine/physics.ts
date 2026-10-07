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

/**
 * Resorte amortiguado (Euler semi-implícito). Devuelve [valor, velocidad].
 * Con damping < 2·√stiffness oscila antes de asentarse: ese es el tambaleo.
 */
export function spring(
  value: number,
  velocity: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): [number, number] {
  const accel = -stiffness * (value - target) - damping * velocity;
  const nextVelocity = velocity + accel * dt;
  return [value + nextVelocity * dt, nextVelocity];
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
