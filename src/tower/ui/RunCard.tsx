"use client";

import { useEffect } from "react";
import { itemDef, MUTATION, RARITY_LABEL } from "../sim/items";
import { getTeam } from "@/lib/teams";
import { useSession } from "@/store/session";
import { useTower } from "../store";
import { bus } from "../view/bus";

const RARITY_TEXT: Record<string, string> = {
  common: "text-sky-300",
  rare: "text-cyan-300",
  epic: "text-purple-300",
  legendary: "text-amber-300",
  mythic: "text-pink-300",
};

/** Lo que cobraste en el intento: aparece al caer a la pileta. */
export function RunCard() {
  const run = useTower((s) => s.lastRun);
  const teamPoints = useTower((s) => s.teamPoints);
  const team = useSession((s) => s.team);
  const dismiss = useTower((s) => s.dismissRun);
  const openPanel = useTower((s) => s.openPanel);

  // Se va sola a los 7 s, o apenas volvés a saltar (para no tapar el juego).
  useEffect(() => {
    if (!run) return;
    const timer = setTimeout(dismiss, 7000);
    const shown = performance.now();
    const off = bus.on((events) => {
      if (performance.now() - shown > 1200 && events.some((e) => e.type === "jump")) dismiss();
    });
    return () => {
      clearTimeout(timer);
      off();
    };
  }, [run, dismiss]);

  if (!run) return null;
  const rows: [string, number][] = [
    [`Subiste ${run.climbed.toFixed(1)} m`, run.heightFame],
    ...(run.record ? ([["¡Récord nuevo!", run.recordFame]] as [string, number][]) : []),
    ["Fichas", run.chips],
  ];
  const bonus: [string, number][] = run.bonusFame > 0 ? [["Bonus (temporada, mascota, evento)", run.bonusFame]] : [];

  return (
    // Centrada con flex: la animación de entrada usa `translate` y pisaría un -translate-x.
    <div className="pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center px-3">
    <div className="pointer-events-auto w-[min(92vw,380px)] animate-[card-in_0.45s_cubic-bezier(0.2,1.2,0.4,1)_both] rounded-3xl border-4 border-ink bg-ink/85 p-4 text-left backdrop-blur" data-testid="run-card">
      <p className="text-cartoon text-center text-3xl text-water">¡AL AGUA!</p>
      <p className="mb-2 text-center font-display text-lg text-white">{run.height.toFixed(1)} m de altura</p>
      <ul className="flex flex-col gap-1 text-sm">
        {rows.map(([label, value]) => (
          <li key={label} className="flex justify-between">
            <span className="text-foreground/85">{label}</span>
            <span className="font-display text-sun">+{value}</span>
          </li>
        ))}
        {run.items.map((item, i) => {
          const def = itemDef(item.def);
          const mutation = MUTATION[item.mutation].label;
          return (
            <li key={i} className="flex justify-between">
              <span className={RARITY_TEXT[def.rarity]}>
                {def.emoji} {def.name} {mutation && <strong className="text-amber-300">· {mutation}</strong>}
                <span className="ml-1 text-xs text-foreground/50">({RARITY_LABEL[def.rarity]})</span>
              </span>
              <span className="font-display text-sun">+{item.value}</span>
            </li>
          );
        })}
        {bonus.map(([label, value]) => (
          <li key={label} className="flex justify-between">
            <span className="text-rubber">{label}</span>
            <span className="font-display text-sun">+{value}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-baseline justify-between border-t-2 border-dashed border-white/20 pt-2">
        <span className="text-cartoon text-xl text-white">TOTAL</span>
        <span className="text-cartoon text-3xl text-sun" data-testid="run-total">+{run.total}</span>
      </p>
      {teamPoints !== null && teamPoints > 0 && team && (
        <p className="mt-1 text-center font-display text-sm" style={{ color: getTeam(team).color }} data-testid="team-points">
          +{teamPoints.toLocaleString("es-AR")} puntos para el {getTeam(team).name}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => { dismiss(); openPanel("shop"); }} className="btn-chunky flex-1 bg-sun py-2 font-display text-lg text-ink">
          🛒 KIOSCO
        </button>
        <button type="button" onClick={dismiss} className="btn-chunky flex-1 bg-white/10 py-2 font-display text-lg text-white">
          SEGUIR
        </button>
      </div>
    </div>
    </div>
  );
}
