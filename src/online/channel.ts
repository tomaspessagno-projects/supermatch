import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { EpisodeKind } from "@/lib/participants";
import type { TeamId } from "@/lib/teams";
import type { NetMessage } from "./protocol";

/**
 * Quién está en un canal (presencia). `busy`: está en plena carrera o viendo
 * los resultados. `mode`: lo que quiere jugar (en la sala vale el del anfitrión).
 */
export type Member = { id: string; nickname: string; team: TeamId; joinedAt: number; busy?: boolean; mode?: EpisodeKind };

/**
 * Un canal de la sala: quién está (presencia) y mensajes a todos los demás.
 * Hay dos implementaciones con la misma cara:
 * - Supabase Realtime (la de verdad);
 * - BroadcastChannel del navegador: entre pestañas del mismo navegador, para
 *   probar sin servidor (`?red=local`).
 */
export type RoomChannel = {
  join(me: Member): Promise<void>;
  /** Cambia lo que los demás ven de mí (por ejemplo, `busy`). */
  update(me: Member): void;
  members(): Member[];
  onMembers(listener: (members: Member[]) => void): () => void;
  send(message: NetMessage): void;
  onMessage(listener: (message: NetMessage, from: string) => void): () => void;
  leave(): Promise<void>;
};

export type Transport = "supabase" | "local";

export function openChannel(name: string, transport: Transport): RoomChannel {
  return transport === "local" ? localChannel(name) : supabaseChannel(name);
}

function emitter<T extends unknown[]>() {
  const listeners = new Set<(...args: T) => void>();
  return {
    on(listener: (...args: T) => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    emit(...args: T) {
      for (const listener of listeners) listener(...args);
    },
  };
}

const byJoin = (a: Member, b: Member) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id);

function supabaseChannel(name: string): RoomChannel {
  let channel: RealtimeChannel | null = null;
  let me: Member | null = null;
  let members: Member[] = [];
  const memberEvents = emitter<[Member[]]>();
  const messageEvents = emitter<[NetMessage, string]>();

  return {
    join(self) {
      me = self;
      const db = supabase();
      channel = db.channel(`sm:${name}`, {
        config: { broadcast: { self: false }, presence: { key: self.id } },
      });
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<Member>();
          members = Object.values(state)
            .map((metas) => metas[0])
            .filter(Boolean)
            .map(({ id, nickname, team, joinedAt, busy, mode }) => ({ id, nickname, team, joinedAt, busy, mode }))
            .sort(byJoin);
          memberEvents.emit(members);
        })
        .on("broadcast", { event: "m" }, ({ payload }) => {
          const { from, m } = payload as { from: string; m: NetMessage };
          messageEvents.emit(m, from);
        });
      return new Promise((resolve, reject) => {
        channel!.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel!.track(self);
            resolve();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            reject(new Error(`No se pudo conectar a la sala (${status})`));
          }
        });
      });
    },
    update(self) {
      me = self;
      void channel?.track(self);
    },
    members: () => members,
    onMembers: memberEvents.on,
    send(message) {
      void channel?.send({ type: "broadcast", event: "m", payload: { from: me?.id, m: message } });
    },
    onMessage: messageEvents.on,
    async leave() {
      if (!channel) return;
      await supabase().removeChannel(channel);
      channel = null;
    },
  };
}

/** Presencia casera sobre BroadcastChannel: saludo, latido y "chau". */
function localChannel(name: string): RoomChannel {
  const HEARTBEAT_MS = 700;
  const TIMEOUT_MS = 2500;
  let bus: BroadcastChannel | null = null;
  let me: Member | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  const seen = new Map<string, { member: Member; at: number }>();
  const memberEvents = emitter<[Member[]]>();
  const messageEvents = emitter<[NetMessage, string]>();

  type Packet =
    | { k: "hi" | "here" | "beat"; member: Member }
    | { k: "bye"; id: string }
    | { k: "m"; from: string; m: NetMessage };

  const list = () => [...seen.values()].map((s) => s.member).sort(byJoin);
  const changed = () => memberEvents.emit(list());
  const post = (packet: Packet) => bus?.postMessage(packet);

  return {
    async join(self) {
      me = self;
      bus = new BroadcastChannel(`sm:${name}`);
      seen.set(self.id, { member: self, at: Date.now() });
      bus.onmessage = ({ data }: MessageEvent<Packet>) => {
        if (data.k === "m") return messageEvents.emit(data.m, data.from);
        if (data.k === "bye") {
          if (seen.delete(data.id)) changed();
          return;
        }
        const before = seen.get(data.member.id)?.member;
        seen.set(data.member.id, { member: data.member, at: Date.now() });
        if (data.k === "hi") post({ k: "here", member: me! });
        if (!before || before.busy !== data.member.busy || before.mode !== data.member.mode) changed();
      };
      post({ k: "hi", member: self });
      timer = setInterval(() => {
        post({ k: "beat", member: me! });
        seen.set(me!.id, { member: me!, at: Date.now() });
        let pruned = false;
        for (const [id, entry] of seen) {
          if (Date.now() - entry.at > TIMEOUT_MS) {
            seen.delete(id);
            pruned = true;
          }
        }
        if (pruned) changed();
      }, HEARTBEAT_MS);
      changed();
    },
    update(self) {
      me = self;
      seen.set(self.id, { member: self, at: Date.now() });
      post({ k: "beat", member: self });
      changed();
    },
    members: list,
    onMembers: memberEvents.on,
    send(message) {
      if (me) post({ k: "m", from: me.id, m: message });
    },
    onMessage: messageEvents.on,
    async leave() {
      if (me) post({ k: "bye", id: me.id });
      if (timer) clearInterval(timer);
      bus?.close();
      bus = null;
      seen.clear();
    },
  };
}
