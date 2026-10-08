import type { SimEvent } from "../sim/sim";

/** Los eventos de la simulación, para los efectos 3D y la interfaz. */
type Listener = (events: readonly SimEvent[]) => void;
const listeners = new Set<Listener>();

export const bus = {
  on(listener: Listener) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  emit(events: readonly SimEvent[]) {
    if (events.length) for (const l of listeners) l(events);
  },
};
