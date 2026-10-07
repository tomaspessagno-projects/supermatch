/**
 * La simulación avanza en pasos fijos (1/120 s) y la pantalla dibuja a su
 * ritmo (60, 90, 144 Hz…). Sin esto, en pantallas de 90 o 144 Hz el jugador
 * avanza a los saltitos. Se dibuja en el medio entre el paso anterior y el
 * último, según cuánto tiempo sobró del frame.
 */
export function createInterpolator() {
  let prevX = 0;
  let prevY = 0;
  let ready = false;

  return {
    /** Llamar justo antes de cada paso de la simulación. */
    before(body: { x: number; y: number }) {
      prevX = body.x;
      prevY = body.y;
      ready = true;
    },

    /** Dibuja con el cuerpo corrido a la posición intermedia y lo deja como estaba. */
    draw(body: { x: number; y: number }, alpha: number, draw: () => void) {
      const x = body.x;
      const y = body.y;
      // Un salto grande (reaparecer en la bandera) no se interpola.
      if (!ready || Math.abs(x - prevX) + Math.abs(y - prevY) > 120) return draw();
      const a = Math.min(1, Math.max(0, alpha));
      body.x = prevX + (x - prevX) * a;
      body.y = prevY + (y - prevY) * a;
      try {
        draw();
      } finally {
        body.x = x;
        body.y = y;
      }
    },
  };
}
