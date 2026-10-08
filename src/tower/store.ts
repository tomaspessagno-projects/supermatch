import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type CosmeticId, type HatId, isHat, type TrailId } from "./sim/cosmetics";
import {
  advanceQuest,
  type Counter,
  type Counters,
  dailyMissions,
  dayKey,
  DEFAULT_TITLE,
  MAX_COUNTERS,
  NO_COUNTERS,
  type Reward,
  STAR_REWARDS,
} from "./sim/goals";
import type { Mutation } from "./sim/items";
import { TOWER_TOP } from "./sim/level";
import { type Levels, NO_UPGRADES, petDef, type PetId, statsFor, type Stats, upgradeCost, type UpgradeId } from "./sim/progression";
import type { RunSummary, SimEvent } from "./sim/sim";

/**
 * El progreso de La Torre: lo que se acumula entre intentos (y entre visitas).
 * Por ahora se guarda en este navegador; después va a la base.
 */

/** Cuántas veces encontraste cada objeto, por mutación. */
export type Collection = Record<string, Partial<Record<Mutation, number>>>;

/** Lo que llevás hecho hoy (para las misiones del día). */
export type Daily = { day: string; counts: Partial<Counters>; done: string[] };

type Save = {
  fame: number;
  totalFame: number;
  levels: Levels;
  record: number;
  highestRest: number;
  runs: number;
  collection: Collection;
  /** Mascotas compradas y la que te acompaña. */
  pets: PetId[];
  pet: PetId | null;
  /** Temporadas renacidas (cada una suma fama para siempre). */
  season: number;
  /** Todo lo que se cuenta para las misiones. */
  counters: Counters;
  /** Misión del programa activa (índice en MAIN_QUEST). */
  quest: number;
  daily: Daily;
  /** Estrellas doradas encontradas (ids) y cuántos premios de estrellas ya cobraste. */
  stars: number[];
  starRewards: number;
  cosmetics: CosmeticId[];
  hat: HatId | null;
  trail: TrailId | null;
  title: string;
};

/** Lo que muestra el HUD (lo actualiza el juego unas 10 veces por segundo). */
export type Hud = {
  height: number;
  energy: number;
  energyMax: number;
  bag: number;
  bagMax: number;
  chips: number;
  floor: number;
  onDeck: boolean;
  nearKiosk: boolean;
};

export type Panel = "shop" | "pets" | "season" | "closet" | "collection" | "missions" | null;

/** Lo que dice el presentador (cambia el id para que se vuelva a mostrar). */
export type Announcement = { id: number; text: string };

/** Un festejo en pantalla: misión cumplida, misión del día o premio de estrellas. */
export type Celebration = { id: number; kind: "quest" | "daily" | "stars"; text: string; reward: Reward };

type TowerState = Save & {
  hud: Hud;
  announcement: Announcement | null;
  announce: (text: string) => void;
  celebrations: Celebration[];
  dismissCelebration: () => void;
  lastRun: RunSummary | null;
  /** Lo que sumó el último intento para tu equipo (null: sin conexión o todavía no contestó). */
  teamPoints: number | null;
  setTeamPoints: (points: number | null) => void;
  panel: Panel;
  stats: () => Stats;
  finishRun: (summary: RunSummary) => void;
  reachRest: (floor: number) => void;
  /** Lo que pasa en la torre y cuenta para las misiones. `height` y `runChips`: cómo va el intento. */
  onSimEvent: (event: SimEvent, run: { height: number; chips: number; stars: number[] }) => void;
  /** Suma a los contadores (los de máximo se quedan con el mayor) y cobra lo que se cumpla. */
  track: (updates: Partial<Counters>) => void;
  buy: (id: UpgradeId) => boolean;
  buyPet: (id: PetId) => boolean;
  equipPet: (id: PetId | null) => void;
  /** Ponerse o sacarse un cosmético (uno de cada tipo). */
  wear: (id: CosmeticId) => void;
  /** ¿Ya llegó a la cima alguna vez en esta temporada? */
  canRebirth: () => boolean;
  /** Nueva temporada: vuelve a empezar (mejoras, fama y récord) con más fama para siempre. */
  rebirth: () => boolean;
  setHud: (hud: Hud) => void;
  openPanel: (panel: Panel) => void;
  dismissRun: () => void;
};

const EMPTY: Save = {
  fame: 0,
  totalFame: 0,
  levels: NO_UPGRADES,
  record: 0,
  highestRest: -1,
  runs: 0,
  collection: {},
  pets: [],
  pet: null,
  season: 0,
  counters: NO_COUNTERS,
  quest: 0,
  daily: { day: "", counts: {}, done: [] },
  stars: [],
  starRewards: 0,
  cosmetics: [],
  hat: null,
  trail: null,
  title: DEFAULT_TITLE,
};

/** Las cosas de hoy que cuentan para las misiones del día. */
const DAILY_COUNTERS: readonly Counter[] = ["runs", "chips", "fame", "items", "height", "superBounces", "nets", "geysers", "knocks", "stars"];

/**
 * Aplica `updates` a los contadores y cobra todo lo que se cumpla: la misión
 * del programa (en cadena), las del día y los premios de estrellas.
 */
export function progressWith(s: Save, updates: Partial<Counters>, now: number, nextId: number) {
  const counters = { ...NO_COUNTERS, ...s.counters };
  const day = dayKey(now);
  const daily: Daily = s.daily.day === day ? { ...s.daily, counts: { ...s.daily.counts }, done: [...s.daily.done] } : { day, counts: {}, done: [] };
  for (const [key, value] of Object.entries(updates) as [Counter, number][]) {
    const before = counters[key];
    const isMax = MAX_COUNTERS.includes(key);
    counters[key] = isMax ? Math.max(before, value) : before + value;
    if (!DAILY_COUNTERS.includes(key)) continue;
    // Hoy: la altura es la mejor de hoy; las estrellas, las encontradas hoy; el resto, sumas.
    if (key === "height") daily.counts.height = Math.max(daily.counts.height ?? 0, value);
    else daily.counts[key] = (daily.counts[key] ?? 0) + (isMax ? counters[key] - before : value);
  }

  const celebrations: Celebration[] = [];
  const rewards: Reward[] = [];
  let id = nextId;
  const claim = (kind: Celebration["kind"], text: string, reward: Reward) => {
    rewards.push(reward);
    celebrations.push({ id: id++, kind, text, reward });
  };
  const { index: quest, done } = advanceQuest(s.quest, counters);
  for (const m of done) claim("quest", m.text, m.reward);
  for (const m of dailyMissions(day)) {
    if (daily.done.includes(m.id) || (daily.counts[m.counter] ?? 0) < m.goal) continue;
    daily.done.push(m.id);
    claim("daily", m.text, m.reward);
  }
  let starRewards = s.starRewards;
  while (starRewards < STAR_REWARDS.length && counters.stars >= STAR_REWARDS[starRewards].stars) {
    const r = STAR_REWARDS[starRewards++];
    claim("stars", `¡${r.stars} estrellas doradas!`, r.reward);
  }

  // Premios: fama, cosméticos (si tenías ese lugar libre, te lo ponés) y título.
  let { fame, totalFame, hat, trail, title } = s;
  const cosmetics = [...s.cosmetics];
  for (const r of rewards) {
    fame += r.fame ?? 0;
    totalFame += r.fame ?? 0;
    if (r.title) title = r.title;
    if (r.cosmetic && !cosmetics.includes(r.cosmetic)) {
      cosmetics.push(r.cosmetic);
      if (isHat(r.cosmetic)) hat = r.cosmetic;
      else trail = r.cosmetic;
    }
  }
  return { counters, daily, quest, starRewards, fame, totalFame, cosmetics, hat, trail, title, celebrations };
}

export const useTower = create<TowerState>()(
  persist(
    (set, get) => {
      let celebrationId = 1;
      const track = (updates: Partial<Counters>) =>
        set((s) => {
          const next = progressWith(s, updates, Date.now(), celebrationId);
          celebrationId += next.celebrations.length;
          return { ...next, celebrations: [...s.celebrations, ...next.celebrations] };
        });
      return {
        ...EMPTY,
        hud: { height: 0, energy: 0, energyMax: 0, bag: 0, bagMax: 0, chips: 0, floor: 0, onDeck: true, nearKiosk: false },
        lastRun: null,
        teamPoints: null,
        setTeamPoints: (teamPoints) => set({ teamPoints }),
        panel: null,
        announcement: null,
        celebrations: [],
        announce: (text) => set((s) => ({ announcement: { id: (s.announcement?.id ?? 0) + 1, text } })),
        dismissCelebration: () => set((s) => ({ celebrations: s.celebrations.slice(1) })),
        track,

        stats: () => statsFor(get().levels, get().pet, get().season),

        finishRun(summary) {
          set((s) => {
            const collection = { ...s.collection };
            for (const item of summary.items) {
              const found = { ...collection[item.def] };
              found[item.mutation] = (found[item.mutation] ?? 0) + 1;
              collection[item.def] = found;
            }
            return {
              fame: s.fame + summary.total,
              totalFame: s.totalFame + summary.total,
              record: Math.max(s.record, summary.height),
              runs: s.runs + 1,
              collection,
              lastRun: summary,
              teamPoints: null,
            };
          });
          track({ runs: 1, fame: summary.total, fameRun: summary.total, height: summary.height });
        },

        reachRest(floor) {
          set((s) => ({ highestRest: Math.max(s.highestRest, floor) }));
          track({ rest: floor + 1 });
        },

        onSimEvent(e, run) {
          switch (e.type) {
            case "land":
              return track({ height: run.height });
            case "chip":
              return track({ chips: e.value, chipsRun: run.chips });
            case "item":
              return track({ items: 1, mutated: e.item.mutation === "gold" || e.item.mutation === "rainbow" ? 1 : 0 });
            case "star":
              set({ stars: [...run.stars] });
              return track({ stars: run.stars.length });
            case "bounce":
              return e.big ? track({ superBounces: 1 }) : undefined;
            case "mantle":
              return track({ nets: 1 });
            case "lift":
              return track({ geysers: 1 });
            case "knock":
              return track({ knocks: 1 });
            case "top":
              return track({ tops: 1, height: run.height });
          }
        },

        buy(id) {
          const { levels, fame } = get();
          const cost = upgradeCost(id, levels[id]);
          if (cost === null || cost > fame) return false;
          set({ fame: fame - cost, levels: { ...levels, [id]: levels[id] + 1 } });
          track({ upgrades: 1 });
          return true;
        },

        buyPet(id) {
          const { pets, fame } = get();
          const price = petDef(id).price;
          if (pets.includes(id) || price > fame) return false;
          set({ fame: fame - price, pets: [...pets, id], pet: id });
          track({ pets: pets.length + 1 });
          return true;
        },

        equipPet: (id) => set((s) => ({ pet: id === null || s.pets.includes(id) ? id : s.pet })),

        wear: (id) =>
          set((s) => {
            if (!s.cosmetics.includes(id)) return {};
            if (isHat(id)) return { hat: s.hat === id ? null : id };
            return { trail: s.trail === id ? null : (id as TrailId) };
          }),

        canRebirth: () => get().record >= TOWER_TOP - 0.5,

        rebirth() {
          if (!get().canRebirth()) return false;
          const season = get().season + 1;
          set({ season, fame: 0, levels: NO_UPGRADES, record: 0, highestRest: -1, panel: null });
          track({ seasons: season });
          return true;
        },

        setHud: (hud) => set({ hud }),
        openPanel: (panel) => set({ panel }),
        dismissRun: () => set({ lastRun: null }),
      };
    },
    {
      name: "supermatch:torre",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Solo lo que se acumula; el HUD, los paneles y los festejos no se guardan.
      partialize: (s): Save => ({
        fame: s.fame,
        totalFame: s.totalFame,
        levels: s.levels,
        record: s.record,
        highestRest: s.highestRest,
        runs: s.runs,
        collection: s.collection,
        pets: s.pets,
        pet: s.pet,
        season: s.season,
        counters: s.counters,
        quest: s.quest,
        daily: s.daily,
        stars: s.stars,
        starRewards: s.starRewards,
        cosmetics: s.cosmetics,
        hat: s.hat,
        trail: s.trail,
        title: s.title,
      }),
      // Partidas guardadas antes de las misiones: los contadores salen de lo que
      // ya habías hecho, y las misiones cumplidas se saltean (sin premio).
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Save>;
        if (saved.counters) return { ...current, ...saved, counters: { ...NO_COUNTERS, ...saved.counters } };
        const levels = { ...NO_UPGRADES, ...saved.levels };
        const counters: Counters = {
          ...NO_COUNTERS,
          height: saved.record ?? 0,
          rest: (saved.highestRest ?? -1) + 1,
          runs: saved.runs ?? 0,
          upgrades: Object.values(levels).reduce((a, b) => a + b, 0),
          pets: saved.pets?.length ?? 0,
          seasons: saved.season ?? 0,
        };
        return { ...current, ...saved, counters, quest: advanceQuest(0, counters).index };
      },
    },
  ),
);
