"use client";

import { useState } from "react";
import { COSMETICS, type CosmeticId } from "../sim/cosmetics";
import { MAIN_QUEST, STAR_REWARDS } from "../sim/goals";
import { PETS, SEASON_BONUS, seasonMultiplier, upgradeCost, UPGRADES } from "../sim/progression";
import { type Panel, useTower } from "../store";
import { play } from "../view/sfx";

type Tab = "shop" | "pets" | "closet" | "season";

const TABS: { id: Tab; label: string }[] = [
  { id: "shop", label: "MEJORAS" },
  { id: "pets", label: "MASCOTAS" },
  { id: "closet", label: "VESTUARIO" },
  { id: "season", label: "TEMPORADA" },
];

const isTab = (p: Panel): p is Tab => TABS.some((t) => t.id === p);

/** El kiosco del programa: mejoras, mascotas y la temporada nueva. */
export function Shop() {
  const fame = useTower((s) => s.fame);
  const panel = useTower((s) => s.panel);
  const open = useTower((s) => s.openPanel);
  const tab: Tab = isTab(panel) ? panel : "shop";

  return (
    <Modal title="KIOSCO" subtitle={`Tenés ⭐ ${Math.floor(fame).toLocaleString("es-AR")} de fama`} onClose={() => open(null)} testId="shop">
      <div className="grid grid-cols-4 gap-1 rounded-2xl border-4 border-ink bg-ink/60 p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            data-testid={`tab-${t.id}`}
            onClick={() => open(t.id)}
            className={`rounded-xl px-1 py-1.5 font-display text-[11px] transition sm:text-base ${tab === t.id ? "bg-sun text-ink" : "text-foreground/70 hover:bg-white/10"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "shop" && <Upgrades />}
      {tab === "pets" && <Pets />}
      {tab === "closet" && <Closet />}
      {tab === "season" && <Season />}
    </Modal>
  );
}

function Upgrades() {
  const fame = useTower((s) => s.fame);
  const levels = useTower((s) => s.levels);
  const buy = useTower((s) => s.buy);
  return (
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
  );
}

function Pets() {
  const fame = useTower((s) => s.fame);
  const pets = useTower((s) => s.pets);
  const pet = useTower((s) => s.pet);
  const buyPet = useTower((s) => s.buyPet);
  const equipPet = useTower((s) => s.equipPet);
  return (
    <>
      <p className="text-sm text-foreground/80">Te siguen por toda la torre y te dan un bonus. Se compran una vez; te acompaña una sola.</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {PETS.map((p) => {
          const owned = pets.includes(p.id);
          const active = pet === p.id;
          return (
            <li key={p.id} className={`flex items-center gap-3 rounded-2xl p-3 ${active ? "bg-sun/20 ring-2 ring-sun" : "bg-white/5"}`} data-testid={`pet-${p.id}`}>
              <span className="text-3xl" aria-hidden>{p.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-white">{p.name}</p>
                <p className="text-xs leading-tight text-foreground/70">{p.detail}</p>
              </div>
              {owned ? (
                <button
                  type="button"
                  onClick={() => equipPet(active ? null : p.id)}
                  className={`btn-chunky shrink-0 px-3 py-1.5 font-display ${active ? "bg-white/10 text-white" : "bg-water text-ink"}`}
                >
                  {active ? "GUARDAR" : "LLEVAR"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={p.price > fame}
                  onClick={() => {
                    if (buyPet(p.id)) play("cheer", { volume: 0.6 });
                  }}
                  className="btn-chunky shrink-0 bg-sun px-3 py-1.5 font-display text-ink disabled:bg-white/10 disabled:text-foreground/50"
                >
                  ⭐ {p.price.toLocaleString("es-AR")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Cómo se gana cada cosmético (para los que todavía no tenés). */
function howToGet(id: CosmeticId): string {
  const quest = MAIN_QUEST.find((m) => m.reward.cosmetic === id);
  if (quest) return `Misión: ${quest.text}`;
  const stars = STAR_REWARDS.find((r) => r.reward.cosmetic === id);
  return stars ? `Encontrá ${stars.stars} estrellas doradas` : "";
}

function Closet() {
  const owned = useTower((s) => s.cosmetics);
  const hat = useTower((s) => s.hat);
  const trail = useTower((s) => s.trail);
  const wear = useTower((s) => s.wear);
  return (
    <>
      <p className="text-sm text-foreground/80">Sombreros y estelas: no se compran, se ganan con misiones y estrellas.</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {COSMETICS.map((c) => {
          const has = owned.includes(c.id);
          const on = hat === c.id || trail === c.id;
          return (
            <li key={c.id} className={`flex items-center gap-3 rounded-2xl p-3 ${on ? "bg-sun/20 ring-2 ring-sun" : "bg-white/5"}`} data-testid={`cosmetic-${c.id}`}>
              <span className={`text-3xl ${has ? "" : "opacity-30 grayscale"}`} aria-hidden>
                {c.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-white">
                  {c.name} <span className="text-xs text-foreground/60">{c.kind === "hat" ? "sombrero" : "estela"}</span>
                </p>
                {!has && <p className="text-xs leading-tight text-foreground/60">🔒 {howToGet(c.id)}</p>}
              </div>
              {has && (
                <button type="button" onClick={() => wear(c.id)} className={`btn-chunky shrink-0 px-3 py-1.5 font-display ${on ? "bg-white/10 text-white" : "bg-water text-ink"}`}>
                  {on ? "SACAR" : "PONER"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Season() {
  const season = useTower((s) => s.season);
  const canRebirth = useTower((s) => s.canRebirth());
  const rebirth = useTower((s) => s.rebirth);
  const [sure, setSure] = useState(false);
  const next = seasonMultiplier(season + 1);
  return (
    <div className="flex flex-col gap-3 text-sm text-foreground/85" data-testid="season">
      <p className="rounded-2xl bg-white/5 p-3">
        Estás en la <strong className="font-display text-sun">temporada {season + 1}</strong>
        {season > 0 && <> · tu fama vale <strong className="font-display text-sun">×{seasonMultiplier(season).toLocaleString("es-AR")}</strong></>}
      </p>
      <p>
        Cuando llegues a la cima, podés empezar una <strong>temporada nueva</strong>: volvés a cero (mejoras, fama y récord), pero toda la fama que
        cobres vale <strong>{Math.round(SEASON_BONUS * 100)} % más para siempre</strong>. Te quedás con la colección y las mascotas.
      </p>
      <button
        type="button"
        disabled={!canRebirth}
        data-testid="rebirth"
        onClick={() => {
          if (!sure) return setSure(true);
          if (rebirth()) play("finish");
        }}
        className="btn-chunky self-center bg-rubber px-5 py-2.5 font-display text-lg text-ink disabled:bg-white/10 disabled:text-foreground/50"
      >
        {!canRebirth ? "🔒 PRIMERO LLEGÁ A LA CIMA" : sure ? `¿SEGURO? TOCÁ DE NUEVO (×${next.toLocaleString("es-AR")})` : "🌟 ¡NUEVA TEMPORADA!"}
      </button>
    </div>
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
