import { create } from "zustand";
import type { MinigameResult, NetLink, RivalResult, RunSlot } from "@/bridge/events";
import { randomNickname } from "@/lib/nicknames";
import type { EpisodeKind } from "@/lib/participants";
import { EPISODE_LENGTH, useSession } from "@/store/session";
import { type Member, openChannel, type RoomChannel, type Transport } from "./channel";
import { createInputRecorder, createRemoteInputs } from "./inputs";
import {
  buildParticipants,
  FIRST_START_IN_MS,
  hostOf,
  INPUT_FLUSH_MS,
  MAX_PLAYERS,
  type NetMessage,
  NEXT_START_IN_MS,
  normalizeCode,
  pickMatch,
  QUICK_START_WAIT_MS,
  roomCode,
  SLOT_DEADLINE_MS,
  slotDone,
} from "./protocol";

/**
 * La sala online: buscar rivales, armar una sala con amigos y llevar el
 * episodio en vivo. El anfitrión (el que está hace más tiempo) arranca y
 * marca la hora de cada prueba; cada compu juega lo suyo, manda sus teclas y
 * su resultado, y re-simula a los demás con las teclas que le llegan.
 */

export type RoomKind = "quick" | "friends";
export type RoomStatus = "idle" | "matching" | "connecting" | "lobby" | "playing" | "error";

type RoomState = {
  status: RoomStatus;
  kind: RoomKind | null;
  code: string | null;
  me: Member | null;
  members: Member[];
  /** Cuándo empezó la búsqueda de rivales (para los carteles de espera). */
  searchingSince: number | null;
  error: string | null;
  /** Sube con cada episodio que arranca: la UI va al juego cuando cambia. */
  episode: number;
  /** Carrera o en equipo. En una sala de amigos lo elige el anfitrión. */
  mode: EpisodeKind;
};

export const useRoom = create<RoomState>()(() => ({
  status: "idle",
  kind: null,
  code: null,
  me: null,
  members: [],
  searchingSince: null,
  error: null,
  episode: 0,
  mode: "race",
}));

const LOCAL_KEY = "supermatch:red";
const ID_KEY = "supermatch:net-id";
const NICK_KEY = "supermatch:net-nick";

/** `?red=local`: salas entre pestañas del mismo navegador, sin servidor (para probar). */
function transport(): Transport {
  try {
    const param = new URLSearchParams(window.location.search).get("red");
    if (param) window.sessionStorage.setItem(LOCAL_KEY, param);
    return window.sessionStorage.getItem(LOCAL_KEY) === "local" ? "local" : "supabase";
  } catch {
    return "supabase";
  }
}

/** Uno por pestaña: dos pestañas son dos jugadores. */
function tabValue(key: string, make: () => string): string {
  try {
    const saved = window.sessionStorage.getItem(key);
    if (saved) return saved;
    const value = make();
    window.sessionStorage.setItem(key, value);
    return value;
  } catch {
    return make();
  }
}

function identity(): Member | null {
  const { team, nickname } = useSession.getState();
  if (!team) return null;
  return {
    id: tabValue(ID_KEY, () => crypto.randomUUID().slice(0, 12)),
    nickname: nickname ?? tabValue(NICK_KEY, randomNickname),
    team,
    joinedAt: Date.now(),
    mode: useSession.getState().kind,
  };
}

// --- Estado de la conexión (fuera del store: no es para pintar) ------------

let channel: RoomChannel | null = null;
let matchChannel: RoomChannel | null = null;
let timers: ReturnType<typeof setInterval>[] = [];
let detach: (() => void)[] = [];

/** El episodio en curso. */
let players: Member[] = [];
let scheduled: RunSlot | 0 = 0;
let slotStart: Partial<Record<RunSlot, number>> = {};
let recorders = new Map<RunSlot, ReturnType<typeof createInputRecorder>>();
let remotes = new Map<string, ReturnType<typeof createRemoteInputs>>();
/** Carrera rápida: a quiénes se espera en la sala nueva y desde cuándo. */
let expected: { ids: string[]; since: number } | null = null;

const set = useRoom.setState;
const get = useRoom.getState;
const session = useSession.getState;

function every(ms: number, action: () => void) {
  timers.push(setInterval(action, ms));
}

async function disconnect() {
  timers.forEach(clearInterval);
  timers = [];
  detach.forEach((off) => off());
  detach = [];
  const closing = [channel, matchChannel];
  channel = null;
  matchChannel = null;
  expected = null;
  await Promise.all(closing.map((c) => c?.leave().catch(() => {})));
}

function fail(error: unknown) {
  void disconnect();
  set({ status: "error", error: error instanceof Error ? error.message : String(error) });
}

/** Salir de la sala o de la búsqueda; lo próximo que se juegue es solo. */
export async function leaveRoom() {
  await disconnect();
  set({ status: "idle", kind: null, code: null, me: null, members: [], searchingSince: null, error: null });
  if (session().mode === "online") session().playSolo();
}

// --- Buscar rivales --------------------------------------------------------

export async function quickMatch(mode: EpisodeKind = "race") {
  await disconnect();
  const me = identity();
  if (!me) return;
  set({ status: "matching", kind: "quick", mode, code: null, me, members: [me], searchingSince: Date.now(), error: null });
  // Una fila por tipo: los que buscan carrera no se cruzan con los que buscan equipo.
  const queue = openChannel(mode === "coop" ? "matchmaking:coop" : "matchmaking", transport());
  matchChannel = queue;
  detach.push(
    queue.onMembers((members) => set({ members })),
    queue.onMessage((message) => {
      if (message.t === "match" && message.ids.includes(me.id) && matchChannel === queue) void enterMatch(message.code, message.ids);
    }),
  );
  try {
    await queue.join(me);
  } catch (error) {
    return fail(error);
  }
  // El que más espera decide: con 4 arma ya, con 2 o 3 pasado un rato.
  every(500, () => {
    if (matchChannel !== queue) return;
    const waiting = queue.members().filter((m) => !m.busy);
    if (hostOf(waiting)?.id !== me.id) return;
    const ids = pickMatch(waiting, Date.now());
    if (!ids) return;
    const code = roomCode();
    queue.send({ t: "match", code, ids });
    void enterMatch(code, ids);
  });
}

async function enterMatch(code: string, ids: string[]) {
  await disconnect();
  expected = { ids, since: Date.now() };
  await joinRoom(code, "quick");
}

// --- Salas con amigos ------------------------------------------------------

export function createRoom() {
  return joinRoom(roomCode(), "friends");
}

export async function joinRoom(rawCode: string, kind: RoomKind = "friends") {
  const code = normalizeCode(rawCode);
  if (code.length !== 5) return set({ status: "error", error: "El código tiene 5 letras." });
  const waitFor = expected;
  await disconnect();
  expected = waitFor;
  const me = identity();
  if (!me) return;
  set({ status: "connecting", kind, code, me, members: [me], searchingSince: kind === "quick" ? get().searchingSince : null, error: null });
  const room = openChannel(`room:${code}`, transport());
  channel = room;
  detach.push(
    room.onMembers((members) => {
      set({ members });
      markLeft(members);
    }),
    room.onMessage((message, from) => receive(message, from)),
  );
  try {
    await room.join(me);
  } catch (error) {
    return fail(error);
  }
  if (channel !== room) return;
  set({ status: "lobby" });
  every(INPUT_FLUSH_MS, flushInputs);
  every(500, tick);
}

/** Los que están en la sala esperando (sin los que siguen jugando o viendo resultados). */
export function lobbyMembers(members: readonly Member[]): Member[] {
  return members.filter((m) => !m.busy).slice(0, MAX_PLAYERS);
}

/** ¿Me toca arrancar? Al más antiguo de los que esperan. */
export function isLobbyHost(members: readonly Member[], me: Member | null): boolean {
  return !!me && hostOf(members.filter((m) => !m.busy))?.id === me.id;
}

/** Lo que se va a jugar en la sala: carrera rápida según lo buscado; con amigos, lo que eligió el anfitrión. */
export function roomMode(state: Pick<RoomState, "kind" | "mode" | "members">): EpisodeKind {
  if (state.kind === "quick") return state.mode;
  return hostOf(state.members.filter((m) => !m.busy))?.mode ?? "race";
}

/** El anfitrión elige carrera o en equipo (los demás lo ven en la sala). */
export function setRoomMode(mode: EpisodeKind) {
  const { me } = get();
  session().chooseKind(mode);
  if (!channel || !me) return;
  const next = { ...me, mode };
  channel.update(next);
  set({ me: next });
}

/** El anfitrión arranca el episodio con los que están esperando. */
export function startEpisode() {
  const { me, members } = get();
  if (!channel || !me || get().status !== "lobby" || !isLobbyHost(members, me)) return;
  const message: NetMessage = {
    t: "start",
    seed: Math.floor(Math.random() * 2 ** 32) >>> 0,
    players: lobbyMembers(members),
    startIn: FIRST_START_IN_MS,
    kind: roomMode(get()),
  };
  channel.send(message);
  receive(message, me.id);
}

/** Volver a la sala después de los resultados: disponible para la revancha. */
export function backToLobby() {
  const { me, status } = get();
  if (!channel || !me || status !== "playing") return;
  const free = { ...me, busy: false };
  channel.update(free);
  set({ status: "lobby", me: free });
}

// --- El episodio -----------------------------------------------------------

function receive(message: NetMessage, from: string) {
  const { me } = get();
  if (!me) return;
  switch (message.t) {
    case "start": {
      if (get().status !== "lobby" || !message.players.some((p) => p.id === me.id)) return;
      players = message.players;
      scheduled = 1;
      const at = Date.now() + message.startIn;
      slotStart = { 1: at };
      recorders = new Map();
      remotes = new Map();
      expected = null;
      const busy = { ...me, busy: true };
      channel?.update(busy);
      session().prepareOnline({
        seed: message.seed,
        participants: buildParticipants(players, me.id),
        schedule: { slot: 1, at },
        kind: message.kind,
      });
      set((s) => ({ status: "playing", me: busy, episode: s.episode + 1 }));
      return;
    }
    case "go": {
      if (get().status !== "playing" || message.slot <= scheduled) return;
      scheduled = message.slot;
      const at = Date.now() + message.startIn;
      slotStart[message.slot] = at;
      session().scheduleSlot({ slot: message.slot, at });
      return;
    }
    case "in":
      remoteInputs(from, message.slot).add(message.from, message.data);
      return;
    case "res": {
      if (!players.some((p) => p.id === from)) return;
      // En equipo, el puntaje del árbitro (el primero de la lista) vale para los 4.
      if (session().kind === "coop") {
        if (from === players[0]?.id) session().setCrewScore(message.slot, message.score);
        else session().setScore(from, message.slot, message.score);
        return;
      }
      session().setScore(from, message.slot, message.score);
      // Los bots terminan distinto en cada compu (según cuándo terminaste vos):
      // vale lo que dice el árbitro, el primero de la lista.
      if (message.bots && from === players[0]?.id) {
        for (const [id, score] of Object.entries(message.bots)) session().setScore(id, message.slot, score);
      }
      return;
    }
  }
}

/** Avisar mi resultado de la prueba (el árbitro manda también el de los bots). */
export function reportResult(result: MinigameResult, rivals: readonly RivalResult[]) {
  const { me } = get();
  if (!channel || !me || get().status !== "playing") return;
  flushInputs();
  const bots =
    players[0]?.id === me.id
      ? Object.fromEntries(rivals.filter((r) => r.id.startsWith("cpu-")).map((r) => [r.id, r.score]))
      : undefined;
  channel.send({ t: "res", slot: result.slot, score: result.score, durationMs: result.durationMs, bots });
}

/** Personas del episodio que ya no están en la sala. */
function markLeft(members: readonly Member[]) {
  if (get().status !== "playing" || session().mode !== "online") return;
  const here = new Set(members.map((m) => m.id));
  const left = session()
    .participants.filter((p) => p.kind === "remote" && !here.has(p.id))
    .map((p) => p.id);
  session().setLeft(left);
}

/** Cada medio segundo: arranques pendientes, plazos y la prueba siguiente. */
function tick() {
  const { status, kind, me: self, members } = get();
  if (!channel || !self) return;
  const now = Date.now();

  // Carrera rápida: cuando llegaron todos los emparejados (o pasó el rato), arranca.
  if (status === "lobby" && kind === "quick" && expected) {
    const here = new Set(members.map((m) => m.id));
    const all = expected.ids.every((id) => here.has(id));
    if ((all || now - expected.since > QUICK_START_WAIT_MS) && isLobbyHost(members, self)) startEpisode();
    return;
  }
  if (status !== "playing" || !scheduled) return;

  const slot = scheduled;
  const startedAt = slotStart[slot];
  if (startedAt === undefined || now < startedAt) return;
  const { participants, scores } = session();
  const humans = participants.filter((p) => p.kind !== "bot");

  // Al que se fue o no terminó a tiempo le queda 0 (si después llega, se corrige).
  // A uno mismo no: su compu puede ir más lenta, pero el resultado llega.
  const overdue = now - startedAt > SLOT_DEADLINE_MS;
  for (const p of humans) {
    if (p.kind === "remote" && scores[p.id]?.[slot] === undefined && (overdue || p.left)) session().setScore(p.id, slot, 0);
  }

  // El anfitrión del episodio (el más antiguo de los que siguen) programa la
  // siguiente cuando terminó él y llegaron los demás. Si su propia pestaña se
  // trabó (segundo plano), pasado el doble del plazo sigue igual.
  if (slot >= EPISODE_LENGTH) return;
  const present = members.filter((m) => players.some((p) => p.id === m.id));
  if (hostOf(present)?.id !== self.id) return;
  const stillHere = humans.filter((p) => !p.left).map((p) => p.id);
  const abandoned = now - startedAt > 2 * SLOT_DEADLINE_MS;
  if (slotDone(slot, stillHere, session().scores) || abandoned) {
    const go: NetMessage = { t: "go", slot: (slot + 1) as RunSlot, startIn: NEXT_START_IN_MS };
    channel.send(go);
    receive(go, self.id);
  }
}

// --- Teclas ----------------------------------------------------------------

function recorder(slot: RunSlot) {
  let r = recorders.get(slot);
  if (!r) recorders.set(slot, (r = createInputRecorder()));
  return r;
}

function remoteInputs(id: string, slot: RunSlot) {
  const key = `${id}:${slot}`;
  let r = remotes.get(key);
  if (!r) remotes.set(key, (r = createRemoteInputs()));
  return r;
}

/** En equipo, un cambio de tecla sale enseguida (con este mínimo entre paquetes). */
const COOP_FLUSH_GAP_MS = 100;
let lastFlushAt = 0;
let lastCode = -1;

function flushInputs() {
  if (!channel || get().status !== "playing") return;
  lastFlushAt = Date.now();
  for (const [slot, r] of recorders) {
    const batch = r.flush();
    if (batch) channel.send({ t: "in", slot, from: batch.from, data: batch.data });
  }
}

/** Lo que el juego usa en una carrera online. */
export const netLink: NetLink = {
  sendInput(slot, tick, input) {
    recorder(slot).record(tick, input);
    // En una prueba compartida, cuanto antes lleguen los cambios, menos hay que
    // corregir del otro lado. En carrera no hace falta (se ve con atraso igual).
    const code = (Math.sign(input.move) + 1) * 2 + (input.jumpPressed ? 1 : 0);
    if (code !== lastCode) {
      lastCode = code;
      if (session().kind === "coop" && Date.now() - lastFlushAt >= COOP_FLUSH_GAP_MS) flushInputs();
    }
  },
  remoteInput: (id, slot, tick) => remotes.get(`${id}:${slot}`)?.at(tick),
  remoteTicks: (id, slot) => remotes.get(`${id}:${slot}`)?.length ?? 0,
};
