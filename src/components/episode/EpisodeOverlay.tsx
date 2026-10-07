"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { sendToGame } from "@/bridge/input";
import type { RunSlot } from "@/bridge/events";
import { introLine, tableLine, teamLine } from "@/lib/host";
import { minigameInfo } from "@/lib/minigames";
import { MEDAL_ICON, MEDAL_LABEL, medalFor, type Participant, standings } from "@/lib/participants";
import { COUNTDOWN_MS, INTRO_LEAD_MS } from "@/online/protocol";
import { EPISODE_LENGTH, PLAYLISTS, useSession } from "@/store/session";
import { Host } from "./Host";
import { TeamRow } from "./TeamRow";

const BEAT_MS = COUNTDOWN_MS / 3; // ritmo de la cuenta regresiva
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

/** La hora, actualizada seguido: para los "arranca en…" de las salas. */
function useNow(ms = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

/** Online: corre `action` cuando llega la hora `at` (o enseguida, si ya pasó). */
function useAt(at: number | null, action: () => void) {
  useEffect(() => {
    if (at === null) return;
    const timer = setTimeout(action, Math.max(0, at - Date.now()));
    return () => clearTimeout(timer);
  }, [at, action]);
}

/** Hora del silbato de la prueba `slot`, si la sala ya la mandó. */
function useStartsAt(slot: number): number | null {
  return useSession((s) => (s.schedule?.slot === slot ? s.schedule.at : null));
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
      <div className="m-auto flex w-full animate-[card-in_0.45s_cubic-bezier(0.2,1.2,0.4,1)_both] justify-center motion-reduce:animate-none">
        {children}
      </div>
    </div>
  );
}

const CARD = "flex w-full max-w-lg flex-col gap-3 rounded-3xl border-4 border-ink bg-background/90 p-6 @max-3xl:gap-1.5 @max-3xl:rounded-2xl @max-3xl:p-3";
const BUTTON = "btn-chunky bg-sun font-display text-ink transition-opacity";

function IntroCard() {
  const results = useSession((s) => s.results);
  const online = useSession((s) => s.mode === "online");
  const participants = useSession((s) => s.participants);
  const kind = useSession((s) => s.kind);
  const startCountdown = useSession((s) => s.startCountdown);
  const ready = useReady();
  const slot = results.length + 1;
  const playlist = PLAYLISTS[kind];
  const minigame = playlist[results.length] ?? playlist[0];
  const info = minigameInfo(minigame, slot);
  const line = introLine(minigame, slot, EPISODE_LENGTH);
  // Online la cuenta arranca sola, a la misma hora en todas las compus.
  const startsAt = useStartsAt(slot);
  useAt(online && startsAt !== null ? startsAt - COUNTDOWN_MS : null, startCountdown);

  return (
    <Panel>
      <div className={`${CARD} items-center text-center`} data-testid="intro-card">
        <Host key={line} line={line} />
        <p className="font-display text-lg text-water @max-3xl:text-sm">
          {kind === "coop" ? "EN EQUIPO · " : ""}PRUEBA {slot} DE {EPISODE_LENGTH}
        </p>
        <h2 className="text-cartoon -rotate-2 text-5xl text-sun @max-3xl:text-2xl">{info.name}</h2>
        {info.round && <p className="font-display text-xl text-rubber @max-3xl:text-sm" data-testid="round-title">{info.round}</p>}
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
        {online ? (
          <>
            {slot === 1 && <Lineup names={participants.map((p) => ({ id: p.id, name: p.name, team: p.team, me: p.kind === "me" }))} />}
            <StartsIn at={startsAt === null ? null : startsAt - COUNTDOWN_MS} />
          </>
        ) : (
          <button
            type="button"
            autoFocus
            onClick={() => ready && startCountdown()}
            aria-disabled={!ready}
            className={`${BUTTON} mt-1 px-8 py-3 text-2xl @max-3xl:px-6 @max-3xl:py-1.5 @max-3xl:text-lg ${ready ? "" : "opacity-60"}`}
          >
            ¡A JUGAR!
          </button>
        )}
      </div>
    </Panel>
  );
}

/** Los 4 de la carrera, con su color. */
function Lineup({ names }: { names: { id: string; name: string; team: string; me: boolean }[] }) {
  return (
    <ul className="flex flex-wrap justify-center gap-2 @max-3xl:gap-1" data-testid="lineup">
      {names.map((p) => (
        <li key={p.id} className={`flex items-center gap-1.5 rounded-full bg-white/10 py-0.5 pl-0.5 pr-3 text-sm @max-3xl:text-xs ${p.me ? "ring-2 ring-sun" : ""}`}>
          <Image src={`/ui/badge-${p.team}.png`} alt="" width={186} height={186} className="size-6 @max-3xl:size-5" />
          <span className="font-display text-white">{p.name}</span>
        </li>
      ))}
    </ul>
  );
}

/** "Arranca en 4": la cuenta la marca el anfitrión. */
function StartsIn({ at, label = "ARRANCA EN" }: { at: number | null; label?: string }) {
  const now = useNow();
  if (at === null) {
    return <p className="animate-pulse font-display text-lg text-foreground/80 @max-3xl:text-sm">Esperando a los demás…</p>;
  }
  const seconds = Math.max(0, Math.ceil((at - now) / 1000));
  return (
    <p className="font-display text-2xl text-sun @max-3xl:text-lg" data-testid="starts-in">
      {label} {seconds}
    </p>
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

/**
 * 3, 2, 1 con un pip cada uno; el silbato lo toca el juego al arrancar.
 * Online va atada a la hora del silbato de la sala: si esta compu se atrasó
 * (pestaña en segundo plano, carga lenta), se saltea lo que ya pasó.
 */
function Countdown() {
  const go = useSession((s) => s.go);
  const goAt = useSession((s) => (s.mode === "online" && s.schedule?.slot === s.results.length + 1 ? s.schedule.at : null));
  const [step, setStep] = useState(0);

  useEffect(() => {
    const now = Date.now();
    const start = goAt === null ? now : goAt - COUNTDOWN_MS;
    const timers = COUNT.map((_, i) => {
      const delay = start + i * BEAT_MS - now;
      return delay < -BEAT_MS / 2
        ? setTimeout(() => setStep(i), 0) // ya pasó: sin pip
        : setTimeout(() => {
            setStep(i);
            sendToGame({ type: "minigame:count" });
          }, Math.max(0, delay));
    });
    timers.push(setTimeout(go, Math.max(0, start + COUNTDOWN_MS - now)));
    return () => timers.forEach(clearTimeout);
  }, [go, goAt]);

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
  const online = useSession((s) => s.mode === "online");
  const kind = useSession((s) => s.kind);
  const participants = useSession((s) => s.participants);
  const scores = useSession((s) => s.scores);
  const results = useSession((s) => s.results);
  const continueEpisode = useSession((s) => s.continueEpisode);
  const ready = useReady();
  const slot = results.length as RunSlot;
  const isLast = slot >= EPISODE_LENGTH;
  const next = isLast ? onFinished : continueEpisode;

  // Online: las personas que todavía están corriendo esta prueba.
  const waiting = online
    ? participants.filter((p) => p.kind === "remote" && !p.left && scores[p.id]?.[slot] === undefined).map((p) => p.id)
    : [];
  const done = waiting.length === 0;
  const nextStartsAt = useStartsAt(slot + 1);

  // Solo: se sigue solo pasado un rato. Online: la prueba siguiente la marca
  // la sala; la tabla final, cuando terminaron todos.
  const autoNext = online ? !isLast || !done : false;
  useEffect(() => {
    if (autoNext) return;
    const timer = setTimeout(next, isLast ? AUTO_RESULTS_MS : AUTO_CONTINUE_MS);
    return () => clearTimeout(timer);
  }, [next, isLast, autoNext]);
  useAt(online && !isLast && nextStartsAt !== null ? nextStartsAt - INTRO_LEAD_MS : null, continueEpisode);

  const table = standings(participants, scores, slot);
  // En equipo, todos tienen el mismo puntaje: el del equipo.
  const me = participants.find((p) => p.kind === "me");
  const rounds = Array.from({ length: slot }, (_, i) => scores[me?.id ?? ""]?.[(i + 1) as RunSlot] ?? 0);
  const total = rounds.reduce((a, b) => a + b, 0);
  const line = !done
    ? "¡Todavía hay gente en carrera! Esperamos a que lleguen..."
    : kind === "coop"
      ? teamLine(rounds[slot - 1] ?? 0, total, isLast)
      : tableLine(table, isLast);
  const showButton = !online || (isLast && done);
  const title = kind === "coop" ? (isLast ? "RESULTADO DEL EQUIPO" : `RONDA ${slot}`) : isLast ? "TABLA FINAL" : `TABLA · PRUEBA ${slot}`;

  return (
    <Panel>
      <div className={CARD} data-testid="between-table">
        <Host key={line} line={line} />
        <h2 className="text-cartoon text-center text-3xl text-sun @max-3xl:text-xl">{title}</h2>
        {kind === "coop" ? (
          <TeamCard participants={participants} rounds={rounds} total={total} />
        ) : (
          // En el cuadro chico, la tabla va en dos columnas para que entre.
          <ol className="flex flex-col gap-2 @max-3xl:grid @max-3xl:grid-cols-2 @max-3xl:gap-1.5">
            {table.map((row, i) => (
              <TeamRow
                key={row.participant.id}
                rank={i + 1}
                row={row}
                showGained
                online={online}
                waiting={waiting.includes(row.participant.id)}
              />
            ))}
          </ol>
        )}
        {showButton ? (
          <button
            type="button"
            autoFocus
            onClick={() => ready && next()}
            aria-disabled={!ready}
            className={`${BUTTON} self-center px-6 py-2 text-xl @max-3xl:py-1 @max-3xl:text-base ${ready ? "" : "opacity-60"}`}
          >
            {isLast ? "VER RESULTADOS" : kind === "coop" ? "SIGUIENTE RONDA" : "SIGUIENTE PRUEBA"}
          </button>
        ) : (
          <div className="self-center">
            <StartsIn at={nextStartsAt === null ? null : nextStartsAt - COUNTDOWN_MS} label="PRÓXIMA PRUEBA EN" />
          </div>
        )}
      </div>
    </Panel>
  );
}

/** En equipo: los 4, la medalla de la ronda y cómo vienen las tres. */
function TeamCard({ participants, rounds, total }: { participants: readonly Participant[]; rounds: readonly number[]; total: number }) {
  const last = rounds[rounds.length - 1] ?? 0;
  const medal = medalFor(last);
  return (
    <div className="flex flex-col items-center gap-3 @max-3xl:gap-1.5" data-testid="team-card">
      <ul className="flex flex-wrap justify-center gap-2 @max-3xl:gap-1">
        {participants.map((p) => (
          <li key={p.id} className={`flex items-center gap-1.5 rounded-full bg-white/10 py-0.5 pl-0.5 pr-3 text-sm @max-3xl:text-xs ${p.kind === "me" ? "ring-2 ring-sun" : ""} ${p.left ? "opacity-50" : ""}`}>
            <Image src={`/ui/badge-${p.team}.png`} alt="" width={186} height={186} className="size-6 @max-3xl:size-5" />
            <span className="font-display text-white">{p.kind === "me" ? "VOS" : p.name}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-4 @max-3xl:gap-2">
        <span className="animate-[pop_0.6s_ease-out] text-6xl @max-3xl:text-3xl" aria-hidden>
          {medal ? MEDAL_ICON[medal] : "💦"}
        </span>
        <div className="text-left">
          <p className="font-display text-water @max-3xl:text-xs">{medal ? `MEDALLA DE ${MEDAL_LABEL[medal]}` : "SIN MEDALLA"}</p>
          <p className="text-cartoon text-5xl text-sun tabular-nums @max-3xl:text-2xl" data-testid="round-score">
            <CountUp to={last} />
          </p>
        </div>
      </div>
      <ol className="flex gap-2 @max-3xl:gap-1">
        {Array.from({ length: EPISODE_LENGTH }, (_, i) => {
          const score = rounds[i];
          const m = score === undefined ? null : medalFor(score);
          return (
            <li key={i} className={`flex min-w-20 flex-col items-center rounded-2xl px-3 py-1 @max-3xl:min-w-14 @max-3xl:px-1.5 @max-3xl:py-0.5 ${score === undefined ? "bg-white/5 text-foreground/50" : "bg-white/10"}`}>
              <span className="font-display text-xs">RONDA {i + 1}</span>
              <span className="font-display text-lg tabular-nums text-white @max-3xl:text-sm">
                {score === undefined ? "—" : `${m ? MEDAL_ICON[m] : ""} ${score}`}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="font-display text-lg text-foreground/80 @max-3xl:text-sm">
        TOTAL DEL EQUIPO <span className="text-sun tabular-nums">{total}</span>
      </p>
    </div>
  );
}

/** Un número que sube de 0 hasta `to` (la tabla se siente viva). */
function CountUp({ to, ms = 900 }: { to: number; ms?: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(Math.round(to * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, ms]);
  return <>{value}</>;
}
