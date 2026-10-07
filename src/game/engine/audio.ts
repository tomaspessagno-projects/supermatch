import type { AudioPlay, KAPLAYCtx } from "kaplay";

/**
 * Efectos de sonido del juego. Viven en public/game/sfx/<nombre>.mp3: los
 * provisorios salen de scripts/make_sfx.py y se reemplazan por los de Flow
 * con el mismo nombre, sin tocar código.
 */
export const SOUNDS = [
  "jump",
  "land",
  "splash",
  "bonk",
  "wall",
  "checkpoint",
  "count",
  "whistle",
  "finish",
  "fail",
  "cheer",
] as const;
export type SoundName = (typeof SOUNDS)[number];

const MUSIC = "music";
const MUSIC_VOLUME = 0.3;
const MUSIC_DUCKED = 0.12; // mientras el programa habla (presentación, tabla)

// Mezcla: los golpes chicos no tapan a los importantes.
const VOLUME: Record<SoundName, number> = {
  jump: 0.35,
  land: 0.4,
  splash: 0.8,
  bonk: 0.7,
  wall: 0.55,
  checkpoint: 0.6,
  count: 0.5,
  whistle: 0.6,
  finish: 0.7,
  fail: 0.7,
  cheer: 0.5,
};

export function loadSounds(k: KAPLAYCtx) {
  for (const name of SOUNDS) k.loadSound(name, `/game/sfx/${name}.mp3`);
  // Streaming: la música no frena la carga de la escena.
  k.loadMusic(MUSIC, `/game/sfx/${MUSIC}.mp3`);
}

export type Audio = ReturnType<typeof createAudio>;

export function createAudio(k: KAPLAYCtx) {
  let music: AudioPlay | null = null;
  let ducked = true;

  return {
    /** `vary`: variación de tono aleatoria en semitonos, para que no suene repetido. */
    play(name: SoundName, { volume = 1, vary = 0 }: { volume?: number; vary?: number } = {}) {
      k.play(name, {
        volume: VOLUME[name] * volume,
        detune: vary ? (Math.random() * 2 - 1) * vary * 100 : 0,
      });
    },

    /** Arranca la música (una vez, después de un gesto del usuario). */
    startMusic() {
      music ??= k.play(MUSIC, { loop: true, volume: ducked ? MUSIC_DUCKED : MUSIC_VOLUME });
    },

    duckMusic(on: boolean) {
      ducked = on;
      if (music) music.volume = on ? MUSIC_DUCKED : MUSIC_VOLUME;
    },

    setMuted(muted: boolean) {
      k.setVolume(muted ? 0 : 1);
    },
  };
}
