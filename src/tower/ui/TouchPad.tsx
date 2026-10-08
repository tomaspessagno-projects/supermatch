"use client";

import { useRef, useState } from "react";
import { pressJump, setStick } from "../view/input";

/** Joystick a la izquierda y salto a la derecha: solo en pantallas con dedo. */
export function TouchPad() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const RADIUS = 48;

  const move = (clientX: number, clientY: number) => {
    const rect = base.current!.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) {
      dx = (dx / d) * RADIUS;
      dy = (dy / d) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    setStick(dx / RADIUS, -dy / RADIUS);
  };
  const release = () => {
    setKnob({ x: 0, y: 0 });
    setStick(0, 0);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden items-end justify-between p-5 pointer-coarse:flex">
      <div
        ref={base}
        className="pointer-events-auto relative size-32 touch-none rounded-full border-4 border-ink bg-white/15 backdrop-blur-sm"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => e.buttons && move(e.clientX, e.clientY)}
        onPointerUp={release}
        onPointerCancel={release}
        data-testid="stick"
      >
        <div
          className="absolute left-1/2 top-1/2 size-14 rounded-full border-4 border-ink bg-white/70"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
      </div>
      <button
        type="button"
        aria-label="Saltar"
        className="pointer-events-auto size-24 touch-none select-none rounded-full border-4 border-ink bg-sun/80 font-display text-3xl text-ink active:bg-sun"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          pressJump(true);
        }}
        onPointerUp={() => pressJump(false)}
        onPointerCancel={() => pressJump(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        ⤒
      </button>
    </div>
  );
}
