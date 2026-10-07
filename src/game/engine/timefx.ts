/**
 * Control del ritmo de la escena: congelado de impacto (hit-stop) y cámara
 * lenta. Cambia cuánto avanza la simulación por frame, no la simulación en
 * sí: el resultado es el mismo, solo se ve distinto.
 */
export function createTimeFx() {
  let freezeFor = 0;
  let slowFor = 0;
  let slowScale = 1;

  return {
    /** Congela todo un instante (un golpe se siente). */
    hitStop(seconds: number) {
      freezeFor = Math.max(freezeFor, seconds);
    },
    /** Cámara lenta: `scale` de velocidad durante `seconds` reales. */
    slowMo(scale: number, seconds: number) {
      if (slowFor > 0 && scale > slowScale) return; // la más lenta manda
      slowScale = scale;
      slowFor = Math.max(slowFor, seconds);
    },
    /** Cuánto tiempo de juego corresponde a `realDt` segundos reales. */
    scale(realDt: number): number {
      if (freezeFor > 0) {
        freezeFor = Math.max(0, freezeFor - realDt);
        return 0;
      }
      if (slowFor > 0) {
        slowFor = Math.max(0, slowFor - realDt);
        // Vuelve a velocidad normal de a poco en el último cuarto.
        const ease = Math.min(1, slowFor / 0.15);
        return slowScale + (1 - slowScale) * (1 - ease);
      }
      return 1;
    },
  };
}

export type TimeFx = ReturnType<typeof createTimeFx>;
