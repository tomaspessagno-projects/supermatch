"use client";

import { dailyMissions, dayKey, MAIN_QUEST, progressLabel, STAR_REWARDS } from "../sim/goals";
import { buildTower } from "../sim/level";
import { useTower } from "../store";
import { THEME_COLOR } from "./colors";
import { missionValue, ProgressBar, RewardChips } from "./Objective";
import { Modal } from "./Shop";

const TOWER = buildTower();

/** Todas las metas: la misión del programa, las del día y las estrellas doradas. */
export function MissionsPanel({ now }: { now: number }) {
  const quest = useTower((s) => s.quest);
  const counters = useTower((s) => s.counters);
  const hud = useTower((s) => s.hud);
  const daily = useTower((s) => s.daily);
  const stars = useTower((s) => s.stars);
  const starRewards = useTower((s) => s.starRewards);
  const title = useTower((s) => s.title);
  const close = useTower((s) => s.openPanel);
  const today = dayKey(now);
  const counts = daily.day === today ? daily.counts : {};
  const done = daily.day === today ? daily.done : [];
  const nextStars = STAR_REWARDS[starRewards];

  return (
    <Modal title="MISIONES" subtitle={`Sos ${title.toUpperCase()} · misión ${Math.min(quest + 1, MAIN_QUEST.length)} de ${MAIN_QUEST.length}`} onClose={() => close(null)} testId="missions">
      <section className="flex flex-col gap-2">
        <h3 className="font-display text-sun">🎯 LA MISIÓN DEL PROGRAMA</h3>
        <ol className="flex flex-col gap-1.5">
          {MAIN_QUEST.map((m, i) => {
            if (i < quest - 2 || i > quest + 2) return null;
            const state = i < quest ? "done" : i === quest ? "now" : "next";
            return (
              <li key={m.id} className={`flex flex-col gap-1 rounded-xl p-2 ${state === "now" ? "bg-sun/15 ring-2 ring-sun" : "bg-white/5"} ${state === "next" ? "opacity-60" : ""}`}>
                <span className="flex items-start justify-between gap-2 text-sm">
                  <span className="text-white">
                    {state === "done" ? "✅" : state === "now" ? "🎯" : "🔒"} {i + 1}. {m.text}
                  </span>
                  <RewardChips reward={m.reward} />
                </span>
                {state === "now" && (
                  <>
                    <ProgressBar value={missionValue(m, counters, hud)} goal={m.goal} />
                    <span className="font-display text-[11px] text-foreground/70">{progressLabel(m, missionValue(m, counters, hud))}</span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-sun">📅 MISIONES DE HOY <span className="text-xs text-foreground/60">(iguales para todos; cambian a la medianoche)</span></h3>
        <ul className="grid gap-1.5 sm:grid-cols-3">
          {dailyMissions(today).map((m) => {
            const value = counts[m.counter] ?? 0;
            const ok = done.includes(m.id);
            return (
              <li key={m.id} className={`flex flex-col gap-1 rounded-xl p-2 ${ok ? "bg-green-500/15" : "bg-white/5"}`} data-testid={`daily-${m.id}`}>
                <span className="text-sm text-white">{ok ? "✅" : "📌"} {m.text}</span>
                <ProgressBar value={ok ? m.goal : value} goal={m.goal} color={ok ? "bg-green-400" : "bg-water"} />
                <span className="flex items-center justify-between">
                  <span className="font-display text-[11px] text-foreground/70">{progressLabel(m, ok ? m.goal : value)}</span>
                  <RewardChips reward={m.reward} />
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-sun">
          ⭐ ESTRELLAS DORADAS: {stars.length} / {TOWER.stars.length}
        </h3>
        <p className="text-xs text-foreground/70">Hay 3 escondidas en cada piso: una alta, una afuera (sobre la pileta) y una de destreza. Quedan encontradas aunque te caigas.</p>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {TOWER.floors.map((f) => (
            <div key={f.index} className="flex flex-col items-center rounded-lg border-2 border-ink p-1" style={{ backgroundColor: `${THEME_COLOR[f.theme]}33` }}>
              <span className="font-display text-[10px] text-white">PISO {f.index + 1}</span>
              <span className="text-sm">
                {TOWER.stars
                  .filter((s) => s.floor === f.index)
                  .map((s) => (
                    <span key={s.id} className={stars.includes(s.id) ? "text-sun" : "text-white/20"}>
                      ★
                    </span>
                  ))}
              </span>
            </div>
          ))}
        </div>
        {nextStars && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-foreground/80">
            Con {nextStars.stars} estrellas: <RewardChips reward={nextStars.reward} />
          </p>
        )}
      </section>
    </Modal>
  );
}
