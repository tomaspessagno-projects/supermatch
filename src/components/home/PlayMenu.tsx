"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TeamPicker } from "@/components/TeamPicker";
import { getTeam } from "@/lib/teams";
import { leaveRoom, useRoom } from "@/online/room";
import { useSession } from "@/store/session";

/**
 * Portada: primero el equipo (para siempre) y después cómo jugar: solo contra
 * la compu, una carrera en vivo con desconocidos o una sala con amigos.
 */
export function PlayMenu() {
  const team = useSession((s) => s.team);
  const nickname = useSession((s) => s.nickname);
  const profileStatus = useSession((s) => s.profileStatus);
  const loadProfile = useSession((s) => s.loadProfile);
  const kind = useSession((s) => s.kind);
  const chooseKind = useSession((s) => s.chooseKind);

  useEffect(() => {
    void loadProfile();
    // Volver a la portada es salir de cualquier sala o búsqueda.
    if (useRoom.getState().status !== "idle") void leaveRoom();
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
      {/* Competir (carrera contra los otros tres) o en equipo (El Colchón, los 4 juntos). */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl border-4 border-ink bg-ink/60 p-1" role="radiogroup" aria-label="Tipo de juego">
        {(
          [
            ["race", "COMPETIR", "Puente y Tronco"],
            ["coop", "EN EQUIPO", "El Colchón"],
          ] as const
        ).map(([value, label, detail]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            data-testid={`kind-${value}`}
            onClick={() => chooseKind(value)}
            className={`flex flex-col items-center rounded-xl px-3 py-1.5 transition ${kind === value ? "bg-sun text-ink" : "text-foreground/70 hover:bg-white/10"}`}
          >
            <span className="font-display text-lg">{label}</span>
            <span className="text-xs opacity-80">{detail}</span>
          </button>
        ))}
      </div>
      {kind === "race" ? (
        <>
          <ModeButton href="/play" solo title="JUGAR SOLO" subtitle="Vos contra 3 de la compu" tone="bg-sun text-ink" testId="mode-solo" />
          <ModeButton href="/online?modo=rapida" title="CARRERA ONLINE" subtitle="En vivo contra gente de verdad" tone="bg-water text-ink" testId="mode-quick" />
        </>
      ) : (
        <>
          <ModeButton href="/play" solo title="CON LA COMPU" subtitle="Vos y 3 compañeros de la compu" tone="bg-sun text-ink" testId="mode-solo" />
          <ModeButton href="/online?modo=rapida&tipo=equipo" title="EQUIPO ONLINE" subtitle="Con gente de verdad, todos juntos" tone="bg-water text-ink" testId="mode-quick" />
        </>
      )}
      <ModeButton href="/online" title="CON AMIGOS" subtitle="Armá una sala y pasales el código" tone="bg-rubber text-ink" testId="mode-friends" />
    </div>
  );
}

function ModeButton({
  href,
  solo = false,
  title,
  subtitle,
  tone,
  testId,
}: {
  href: string;
  solo?: boolean;
  title: string;
  subtitle: string;
  tone: string;
  testId: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={() => {
        if (solo) useSession.getState().playSolo();
        router.push(href);
      }}
      className={`btn-chunky flex flex-col items-start px-5 py-3 text-left ${tone}`}
    >
      <span className="font-display text-2xl">{title}</span>
      <span className="text-sm opacity-80">{subtitle}</span>
    </button>
  );
}
