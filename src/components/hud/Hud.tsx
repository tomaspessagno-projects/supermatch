"use client";

import Image from "next/image";
import { RUN_PLAYLIST, useSession } from "@/store/session";

export function Hud() {
  const team = useSession((s) => s.team);
  const slot = useSession((s) => s.results.length + 1);
  const liveScore = useSession((s) => s.liveScore);
  const banked = useSession((s) =>
    s.results.reduce((total, r) => total + r.score, 0),
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-4">
      <p className="text-cartoon text-lg text-white sm:text-2xl">
        PRUEBA{" "}
        <span data-testid="hud-slot" className="text-sun">
          {Math.min(slot, RUN_PLAYLIST.length)}/{RUN_PLAYLIST.length}
        </span>
      </p>
      <div className="flex items-center gap-2">
        {team && (
          <Image src={`/ui/badge-${team}.png`} alt="" width={186} height={186} className="size-8 sm:size-10" />
        )}
        <span data-testid="hud-score" className="text-cartoon text-2xl text-white tabular-nums sm:text-4xl">
          {banked + liveScore}
        </span>
      </div>
    </div>
  );
}
