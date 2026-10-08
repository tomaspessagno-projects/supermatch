"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { TeamPicker } from "@/components/TeamPicker";
import { getTeam } from "@/lib/teams";
import { useSession } from "@/store/session";
import { useTower } from "@/tower/store";

/** Portada: primero el equipo (para siempre) y después, a la torre. */
export function PlayMenu() {
  const team = useSession((s) => s.team);
  const nickname = useSession((s) => s.nickname);
  const profileStatus = useSession((s) => s.profileStatus);
  const loadProfile = useSession((s) => s.loadProfile);
  const record = useTower((s) => s.record);
  const fame = useTower((s) => s.fame);
  const runs = useTower((s) => s.runs);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (profileStatus !== "ready" && !team) {
    return <p className="w-full max-w-md animate-pulse text-center font-display text-xl text-foreground/70">Cargando…</p>;
  }
  if (!team) return <TeamPicker />;

  const { name, color } = getTeam(team);
  return (
    <div className="flex w-full max-w-md flex-col gap-4" data-testid="mode-picker">
      <div className="flex items-center gap-3 rounded-3xl border-4 border-ink px-4 py-3" style={{ backgroundColor: `${color}40` }}>
        <Image src={`/ui/badge-${team}.png`} alt="" width={186} height={186} className="size-14 animate-wobble" />
        <p className="leading-tight text-foreground/90">
          {nickname ? (
            <>
              Jugás como <strong className="font-display text-lg text-sun">{nickname}</strong>
              <br />
            </>
          ) : null}
          por el <strong className="font-display text-lg text-white">{name}</strong>
        </p>
      </div>
      <Link href="/torre" data-testid="play-tower" className="btn-chunky flex flex-col items-start bg-sun px-5 py-4 text-left text-ink">
        <span className="font-display text-3xl">{runs > 0 ? "¡VOLVER A LA TORRE!" : "¡A LA TORRE!"}</span>
        <span className="text-sm opacity-80">
          {runs > 0
            ? `Tu récord: ${record.toFixed(1)} m · ${Math.floor(fame).toLocaleString("es-AR")} de fama para gastar`
            : "Subí, caete a la pileta, mejorá y volvé a subir"}
        </span>
      </Link>
    </div>
  );
}
