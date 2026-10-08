/**
 * Sonido con Web Audio: los mismos efectos del programa (public/game/sfx).
 * Arranca con el primer toque o tecla (los navegadores lo exigen).
 */
const NAMES = ["jump", "land", "splash", "bonk", "checkpoint", "count", "whistle", "finish", "fail", "cheer", "laugh", "pop", "spring", "creak", "wall", "cannon"] as const;
export type Sfx = (typeof NAMES)[number];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<string, AudioBuffer>();
let music: AudioBufferSourceNode | null = null;
let musicGain: GainNode | null = null;
let muted = false;

async function load(name: string) {
  if (!ctx) return;
  try {
    const res = await fetch(`/game/sfx/${name}.mp3`);
    buffers.set(name, await ctx.decodeAudioData(await res.arrayBuffer()));
  } catch {
    // sin ese sonido, se sigue igual
  }
}

/** Llamar en un gesto del usuario. */
export function unlockAudio() {
  if (ctx) {
    void ctx.resume();
    return;
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  master.connect(ctx.destination);
  for (const n of NAMES) void load(n);
  void load("music").then(startMusic);
}

function startMusic() {
  const buffer = buffers.get("music");
  if (!ctx || !master || !buffer || music) return;
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.25;
  musicGain.connect(master);
  music = ctx.createBufferSource();
  music.buffer = buffer;
  music.loop = true;
  music.connect(musicGain);
  music.start();
}

export function play(name: Sfx, { volume = 1, vary = 0 }: { volume?: number; vary?: number } = {}) {
  const buffer = buffers.get(name);
  if (!ctx || !master || !buffer) return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = 1 + (Math.random() - 0.5) * vary * 0.1;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(gain).connect(master);
  src.start();
}

export function setMuted(value: boolean) {
  muted = value;
  if (master) master.gain.value = value ? 0 : 0.8;
}

export function stopAudio() {
  music?.stop();
  music = null;
  void ctx?.close();
  ctx = null;
  buffers.clear();
}
