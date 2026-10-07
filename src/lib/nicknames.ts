const WHO = ["Pato", "Pingüino", "Carpincho", "Ñandú", "Mapache", "Pollito", "Tero", "Yacaré", "Sapo", "Oso", "Gato", "Puma"];
const HOW = ["Resbaloso", "Patinador", "Enjabonado", "Torpe", "Volador", "Mojado", "Turbo", "Saltarín", "Despistado", "Mareado", "Veloz", "Bamboleante"];

/** Debe coincidir con el check de public.players.nickname (2 a 20 caracteres). */
export const NICKNAME_MAX = 20;

const pick = (items: readonly string[]) => items[Math.floor(Math.random() * items.length)];

/** Apodo al azar para no pedir registro: "Pato Resbaloso". */
export function randomNickname(): string {
  for (;;) {
    const name = `${pick(WHO)} ${pick(HOW)}`;
    if (name.length <= NICKNAME_MAX) return name;
  }
}
