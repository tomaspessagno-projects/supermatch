"use client";

import { ITEMS, MUTATION, type Mutation, RARITY_LABEL } from "../sim/items";
import { useTower } from "../store";
import { Modal } from "./Shop";

const MUTATIONS: Mutation[] = ["wet", "gold", "rainbow"];

/** El álbum: todo lo que se puede encontrar en la torre y cuánto encontraste. */
export function CollectionPanel() {
  const collection = useTower((s) => s.collection);
  const close = useTower((s) => s.openPanel);
  const found = ITEMS.filter((i) => collection[i.id]).length;

  return (
    <Modal title="COLECCIÓN" subtitle={`${found} de ${ITEMS.length} objetos del programa`} onClose={() => close(null)} testId="collection">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ITEMS.map((item) => {
          const counts = collection[item.id];
          const total = counts ? Object.values(counts).reduce((a, b) => a + (b ?? 0), 0) : 0;
          return (
            <li key={item.id} className={`flex flex-col items-center gap-1 rounded-2xl p-3 text-center ${counts ? "bg-white/10" : "bg-white/5"}`}>
              <span className={`text-4xl ${counts ? "" : "opacity-20 grayscale"}`} aria-hidden>
                {counts ? item.emoji : "❔"}
              </span>
              <span className="font-display text-sm leading-tight text-white">{counts ? item.name : "???"}</span>
              <span className="text-xs text-foreground/60">{RARITY_LABEL[item.rarity]}{total ? ` · ×${total}` : ""}</span>
              {counts && (
                <span className="flex gap-1 text-[10px]">
                  {MUTATIONS.map((m) => (
                    <span key={m} className={`rounded-full px-1.5 ${counts[m] ? "bg-amber-400 text-ink" : "bg-white/5 text-foreground/40"}`}>
                      {MUTATION[m].label}
                    </span>
                  ))}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
