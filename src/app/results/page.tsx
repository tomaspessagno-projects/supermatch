import { ResultsSummary } from "./ResultsSummary";

export default function ResultsPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-black">Resultados</h1>
      <ResultsSummary />
    </main>
  );
}
