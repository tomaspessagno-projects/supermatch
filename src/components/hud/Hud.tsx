"use client";

import { RUN_PLAYLIST, useSession } from "@/store/session";

export function Hud() {
  const slot = useSession((s) => s.results.length + 1);
  const liveScore = useSession((s) => s.liveScore);
  const banked = useSession((s) =>
    s.results.reduce((total, r) => total + r.score, 0),
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-4 font-mono text-white">
      <span data-testid="hud-slot">
        {Math.min(slot, RUN_PLAYLIST.length)}/{RUN_PLAYLIST.length}
      </span>
      <span data-testid="hud-score">{banked + liveScore}</span>
    </div>
  );
}
