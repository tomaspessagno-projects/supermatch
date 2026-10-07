import type { Color, KAPLAYCtx } from "kaplay";

// Efectos puramente visuales (partículas, carteles y destellos). No afectan la
// simulación, así que pueden usar Math.random.

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  angle: number;
  spin: number;
  gravity: number;
  color?: Color;
  sprite?: string;
};

type Popup = {
  text: string;
  x: number;
  y: number;
  life: number;
  color: Color;
  size: number;
  backdrop?: string;
  backdropSize: number;
};

type Flash = {
  sprite: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  from: number;
  to: number;
  anchor: "center" | "bot";
};

export type BurstOptions = {
  x: number;
  y: number;
  count: number;
  speed: number;
  /** Colores para círculos, o nombres de sprite (se elige uno al azar por partícula). */
  colors?: readonly Color[];
  sprites?: readonly string[];
  /** Tamaño en px (diámetro aproximado). */
  size?: number;
  life?: number;
  /** Dirección central en grados (-90 = hacia arriba). */
  angle?: number;
  /** Apertura total en grados. */
  spread?: number;
  gravity?: number;
};

const POPUP_LIFE = 0.9;
const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

export function createFx(k: KAPLAYCtx, font: string) {
  const particles: Particle[] = [];
  const popups: Popup[] = [];
  const flashes: Flash[] = [];

  return {
    burst({
      x,
      y,
      count,
      speed,
      colors,
      sprites,
      size = 12,
      life = 0.6,
      angle = -90,
      spread = 180,
      gravity = 1400,
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
          angle: Math.random() * 360,
          spin: (Math.random() - 0.5) * 720,
          gravity,
          color: colors ? colors[i % colors.length] : undefined,
          sprite: sprites ? pick(sprites) : undefined,
        });
      }
    },

    /** Cartel de historieta ("¡BOING!") con un fondo opcional detrás. */
    popup(
      text: string,
      x: number,
      y: number,
      color: Color,
      { size = 52, backdrop, backdropSize = 170 }: { size?: number; backdrop?: string; backdropSize?: number } = {},
    ) {
      popups.push({ text, x, y, life: POPUP_LIFE, color, size, backdrop, backdropSize });
    },

    /** Sprite que aparece, crece y se desvanece (salpicón, nube de polvo). */
    flash(
      sprite: string,
      x: number,
      y: number,
      { life = 0.5, from = 0.4, to = 1, anchor = "center" }: { life?: number; from?: number; to?: number; anchor?: "center" | "bot" } = {},
    ) {
      flashes.push({ sprite, x, y, life, maxLife: life, from, to, anchor });
    },

    update(dt: number) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
      }
      for (let i = popups.length - 1; i >= 0; i--) {
        const p = popups[i];
        p.life -= dt;
        p.y -= 60 * dt;
        if (p.life <= 0) popups.splice(i, 1);
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        flashes[i].life -= dt;
        if (flashes[i].life <= 0) flashes.splice(i, 1);
      }
    },

    draw() {
      for (const f of flashes) {
        const t = 1 - f.life / f.maxLife;
        const grow = f.from + (f.to - f.from) * (1 - (1 - t) * (1 - t));
        k.drawSprite({
          sprite: f.sprite,
          pos: k.vec2(f.x, f.y),
          anchor: f.anchor,
          scale: grow,
          opacity: Math.min(1, (f.life / f.maxLife) * 2.5),
        });
      }
      for (const p of particles) {
        const opacity = Math.min(1, (p.life / p.maxLife) * 2);
        if (p.sprite) {
          k.drawSprite({
            sprite: p.sprite,
            pos: k.vec2(p.x, p.y),
            anchor: "center",
            angle: p.angle,
            width: p.size,
            height: p.size,
            opacity,
          });
        } else {
          k.drawCircle({ pos: k.vec2(p.x, p.y), radius: p.size / 2, color: p.color, opacity });
        }
      }
      for (const p of popups) {
        const age = 1 - p.life / POPUP_LIFE;
        // Aparece inflándose y se desvanece al final.
        const scale = age < 0.15 ? 0.5 + (age / 0.15) * 0.7 : 1.2 - age * 0.2;
        const opacity = Math.min(1, p.life / 0.3);
        const pos = k.vec2(p.x, p.y);
        if (p.backdrop) {
          k.drawSprite({
            sprite: p.backdrop,
            pos,
            anchor: "center",
            width: p.backdropSize * scale,
            angle: -8,
            opacity,
          });
        }
        k.drawText({ text: p.text, pos, size: p.size, font, anchor: "center", scale, color: p.color, opacity, angle: -8 });
      }
    },
  };
}
