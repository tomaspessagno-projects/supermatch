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

  return (
    <main className="flex flex-1 items-center justify-center bg-black p-4">
      <div className="relative aspect-video w-full max-w-5xl">
        <GameHost
          teamColor={getTeam(team).color}
          onRunFinished={() => router.push("/results")}
        />
        <Hud />
      </div>
    </main>
  );
}
