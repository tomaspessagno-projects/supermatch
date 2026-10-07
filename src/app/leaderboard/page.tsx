import Link from "next/link";
import { TeamLeaderboard } from "@/components/leaderboard/TeamLeaderboard";

export default function LeaderboardPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-cartoon -rotate-2 text-5xl text-sun sm:text-6xl">RANKING</h1>
        <p className="mt-2 flex items-center justify-center gap-2 text-foreground/70">
          <span className="size-2 animate-pulse rounded-full bg-red-500" /> En vivo: cada partida suma a su equipo
        </p>
      </div>
      <TeamLeaderboard />
      <Link href="/" className="btn-chunky bg-sun px-6 py-3 font-display text-xl text-ink">
        Jugar
      </Link>
    </main>
  );
}
