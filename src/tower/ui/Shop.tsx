"use client";

import { upgradeCost, UPGRADES } from "../sim/progression";
import { useTower } from "../store";
import { play } from "../view/sfx";

/** El kiosco del programa: mejoras con precio que sube en cada nivel. */
export function Shop() {
  const fame = useTower((s) => s.fame);
  const levels = useTower((s) => s.levels);
  const buy = useTower((s) => s.buy);
  const close = useTower((s) => s.openPanel);

  return (
    <Modal title="KIOSCO" subtitle={`Tenés ⭐ ${fame.toLocaleString("es-AR")} de fama`} onClose={() => close(null)} testId="shop">
      <ul className="grid gap-2 sm:grid-cols-2">
        {UPGRADES.map((u) => {
          const level = levels[u.id];
          const cost = upgradeCost(u.id, level);
          const affordable = cost !== null && cost <= fame;
          return (
            <li key={u.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3" data-testid={`upgrade-${u.id}`}>
              <span className="text-3xl" aria-hidden>{u.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-white">
                  {u.name}{" "}
                  {u.max > 1 && <span className="text-xs text-foreground/60">nivel {level}/{u.max}</span>}
                </p>
                <p className="text-xs leading-tight text-foreground/70">{u.detail}</p>
              </div>
              <button
                type="button"
                disabled={!affordable}
                onClick={() => {
                  if (buy(u.id)) play("checkpoint");
                }}
                className="btn-chunky shrink-0 bg-sun px-3 py-1.5 font-display text-ink disabled:bg-white/10 disabled:text-foreground/50"
              >
                {cost === null ? "✔" : `⭐ ${cost.toLocaleString("es-AR")}`}
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

export function Modal({ title, subtitle, onClose, children, testId }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; testId: string }) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-ink/60 p-3 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="flex max-h-[92dvh] w-full max-w-2xl animate-[card-in_0.4s_cubic-bezier(0.2,1.2,0.4,1)_both] flex-col gap-3 overflow-y-auto rounded-3xl border-4 border-ink bg-background/95 p-4"
        onClick={(e) => e.stopPropagation()}
        data-testid={testId}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-cartoon text-3xl text-sun">{title}</h2>
            {subtitle && <p className="font-display text-foreground/80">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-10 place-items-center rounded-full border-4 border-ink bg-white/10 font-display text-white">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
