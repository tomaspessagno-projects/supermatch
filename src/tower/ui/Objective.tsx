"use client";

import { cosmeticDef } from "../sim/cosmetics";
import { type Counters, dailyMissions, dayKey, MAIN_QUEST, type Mission, progressLabel, type Reward } from "../sim/goals";
import { type Hud, useTower } from "../store";

/** Cuánto lleva de una misión (con lo que va del intento, para que la barra se mueva en vivo). */
export function missionValue(m: Mission, counters: Counters, hud: Hud): number {
  if (m.counter === "height") return Math.max(counters.height, hud.height);
  if (m.counter === "chipsRun") return Math.max(counters.chipsRun, hud.chips);
  return counters[m.counter];
}

export function RewardChips({ reward }: { reward: Reward }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {reward.fame ? <span className="rounded-full bg-sun/20 px-1.5 font-display text-[11px] text-sun">⭐ +{reward.fame.toLocaleString("es-AR")}</span> : null}
      {reward.cosmetic ? <span className="rounded-full bg-rubber/20 px-1.5 font-display text-[11px] text-rubber">{cosmeticDef(reward.cosmetic).emoji} {cosmeticDef(reward.cosmetic).name}</span> : null}
      {reward.title ? <span className="rounded-full bg-water/20 px-1.5 font-display text-[11px] text-water">🏅 {reward.title}</span> : null}
    </span>
  );
}

export function ProgressBar({ value, goal, color = "bg-sun" }: { value: number; goal: number; color?: string }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full border-2 border-ink bg-ink/60">
      <div className={`h-full transition-[width] duration-300 ${color}`} style={{ width: `${Math.min(100, (value / goal) * 100)}%` }} />
    </div>
  );
}

/** La misión del programa activa: siempre a la vista. Tocándola se abren todas. */
export function Objective({ now }: { now: number }) {
  const quest = useTower((s) => s.quest);
  const counters = useTower((s) => s.counters);
  const hud = useTower((s) => s.hud);
  const daily = useTower((s) => s.daily);
  const openPanel = useTower((s) => s.openPanel);
  const mission = MAIN_QUEST[quest];
  const today = dayKey(now);
  const dailyDone = daily.day === today ? daily.done.length : 0;
  const dailyTotal = dailyMissions(today).length;

  return (
    <button
      type="button"
      onClick={() => openPanel("missions")}
      onMouseDown={(e) => e.preventDefault()}
      className="pointer-events-auto flex w-[min(78vw,300px)] flex-col gap-1 rounded-2xl border-4 border-ink bg-ink/75 p-2 text-left backdrop-blur-sm"
      data-testid="objective"
    >
      {mission ? (
        <>
          <span className="flex items-center justify-between font-display text-[11px] text-sun">
            <span>🎯 MISIÓN {quest + 1}/{MAIN_QUEST.length}</span>
            <span className="text-foreground/60">DEL DÍA {dailyDone}/{dailyTotal}</span>
          </span>
          <span className="font-display text-sm leading-tight text-white" data-testid="objective-text">
            {mission.text}
          </span>
          <ProgressBar value={missionValue(mission, counters, hud)} goal={mission.goal} />
          <span className="flex items-center justify-between gap-2">
            <span className="font-display text-[11px] tabular-nums text-foreground/80">{progressLabel(mission, missionValue(mission, counters, hud))}</span>
            <RewardChips reward={mission.reward} />
          </span>
        </>
      ) : (
        <span className="font-display text-sm text-white">🏆 ¡Hiciste todas las misiones del programa! Seguí con las del día y las estrellas.</span>
      )}
    </button>
  );
}
