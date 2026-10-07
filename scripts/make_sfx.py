"""Sonidos provisorios sintetizados (numpy + ffmpeg).

Placeholders con el tono del juego (boing, plaf, silbato, trombón triste) hasta
que lleguen los audios de Flow. Cuando llegue un audio real, se reemplaza el
.mp3 con el mismo nombre en public/game/sfx/ y no hay que tocar código.

    python3 scripts/make_sfx.py
"""

import subprocess
import tempfile
import wave
import zlib
from pathlib import Path

import numpy as np

RATE = 44100
OUT = Path(__file__).resolve().parent.parent / "public" / "game" / "sfx"
rng = np.random.default_rng(7)


def t_axis(seconds: float) -> np.ndarray:
    return np.arange(int(RATE * seconds)) / RATE


def env(n: int, attack: float = 0.005, release: float = 0.05) -> np.ndarray:
    """Envolvente con ataque y caída lineales (en segundos)."""
    e = np.ones(n)
    a = min(n, int(RATE * attack))
    r = min(n - a, int(RATE * release))
    if a:
        e[:a] = np.linspace(0, 1, a)
    if r:
        e[n - r:] = np.linspace(1, 0, r)
    return e


def sweep(f0: float, f1: float, seconds: float, shape=np.sin) -> np.ndarray:
    """Barrido exponencial de frecuencia."""
    t = t_axis(seconds)
    freq = f0 * (f1 / f0) ** (t / seconds)
    phase = 2 * np.pi * np.cumsum(freq) / RATE
    return shape(phase)


def square(phase: np.ndarray) -> np.ndarray:
    return np.sign(np.sin(phase)) * 0.6


def saw(phase: np.ndarray) -> np.ndarray:
    return 2 * ((phase / (2 * np.pi)) % 1) - 1


def lowpass(x: np.ndarray, alpha: float) -> np.ndarray:
    """Filtro de un polo: alpha chico = más opaco."""
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += alpha * (v - acc)
        y[i] = acc
    return y


def noise(seconds: float) -> np.ndarray:
    return rng.uniform(-1, 1, int(RATE * seconds))


def decay(n: int, rate: float) -> np.ndarray:
    return np.exp(-np.arange(n) / RATE * rate)


def tone(freq: float, seconds: float, shape=np.sin) -> np.ndarray:
    return shape(2 * np.pi * freq * t_axis(seconds))


def mix(*parts: tuple[float, np.ndarray]) -> np.ndarray:
    """Suma pistas que arrancan en distintos momentos (segundos)."""
    end = max(int(start * RATE) + len(x) for start, x in parts)
    out = np.zeros(end)
    for start, x in parts:
        i = int(start * RATE)
        out[i:i + len(x)] += x
    return out


# --- efectos ---------------------------------------------------------------


def sfx_jump():
    x = sweep(220, 700, 0.16, square) * 0.5
    return x * env(len(x), 0.002, 0.08)


def sfx_land():
    n = noise(0.12)
    x = lowpass(n, 0.08) * 3 + sweep(120, 50, 0.12) * 0.8
    return x * decay(len(x), 30)


def sfx_splash():
    body = lowpass(noise(0.7), 0.25) * decay(int(RATE * 0.7), 6)
    drops = [(d, sweep(f, f * 1.8, 0.05) * 0.25) for f, d in [(900, 0.08), (1300, 0.15), (700, 0.22), (1100, 0.3)]]
    plop = sweep(400, 90, 0.15) * decay(int(RATE * 0.15), 15)
    return mix((0, plop), (0, body), *drops)


def sfx_bonk():
    # "BOING": seno que baja con vibrato de resorte
    t = t_axis(0.5)
    freq = 330 * (1 - 0.45 * t / 0.5) * (1 + 0.12 * np.sin(2 * np.pi * 18 * t))
    x = np.sin(2 * np.pi * np.cumsum(freq) / RATE)
    return x * decay(len(x), 5) * env(len(x), 0.002, 0.1)


def sfx_wall():
    x = sweep(160, 45, 0.18) + lowpass(noise(0.18), 0.1) * 1.5
    return x * decay(len(x), 22)


def sfx_checkpoint():
    a = tone(784, 0.12) * decay(int(RATE * 0.12), 12)
    b = tone(1175, 0.35) * decay(int(RATE * 0.35), 8)
    return mix((0, a), (0.09, b)) * 0.6


def sfx_count():
    x = tone(660, 0.16, square) * 0.5
    return x * env(len(x), 0.003, 0.06)


def sfx_whistle():
    # Silbato de árbitro: tono agudo con trino rápido + aire
    t = t_axis(0.9)
    trill = 1 + 0.03 * np.sign(np.sin(2 * np.pi * 32 * t))
    x = np.sin(2 * np.pi * np.cumsum(2900 * trill) / RATE)
    air = lowpass(noise(0.9), 0.6) * 0.15
    return (x + air) * env(len(x), 0.02, 0.12) * 0.55


def sfx_finish():
    notes = [523, 659, 784, 1047]
    parts = [(i * 0.1, tone(f, 0.18, square) * decay(int(RATE * 0.18), 6) * 0.4) for i, f in enumerate(notes)]
    chord = sum(tone(f, 0.9, square) * 0.13 for f in [523, 659, 784, 1047]) * decay(int(RATE * 0.9), 3)
    return mix(*parts, (0.4, chord))


def sfx_fail():
    # "womp womp womp wooomp": trombón triste (diente de sierra filtrado)
    parts = []
    for i, (f, dur) in enumerate([(294, 0.32), (277, 0.32), (262, 0.32), (247, 1.0)]):
        t = t_axis(dur)
        vib = 1 + (0.02 * np.sin(2 * np.pi * 6 * t) if dur > 0.5 else 0)
        x = saw(2 * np.pi * np.cumsum(f * vib) / RATE)
        x = lowpass(x, 0.12) * env(len(x), 0.03, 0.1) * 0.9
        parts.append((i * 0.36, x))
    return mix(*parts)


def sfx_cheer():
    # Tribuna: ruido filtrado que crece y se apaga
    n = int(RATE * 1.6)
    x = lowpass(noise(1.6), 0.35)
    shape = np.minimum(1, np.arange(n) / (RATE * 0.25)) * decay(n, 1.6)
    return x * shape * 0.8


def sfx_laugh():
    # Risas de la tribuna: ruido filtrado cortado en "ja-ja-ja"
    n = int(RATE * 1.4)
    t = np.arange(n) / RATE
    x = lowpass(noise(1.4), 0.3)
    ha = 0.55 + 0.45 * np.sin(2 * np.pi * 5.5 * t)
    return x * ha * np.minimum(1, t / 0.08) * decay(n, 1.8) * 0.8


def sfx_cannon():
    # "¡POMF!": cañón de espuma (golpe grave + soplido)
    thump = sweep(110, 40, 0.25) * decay(int(RATE * 0.25), 14)
    air = lowpass(noise(0.35), 0.2) * decay(int(RATE * 0.35), 10) * 1.2
    return mix((0, thump), (0, air))


def sfx_creak():
    # Crujido de madera: pulsos ásperos con tono que baja
    n = int(RATE * 0.7)
    t = np.arange(n) / RATE
    freq = 140 - 60 * t / 0.7
    clicks = (np.sin(2 * np.pi * np.cumsum(freq) / RATE) > 0.92).astype(float)
    body = lowpass(clicks + noise(0.7) * 0.15, 0.3) * 4
    return body * env(n, 0.05, 0.15)


def sfx_pop():
    # Burbuja que revienta: "plop" corto que sube + brillo
    plop = sweep(500, 1500, 0.07) * decay(int(RATE * 0.07), 40)
    sparkle = tone(2093, 0.25) * decay(int(RATE * 0.25), 14) * 0.4
    return mix((0, plop), (0.03, sparkle))


def sfx_spring():
    # Trampolín: "boiiing" que sube, con vibrato de resorte
    t = t_axis(0.6)
    freq = 180 * (1 + 2.2 * t / 0.6) * (1 + 0.1 * np.sin(2 * np.pi * 22 * t))
    x = np.sin(2 * np.pi * np.cumsum(freq) / RATE)
    return x * decay(len(x), 4) * env(len(x), 0.003, 0.12)


# --- música ----------------------------------------------------------------

BPM = 150
BEAT = 60 / BPM
NOTE = {n: 440 * 2 ** ((i - 9) / 12) for i, n in enumerate("C C# D D# E F F# G G# A A# B".split())}


def note_freq(name: str) -> float:
    pitch, octave = name[:-1], int(name[-1])
    return NOTE[pitch] * 2 ** (octave - 4)


def music_loop():
    """8 compases de game show en loop: bajo, batería y melodía chiptune."""
    bars = 8
    total = bars * 4 * BEAT
    out = np.zeros(int(RATE * total) + RATE)
    roots = ["C3", "C3", "F3", "G3", "C3", "A2", "F3", "G3"]
    for bar, root in enumerate(roots):
        f = note_freq(root)
        for beat in range(4):
            start = (bar * 4 + beat) * BEAT
            # bajo saltarín: fundamental y octava
            for half, mult in [(0, 1), (0.5, 2)]:
                x = tone(f * mult, BEAT * 0.45, square) * 0.22
                x *= env(len(x), 0.003, 0.04)
                i = int((start + half * BEAT) * RATE)
                out[i:i + len(x)] += x
            # bombo en 1 y 3, redoblante en 2 y 4
            if beat % 2 == 0:
                k = sweep(150, 40, 0.12) * decay(int(RATE * 0.12), 25) * 0.7
            else:
                k = lowpass(noise(0.12), 0.5) * decay(int(RATE * 0.12), 30) * 0.35
            i = int(start * RATE)
            out[i:i + len(k)] += k
            # hi-hat en corcheas
            for half in (0, 0.5):
                h = noise(0.03) * decay(int(RATE * 0.03), 120) * 0.12
                i = int((start + half * BEAT) * RATE)
                out[i:i + len(h)] += h
    melody = (
        "G4 E4 G4 A4 G4 E4 C4 E4 F4 A4 C5 A4 G4 B4 D5 B4 "
        "C5 G4 E4 G4 A4 F4 A4 C5 B4 G4 F4 D4 G4 - G4 -"
    ).split()
    step = BEAT * 4 * bars / (len(melody) * 2)
    for i, name in enumerate(melody):
        if name == "-":
            continue
        x = tone(note_freq(name), step * 1.7, square) * 0.13
        x *= env(len(x), 0.004, 0.05)
        j = int(i * 2 * step * RATE)
        out[j:j + len(x)] += x
    return out[: int(RATE * total)]


SOUNDS = {
    "jump": sfx_jump,
    "land": sfx_land,
    "splash": sfx_splash,
    "bonk": sfx_bonk,
    "wall": sfx_wall,
    "checkpoint": sfx_checkpoint,
    "count": sfx_count,
    "whistle": sfx_whistle,
    "finish": sfx_finish,
    "fail": sfx_fail,
    "cheer": sfx_cheer,
    "laugh": sfx_laugh,
    "cannon": sfx_cannon,
    "creak": sfx_creak,
    "pop": sfx_pop,
    "spring": sfx_spring,
    "music": music_loop,
}


def write_mp3(name: str, samples: np.ndarray):
    peak = np.max(np.abs(samples)) or 1
    pcm = (samples / peak * 0.85 * 32767).astype(np.int16)
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = Path(tmp) / f"{name}.wav"
        with wave.open(str(wav_path), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(pcm.tobytes())
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path), "-codec:a", "libmp3lame", "-q:a", "5", str(OUT / f"{name}.mp3")],
            check=True,
        )


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    global rng
    for name, make in SOUNDS.items():
        # Semilla por sonido: agregar uno nuevo no cambia los demás.
        rng = np.random.default_rng(zlib.crc32(name.encode()))
        write_mp3(name, make())
        print(f"{name}.mp3")


if __name__ == "__main__":
    main()
