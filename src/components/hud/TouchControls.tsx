"use client";

import type { VirtualButton } from "@/bridge/events";
import { pressButton } from "@/bridge/input";

/**
 * Botones táctiles: solo en pantallas con dedo (pointer: coarse). Van a los
 * costados del cuadro de juego (que se angosta para dejarles lugar), así el
 * pulgar no tapa al concursante.
 */
export function TouchControls() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] hidden items-end justify-between p-2 pointer-coarse:flex">
      <div className="flex gap-2">
        <Pad button="left" label="◀" />
        <Pad button="right" label="▶" />
      </div>
      <Pad button="jump" label="⤒" big />
    </div>
  );
}

function Pad({ button, label, big = false }: { button: VirtualButton; label: string; big?: boolean }) {
  const release = () => pressButton(button, false);
  return (
    <button
      type="button"
      aria-label={button}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pressButton(button, true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
      className={`pointer-events-auto touch-none select-none rounded-full border-4 border-ink bg-white/25 font-display text-white backdrop-blur-sm active:bg-sun/70 ${big ? "size-20 text-4xl" : "size-13 text-2xl"}`}
    >
      {label}
    </button>
  );
}

/** En celulares en vertical, pide girar la pantalla. */
export function RotateHint() {
  return (
    <div className="absolute inset-0 z-20 hidden flex-col items-center justify-center gap-3 bg-ink/90 p-6 text-center pointer-coarse:portrait:flex">
      <span className="text-6xl">📱↻</span>
      <p className="text-cartoon text-2xl text-sun">Girá el celular</p>
      <p className="text-foreground/80">Supermatch se juega en horizontal.</p>
    </div>
  );
}
