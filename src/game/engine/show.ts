import type { Color, KAPLAYCtx } from "kaplay";

/**
 * Lo que hace que una prueba parezca un programa de TV en vivo, compartido
 * por todas las escenas: luces que barren el estudio, la hinchada en primer
 * plano que reacciona a lo que pasa, el cartel "EN VIVO" y tu posición en la
 * carrera. Todo se dibuja en coordenadas de pantalla.
 */

const VIEW_W = 1280;
const VIEW_H = 720;
const INK = "#1f1147";

const BEAMS = [
  { x: 180, color: "#f472b6", base: 18, swing: 22, speed: 0.5, phase: 0 },
  { x: 520, color: "#22d3ee", base: -10, swing: 26, speed: 0.37, phase: 1.7 },
  { x: 800, color: "#facc15", base: 12, swing: 24, speed: 0.44, phase: 3.1 },
  { x: 1120, color: "#ffffff", base: -20, swing: 20, speed: 0.31, phase: 4.4 },
] as const;

const FAN_SPACING = 46;
const FANS = Math.ceil(VIEW_W / FAN_SPACING) + 3;
const CROWD_PARALLAX = 1.25; // más cerca que el puente: se mueve más rápido

/** Número pseudoaleatorio estable por índice (0..1): cada hincha siempre igual. */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function createShow(k: KAPLAYCtx, teamColors: readonly string[]) {
  const ink = k.rgb(INK);
  const red = k.rgb("#ef4444");
  const white = k.rgb("#ffffff");
  const beams = BEAMS.map((b) => ({ ...b, rgb: k.rgb(b.color) }));
  const teams = teamColors.map((c) => k.rgb(c));
  // Hinchas: un color de equipo cada uno, alturas y ritmos distintos.
  const fans = Array.from({ length: FANS }, (_, i) => ({
    color: teams[Math.floor(hash(i) * teams.length)] ?? white,
    head: 16 + hash(i + 50) * 6,
    body: 34 + hash(i + 100) * 26,
    width: 36 + hash(i + 150) * 14,
    phase: hash(i + 200) * Math.PI * 2,
    rate: 7 + hash(i + 250) * 5,
    flag: hash(i + 300) < 0.3,
  }));

  let excitement = 0.15;
  let time = 0;

  return {
    /** Algo pasó: la tribuna salta (0..1). */
    excite(amount: number) {
      excitement = Math.min(1, excitement + amount);
    },

    update(dt: number) {
      time += dt;
      // Se calma de a poco, pero nunca del todo: es un programa en vivo.
      excitement = Math.max(0.15, excitement - dt * 0.35);
    },

    /** Haces de luz que barren el estudio (detrás de la prueba). */
    drawLights() {
      for (const beam of beams) {
        const angle = ((beam.base + beam.swing * Math.sin(time * beam.speed + beam.phase)) * Math.PI) / 180;
        const dir = k.vec2(Math.sin(angle), Math.cos(angle));
        const side = k.vec2(dir.y, -dir.x);
        const src = k.vec2(beam.x, -40);
        const end = src.add(dir.scale(VIEW_H * 1.3));
        k.drawPolygon({
          pts: [src.add(side.scale(10)), src.sub(side.scale(10)), end.sub(side.scale(130)), end.add(side.scale(130))],
          color: beam.rgb,
          opacity: 0.07 + excitement * 0.12,
          fixed: true,
        });
      }
    },

    /** La hinchada en primer plano: siluetas con bufandas y banderas de los 4 equipos. */
    drawCrowd(cameraX = 0) {
      const scroll = ((cameraX * CROWD_PARALLAX) % FAN_SPACING + FAN_SPACING) % FAN_SPACING;
      const hop = 3 + excitement * 20;
      const armsUp = excitement > 0.35;
      // Cada hincha queda en su lugar del mundo: el patrón se corre con la cámara.
      const shift = Math.floor((cameraX * CROWD_PARALLAX) / FAN_SPACING);
      for (let i = 0; i < FANS; i++) {
        const look = fans[(((i + shift) % FANS) + FANS) % FANS];
        const x = i * FAN_SPACING - scroll - FAN_SPACING;
        const jump = Math.abs(Math.sin(time * look.rate + look.phase)) * hop;
        const top = VIEW_H - look.body - jump;
        const shoulders = top + 10;
        if (armsUp) {
          const wave = Math.sin(time * look.rate * 1.3 + look.phase) * 18;
          for (const side of [-1, 1]) {
            k.drawLine({
              p1: k.vec2(x + side * look.width * 0.32, shoulders),
              p2: k.vec2(x + side * (look.width * 0.45 + wave * 0.3), shoulders - 34 - wave * side * 0.4),
              width: 9,
              color: ink,
              fixed: true,
            });
          }
        }
        if (look.flag) {
          const pole = k.vec2(x + look.width * 0.4, shoulders - 50);
          k.drawLine({ p1: k.vec2(x + look.width * 0.35, shoulders + 6), p2: pole, width: 4, color: ink, fixed: true });
          const flap = Math.sin(time * 9 + look.phase) * 6;
          k.drawPolygon({
            pts: [pole, pole.add(k.vec2(30, 6 + flap)), pole.add(k.vec2(0, 20))],
            color: look.color,
            outline: { width: 3, color: ink },
            fixed: true,
          });
        }
        k.drawRect({ pos: k.vec2(x - look.width / 2, top), width: look.width, height: look.body + 40, radius: 14, color: ink, fixed: true });
        // Bufanda del equipo.
        k.drawRect({ pos: k.vec2(x - look.width / 2 + 3, top + 4), width: look.width - 6, height: 9, radius: 4, color: look.color, fixed: true });
        k.drawCircle({ pos: k.vec2(x, top - look.head + 4), radius: look.head, color: ink, fixed: true });
      }
    },

    /** "EN VIVO" con la luz roja que titila, arriba a la izquierda. */
    drawLiveBadge(font: string) {
      const pos = k.vec2(22, 62);
      k.drawRect({ pos, width: 112, height: 30, radius: 8, color: ink, opacity: 0.75, fixed: true });
      const on = Math.sin(time * 5) > -0.2;
      k.drawCircle({ pos: pos.add(k.vec2(18, 15)), radius: 7, color: red, opacity: on ? 1 : 0.35, fixed: true });
      k.drawText({ text: "EN VIVO", pos: pos.add(k.vec2(32, 6)), size: 20, font, color: white, fixed: true });
    },

    /** Tu puesto en la carrera ("1º"…"4º"), con el color del primero en dorado. */
    drawRank(rank: number, x: number, y: number, font: string, colors: { gold: Color; plain: Color }) {
      const pulse = 1 + Math.max(0, Math.sin(time * 6)) * 0.06 * (rank === 1 ? 1 : 0);
      k.drawText({
        text: `${rank}º`,
        pos: k.vec2(x, y),
        size: 40,
        font,
        anchor: "center",
        scale: pulse,
        color: rank === 1 ? colors.gold : colors.plain,
        fixed: true,
      });
    },
  };
}

export type Show = ReturnType<typeof createShow>;

/**
 * Sigue tu puesto entre el jugador y los rivales y avisa cuando cambia:
 * "¡PASASTE A …!" / "¡TE PASÓ …!". Con margen, para que un empate no titile,
 * y callado los primeros segundos (todos largan juntos).
 */
export function createRankTracker(rivalNames: readonly string[], { margin = 30, quietFor = 2.5 } = {}) {
  const ahead = rivalNames.map(() => false);
  return {
    /** `mine` y `rivals`: avance de cada uno (más es mejor); `time`: segundos de prueba. */
    update(mine: number, rivals: readonly number[], time: number) {
      const calls: { text: string; good: boolean }[] = [];
      rivals.forEach((r, i) => {
        if (!ahead[i] && r > mine + margin) {
          ahead[i] = true;
          if (time > quietFor) calls.push({ text: `¡TE PASÓ ${rivalNames[i]}!`, good: false });
        } else if (ahead[i] && r < mine - margin) {
          ahead[i] = false;
          if (time > quietFor) calls.push({ text: `¡PASASTE A ${rivalNames[i]}!`, good: true });
        }
      });
      const rank = 1 + rivals.filter((r) => r > mine).length;
      return { rank, calls };
    },
  };
}
