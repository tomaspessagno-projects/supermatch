"use client";

import { useTower } from "../store";
import { buildTower } from "../sim/level";

const FLOORS = buildTower().floors;

/** Marcador: fama, altura y récord, energía y mochila. */
export function Hud({ muted, onMute }: { muted: boolean; onMute: () => void }) {
  const fame = useTower((s) => s.fame);
  const record = useTower((s) => s.record);
  const hud = useTower((s) => s.hud);
  const openPanel = useTower((s) => s.openPanel);
  const energy = hud.energyMax ? hud.energy / hud.energyMax : 0;
  const floor = FLOORS[Math.min(hud.floor, FLOORS.length - 1)];

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="flex flex-col">
          <span className="font-display text-xs text-foreground/80 sm:text-sm">FAMA</span>
          <span className="text-cartoon text-3xl text-sun tabular-nums sm:text-4xl" data-testid="fame">
            ⭐ {fame.toLocaleString("es-AR")}
          </span>
          {hud.chips > 0 && <span className="font-display text-sm text-water">+{hud.chips} en este intento</span>}
        </div>
        <div className="flex flex-col items-center text-center">
          <span className="text-cartoon text-4xl text-white tabular-nums sm:text-5xl" data-testid="height">
            {hud.height.toFixed(1)} m
          </span>
          <span className="font-display text-xs text-foreground/80 sm:text-sm">
            RÉCORD {record.toFixed(1)} m · PISO {hud.floor + 1}: {floor.name.toUpperCase()}
          </span>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <HudButton label="Colección" onClick={() => openPanel("collection")} testId="open-collection">
            📖
          </HudButton>
          <HudButton label="Kiosco" onClick={() => openPanel("shop")} testId="open-shop" disabled={!hud.onDeck}>
            🛒
          </HudButton>
          <HudButton label={muted ? "Activar sonido" : "Silenciar"} onClick={onMute} testId="mute">
            {muted ? "🔇" : "🔊"}
          </HudButton>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex w-44 flex-col gap-1 sm:bottom-4 sm:left-4 sm:w-56 pointer-coarse:bottom-36">
        <span className="font-display text-xs text-foreground/80">ENERGÍA</span>
        <div className="h-5 overflow-hidden rounded-full border-4 border-ink bg-ink/60" data-testid="energy">
          <div
            className={`h-full transition-[width] duration-150 ${energy < 0.25 ? "animate-pulse bg-red-500" : "bg-sun"}`}
            style={{ width: `${Math.round(energy * 100)}%` }}
          />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex flex-col items-end sm:bottom-4 sm:right-4 pointer-coarse:bottom-36">
        <span className="font-display text-xs text-foreground/80">MOCHILA</span>
        <span className={`text-cartoon text-2xl tabular-nums ${hud.bag >= hud.bagMax ? "text-red-400" : "text-white"}`} data-testid="bag">
          🎒 {hud.bag}/{hud.bagMax}
        </span>
      </div>

      {hud.nearKiosk && (
        <button
          type="button"
          onClick={() => openPanel("shop")}
          className="btn-chunky pointer-events-auto absolute bottom-24 left-1/2 z-10 -translate-x-1/2 bg-sun px-5 py-2 font-display text-lg text-ink"
          data-testid="kiosk-prompt"
        >
          🛒 ABRIR KIOSCO <span className="pointer-coarse:hidden">(E)</span>
        </button>
      )}
    </>
  );
}

function HudButton({ children, label, onClick, testId, disabled = false }: { children: React.ReactNode; label: string; onClick: () => void; testId: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      disabled={disabled}
      data-testid={testId}
      className="grid size-11 place-items-center rounded-full border-4 border-ink bg-white/20 text-lg backdrop-blur-sm transition disabled:opacity-30"
    >
      {children}
    </button>
  );
}
