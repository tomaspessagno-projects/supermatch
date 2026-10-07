"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { GameHost } from "@/bridge/GameHost";
import { EpisodeOverlay } from "@/components/episode/EpisodeOverlay";
import { Hud } from "@/components/hud/Hud";
import { RotateHint, TouchControls } from "@/components/hud/TouchControls";
import { getTeam } from "@/lib/teams";
import { useSession } from "@/store/session";

export function PlayScreen() {
  const router = useRouter();
  const team = useSession((s) => s.team);
  const showResults = useCallback(() => router.push("/results"), [router]);

  useEffect(() => {
    if (!team) router.replace("/");
  }, [team, router]);

  if (!team) return null;
  const { color } = getTeam(team);

  return (
    <main className="relative flex flex-1 items-center justify-center p-2 sm:p-6">
      <div
        style={{ boxShadow: `0 0 0 6px ${color}, 0 24px 60px rgb(0 0 0 / 0.6)` }}
        className="relative aspect-video w-[min(100%,calc((100dvh-1.5rem)*16/9))] max-w-6xl pointer-coarse:w-[min(calc(100%-15rem),calc((100dvh-1.5rem)*16/9))] overflow-hidden rounded-3xl border-4 border-ink bg-ink"
      >
        <GameHost team={team} />
        <Hud />
        <EpisodeOverlay onFinished={showResults} />
      </div>
      <TouchControls />
      <RotateHint />
    </main>
  );
}
