import Image from "next/image";
import type { Standing } from "@/lib/participants";

/**
 * Una fila de la tabla: puesto, escudo, nombre, puntos de la prueba y total.
 * `waiting`: una persona de la sala que todavía no terminó la prueba.
 */
export function TeamRow({
  rank,
  row: { participant, gained, total },
  showGained = false,
  waiting = false,
  online = false,
}: {
  rank: number;
  row: Standing;
  showGained?: boolean;
  waiting?: boolean;
  online?: boolean;
}) {
  const mine = participant.kind === "me";
  return (
    <li
      data-testid={`row-${participant.id}`}
      style={{ animationDelay: `${120 + rank * 80}ms` }}
      className={`flex animate-[row-in_0.35s_ease-out_both] items-center motion-reduce:animate-none gap-3 rounded-2xl bg-white/5 px-3 py-2 @max-3xl:gap-1.5 @max-3xl:rounded-xl @max-3xl:px-2 @max-3xl:py-1 ${mine ? "ring-4 ring-sun @max-3xl:ring-2" : ""} ${participant.left ? "opacity-50" : ""}`}
    >
      <span className="text-cartoon w-6 text-center text-2xl text-white @max-3xl:w-4 @max-3xl:text-base">{rank}</span>
      <Image src={`/ui/badge-${participant.team}.png`} alt="" width={186} height={186} className="size-9 @max-3xl:size-6" />
      <span className="flex-1 truncate font-display text-white @max-3xl:text-xs">
        {participant.name}
        {mine && <span className="ml-2 text-xs text-sun @max-3xl:ml-1">(VOS)</span>}
        {online && participant.kind === "bot" && <span className="ml-2 text-xs text-foreground/60 @max-3xl:ml-1">CPU</span>}
        {participant.left && <span className="ml-2 text-xs text-foreground/60 @max-3xl:ml-1">SE FUE</span>}
      </span>
      {showGained &&
        (waiting ? (
          <span className="animate-pulse font-display text-sm text-foreground/70 @max-3xl:text-xs" data-testid="waiting">
            jugando…
          </span>
        ) : (
          <span className="font-display text-sm text-water tabular-nums @max-3xl:hidden">+{gained ?? 0}</span>
        ))}
      <span className="text-cartoon w-16 text-right text-2xl text-sun tabular-nums @max-3xl:w-auto @max-3xl:text-base">{total}</span>
    </li>
  );
}
