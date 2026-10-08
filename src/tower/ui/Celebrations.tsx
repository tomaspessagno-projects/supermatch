"use client";

import { useEffect } from "react";
import { MAIN_QUEST } from "../sim/goals";
import { useTower } from "../store";
import { play } from "../view/sfx";
import { RewardChips } from "./Objective";

const HEADLINE = { quest: "¡MISIÓN CUMPLIDA!", daily: "¡MISIÓN DEL DÍA!", stars: "¡PREMIO DE ESTRELLAS!" } as const;

/** El festejo de cada misión cumplida (de a uno, en fila). */
export function Celebrations() {
  const current = useTower((s) => s.celebrations[0] ?? null);
  const quest = useTower((s) => s.quest);
  const dismiss = useTower((s) => s.dismissCelebration);
  // Si está la tarjeta del intento, el festejo espera a que se cierre.
  const waiting = useTower((s) => s.lastRun !== null);

  useEffect(() => {
    if (!current || waiting) return;
    play("finish", { volume: 0.7 });
    if (current.kind === "quest") {
      const next = MAIN_QUEST[quest];
      useTower.getState().announce(next ? `¡Misión cumplida! La próxima: ${next.text}.` : "¡Hiciste todas las misiones del programa! ¡Sos una leyenda!");
    }
    const timer = setTimeout(dismiss, 3200);
    return () => clearTimeout(timer);
    // Solo cuando cambia el festejo (o se cierra la tarjeta del intento).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, waiting]);

  if (!current || waiting) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 z-20 flex justify-center px-3 pointer-coarse:bottom-44">
      <div
        key={current.id}
        className="pointer-events-auto flex w-[min(92vw,420px)] animate-[card-in_0.45s_cubic-bezier(0.2,1.2,0.4,1)_both] flex-col items-center gap-1 rounded-3xl border-4 border-sun bg-ink/90 p-3 text-center text-white shadow-[0_6px_0_var(--ink)]"
        onClick={dismiss}
        data-testid="celebration"
      >
        <span className="text-cartoon text-2xl text-sun">{HEADLINE[current.kind]}</span>
        <span className="font-display text-base leading-tight">{current.text}</span>
        <RewardChips reward={current.reward} />
      </div>
    </div>
  );
}
