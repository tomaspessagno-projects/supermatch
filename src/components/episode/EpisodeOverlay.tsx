"use client";

import { useEffect, useState } from "react";
import { sendToGame } from "@/bridge/input";
import { MINIGAMES } from "@/lib/minigames";
import { TEAMS, type TeamId } from "@/lib/teams";
import { episodeTotals, RUN_PLAYLIST, useSession } from "@/store/session";
import { TeamRow } from "./TeamRow";

const BEAT_MS = 700; // ritmo de la cuenta regresiva
const AUTO_CONTINUE_MS = 7000;
const AUTO_RESULTS_MS = 6000;

/** Lo que el programa muestra encima del juego entre prueba y prueba. */
export function EpisodeOverlay({ onFinished }: { onFinished: () => void }) {
  const phase = useSession((s) => s.phase);
  if (phase === "intro") return <IntroCard />;
  if (phase === "countdown") return <Countdown />;
  if (phase === "playing") return <GoBanner />;
  return <BetweenTable onFinished={onFinished} />;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-[2px]">
      {children}
    </div>
  );
}

function IntroCard() {
  const results = useSession((s) => s.results);
  const startCountdown = useSession((s) => s.startCountdown);
  const slot = results.length + 1;
  const info = MINIGAMES[RUN_PLAYLIST[results.length] ?? RUN_PLAYLIST[0]];

  return (
    <Panel>
      <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-3xl border-4 border-ink bg-background/90 p-6 text-center" data-testid="intro-card">
        <p className="font-display text-lg text-water">
          PRUEBA {slot} DE {RUN_PLAYLIST.length}
        </p>
        <h2 className="text-cartoon -rotate-2 text-4xl text-sun sm:text-5xl">{info.name}</h2>
        <p className="text-foreground/85">{info.rule}</p>
        <ul className="flex flex-wrap justify-center gap-3">
          {info.controls.map((c) => (
            <li key={c.keys} className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-1.5">
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
          onClick={startCountdown}
          className="btn-chunky mt-2 bg-sun px-8 py-3 font-display text-2xl text-ink"
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
      <span key={children} className="text-cartoon animate-[pop_0.7s_ease-out] text-8xl text-sun sm:text-9xl">
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

  return <BigText testId="countdown">{COUNT[step]}</BigText>;
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

  return (
    <Panel>
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-3xl border-4 border-ink bg-background/90 p-6" data-testid="between-table">
        <h2 className="text-cartoon text-center text-3xl text-sun">{isLast ? "TABLA FINAL" : `TABLA · PRUEBA ${slot}`}</h2>
        <ol className="flex flex-col gap-2">
          {ranked.map((id, i) => (
            <TeamRow key={id} rank={i + 1} team={id as TeamId} mine={id === team} gained={lastPoints(id)} total={totals[id] ?? 0} />
          ))}
        </ol>
        <button type="button" autoFocus onClick={next} className="btn-chunky self-center bg-sun px-6 py-2 font-display text-xl text-ink">
          {isLast ? "VER RESULTADOS" : "SIGUIENTE PRUEBA"}
        </button>
      </div>
    </Panel>
  );
}
