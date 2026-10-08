import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Mutation } from "./sim/items";
import { type Levels, NO_UPGRADES, statsFor, type Stats, upgradeCost, type UpgradeId } from "./sim/progression";
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

/** Lo que dice el presentador (cambia el id para que se vuelva a mostrar). */
export type Announcement = { id: number; text: string };

type TowerState = Save & {
  hud: Hud;
  announcement: Announcement | null;
  announce: (text: string) => void;
  lastRun: RunSummary | null;
  panel: "shop" | "collection" | null;
  stats: () => Stats;
  finishRun: (summary: RunSummary) => void;
  reachRest: (floor: number) => void;
  buy: (id: UpgradeId) => boolean;
  setHud: (hud: Hud) => void;
  openPanel: (panel: "shop" | "collection" | null) => void;
  dismissRun: () => void;
};

const EMPTY: Save = { fame: 0, totalFame: 0, levels: NO_UPGRADES, record: 0, highestRest: -1, runs: 0, collection: {} };

export const useTower = create<TowerState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      hud: { height: 0, energy: 0, energyMax: 0, bag: 0, bagMax: 0, chips: 0, floor: 0, onDeck: true, nearKiosk: false },
      lastRun: null,
      panel: null,
      announcement: null,
      announce: (text) => set((s) => ({ announcement: { id: (s.announcement?.id ?? 0) + 1, text } })),

      stats: () => statsFor(get().levels),

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
      }),
    },
  ),
);
