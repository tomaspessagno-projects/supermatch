import { ResultsSummary } from "./ResultsSummary";

export default function ResultsPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-cartoon -rotate-2 text-5xl text-sun sm:text-6xl">RESULTADOS</h1>
      <ResultsSummary />
    </main>
  );
}
