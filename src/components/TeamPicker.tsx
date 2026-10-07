"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { TEAMS, type TeamId } from "@/lib/teams";
import { useSession } from "@/store/session";

/** Los cuatro escudos. Elegir es para siempre: la facción queda bloqueada. */
export function TeamPicker() {
  const team = useSession((s) => s.team);
  const profileStatus = useSession((s) => s.profileStatus);
  const loadProfile = useSession((s) => s.loadProfile);
  const chooseTeam = useSession((s) => s.chooseTeam);
  const [joining, setJoining] = useState<TeamId | null>(null);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function choose(id: TeamId) {
    if (team) return;
    setJoining(id);
    await chooseTeam(id);
    setJoining(null);
  }

  const busy = joining !== null || profileStatus === "loading";

  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-4" data-testid="team-picker">
      {TEAMS.map(({ id, name, color }) => (
        <button
          key={id}
          type="button"
          onClick={() => choose(id)}
          disabled={busy || team !== null}
          style={{ backgroundColor: `${color}40` }}
          className="btn-chunky group relative flex flex-col items-center gap-2 px-3 pb-4 pt-5 disabled:opacity-30"
        >
          <Image
            src={`/ui/badge-${id}.png`}
            alt=""
            width={186}
            height={186}
            className="size-20 transition group-hover:rotate-12 group-hover:scale-110 group-disabled:rotate-0 group-disabled:scale-100"
          />
          <span className="text-cartoon text-xl text-white">{joining === id ? "Entrando…" : name}</span>
        </button>
      ))}
    </div>
  );
}
