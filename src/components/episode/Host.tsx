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
    // En el cuadro chico deja lugar a la derecha para el botón de silencio.
    <div className="flex items-end gap-2 self-stretch @max-3xl:pr-9" data-testid="host">
      <Image
        src={mouthOpen ? "/ui/host-head-talk.png" : "/ui/host-head.png"}
        alt=""
        width={144}
        height={225}
        className="h-24 w-auto shrink-0 drop-shadow-[0_4px_0_var(--ink)] @max-3xl:h-12"
        priority
      />
      <p className="relative mb-3 flex-1 rounded-2xl border-4 border-ink bg-white px-3 py-2 text-left font-display text-base leading-snug text-ink @max-3xl:mb-1 @max-3xl:rounded-xl @max-3xl:border-2 @max-3xl:px-2 @max-3xl:py-1 @max-3xl:text-[11px]">
        <span className="sr-only">El presentador: {line}</span>
        {/* El texto entero reserva el lugar; encima va lo que ya dijo. */}
        <span className="invisible" aria-hidden>
          {line}
        </span>
        <span className="absolute inset-x-3 top-2 @max-3xl:inset-x-2 @max-3xl:top-1" aria-hidden>
          {line.slice(0, shown)}
        </span>
        <span className="absolute -left-3 bottom-3 size-4 rotate-45 border-b-4 border-l-4 border-ink bg-white" aria-hidden />
      </p>
    </div>
  );
}
