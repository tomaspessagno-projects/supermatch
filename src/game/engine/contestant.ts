import type { KAPLAYCtx } from "kaplay";
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
  /** Inclinación del cuerpo en grados (positivo = hacia adelante). */
  lean: number;
  /** 1 = normal, < 1 aplastado, > 1 estirado. */
  squash: number;
  /** Grados por pierna [atrás, adelante]; 0 = recta, positivo = pie hacia adelante. */
  legs: readonly [number, number];
  /** Grados por brazo [atrás, adelante]; 0 = colgando, positivo = mano hacia adelante. */
  arms: readonly [number, number];
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

export function createContestant(k: KAPLAYCtx, teamColor: string) {
  const team = k.rgb(teamColor);
  const teamBack = k.rgb(team.r * 0.65, team.g * 0.65, team.b * 0.65);
  const back = k.rgb(170, 165, 200);
  const white = k.rgb(255, 255, 255);

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

  function arm(angle: number, behind: boolean) {
    const at = behind ? { x: SHOULDER.x + 3, y: SHOULDER.y - 1 } : SHOULDER;
    // Ángulo de pose (positivo = adelante) a rotación de KAPLAY (horario).
    part("char-arm-tint", at, JOINTS.arm.shoulder, -angle, behind ? teamBack : team);
    part("char-arm", at, JOINTS.arm.shoulder, -angle, behind ? back : white);
  }

  function leg(angle: number, behind: boolean) {
    part("char-leg", { x: behind ? -3 : 2, y: 0 }, JOINTS.leg.hip, -angle, behind ? back : white);
  }

  function draw(pose: ContestantPose) {
    opacity = pose.opacity ?? 1;
    const rad = (pose.lean * Math.PI) / 180;
    // Tirado en el piso, la cadera baja hasta casi tocar el suelo.
    const hipY = -Math.max(8, HIP_HEIGHT * Math.abs(Math.cos(rad)));

    k.pushTransform();
    k.pushTranslate(pose.x, pose.y);
    k.pushScale((2 - pose.squash) * VISUAL_SCALE, pose.squash * VISUAL_SCALE);
    k.pushTranslate(0, hipY / VISUAL_SCALE);
    k.pushRotate(pose.lean);

    arm(pose.arms[0], true);
    leg(pose.legs[0], true);
    leg(pose.legs[1], false);

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

    arm(pose.arms[1], false);
    k.popTransform();
  }

  return { draw };
}
