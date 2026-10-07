import Image from "next/image";
import { TeamPicker } from "@/components/TeamPicker";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-10">
      <div className="text-center">
        <h1 className="text-cartoon -rotate-2 text-6xl text-sun sm:text-8xl">SUPERMATCH</h1>
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
        <TeamPicker />
      </div>
    </main>
  );
}
