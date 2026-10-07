import type { Color, KAPLAYCtx } from "kaplay";

// Efectos puramente visuales (partículas y carteles). No afectan la simulación,
// así que pueden usar Math.random.

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: Color;
};

type Popup = {
  text: string;
  x: number;
  y: number;
  life: number;
  color: Color;
  size: number;
};

export type BurstOptions = {
  x: number;
  y: number;
  count: number;
  speed: number;
  colors: readonly Color[];
  size?: number;
  life?: number;
  /** Dirección central en grados (-90 = hacia arriba). */
  angle?: number;
  /** Apertura total en grados. */
  spread?: number;
};

const POPUP_LIFE = 0.9;

export function createFx(k: KAPLAYCtx) {
  const particles: Particle[] = [];
  const popups: Popup[] = [];
  const ink = k.rgb("#1f1147");

  return {
    burst({
      x,
      y,
      count,
      speed,
      colors,
      size = 6,
      life = 0.6,
      angle = -90,
      spread = 180,
    }: BurstOptions) {
      for (let i = 0; i < count; i++) {
        const a = ((angle + (Math.random() - 0.5) * spread) * Math.PI) / 180;
        const s = speed * (0.4 + Math.random() * 0.6);
        particles.push({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life,
          maxLife: life,
          size: size * (0.6 + Math.random() * 0.8),
          color: colors[i % colors.length],
        });
      }
    },

    popup(text: string, x: number, y: number, color: Color, size = 52) {
      popups.push({ text, x, y, life: POPUP_LIFE, color, size });
    },

    update(dt: number, gravity = 1400) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.vy += gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (let i = popups.length - 1; i >= 0; i--) {
        const p = popups[i];
        p.life -= dt;
        p.y -= 60 * dt;
        if (p.life <= 0) popups.splice(i, 1);
      }
    },

    draw() {
      for (const p of particles) {
        k.drawCircle({
          pos: k.vec2(p.x, p.y),
          radius: p.size,
          color: p.color,
          opacity: p.life / p.maxLife,
        });
      }
      for (const p of popups) {
        const age = 1 - p.life / POPUP_LIFE;
        // Aparece inflándose y se desvanece al final.
        const scale = age < 0.15 ? 0.5 + (age / 0.15) * 0.7 : 1.2 - age * 0.2;
        const opacity = Math.min(1, p.life / 0.3);
        for (const [dx, color] of [[4, ink], [0, p.color]] as const) {
          k.drawText({
            text: p.text,
            pos: k.vec2(p.x + dx, p.y + dx),
            size: p.size,
            anchor: "center",
            scale,
            color,
            opacity,
          });
        }
      }
    },
  };
}
