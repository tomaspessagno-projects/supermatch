"use client";

import Image from "next/image";
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
          style={{ backgroundColor: `${color}40` }}
          className="btn-chunky group relative flex flex-col items-center gap-2 px-3 pb-4 pt-5 disabled:opacity-30"
        >
          {team === id && (
            <span className="absolute -top-3 rounded-full border-2 border-ink bg-sun px-3 py-0.5 font-display text-xs text-ink">
              TU EQUIPO
            </span>
          )}
          <Image
            src={`/ui/badge-${id}.png`}
            alt=""
            width={186}
            height={186}
            className="size-20 transition group-hover:rotate-12 group-hover:scale-110 group-disabled:rotate-0 group-disabled:scale-100"
          />
          <span className="text-cartoon text-xl text-white">{name}</span>
        </button>
      ))}
    </div>
  );
}
