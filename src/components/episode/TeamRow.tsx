import Image from "next/image";
import { getTeam, type TeamId } from "@/lib/teams";

/** Una fila de tabla de equipos: puesto, escudo, puntos ganados y total. */
export function TeamRow({ rank, team, mine, gained, total }: { rank: number; team: TeamId; mine: boolean; gained?: number; total: number }) {
  return (
    <li className={`flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2 @max-3xl:gap-1.5 @max-3xl:rounded-xl @max-3xl:px-2 @max-3xl:py-1 ${mine ? "ring-4 ring-sun @max-3xl:ring-2" : ""}`}>
      <span className="text-cartoon w-6 text-center text-2xl text-white @max-3xl:w-4 @max-3xl:text-base">{rank}</span>
      <Image src={`/ui/badge-${team}.png`} alt="" width={186} height={186} className="size-9 @max-3xl:size-6" />
      <span className="flex-1 truncate font-display text-white @max-3xl:text-xs">
        {getTeam(team).name}
        {mine && <span className="ml-2 text-xs text-sun @max-3xl:ml-1">(VOS)</span>}
      </span>
      {gained !== undefined && <span className="font-display text-sm text-water tabular-nums @max-3xl:hidden">+{gained}</span>}
      <span className="text-cartoon w-16 text-right text-2xl text-sun tabular-nums @max-3xl:w-auto @max-3xl:text-base">{total}</span>
    </li>
  );
}
