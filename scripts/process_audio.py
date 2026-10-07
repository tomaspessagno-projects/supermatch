"""Audios de Flow → sonidos del juego.

Cada archivo en art/source/audio/<nombre>.(mp4|mov|mp3|wav|m4a) se convierte en
public/game/sfx/<nombre>.mp3, el mismo nombre que usa el juego: se queda solo
con el audio, le saca el silencio de las puntas (efectos), lo corta a un largo
razonable y empareja el volumen. Lo que no está en art/source/audio/ sigue con
el placeholder de scripts/make_sfx.py.

    python3 scripts/process_audio.py   # requiere ffmpeg
"""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "art" / "source" / "audio"
OUT = ROOT / "public" / "game" / "sfx"
EXTENSIONS = {".mp4", ".mov", ".mp3", ".wav", ".m4a"}

# Largo máximo (s) de cada efecto: Flow genera 8 s y suele repetir el sonido.
MAX_SECONDS = {
    "jump": 0.6,
    "land": 0.5,
    "wall": 0.6,
    "bonk": 1.0,
    "splash": 1.5,
    "checkpoint": 1.2,
    "count": 0.4,
    "whistle": 1.2,
    "finish": 3.0,
    "fail": 3.5,
    "cheer": 3.0,
    "laugh": 2.5,
    "cannon": 0.8,
    "creak": 1.2,
    "pop": 0.5,
    "spring": 1.0,
    "win": 6.0,
}
# Música en loop: no se recorta ni se le saca el silencio del final.
LOOPS = {"music", "menu"}

TRIM_SILENCE = (
    "silenceremove=start_periods=1:start_threshold=-40dB,"
    "areverse,silenceremove=start_periods=1:start_threshold=-40dB,areverse"
)


def audio_filter(name: str) -> str:
    if name in LOOPS:
        return "loudnorm=I=-18:TP=-1.5,afade=t=in:d=0.05"
    limit = MAX_SECONDS.get(name, 3.0)
    fade = 0.08
    return f"{TRIM_SILENCE},atrim=0:{limit},afade=t=out:st={limit - fade}:d={fade},loudnorm=I=-16:TP=-1.5"


def main():
    if not SOURCE.exists():
        print(f"No existe {SOURCE.relative_to(ROOT)}: no hay audios para procesar.")
        return
    OUT.mkdir(parents=True, exist_ok=True)
    for src in sorted(SOURCE.iterdir()):
        if src.suffix.lower() not in EXTENSIONS:
            continue
        name = src.stem
        dest = OUT / f"{name}.mp3"
        subprocess.run(
            [
                "ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
                "-vn", "-ac", "1", "-ar", "44100",
                "-af", audio_filter(name),
                "-codec:a", "libmp3lame", "-q:a", "4",
                str(dest),
            ],
            check=True,
        )
        print(f"{src.name} → {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
