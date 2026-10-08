"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Host } from "@/components/Host";
import { getTeam } from "@/lib/teams";
import { useSession } from "@/store/session";
import { liveEventAt, nextEventAt } from "../sim/events";
import { useTower } from "../store";
import { input, listenKeyboard } from "../view/input";
import { play, setMuted, stopAudio, unlockAudio } from "../view/sfx";
import { CollectionPanel } from "./CollectionPanel";
import { Hud, type LiveState } from "./Hud";
import { RunCard } from "./RunCard";
import { Shop } from "./Shop";
import { TouchPad } from "./TouchPad";

// three.js solo en el navegador.
const TowerCanvas = dynamic(() => import("../view/TowerCanvas").then((m) => m.TowerCanvas), {
  ssr: false,
  loading: () => <p className="absolute inset-0 grid place-items-center font-display text-2xl text-foreground/70">Armando el estudio…</p>,
});

const MUTED_KEY = "supermatch:muted";

export function TowerGame() {
  const router = useRouter();
  const team = useSession((s) => s.team);
  const profileStatus = useSession((s) => s.profileStatus);
  const loadProfile = useSession((s) => s.loadProfile);
  const panel = useTower((s) => s.panel);
  const announcement = useTower((s) => s.announcement);
  const showingRun = useTower((s) => s.lastRun !== null);
  const [muted, setMutedState] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(MUTED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [hiddenId, setHiddenId] = useState(0);
  const [live, setLive] = useState<LiveState | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (profileStatus === "ready" && !team) router.replace("/");
  }, [profileStatus, team, router]);

  useEffect(() => {
    const stop = listenKeyboard();
    const unlock = () => unlockAudio();
    // Escape cierra el kiosco o la colección.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") useTower.getState().openPanel(null);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("keydown", onKey);
    return () => {
      stop();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("keydown", onKey);
      stopAudio();
    };
  }, []);

  useEffect(() => setMuted(muted), [muted]);

  // Eventos en vivo: el reloj dice cuál está pasando (igual para todos).
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const current = liveEventAt(now);
      const next = nextEventAt(now);
      setLive({ event: current?.event ?? null, endsAt: current?.endsAt ?? 0, next: next.event, startsAt: next.startsAt, now });
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  const eventId = live?.event?.id ?? null;
  useEffect(() => {
    if (!eventId || !live?.event) return;
    useTower.getState().announce(`¡EVENTO EN VIVO! ${live.event.name} ${live.event.detail}. ¡Aprovechalo!`);
    play("whistle", { volume: 0.6 });
    // Solo cuando cambia el evento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // El presentador habla unos segundos y se va.
  useEffect(() => {
    if (!announcement) return;
    const timer = setTimeout(() => setHiddenId(announcement.id), 4800);
    return () => clearTimeout(timer);
  }, [announcement]);
  // Mientras está la tarjeta del intento, el presentador espera.
  const line = announcement && announcement.id !== hiddenId && !showingRun ? announcement : null;

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    try {
      window.localStorage.setItem(MUTED_KEY, next ? "1" : "0");
    } catch {
      // sin almacenamiento
    }
  };

  if (!team) return null;

  return (
    <main
      className="relative h-dvh w-full touch-none select-none overflow-hidden bg-background"
      // Arrastrar gira la cámara alrededor del personaje.
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).tagName === "CANVAS") drag.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        input.yaw = Math.max(-1.3, Math.min(1.3, input.yaw - (e.clientX - drag.current.x) * 0.006));
        input.pitch = Math.max(-0.4, Math.min(0.6, input.pitch + (e.clientY - drag.current.y) * 0.003));
        drag.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      data-testid="tower-game"
    >
      <div className="absolute inset-0">
        <TowerCanvas teamColor={getTeam(team).color} />
      </div>
      <Hud muted={muted} onMute={toggleMute} live={live} />
      {line && (
        <div key={line.id} className="pointer-events-none absolute left-3 top-24 z-10 w-[min(92vw,520px)] animate-[card-in_0.4s_ease-out_both] sm:left-4">
          <Host line={line.text} />
        </div>
      )}
      <RunCard />
      <TouchPad />
      {(panel === "shop" || panel === "pets" || panel === "season") && <Shop />}
      {panel === "collection" && <CollectionPanel />}
      <Link href="/" className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 font-display text-sm text-foreground/60 underline-offset-4 hover:underline pointer-coarse:hidden">
        ← Salir
      </Link>
    </main>
  );
}
