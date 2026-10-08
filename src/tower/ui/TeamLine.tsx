"use client";

import { useMissions } from "@/components/mission/MissionBoard";
import { getTeam } from "@/lib/teams";
import { useSession } from "@/store/session";

/** La misión del día de tu equipo, en vivo: lo que subís suma acá. */
export function TeamLine() {
  const team = useSession((s) => s.team);
  const missions = useMissions();
  const mission = missions?.find((m) => m.team === team);
  if (!team || !mission) return null;
  const { name, color } = getTeam(team);
  const pct = Math.min(100, (mission.progress / mission.target) * 100);
  return (
    <div className="mt-1 flex w-[min(60vw,240px)] flex-col gap-0.5" data-testid="team-line">
      <span className="font-display text-[10px] text-foreground/80">
        {name.toUpperCase()} · MISIÓN DEL DÍA {mission.progress.toLocaleString("es-AR")} / {mission.target.toLocaleString("es-AR")}
        {mission.completed && " ✅"}
      </span>
      <div className="h-1.5 overflow-hidden rounded-full border border-ink bg-ink/60">
        <div className="h-full transition-[width] duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
