import type { PlayerInput } from "@/bridge/events";

/**
 * Las teclas de cada tick (120 por segundo), comprimidas para mandarlas por
 * la red. Como las simulaciones son deterministas, con las teclas alcanza
 * para que cada compu re-simule a los demás exactamente igual.
 *
 * Formato: un carácter por tick ("0"–"5" = movimiento −1/0/1 × salto sí/no)
 * y las repeticiones como "3*40" (40 ticks seguidos con el código 3),
 * separadas por comas. Una tecla apretada medio segundo ocupa 4 caracteres.
 */

const code = (input: PlayerInput) => String((Math.sign(input.move) + 1) * 2 + (input.jumpPressed ? 1 : 0));

const decode = (c: string): PlayerInput => {
  const n = Number(c);
  return { move: Math.floor(n / 2) - 1, jumpPressed: n % 2 === 1 };
};

export function encodeInputs(inputs: readonly PlayerInput[]): string {
  const runs: string[] = [];
  let current = "";
  let count = 0;
  for (const input of inputs) {
    const c = code(input);
    if (c === current) {
      count++;
      continue;
    }
    if (count) runs.push(count === 1 ? current : `${current}*${count}`);
    current = c;
    count = 1;
  }
  if (count) runs.push(count === 1 ? current : `${current}*${count}`);
  return runs.join(",");
}

export function decodeInputs(data: string): PlayerInput[] {
  if (!data) return [];
  const out: PlayerInput[] = [];
  for (const run of data.split(",")) {
    const [c, times = "1"] = run.split("*");
    const input = decode(c);
    for (let i = 0; i < Number(times); i++) out.push(input);
  }
  return out;
}

/** Junta las teclas propias y entrega lo nuevo desde la última vez. */
export function createInputRecorder() {
  let inputs: PlayerInput[] = [];
  let sent = 0;
  return {
    /** Tick `tick` (0, 1, 2…): los ticks llegan en orden. */
    record(tick: number, input: PlayerInput) {
      if (tick !== inputs.length) return; // repetido o fuera de orden: se ignora
      inputs.push({ move: Math.sign(input.move), jumpPressed: input.jumpPressed });
    },
    /** Lo no enviado todavía, o null si no hay nada nuevo. */
    flush(): { from: number; data: string } | null {
      if (sent >= inputs.length) return null;
      const batch = { from: sent, data: encodeInputs(inputs.slice(sent)) };
      sent = inputs.length;
      return batch;
    },
    reset() {
      inputs = [];
      sent = 0;
    },
  };
}

/**
 * Las teclas que van llegando de un jugador remoto. Si se pierde un paquete
 * (reconexión), el hueco se rellena con la última tecla conocida: el rival
 * puede verse un poco distinto, pero su puntaje real llega aparte.
 */
export function createRemoteInputs() {
  const inputs: PlayerInput[] = [];
  const idle: PlayerInput = { move: 0, jumpPressed: false };
  return {
    add(from: number, data: string) {
      const batch = decodeInputs(data);
      if (from + batch.length <= inputs.length) return; // ya lo teníamos
      while (inputs.length < from) inputs.push({ ...(inputs[inputs.length - 1] ?? idle), jumpPressed: false });
      for (let i = inputs.length - from; i < batch.length; i++) inputs.push(batch[i]);
    },
    /** Cantidad de ticks conocidos (el próximo a llegar es este número). */
    get length() {
      return inputs.length;
    },
    at(tick: number): PlayerInput | undefined {
      return inputs[tick];
    },
  };
}
