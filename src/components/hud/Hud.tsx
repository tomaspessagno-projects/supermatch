"use client";

import Image from "next/image";
import { EPISODE_LENGTH, useSession } from "@/store/session";

export function Hud() {
  const team = useSession((s) => s.team);
  const slot = useSession((s) => s.results.length + 1);
  const liveScore = useSession((s) => s.liveScore);
  const banked = useSession((s) =>
    s.results.reduce((total, r) => total + r.score, 0),
  );
  const muted = useSession((s) => s.muted);
  const toggleMuted = useSession((s) => s.toggleMuted);

  return (
    // Tamaños según el ancho del cuadro de juego (en el celular es chico).
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 @max-3xl:p-1.5">
      <p className="text-cartoon text-2xl text-white @max-3xl:text-xs">
        PRUEBA{" "}
        <span data-testid="hud-slot" className="text-sun">
          {Math.min(slot, EPISODE_LENGTH)}/{EPISODE_LENGTH}
        </span>
      </p>
      <div className="flex items-center gap-2">
        {team && (
          <Image src={`/ui/badge-${team}.png`} alt="" width={186} height={186} className="size-10 @max-3xl:size-5" />
        )}
        <span data-testid="hud-score" className="text-cartoon text-4xl text-white tabular-nums @max-3xl:text-base">
          {banked + liveScore}
        </span>
        {/* Por encima de los carteles del episodio: se puede silenciar en cualquier momento. */}
        <button
          type="button"
          onClick={toggleMuted}
          // Sin robarle el foco al juego: si no, la barra espaciadora lo vuelve a tocar.
          onMouseDown={(e) => e.preventDefault()}
          aria-label={muted ? "Activar sonido" : "Silenciar"}
          aria-pressed={muted}
          data-testid="mute"
          className="pointer-events-auto relative z-20 ml-1 grid size-11 place-items-center rounded-full border-4 border-ink bg-white/20 text-lg backdrop-blur-sm @max-3xl:size-7 @max-3xl:border-2 @max-3xl:text-xs"
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </div>
    </div>
  );
}
