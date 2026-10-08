import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Mutation } from "./sim/items";
import { TOWER_TOP } from "./sim/level";
import { type Levels, NO_UPGRADES, petDef, type PetId, statsFor, type Stats, upgradeCost, type UpgradeId } from "./sim/progression";
import type { RunSummary } from "./sim/sim";

/**
 * El progreso de La Torre: lo que se acumula entre intentos (y entre visitas).
 * Por ahora se guarda en este navegador; después va a la base.
 */

/** Cuántas veces encontraste cada objeto, por mutación. */
export type Collection = Record<string, Partial<Record<Mutation, number>>>;

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

export type Panel = "shop" | "pets" | "season" | "collection" | null;

/** Lo que dice el presentador (cambia el id para que se vuelva a mostrar). */
export type Announcement = { id: number; text: string };

type TowerState = Save & {
  hud: Hud;
  announcement: Announcement | null;
  announce: (text: string) => void;
  lastRun: RunSummary | null;
  panel: Panel;
  stats: () => Stats;
  finishRun: (summary: RunSummary) => void;
  reachRest: (floor: number) => void;
  buy: (id: UpgradeId) => boolean;
  buyPet: (id: PetId) => boolean;
  equipPet: (id: PetId | null) => void;
  /** ¿Ya llegó a la cima alguna vez en esta temporada? */
  canRebirth: () => boolean;
  /** Nueva temporada: vuelve a empezar (mejoras, fama y récord) con más fama para siempre. */
  rebirth: () => boolean;
  setHud: (hud: Hud) => void;
  openPanel: (panel: Panel) => void;
  dismissRun: () => void;
};

const EMPTY: Save = { fame: 0, totalFame: 0, levels: NO_UPGRADES, record: 0, highestRest: -1, runs: 0, collection: {}, pets: [], pet: null, season: 0 };

export const useTower = create<TowerState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      hud: { height: 0, energy: 0, energyMax: 0, bag: 0, bagMax: 0, chips: 0, floor: 0, onDeck: true, nearKiosk: false },
      lastRun: null,
      panel: null,
      announcement: null,
      announce: (text) => set((s) => ({ announcement: { id: (s.announcement?.id ?? 0) + 1, text } })),

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
          };
        });
      },

      reachRest: (floor) => set((s) => ({ highestRest: Math.max(s.highestRest, floor) })),

      buy(id) {
        const { levels, fame } = get();
        const cost = upgradeCost(id, levels[id]);
        if (cost === null || cost > fame) return false;
        set({ fame: fame - cost, levels: { ...levels, [id]: levels[id] + 1 } });
        return true;
      },

      buyPet(id) {
        const { pets, fame } = get();
        const price = petDef(id).price;
        if (pets.includes(id) || price > fame) return false;
        set({ fame: fame - price, pets: [...pets, id], pet: id });
        return true;
      },

      equipPet: (id) => set((s) => ({ pet: id === null || s.pets.includes(id) ? id : s.pet })),

      canRebirth: () => get().record >= TOWER_TOP - 0.5,

      rebirth() {
        if (!get().canRebirth()) return false;
        set((s) => ({ season: s.season + 1, fame: 0, levels: NO_UPGRADES, record: 0, highestRest: -1, panel: null }));
        return true;
      },

      setHud: (hud) => set({ hud }),
      openPanel: (panel) => set({ panel }),
      dismissRun: () => set({ lastRun: null }),
    }),
    {
      name: "supermatch:torre",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Solo lo que se acumula; el HUD y los paneles no se guardan.
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
      }),
    },
  ),
);
