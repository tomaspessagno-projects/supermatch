"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TeamPicker } from "@/components/TeamPicker";
import { getTeam } from "@/lib/teams";
import type { Member } from "@/online/channel";
import { MATCH_GIVE_UP_MS, MAX_PLAYERS, normalizeCode } from "@/online/protocol";
import {
  backToLobby,
  createRoom,
  isLobbyHost,
  joinRoom,
  leaveRoom,
  lobbyMembers,
  quickMatch,
  roomMode,
  setRoomMode,
  startEpisode,
  useRoom,
} from "@/online/room";
import { useSession } from "@/store/session";

const CARD = "flex w-full max-w-lg flex-col gap-4 rounded-3xl border-4 border-ink bg-ink/60 p-6";
const BUTTON = "btn-chunky px-6 py-3 font-display text-2xl";

/**
 * Salas online. Por la dirección: `?modo=rapida` busca rivales, `?sala=CÓDIGO`
 * entra a la sala de un amigo; sin nada, el menú para crear o entrar.
 */
export function OnlineLobby() {
  const router = useRouter();
  const team = useSession((s) => s.team);
  const profileStatus = useSession((s) => s.profileStatus);
  const loadProfile = useSession((s) => s.loadProfile);
  const status = useRoom((s) => s.status);
  const episode = useRoom((s) => s.episode);
  const startedWith = useRef(episode);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  // Lo que pide la dirección. Corre también cada vez que Next vuelve a
  // mostrar la ruta (la oculta en vez de desmontarla).
  useEffect(() => {
    if (!team) return;
    startedWith.current = useRoom.getState().episode;
    const params = new URLSearchParams(window.location.search);
    const code = normalizeCode(params.get("sala") ?? "");
    const room = useRoom.getState();
    const inRoom = room.status === "lobby" || room.status === "playing";
    if (code && room.code === code && inRoom) backToLobby();
    else if (code) void joinRoom(code);
    else if (params.get("modo") === "rapida") void quickMatch(params.get("tipo") === "equipo" ? "coop" : "race");
    else if (room.status === "playing") backToLobby();
  }, [team]);

  // Arrancó un episodio: al juego.
  useEffect(() => {
    if (episode !== startedWith.current && status === "playing") router.push("/play");
  }, [episode, status, router]);

  if (!team) {
    return (
      <div className={CARD}>
        <h2 className="text-cartoon text-center text-3xl text-sun">ELEGÍ TU EQUIPO</h2>
        <p className="text-center text-foreground/80">Antes de entrar, elegí tu color. Es para siempre.</p>
        {profileStatus === "ready" ? <TeamPicker /> : <p className="animate-pulse text-center">Cargando…</p>}
      </div>
    );
  }

  switch (status) {
    case "idle":
      return <Menu />;
    case "matching":
      return <Searching />;
    case "connecting":
      return <Message title="ENTRANDO A LA SALA…" pulse />;
    case "lobby":
      return <Lobby />;
    case "playing":
      return <Message title="¡ARRANCA!" pulse />;
    case "error":
      return <ErrorCard />;
  }
}

function Menu() {
  const [code, setCode] = useState("");
  const kind = useSession((s) => s.kind);
  const valid = normalizeCode(code).length === 5;
  return (
    <div className={CARD} data-testid="online-menu">
      <button type="button" onClick={() => void quickMatch(kind)} className={`${BUTTON} bg-water text-ink`}>
        {kind === "coop" ? "EQUIPO RÁPIDO" : "CARRERA RÁPIDA"}
      </button>
      <button type="button" onClick={() => void createRoom()} className={`${BUTTON} bg-rubber text-ink`} data-testid="create-room">
        CREAR SALA
      </button>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) void joinRoom(code);
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
          placeholder="CÓDIGO"
          aria-label="Código de sala"
          className="min-w-0 flex-1 rounded-2xl border-4 border-ink bg-white px-4 font-display text-2xl tracking-[0.3em] text-ink placeholder:text-ink/30"
          data-testid="code-input"
        />
        <button type="submit" disabled={!valid} className="btn-chunky bg-sun px-5 font-display text-xl text-ink disabled:opacity-40">
          ENTRAR
        </button>
      </form>
      <Link href="/" className="text-center text-foreground/70 underline-offset-4 hover:underline">
        ← Volver
      </Link>
    </div>
  );
}

function Searching() {
  const router = useRouter();
  const searchingSince = useRoom((s) => s.searchingSince);
  const coop = useRoom((s) => s.mode === "coop");
  const others = useRoom((s) => s.members.filter((m) => m.id !== s.me?.id && !m.busy).length);
  const [now, setNow] = useState(() => Date.now());
  const since = searchingSince ?? now;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  const alone = now - since > MATCH_GIVE_UP_MS && others === 0;

  return (
    <div className={`${CARD} items-center text-center`} data-testid="searching">
      <Image src="/ui/host-34.png" alt="" width={220} height={300} className="h-36 w-auto animate-wobble" />
      <h2 className="text-cartoon text-3xl text-sun">{coop ? "BUSCANDO EQUIPO…" : "BUSCANDO RIVALES…"}</h2>
      <p className="text-foreground/80">
        {others > 0 ? `¡Hay ${others + 1} en la fila! Armando la carrera…` : "Esperando que aparezca alguien con ganas de mojarse."}
      </p>
      <p className="font-display text-lg tabular-nums text-water">{Math.floor((now - since) / 1000)} s</p>
      {alone && (
        <div className="flex flex-col gap-2" data-testid="alone">
          <p className="text-foreground/80">Nadie a la vista por ahora. ¿Jugás contra la compu mientras tanto?</p>
          <button
            type="button"
            onClick={async () => {
              await leaveRoom();
              router.push("/play");
            }}
            className={`${BUTTON} bg-sun text-ink`}
          >
            JUGAR CONTRA LA COMPU
          </button>
        </div>
      )}
      <button type="button" onClick={() => void leaveRoom()} className="text-foreground/70 underline-offset-4 hover:underline">
        Cancelar
      </button>
    </div>
  );
}

function Lobby() {
  const kind = useRoom((s) => s.kind);
  const code = useRoom((s) => s.code);
  const me = useRoom((s) => s.me);
  const members = useRoom((s) => s.members);
  const waiting = lobbyMembers(members);
  const playing = members.filter((m) => m.busy && m.id !== me?.id);
  const host = isLobbyHost(members, me);
  const full = !!me && !waiting.some((m) => m.id === me.id);
  const hostName = waiting[0]?.nickname;
  const mode = useRoom(roomMode);

  return (
    <div className={CARD} data-testid="lobby">
      {kind === "friends" ? (
        <RoomCode code={code ?? ""} />
      ) : (
        <h2 className="text-cartoon text-center text-3xl text-sun">{mode === "coop" ? "¡EQUIPO ARMADO!" : "¡RIVALES ENCONTRADOS!"}</h2>
      )}
      {kind === "friends" && <ModeChoice mode={mode} host={host} />}
      <ol className="flex flex-col gap-2" data-testid="lobby-members">
        {Array.from({ length: MAX_PLAYERS }, (_, i) => (
          <Seat key={waiting[i]?.id ?? `free-${i}`} member={waiting[i]} me={waiting[i]?.id === me?.id} host={i === 0} />
        ))}
      </ol>
      {playing.length > 0 && (
        <p className="text-center text-sm text-foreground/70">
          Todavía en carrera o viendo resultados: {playing.map((m) => m.nickname).join(", ")}
        </p>
      )}
      {full ? (
        <p className="text-center font-display text-lg text-rubber">La sala está llena (son {MAX_PLAYERS}).</p>
      ) : kind === "quick" ? (
        <p className="animate-pulse text-center font-display text-xl text-water">Arrancando…</p>
      ) : host ? (
        <button type="button" onClick={startEpisode} className={`${BUTTON} bg-sun text-ink`} data-testid="start-episode">
          {waiting.length > 1 ? "¡EMPEZAR!" : "EMPEZAR CON LA COMPU"}
        </button>
      ) : (
        <p className="animate-pulse text-center font-display text-lg text-foreground/80">Esperando que {hostName} arranque…</p>
      )}
      <button type="button" onClick={() => void leaveRoom()} className="text-foreground/70 underline-offset-4 hover:underline">
        Salir de la sala
      </button>
    </div>
  );
}

/** Carrera o en equipo: lo elige el anfitrión, los demás lo ven. */
function ModeChoice({ mode, host }: { mode: "race" | "coop"; host: boolean }) {
  const options = [
    ["race", "CARRERA", "Puente y Tronco: cada uno contra todos"],
    ["coop", "EN EQUIPO", "El Colchón: los 4 juntos"],
  ] as const;
  if (!host) {
    const [, label, detail] = options.find(([value]) => value === mode)!;
    return (
      <p className="text-center text-foreground/80" data-testid="room-mode">
        Van a jugar: <strong className="font-display text-sun">{label}</strong> · {detail}
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl border-4 border-ink bg-ink/60 p-1" role="radiogroup" aria-label="Qué juegan" data-testid="room-mode">
      {options.map(([value, label, detail]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          data-testid={`room-mode-${value}`}
          onClick={() => setRoomMode(value)}
          className={`flex flex-col items-center rounded-xl px-2 py-1.5 transition ${mode === value ? "bg-sun text-ink" : "text-foreground/70 hover:bg-white/10"}`}
        >
          <span className="font-display text-lg">{label}</span>
          <span className="text-center text-xs opacity-80">{detail}</span>
        </button>
      ))}
    </div>
  );
}

function Seat({ member, me, host }: { member?: Member; me: boolean; host: boolean }) {
  if (!member) {
    return (
      <li className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-white/15 px-3 py-2 text-foreground/50">
        <span className="grid size-9 place-items-center rounded-full bg-white/5 font-display">?</span>
        Libre: si nadie viene, corre un bot
      </li>
    );
  }
  return (
    <li className={`flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2 ${me ? "ring-4 ring-sun" : ""}`}>
      <Image src={`/ui/badge-${member.team}.png`} alt="" width={186} height={186} className="size-9" />
      <span className="flex-1 truncate font-display text-white">
        {member.nickname}
        {me && <span className="ml-2 text-xs text-sun">(VOS)</span>}
      </span>
      <span className="text-xs text-foreground/60">{host ? "ANFITRIÓN" : getTeam(member.team).name}</span>
    </li>
  );
}

function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${window.location.origin}/online?sala=${code}`;
    try {
      if (navigator.share) await navigator.share({ title: "Supermatch", text: `¡Vení a mojarte! Sala ${code}`, url });
      else await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // cancelado o sin permiso: queda el código a la vista
    }
  }
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="font-display text-foreground/80">CÓDIGO DE LA SALA</p>
      <p className="text-cartoon text-6xl tracking-[0.2em] text-sun" data-testid="room-code">
        {code}
      </p>
      <button type="button" onClick={share} className="btn-chunky bg-white/10 px-4 py-2 font-display text-white">
        {copied ? "¡LINK COPIADO!" : "COMPARTIR LINK"}
      </button>
    </div>
  );
}

function Message({ title, pulse = false }: { title: string; pulse?: boolean }) {
  return (
    <div className={`${CARD} items-center`}>
      <h2 className={`text-cartoon text-3xl text-sun ${pulse ? "animate-pulse" : ""}`}>{title}</h2>
    </div>
  );
}

function ErrorCard() {
  const error = useRoom((s) => s.error);
  return (
    <div className={`${CARD} items-center text-center`} data-testid="room-error">
      <h2 className="text-cartoon text-3xl text-rubber">¡UPS!</h2>
      <p className="text-foreground/80">{error ?? "Algo falló con la conexión."}</p>
      <button type="button" onClick={() => void leaveRoom()} className={`${BUTTON} bg-sun text-ink`}>
        VOLVER
      </button>
    </div>
  );
}
