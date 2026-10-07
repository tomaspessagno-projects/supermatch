import type { Color, KAPLAYCtx } from "kaplay";
import { SPRITE_RES, SPRITES } from "../assets";

/**
 * El concursante, armado como títere de cartón: cada pieza es un sprite que
 * rota alrededor de su articulación. La pose la calcula cada minijuego.
 */

/** Articulaciones medidas sobre cada pieza, en fracción del sprite (0..1). */
const JOINTS = {
  head: { neck: [0.45, 0.92] },
  headScream: { neck: [0.42, 0.92] },
  torso: { hip: [0.5, 0.86], neck: [0.62, 0.08], shoulder: [0.32, 0.27] },
  arm: { shoulder: [0.5, 0.08] },
  leg: { hip: [0.28, 0.06] },
} as const;

/**
 * Piernas y brazos se dibujan en dos tramos (muslo y pantorrilla, brazo y
 * antebrazo) cortando la misma pieza: así doblan rodillas y codos. `cut` es
 * la altura de la articulación (fracción de la pieza) y `x` su centro.
 */
const BEND = {
  leg: { cut: 0.46, x: 0.39 },
  arm: { cut: 0.46, x: 0.37 },
} as const;
/** Los dos tramos se pisan un poco para que no se vea la costura. */
const OVERLAP = 0.05;
const SKIN = "#f7c19d";
const LINE = "#3a2a40";

/** Escala visual sobre el tamaño nominal de las piezas. */
const VISUAL_SCALE = 1.1;

const size = (name: keyof typeof SPRITES) => ({
  w: SPRITES[name].w * SPRITE_RES,
  h: SPRITES[name].h * SPRITE_RES,
});
const TORSO = size("char-torso");
const LEG = size("char-leg");
const HEAD = size("char-head");

/** Altura de la cadera sobre la suela (largo de la pierna). */
export const HIP_HEIGHT = (1 - JOINTS.leg.hip[1]) * LEG.h * VISUAL_SCALE;

export type Expression = "normal" | "scream" | "dizzy";

export type ContestantPose = {
  /** Centro de los pies. */
  x: number;
  y: number;
  /** Inclinación del cuerpo en grados (positivo = horario, hacia la derecha). */
  lean: number;
  /** Hacia dónde mira: 1 derecha (por defecto), -1 izquierda. */
  facing?: 1 | -1;
  /** 1 = normal, < 1 aplastado, > 1 estirado. */
  squash: number;
  /** Grados por pierna [atrás, adelante]; 0 = recta, positivo = pie hacia adelante. */
  legs: readonly [number, number];
  /** Grados por brazo [atrás, adelante]; 0 = colgando, positivo = mano hacia adelante. */
  arms: readonly [number, number];
  /** Rodillas dobladas, en grados (positivo = el pie va para atrás). Si falta, se calcula de las piernas. */
  knees?: readonly [number, number];
  /** Codos doblados, en grados (positivo = la mano va para adelante). Si falta, se calcula de los brazos. */
  elbows?: readonly [number, number];
  headTilt: number;
  expression: Expression;
  /** Estrellitas girando sobre la cabeza. */
  dizzy: boolean;
  time: number;
  /** Los rivales se dibujan semitransparentes. */
  opacity?: number;
};

const anchorOf = (k: KAPLAYCtx, [fx, fy]: readonly [number, number]) =>
  k.vec2(fx * 2 - 1, fy * 2 - 1);

/** Punto de una articulación del torso relativo a la cadera, en px de juego. */
const torsoPoint = ([fx, fy]: readonly [number, number]) => ({
  x: (fx - JOINTS.torso.hip[0]) * TORSO.w,
  y: (fy - JOINTS.torso.hip[1]) * TORSO.h,
});
const NECK = torsoPoint(JOINTS.torso.neck);
const SHOULDER = torsoPoint(JOINTS.torso.shoulder);

/** Rodilla por defecto: casi recta adelante, bien doblada cuando la pierna va para atrás (patada). */
export const autoKnee = (leg: number) => Math.min(95, 8 + Math.max(0, -leg) * 1.2 + Math.max(0, leg) * 0.25);
/** Codo por defecto: un poco doblado siempre, más cuando el brazo va adelante. */
export const autoElbow = (arm: number) => Math.min(110, 18 + Math.max(0, Math.min(arm, 120)) * 0.35);

export function createContestant(k: KAPLAYCtx, teamColor: string) {
  const team = k.rgb(teamColor);
  const teamBack = k.rgb(team.r * 0.65, team.g * 0.65, team.b * 0.65);
  const back = k.rgb(170, 165, 200);
  const white = k.rgb(255, 255, 255);
  const skin = k.rgb(SKIN);
  const skinBack = k.rgb((skin.r * back.r) / 255, (skin.g * back.g) / 255, (skin.b * back.b) / 255);
  const line = k.rgb(LINE);

  let opacity = 1;
  const part = (sprite: string, pos: { x: number; y: number }, joint: readonly [number, number], angle: number, color = white) =>
    k.drawSprite({
      sprite,
      pos: k.vec2(pos.x, pos.y),
      anchor: anchorOf(k, joint),
      angle,
      scale: SPRITE_RES,
      color,
      opacity,
    });

  /**
   * Un miembro en dos tramos: el de arriba gira en `joint` (hombro o cadera),
   * el de abajo en la rodilla o el codo. `layers`: la pieza y, en los brazos,
   * la manga teñida del color del equipo.
   */
  function limb(
    kind: keyof typeof BEND,
    layers: readonly { sprite: keyof typeof SPRITES; color: Color }[],
    at: { x: number; y: number },
    joint: readonly [number, number],
    angle: number,
    bend: number,
    behind: boolean,
  ) {
    const { cut, x: midX } = BEND[kind];
    const { w, h } = size(layers[0].sprite);
    const lowerH = 1 - cut + OVERLAP;
    k.pushTransform();
    k.pushTranslate(at.x, at.y);
    k.pushRotate(angle);
    const kneeAt = k.vec2((midX - joint[0]) * w, (cut - joint[1]) * h);
    // Articulación redonda atrás: tapa el hueco del lado de afuera al doblar.
    const radius = kind === "leg" ? 3.4 : 2;
    k.drawCircle({ pos: kneeAt, radius, color: behind ? skinBack : skin, outline: { width: 1, color: line }, opacity });
    for (const layer of layers) {
      k.drawSprite({
        sprite: layer.sprite,
        pos: k.vec2(0, 0),
        anchor: k.vec2(joint[0] * 2 - 1, (joint[1] / cut) * 2 - 1),
        quad: k.quad(0, 0, 1, cut),
        scale: SPRITE_RES,
        color: layer.color,
        opacity,
      });
    }
    k.pushTranslate(kneeAt.x, kneeAt.y);
    k.pushRotate(bend);
    for (const layer of layers) {
      k.drawSprite({
        sprite: layer.sprite,
        pos: k.vec2(0, 0),
        anchor: k.vec2(midX * 2 - 1, (OVERLAP / lowerH) * 2 - 1),
        quad: k.quad(0, cut - OVERLAP, 1, lowerH),
        scale: SPRITE_RES,
        color: layer.color,
        opacity,
      });
    }
    k.popTransform();
  }

  function arm(angle: number, elbow: number, behind: boolean) {
    const at = behind ? { x: SHOULDER.x + 3, y: SHOULDER.y - 1 } : SHOULDER;
    // Ángulo de pose (positivo = adelante) a rotación de KAPLAY (horario).
    limb(
      "arm",
      [
        { sprite: "char-arm-tint", color: behind ? teamBack : team },
        { sprite: "char-arm", color: behind ? back : white },
      ],
      at,
      JOINTS.arm.shoulder,
      -angle,
      -elbow,
      behind,
    );
  }

  function leg(angle: number, knee: number, behind: boolean) {
    limb("leg", [{ sprite: "char-leg", color: behind ? back : white }], { x: behind ? -3 : 2, y: 0 }, JOINTS.leg.hip, -angle, knee, behind);
  }

  function draw(pose: ContestantPose) {
    opacity = pose.opacity ?? 1;
    const rad = (pose.lean * Math.PI) / 180;
    // Tirado en el piso, la cadera baja hasta casi tocar el suelo.
    const hipY = -Math.max(8, HIP_HEIGHT * Math.abs(Math.cos(rad)));

    k.pushTransform();
    k.pushTranslate(pose.x, pose.y);
    const facing = pose.facing ?? 1;
    k.pushScale(facing * (2 - pose.squash) * VISUAL_SCALE, pose.squash * VISUAL_SCALE);
    k.pushTranslate(0, hipY / VISUAL_SCALE);
    // Espejado, la rotación se invierte: así la inclinación queda igual en pantalla.
    k.pushRotate(facing * pose.lean);

    const knees = pose.knees ?? [autoKnee(pose.legs[0]), autoKnee(pose.legs[1])];
    const elbows = pose.elbows ?? [autoElbow(pose.arms[0]), autoElbow(pose.arms[1])];
    arm(pose.arms[0], elbows[0], true);
    leg(pose.legs[0], knees[0], true);
    leg(pose.legs[1], knees[1], false);

    part("char-torso-tint", { x: 0, y: 0 }, JOINTS.torso.hip, 0, team);
    part("char-torso", { x: 0, y: 0 }, JOINTS.torso.hip, 0);

    const head =
      pose.expression === "dizzy" ? "char-head-dizzy" : pose.expression === "scream" ? "char-head-scream" : "char-head";
    const neck = pose.expression === "scream" ? JOINTS.headScream.neck : JOINTS.head.neck;
    part(head, NECK, neck, pose.headTilt);

    if (pose.dizzy) {
      const top = { x: NECK.x, y: NECK.y - HEAD.h * 0.95 };
      for (let i = 0; i < 3; i++) {
        const a = pose.time * 5 + (i * 2 * Math.PI) / 3;
        k.drawSprite({
          sprite: "fx-star",
          pos: k.vec2(top.x + Math.cos(a) * 16, top.y + Math.sin(a) * 5),
          anchor: "center",
          width: 11,
          angle: pose.time * 200,
          opacity,
        });
      }
    }

    arm(pose.arms[1], elbows[1], false);
    k.popTransform();
  }

  return { draw };
}
