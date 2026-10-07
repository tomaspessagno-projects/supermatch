import Image from "next/image";
import { getTeam, type TeamId } from "@/lib/teams";

/** Una fila de tabla de equipos: puesto, escudo, puntos ganados y total. */
export function TeamRow({ rank, team, mine, gained, total }: { rank: number; team: TeamId; mine: boolean; gained?: number; total: number }) {
  return (
    <li className={`flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2 ${mine ? "ring-4 ring-sun" : ""}`}>
      <span className="text-cartoon w-6 text-center text-2xl text-white">{rank}</span>
      <Image src={`/ui/badge-${team}.png`} alt="" width={186} height={186} className="size-9" />
      <span className="flex-1 font-display text-white">
        {getTeam(team).name}
        {mine && <span className="ml-2 text-xs text-sun">(VOS)</span>}
      </span>
      {gained !== undefined && <span className="font-display text-sm text-water tabular-nums">+{gained}</span>}
      <span className="text-cartoon w-16 text-right text-2xl text-sun tabular-nums">{total}</span>
    </li>
  );
}
