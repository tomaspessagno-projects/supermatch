"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TEAMS, type TeamId } from "@/lib/teams";
import { useSession } from "@/store/session";

export function TeamPicker() {
  const router = useRouter();
  const team = useSession((s) => s.team);
  const nickname = useSession((s) => s.nickname);
  const profileStatus = useSession((s) => s.profileStatus);
  const loadProfile = useSession((s) => s.loadProfile);
  const chooseTeam = useSession((s) => s.chooseTeam);
  const [joining, setJoining] = useState<TeamId | null>(null);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function play(id: TeamId) {
    if (!team) {
      setJoining(id);
      await chooseTeam(id);
      setJoining(null);
    }
    router.push("/play");
  }

  const busy = joining !== null || profileStatus === "loading";

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      {nickname && (
        <p className="text-center text-foreground/80">
          Jugás como <strong className="font-display text-lg text-sun">{nickname}</strong>
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        {TEAMS.map(({ id, name, color }) => (
          <button
            key={id}
            type="button"
            onClick={() => play(id)}
            disabled={busy || (team !== null && team !== id)}
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
            <span className="text-cartoon text-xl text-white">{joining === id ? "Entrando…" : name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
