import { TeamPicker } from "@/components/TeamPicker";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 p-8">
      <div className="text-center">
        <h1 className="text-6xl font-black tracking-tight">Supermatch</h1>
        <p className="mt-3 text-lg opacity-70">
          Elegí tu equipo. Una vez elegido, no hay vuelta atrás.
        </p>
      </div>
      <TeamPicker />
    </main>
  );
}
