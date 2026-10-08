"use client";

import { buildTower } from "../sim/level";
import { useTower } from "../store";
import { THEME_COLOR } from "./colors";

const TOWER = buildTower();

/**
 * La torre en una barra: los pisos con su color, dónde estás vos, tu récord,
 * las estrellas de cada piso y La Copa arriba de todo. Así siempre se ve
 * cuánto falta.
 */
export function TowerBar({ teamColor }: { teamColor: string }) {
  const height = useTower((s) => s.hud.height);
  const record = useTower((s) => s.record);
  const stars = useTower((s) => s.stars);
  const pct = (y: number) => `${Math.max(0, Math.min(100, (y / TOWER.top) * 100))}%`;

  return (
    <div className="pointer-events-none absolute right-2 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1 sm:right-3" data-testid="tower-bar">
      <span className="text-xl drop-shadow-[0_2px_0_var(--ink)]" aria-hidden>🏆</span>
      <div className="relative h-[42vh] w-3.5 rounded-full border-2 border-ink bg-ink/60 sm:w-4">
        <div className="absolute inset-0 flex flex-col-reverse overflow-hidden rounded-full">
          {TOWER.floors.map((f) => (
            <div key={f.index} style={{ height: pct(f.top - f.bottom), backgroundColor: THEME_COLOR[f.theme] }} className="border-t border-ink/40" />
          ))}
        </div>
        {/* Estrellas de cada piso: doradas las encontradas. */}
        {TOWER.floors.map((f) => (
          <div key={f.index} className="absolute right-full mr-1 flex -translate-y-1/2 gap-px" style={{ bottom: pct((f.bottom + f.top) / 2) }}>
            {TOWER.stars
              .filter((s) => s.floor === f.index)
              .map((s) => (
                <span key={s.id} className={`text-[8px] leading-none ${stars.includes(s.id) ? "text-sun" : "text-white/25"}`}>
                  ★
                </span>
              ))}
          </div>
        ))}
        {record > 0 && <div className="absolute -left-1 -right-1 h-0.5 bg-white" style={{ bottom: pct(record) }} title="Récord" />}
        <div
          className="absolute left-1/2 size-4 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-ink shadow transition-[bottom] duration-150"
          style={{ bottom: pct(height), backgroundColor: teamColor }}
          data-testid="tower-bar-you"
        />
      </div>
    </div>
  );
}
