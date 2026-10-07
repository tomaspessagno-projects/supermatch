"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { fetchTeamTotals, subscribeTeamTotals, type TeamTotal } from "@/lib/supabase/api";
import { getTeam } from "@/lib/teams";
import { useSession } from "@/store/session";

export function TeamLeaderboard() {
  const myTeam = useSession((s) => s.team);
  const [totals, setTotals] = useState<TeamTotal[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetchTeamTotals()
      .then((rows) => active && setTotals(rows))
      .catch(() => active && setFailed(true));
    const unsubscribe = subscribeTeamTotals((row) =>
      setTotals((prev) => prev?.map((t) => (t.team === row.team ? row : t)) ?? prev),
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (failed) {
    return <p className="text-foreground/70">No pudimos cargar el ranking. Probá de nuevo en un rato.</p>;
  }
  if (!totals) {
    return <p className="animate-pulse text-foreground/70">Cargando el ranking…</p>;
  }

  const ranked = [...totals].sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...ranked.map((t) => t.total));

  return (
    <ol className="flex w-full max-w-xl flex-col gap-3" data-testid="leaderboard">
      {ranked.map((t, i) => {
        const team = getTeam(t.team);
        return (
          <li
            key={t.team}
            className={`flex items-center gap-3 rounded-3xl border-4 border-ink bg-ink/60 p-3 ${t.team === myTeam ? "ring-4 ring-sun" : ""}`}
          >
            <span className="text-cartoon w-8 text-center text-3xl text-white">{i + 1}</span>
            <Image src={`/ui/badge-${t.team}.png`} alt="" width={186} height={186} className="size-12" />
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg text-white">{team.name}</span>
                <span className="text-cartoon text-2xl tabular-nums text-sun" data-testid={`total-${t.team}`}>
                  {t.total.toLocaleString("es-AR")}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${Math.max(3, (t.total / max) * 100)}%`, backgroundColor: team.color }}
                />
              </div>
              <span className="text-xs text-foreground/60">
                {t.runs} {t.runs === 1 ? "partida" : "partidas"}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
