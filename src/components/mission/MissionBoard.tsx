"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { fetchMissions, type Mission, subscribeMissions } from "@/lib/supabase/api";
import { getTeam, type TeamId } from "@/lib/teams";
import { useSession } from "@/store/session";

/** Las misiones de hoy, en vivo. null mientras cargan o si no hay conexión. */
export function useMissions(): Mission[] | null {
  const [missions, setMissions] = useState<Mission[] | null>(null);
  useEffect(() => {
    let active = true;
    const load = () =>
      fetchMissions()
        .then((rows) => active && setMissions(rows))
        .catch(() => {});
    void load();
    const unsubscribe = subscribeMissions(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return missions;
}

/**
 * La Misión del equipo: cuatro tanques que se llenan con los puntos que
 * suma cada color durante el día.
 */
export function MissionBoard({ compact = false }: { compact?: boolean }) {
  const missions = useMissions();
  const myTeam = useSession((s) => s.team);
  if (!missions) return null;
  const target = missions[0]?.target ?? 0;

  return (
    <section className="flex w-full max-w-xl flex-col gap-3 rounded-3xl border-4 border-ink bg-ink/60 p-4" data-testid="missions">
      <div className="text-center">
        <h2 className="text-cartoon text-2xl text-sun">MISIÓN DE HOY</h2>
        <p className="text-sm text-foreground/80">
          Entre todos los de tu color, sumen {target.toLocaleString("es-AR")} puntos.
        </p>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {missions.map((m) => (
          <Tank key={m.team} mission={m} mine={m.team === myTeam} compact={compact} />
        ))}
      </div>
    </section>
  );
}

function Tank({ mission, mine, compact }: { mission: Mission; mine: boolean; compact: boolean }) {
  const team = getTeam(mission.team as TeamId);
  const fill = Math.min(1, mission.progress / mission.target);
  return (
    <div className="flex flex-col items-center gap-1" data-testid={`mission-${mission.team}`}>
      <div
        className={`relative w-full overflow-hidden rounded-2xl border-4 border-ink bg-white/10 ${compact ? "h-20" : "h-32"} ${mine ? "ring-4 ring-sun" : ""}`}
      >
        {/* Agua del color del equipo que sube, con una ola arriba. */}
        <div
          className="absolute inset-x-0 bottom-0 transition-[height] duration-1000"
          style={{ height: `${fill * 100}%`, backgroundColor: team.color }}
        >
          <div className="h-1.5 w-full bg-white/40" />
        </div>
        {[0.25, 0.5, 0.75].map((mark) => (
          <div key={mark} className="absolute left-0 h-0.5 w-2 bg-ink/60" style={{ bottom: `${mark * 100}%` }} />
        ))}
        {mission.completed && (
          <span className="text-cartoon absolute inset-x-0 top-1/2 -translate-y-1/2 -rotate-6 text-center text-sm text-sun">
            ¡CUMPLIDA!
          </span>
        )}
      </div>
      <Image src={`/ui/badge-${mission.team}.png`} alt={team.name} width={186} height={186} className="size-7" />
      <span className="font-display text-xs tabular-nums text-white">
        {Math.round(fill * 100)}%
      </span>
    </div>
  );
}
