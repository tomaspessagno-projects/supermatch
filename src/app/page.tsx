import Image from "next/image";
import Link from "next/link";
import { PlayMenu } from "@/components/home/PlayMenu";
import { MissionBoard } from "@/components/mission/MissionBoard";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-10">
      <div className="text-center">
        <h1>
          <Image
            src="/ui/logo.png"
            alt="Supermatch"
            width={1005}
            height={387}
            priority
            className="mx-auto h-auto w-full max-w-xl -rotate-2 drop-shadow-[0_8px_0_rgb(31_17_71/0.5)]"
          />
        </h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-foreground/80">
          Minijuegos torpes, resbaladizos y caóticos. Elegí tu equipo: no hay vuelta atrás.
        </p>
      </div>
      <div className="flex flex-col items-center gap-8 md:flex-row md:gap-14">
        <Image
          src="/ui/contestant.png"
          alt="El concursante"
          width={370}
          height={531}
          priority
          className="h-56 w-auto animate-wobble drop-shadow-[0_10px_0_rgb(31_17_71/0.6)] sm:h-80"
        />
        <PlayMenu />
      </div>
      <MissionBoard compact />
      <Link href="/leaderboard" className="font-display text-lg text-water underline-offset-4 hover:underline">
        Ver el ranking en vivo →
      </Link>
    </main>
  );
}
