"use client";

import Link from "next/link";
import { useSession } from "@/store/session";

export function ResultsSummary() {
  const results = useSession((s) => s.results);
  const total = results.reduce((sum, r) => sum + r.score, 0);

  if (results.length === 0) {
    return (
      <Link href="/" className="underline">
        Todavía no jugaste. Elegí tu equipo.
      </Link>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <ol className="flex flex-col gap-2 font-mono" data-testid="results">
        {results.map((r) => (
          <li key={r.slot} className="flex justify-between">
            <span>
              {r.slot}. {r.minigameId}
            </span>
            <span>{r.score}</span>
          </li>
        ))}
      </ol>
      <p className="flex justify-between border-t pt-4 text-2xl font-bold">
        <span>Total</span>
        <span data-testid="results-total">{total}</span>
      </p>
      <Link
        href="/play"
        className="rounded-2xl bg-white px-4 py-3 text-center font-bold text-black"
      >
        Jugar de nuevo
      </Link>
    </div>
  );
}
