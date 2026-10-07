"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { sendToGame } from "@/bridge/input";
import { introLine, tableLine } from "@/lib/host";
import { MINIGAMES } from "@/lib/minigames";
import { TEAMS, type TeamId } from "@/lib/teams";
import { episodeTotals, RUN_PLAYLIST, useSession } from "@/store/session";
import { Host } from "./Host";
import { TeamRow } from "./TeamRow";

const BEAT_MS = 700; // ritmo de la cuenta regresiva
const AUTO_CONTINUE_MS = 7000;
const AUTO_RESULTS_MS = 6000;
// Los botones no responden enseguida: quien venía apretando ESPACIO para
// saltar no se saltea la tabla ni arranca la prueba sin leerla.
const BUTTON_DELAY_MS = 1200;

function useReady(ms = BUTTON_DELAY_MS) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return ready;
}

/** Lo que el programa muestra encima del juego entre prueba y prueba. */
export function EpisodeOverlay({ onFinished }: { onFinished: () => void }) {
  const phase = useSession((s) => s.phase);
  if (phase === "intro") return <IntroCard />;
  if (phase === "countdown") return <Countdown />;
  if (phase === "playing") return <GoBanner />;
  return <BetweenTable onFinished={onFinished} />;
}

/**
 * Fondo de los carteles. Los tamaños compactos (`@max-3xl:`) dependen del
 * ancho del cuadro de juego, no de la pantalla: en el celular el cuadro es
 * chico. Si igual no entra, se puede scrollear.
 */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex overflow-y-auto bg-ink/55 p-4 backdrop-blur-[2px] @max-3xl:p-2">
      <div className="m-auto flex w-full justify-center">{children}</div>
    </div>
  );
}

const CARD = "flex w-full max-w-lg flex-col gap-3 rounded-3xl border-4 border-ink bg-background/90 p-6 @max-3xl:gap-1.5 @max-3xl:rounded-2xl @max-3xl:p-3";
const BUTTON = "btn-chunky bg-sun font-display text-ink transition-opacity";

function IntroCard() {
  const results = useSession((s) => s.results);
  const startCountdown = useSession((s) => s.startCountdown);
  const ready = useReady();
  const slot = results.length + 1;
  const minigame = RUN_PLAYLIST[results.length] ?? RUN_PLAYLIST[0];
  const info = MINIGAMES[minigame];
  const line = introLine(minigame, slot, RUN_PLAYLIST.length);

  return (
    <Panel>
      <div className={`${CARD} items-center text-center`} data-testid="intro-card">
        <Host key={line} line={line} />
        <p className="font-display text-lg text-water @max-3xl:text-sm">
          PRUEBA {slot} DE {RUN_PLAYLIST.length}
        </p>
        <h2 className="text-cartoon -rotate-2 text-5xl text-sun @max-3xl:text-2xl">{info.name}</h2>
        <p className="text-foreground/85 @max-3xl:text-xs">{info.rule}</p>
        <ul className="flex flex-wrap justify-center gap-3 @max-3xl:gap-2 @max-3xl:text-xs">
          {info.controls.map((c) => (
            <li key={c.keys} className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-1.5 @max-3xl:py-0.5">
              <kbd className="rounded-lg border-2 border-ink bg-white px-2 font-display text-ink">
                <span className="pointer-coarse:hidden">{c.keys}</span>
                <span className="hidden pointer-coarse:inline">{c.touch}</span>
              </kbd>
              <span className="text-sm text-foreground/80">{c.action}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          autoFocus
          onClick={() => ready && startCountdown()}
          aria-disabled={!ready}
          className={`${BUTTON} mt-1 px-8 py-3 text-2xl @max-3xl:px-6 @max-3xl:py-1.5 @max-3xl:text-lg ${ready ? "" : "opacity-60"}`}
        >
          ¡A JUGAR!
        </button>
      </div>
    </Panel>
  );
}

const COUNT = ["3", "2", "1"] as const;

function BigText({ children, testId }: { children: string; testId: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" data-testid={testId}>
      <span key={children} className="text-cartoon animate-[pop_0.7s_ease-out] text-9xl text-sun @max-3xl:text-7xl">
        {children}
      </span>
    </div>
  );
}

/** 3, 2, 1 con un pip cada uno; el silbato lo toca el juego al arrancar. */
function Countdown() {
  const go = useSession((s) => s.go);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = COUNT.map((_, i) =>
      setTimeout(() => {
        setStep(i);
        sendToGame({ type: "minigame:count" });
      }, i * BEAT_MS),
    );
    timers.push(setTimeout(go, COUNT.length * BEAT_MS));
    return () => timers.forEach(clearTimeout);
  }, [go]);

  return (
    <>
      <BigText testId="countdown">{COUNT[step]}</BigText>
      <Image
        src="/ui/ref-whistle.png"
        alt=""
        width={166}
        height={272}
        className="pointer-events-none absolute bottom-0 right-[4%] z-10 h-[42%] w-auto animate-[pop_0.5s_ease-out] [transform:scaleX(-1)]"
        priority
      />
    </>
  );
}

/** "¡YA!" sobre el juego ya andando: se va solo. */
function GoBanner() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), BEAT_MS);
    return () => clearTimeout(timer);
  }, []);
  return visible ? <BigText testId="go">¡YA!</BigText> : null;
}

function BetweenTable({ onFinished }: { onFinished: () => void }) {
  const team = useSession((s) => s.team);
  const results = useSession((s) => s.results);
  const rivalScores = useSession((s) => s.rivalScores);
  const continueEpisode = useSession((s) => s.continueEpisode);
  const ready = useReady();
  const slot = results.length;
  const isLast = slot >= RUN_PLAYLIST.length;

  const next = isLast ? onFinished : continueEpisode;

  useEffect(() => {
    const timer = setTimeout(next, isLast ? AUTO_RESULTS_MS : AUTO_CONTINUE_MS);
    return () => clearTimeout(timer);
  }, [next, isLast]);

  if (!team) return null;
  const totals = episodeTotals(team, results, rivalScores);
  const lastPoints = (id: string) => (id === team ? results[slot - 1]?.score : rivalScores[id]?.[slot - 1]) ?? 0;
  const ranked = TEAMS.map((t) => t.id).sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0));
  const line = tableLine(team, totals, isLast);

  return (
    <Panel>
      <div className={CARD} data-testid="between-table">
        <Host key={line} line={line} />
        <h2 className="text-cartoon text-center text-3xl text-sun @max-3xl:text-xl">{isLast ? "TABLA FINAL" : `TABLA · PRUEBA ${slot}`}</h2>
        {/* En el cuadro chico, la tabla va en dos columnas para que entre. */}
        <ol className="flex flex-col gap-2 @max-3xl:grid @max-3xl:grid-cols-2 @max-3xl:gap-1.5">
          {ranked.map((id, i) => (
            <TeamRow key={id} rank={i + 1} team={id as TeamId} mine={id === team} gained={lastPoints(id)} total={totals[id] ?? 0} />
          ))}
        </ol>
        <button
          type="button"
          autoFocus
          onClick={() => ready && next()}
          aria-disabled={!ready}
          className={`${BUTTON} self-center px-6 py-2 text-xl @max-3xl:py-1 @max-3xl:text-base ${ready ? "" : "opacity-60"}`}
        >
          {isLast ? "VER RESULTADOS" : "SIGUIENTE PRUEBA"}
        </button>
      </div>
    </Panel>
  );
}
