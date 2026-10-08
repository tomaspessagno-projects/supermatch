"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const CHARS_PER_SECOND = 45;
const MOUTH_MS = 120;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * El presentador del programa: su cabeza con un globo de diálogo. Mientras
 * escribe el texto mueve la boca; si el sistema pide menos movimiento, el
 * texto aparece entero. Para otra frase, montarlo con otra `key`.
 */
export function Host({ line }: { line: string }) {
  const [reduced] = useState(prefersReducedMotion);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const started = performance.now();
    const timer = setInterval(() => {
      const ms = performance.now() - started;
      setElapsed(ms);
      if ((ms / 1000) * CHARS_PER_SECOND >= line.length) clearInterval(timer);
    }, MOUTH_MS / 2);
    return () => clearInterval(timer);
  }, [line, reduced]);

  const shown = reduced ? line.length : Math.min(line.length, Math.floor((elapsed / 1000) * CHARS_PER_SECOND));
  const talking = shown < line.length;
  const mouthOpen = talking && Math.floor(elapsed / MOUTH_MS) % 2 === 1;

  return (
    <div className="flex items-end gap-2 self-stretch" data-testid="host">
      <Image
        src={mouthOpen ? "/ui/host-head-talk.png" : "/ui/host-head.png"}
        alt=""
        width={144}
        height={225}
        className="h-16 w-auto shrink-0 drop-shadow-[0_4px_0_var(--ink)] sm:h-24"
        priority
      />
      <p className="relative mb-2 flex-1 rounded-2xl border-4 border-ink bg-white px-3 py-2 text-left font-display text-sm leading-snug text-ink sm:mb-3 sm:text-base">
        <span className="sr-only">El presentador: {line}</span>
        {/* El texto entero reserva el lugar; encima va lo que ya dijo. */}
        <span className="invisible" aria-hidden>
          {line}
        </span>
        <span className="absolute inset-x-3 top-2" aria-hidden>
          {line.slice(0, shown)}
        </span>
        <span className="absolute -left-3 bottom-3 size-4 rotate-45 border-b-4 border-l-4 border-ink bg-white" aria-hidden />
      </p>
    </div>
  );
}
