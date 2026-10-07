"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Host } from "@/components/episode/Host";
import { TeamRow } from "@/components/episode/TeamRow";
import { tableLine, teamLine } from "@/lib/host";
import { minigameTitle } from "@/lib/minigames";
import { MEDAL_ICON, MEDAL_LABEL, medalFor, standings } from "@/lib/participants";
import { getTeam } from "@/lib/teams";
import { leaveRoom, useRoom } from "@/online/room";
import { type Submission, useSession } from "@/store/session";

export function ResultsSummary() {
  const team = useSession((s) => s.team);
  const results = useSession((s) => s.results);
  const submission = useSession((s) => s.submission);
  const submitRun = useSession((s) => s.submitRun);
  const retrySubmit = useSession((s) => s.retrySubmit);
  const participants = useSession((s) => s.participants);
  const scores = useSession((s) => s.scores);
  const online = useSession((s) => s.mode === "online");
  const coop = useSession((s) => s.kind === "coop");
  const total = results.reduce((sum, r) => sum + r.score, 0);

  useEffect(() => {
    void submitRun();
  }, [submitRun]);

  if (results.length === 0 || !team) {
    return (
      <Link href="/" className="btn-chunky bg-sun px-6 py-3 font-display text-xl text-ink">
        Elegí tu equipo y jugá
      </Link>
    );
  }

  // Tabla del episodio: vos y los otros tres (bots o personas de la sala).
  const table = standings(participants, scores);
  const winner = table[0].participant;
  const won = winner.kind === "me";
  // En equipo: la medalla del episodio es la del promedio de las rondas.
  const teamMedal = medalFor(total / Math.max(1, results.length));
  const line = coop ? teamLine(results[results.length - 1]?.score ?? 0, total, true) : tableLine(table, true);

  return (
    <div className="flex w-full items-end justify-center gap-8">
      {/* En pantallas grandes, el presentador cierra el programa de cuerpo entero. */}
      <Image src="/ui/host.png" alt="" width={250} height={401} className="mb-6 hidden h-96 w-auto lg:block" />
      <div className="flex w-full max-w-md flex-col gap-5 rounded-3xl border-4 border-ink bg-ink/60 p-6">
        <Host key={line} line={line} />
        {coop ? (
          <div className="flex flex-col items-center gap-2 text-center" data-testid="episode-winner">
            <span className="animate-wobble text-7xl" aria-hidden>{teamMedal ? MEDAL_ICON[teamMedal] : "💦"}</span>
            <p className="text-cartoon text-3xl text-sun">{teamMedal ? `¡EQUIPO DE ${MEDAL_LABEL[teamMedal]}!` : "¡TERMINARON!"}</p>
            <ul className="flex flex-wrap justify-center gap-2" data-testid="standings">
              {participants.map((p) => (
                <li key={p.id} className={`flex items-center gap-1.5 rounded-full bg-white/10 py-0.5 pl-0.5 pr-3 text-sm ${p.kind === "me" ? "ring-2 ring-sun" : ""}`}>
                  <Image src={`/ui/badge-${p.team}.png`} alt="" width={186} height={186} className="size-6" />
                  <span className="font-display text-white">{p.kind === "me" ? "VOS" : p.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-1 text-center" data-testid="episode-winner">
              <Image src={`/ui/badge-${winner.team}.png`} alt="" width={186} height={186} className="size-20 animate-wobble" />
              <p className="text-cartoon text-3xl text-sun">{won ? "¡GANASTE EL EPISODIO!" : `GANÓ ${winner.name.toUpperCase()}`}</p>
            </div>
            <ol className="flex flex-col gap-2" data-testid="standings">
              {table.map((row, i) => (
                <TeamRow key={row.participant.id} rank={i + 1} row={row} online={online} />
              ))}
            </ol>
          </>
        )}
        <div className="flex items-center gap-3 border-t-4 border-dashed border-white/15 pt-4">
          <Image src={`/ui/badge-${team}.png`} alt="" width={186} height={186} className="size-10" />
          <p className="text-cartoon text-xl text-white">Tus puntos para {getTeam(team).name}</p>
        </div>
        <ol className="flex flex-col gap-2" data-testid="results">
          {results.map((r) => (
            <li key={r.slot} className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-2">
              <span className="text-foreground/80">
                {r.slot}. {minigameTitle(r.minigameId, r.slot)}
              </span>
              <span className="font-display text-xl tabular-nums">
                {coop && medalFor(r.score) ? `${MEDAL_ICON[medalFor(r.score)!]} ` : ""}
                {r.score}
              </span>
            </li>
          ))}
        </ol>
        <p className="flex items-baseline justify-between">
          <span className="text-cartoon text-3xl text-white">TOTAL</span>
          <span data-testid="results-total" className="text-cartoon text-5xl text-sun tabular-nums">
            {total}
          </span>
        </p>
        <SubmissionStatus submission={submission} teamName={getTeam(team).name} onRetry={retrySubmit} />
        {online ? (
          <OnlineActions />
        ) : (
          <div className="flex gap-3">
            <Link href="/play" className="btn-chunky flex-1 bg-sun px-4 py-3 text-center font-display text-2xl text-ink">
              Jugar de nuevo
            </Link>
            <Link href="/leaderboard" className="btn-chunky bg-white/10 px-4 py-3 text-center font-display text-2xl text-white">
              Ranking
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/** Después de una carrera online: revancha en la misma sala, otra carrera o salir. */
function OnlineActions() {
  const router = useRouter();
  const kind = useRoom((s) => s.kind);
  const code = useRoom((s) => s.code);
  const inRoom = useRoom((s) => s.status === "playing" || s.status === "lobby");

  async function leave(to: string) {
    await leaveRoom();
    router.push(to);
  }

  return (
    <div className="flex gap-3">
      {kind === "friends" && inRoom ? (
        <Link href={`/online?sala=${code}`} className="btn-chunky flex-1 bg-sun px-4 py-3 text-center font-display text-2xl text-ink">
          Revancha
        </Link>
      ) : (
        <button type="button" onClick={() => leave("/online?modo=rapida")} className="btn-chunky flex-1 bg-sun px-4 py-3 font-display text-2xl text-ink">
          Otra carrera
        </button>
      )}
      <button type="button" onClick={() => leave("/")} className="btn-chunky bg-white/10 px-4 py-3 font-display text-2xl text-white">
        Salir
      </button>
    </div>
  );
}

function SubmissionStatus({
  submission,
  teamName,
  onRetry,
}: {
  submission: Submission;
  teamName: string;
  onRetry: () => void;
}) {
  const base = "rounded-2xl px-4 py-3 text-center";
  switch (submission.status) {
    case "idle":
    case "sending":
      return <p className={`${base} animate-pulse bg-white/5 text-foreground/80`} data-testid="submission">Sumando tu puntaje al ranking…</p>;
    case "sent":
      return (
        <p className={`${base} bg-sun/15 font-display text-lg text-sun`} data-testid="submission">
          ¡+{submission.total} puntos para {teamName}!
        </p>
      );
    case "offline":
      return (
        <p className={`${base} bg-white/5 text-foreground/70`} data-testid="submission">
          Jugaste sin conexión: este puntaje no suma al ranking.
        </p>
      );
    case "error":
      return (
        <div className={`${base} flex items-center justify-between gap-3 bg-red-500/15 text-left`} data-testid="submission">
          <span className="text-foreground/80">No pudimos guardar el puntaje.</span>
          <button type="button" onClick={onRetry} className="font-display text-sun underline">
            Reintentar
          </button>
        </div>
      );
  }
}
