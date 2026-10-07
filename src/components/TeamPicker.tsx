"use client";

import { useRouter } from "next/navigation";
import { TEAMS, type TeamId } from "@/lib/teams";
import { useSession } from "@/store/session";

export function TeamPicker() {
  const router = useRouter();
  const team = useSession((s) => s.team);
  const chooseTeam = useSession((s) => s.chooseTeam);

  function play(id: TeamId) {
    chooseTeam(id);
    router.push("/play");
  }

  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-4">
      {TEAMS.map(({ id, name, color }) => (
        <button
          key={id}
          type="button"
          onClick={() => play(id)}
          disabled={team !== null && team !== id}
          style={{ backgroundColor: color }}
          className="rounded-2xl px-4 py-6 text-lg font-bold text-white shadow-lg transition hover:scale-105 disabled:opacity-30 disabled:hover:scale-100"
        >
          {name}
        </button>
      ))}
    </div>
  );
}
