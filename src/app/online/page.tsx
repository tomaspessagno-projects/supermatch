import type { Metadata } from "next";
import { OnlineLobby } from "./OnlineLobby";

export const metadata: Metadata = {
  title: "Carrera online · Supermatch",
};

export default function OnlinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-cartoon -rotate-2 text-center text-5xl text-sun sm:text-6xl">EN VIVO</h1>
      <OnlineLobby />
    </main>
  );
}
