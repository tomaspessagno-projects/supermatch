"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { GameHost } from "@/bridge/GameHost";
import { Hud } from "@/components/hud/Hud";
import { getTeam } from "@/lib/teams";
import { useSession } from "@/store/session";

export function PlayScreen() {
  const router = useRouter();
  const team = useSession((s) => s.team);

  useEffect(() => {
    if (!team) router.replace("/");
  }, [team, router]);

  if (!team) return null;
  const { color } = getTeam(team);

  return (
    <main className="flex flex-1 items-center justify-center p-3 sm:p-6">
      <div
        style={{ boxShadow: `0 0 0 6px ${color}, 0 24px 60px rgb(0 0 0 / 0.6)` }}
        className="relative aspect-video w-full max-w-6xl overflow-hidden rounded-3xl border-4 border-ink bg-ink"
      >
        <GameHost teamColor={color} onRunFinished={() => router.push("/results")} />
        <Hud />
      </div>
    </main>
  );
}
