#!/usr/bin/env python3
"""Convierte las hojas de art/source/ en sprites listos para el juego.

Uso:  python3 scripts/process_art.py

- Saca el fondo croma (verde o magenta) con alpha suave y des-mezcla el borde,
  así no queda halo verde alrededor de los contornos.
- Corta cada objeto de su hoja según CONFIG, lo recorta al contenido y lo escala.
- En las piezas que se tiñen por equipo separa la tela blanca (capa "-tint",
  en escala de grises) del resto (capa base).
- Escribe public/game/sprites/, public/ui/ y src/game/assets/manifest.ts.

Si falta una hoja en art/source/, la saltea y avisa.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "art" / "source"
GAME_OUT = ROOT / "public" / "game" / "sprites"
UI_OUT = ROOT / "public" / "ui"
MANIFEST = ROOT / "src" / "game" / "assets" / "manifest.ts"

# Las piezas del personaje comparten escala para conservar sus proporciones.
# 0.23 = el doble del tamaño en el juego (se dibujan a escala 0.5, nítidas en HiDPI).
CHAR_SCALE = 0.23

# name, box (x0, y0, x1, y1) en px de la hoja, scale, opciones.
#   mode:  "all" (todo lo que hay en la caja), "largest" (solo la pieza más grande),
#          "split" (cada pieza suelta es un sprite: name-0, name-1…)
#   tint:  separa la tela blanca; (y0, y1) limita la zona en fracción de alto.
#   trim_x: False conserva el ancho completo (texturas que se repiten).
CONFIG = {
    "personaje-piezas.jpg": {
        "key": "green",
        "out": GAME_OUT,
        "items": [
            ("char-head", (136, 8, 412, 300), CHAR_SCALE, {}),
            ("char-head-scream", (552, 8, 840, 316), CHAR_SCALE, {}),
            ("char-head-dizzy", (968, 8, 1244, 300), CHAR_SCALE, {}),
            ("char-torso", (116, 360, 432, 728), CHAR_SCALE, {"tint": (0, 1)}),
            ("char-arm", (628, 364, 780, 748), CHAR_SCALE, {"tint": (0, 0.3)}),
            ("char-leg", (1024, 376, 1244, 748), CHAR_SCALE, {}),
        ],
    },
    "props.jpg": {
        "key": "green",
        "out": GAME_OUT,
        "items": [
            ("prop-roller", (52, 24, 396, 368), 0.65, {}),
            ("prop-bumper", (1084, 32, 1232, 484), 0.8, {}),
            ("prop-arch", (416, 172, 960, 556), 0.8, {}),
            ("prop-pillar", (116, 396, 332, 744), 0.5, {}),
            ("prop-water", (820, 560, 1324, 740), 0.6, {}),
        ],
    },
    "efectos.jpg": {
        "key": "green",
        "out": GAME_OUT,
        "items": [
            ("fx-burst", (40, 40, 448, 376), 0.5, {}),
            ("fx-splash", (488, 56, 928, 368), 0.5, {}),
            ("fx-puff", (956, 40, 1336, 368), 0.4, {}),
            ("fx-star", (104, 444, 380, 700), 0.35, {"mode": "largest"}),
            ("fx-bubbles", (544, 424, 852, 724), 0.3, {}),
            ("fx-confetti", (980, 410, 1316, 736), 0.4, {"mode": "split", "min_area": 300}),
        ],
    },
    "puente-tramo.jpg": {
        "key": "green",
        "out": GAME_OUT,
        "items": [
            ("deck-tile", (0, 200, 1376, 620), 0.35, {"trim_x": False}),
        ],
    },
    "fondo-estudio.jpg": {
        "key": None,
        "out": GAME_OUT,
        "items": [
            ("bg-studio", (0, 0, 1376, 768), 720 / 768, {"format": "jpg"}),
        ],
    },
    "escudos-equipos.jpg": {
        "key": "magenta",
        "out": UI_OUT,
        "items": [
            ("badge-red", (40, 225, 362, 545), 0.6, {"mode": "largest"}),
            ("badge-blue", (366, 225, 688, 545), 0.6, {"mode": "largest"}),
            ("badge-yellow", (692, 225, 1014, 545), 0.6, {"mode": "largest"}),
            ("badge-green", (1018, 225, 1340, 545), 0.6, {"mode": "largest"}),
        ],
    },
    "ref-personaje.jpg": {
        "key": "green",
        "out": UI_OUT,
        "items": [
            ("contestant", (928, 32, 1304, 568), 1.0, {}),
        ],
    },
    "logo.jpg": {
        "key": "magenta",
        "out": UI_OUT,
        "items": [
            ("logo", (0, 0, 1376, 768), 0.8, {}),
        ],
    },
}


def chroma_score(rgb: np.ndarray, key: str) -> np.ndarray:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    if key == "green":
        return g - np.maximum(r, b)
    return np.minimum(r, b) - g


def border_color(rgb: np.ndarray) -> np.ndarray:
    edge = np.concatenate([rgb[:4].reshape(-1, 3), rgb[-4:].reshape(-1, 3),
                           rgb[:, :4].reshape(-1, 3), rgb[:, -4:].reshape(-1, 3)])
    return np.median(edge, axis=0)


def key_out(rgb: np.ndarray, key: str, bg: np.ndarray) -> np.ndarray:
    """Devuelve RGBA float (0..1) con el fondo croma quitado."""
    bg_score = chroma_score(bg[None, None, :], key)[0, 0]
    lo, hi = 0.15 * bg_score, 0.7 * bg_score
    alpha = np.clip((hi - chroma_score(rgb, key)) / (hi - lo), 0, 1)
    alpha[alpha < 0.05] = 0
    # Des-mezcla: el píxel observado es a·frente + (1-a)·fondo.
    a = np.maximum(alpha, 1e-3)[..., None]
    fg = np.clip((rgb - (1 - a) * bg) / a, 0, 255)
    return np.dstack([fg / 255, alpha])


def components(mask: np.ndarray) -> list[np.ndarray]:
    h, w = mask.shape
    seen = np.zeros_like(mask, bool)
    found = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        pts, q = [], deque([(y, x)])
        seen[y, x] = True
        while q:
            cy, cx = q.popleft()
            pts.append((cy, cx))
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        found.append(np.array(pts))
    return found


def keep_only(rgba: np.ndarray, pts: np.ndarray) -> np.ndarray:
    keep = np.zeros(rgba.shape[:2], bool)
    keep[pts[:, 0], pts[:, 1]] = True
    # Incluye el borde suave alrededor de la pieza.
    grown = keep.copy()
    for _ in range(2):
        grown[1:] |= grown[:-1]; grown[:-1] |= grown[1:]
        grown[:, 1:] |= grown[:, :-1]; grown[:, :-1] |= grown[:, 1:]
    out = rgba.copy()
    out[..., 3] *= grown
    return out


def trim(rgba: np.ndarray, trim_x: bool = True, pad: int = 2) -> np.ndarray:
    ys, xs = np.nonzero(rgba[..., 3] > 0.02)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, rgba.shape[0])
    x0, x1 = (max(xs.min() - pad, 0), min(xs.max() + pad + 1, rgba.shape[1])) if trim_x else (0, rgba.shape[1])
    return rgba[y0:y1, x0:x1]


def resize(rgba: np.ndarray, scale: float) -> Image.Image:
    img = Image.fromarray((rgba * 255).round().astype(np.uint8), "RGBA")
    size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    # Premultiplicado para que el borde no se oscurezca al achicar.
    return img.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def split_tint(rgba: np.ndarray, rows: tuple[float, float]) -> tuple[np.ndarray, np.ndarray]:
    """Separa la tela blanca (para teñir) del resto. Devuelve (base, tint)."""
    rgb = rgba[..., :3]
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-3)
    cloth = np.clip((0.3 - sat) / 0.12, 0, 1) * np.clip((mx - 0.5) / 0.15, 0, 1)
    h = rgba.shape[0]
    zone = np.zeros(h)
    zone[int(rows[0] * h):int(rows[1] * h)] = 1
    cloth *= zone[:, None]

    lum = rgb @ np.array([0.299, 0.587, 0.114])
    ref = np.percentile(lum[cloth > 0.5], 98) if (cloth > 0.5).any() else 1
    shade = np.clip(1 - (1 - lum / ref) * 1.8, 0.3, 1)
    # La capa teñida cubre toda la silueta; la base va encima donde no es tela.
    tint = np.dstack([shade, shade, shade, rgba[..., 3]])
    base = rgba.copy()
    base[..., 3] *= 1 - cloth
    return base, tint


def save(img: Image.Image, out: Path, name: str, fmt: str, manifest: dict) -> None:
    out.mkdir(parents=True, exist_ok=True)
    file = f"{name}.{fmt}"
    if fmt == "jpg":
        img.convert("RGB").save(out / file, quality=84, optimize=True, progressive=True)
    else:
        img.save(out / file, optimize=True)
    if out == GAME_OUT:
        manifest[name] = (file, img.width, img.height)
    print(f"  {out.relative_to(ROOT)}/{file}  {img.width}x{img.height}")


def main() -> None:
    manifest: dict[str, tuple[str, int, int]] = {}
    for sheet, spec in CONFIG.items():
        path = SOURCE / sheet
        if not path.exists():
            print(f"(falta {path.relative_to(ROOT)}, se saltea)")
            continue
        print(sheet)
        rgb = np.asarray(Image.open(path).convert("RGB")).astype(float)
        bg = border_color(rgb)
        for name, (x0, y0, x1, y1), scale, opt in spec["items"]:
            crop = rgb[y0:y1, x0:x1]
            if spec["key"] is None:
                rgba = np.dstack([crop / 255, np.ones(crop.shape[:2])])
            else:
                rgba = key_out(crop, spec["key"], bg)

            mode = opt.get("mode", "all")
            if mode == "all":
                pieces = [(name, rgba)]
            else:
                parts = sorted(components(rgba[..., 3] > 0.5), key=len, reverse=True)
                parts = [p for p in parts if len(p) >= opt.get("min_area", 0)]
                if mode == "largest":
                    pieces = [(name, keep_only(rgba, parts[0]))]
                else:
                    pieces = [(f"{name}-{i}", keep_only(rgba, p)) for i, p in enumerate(parts)]

            fmt = opt.get("format", "png")
            for piece_name, piece in pieces:
                piece = trim(piece, opt.get("trim_x", True)) if spec["key"] else piece
                if "tint" in opt:
                    base, tint = split_tint(piece, opt["tint"])
                    save(resize(base, scale), spec["out"], piece_name, fmt, manifest)
                    save(resize(tint, scale), spec["out"], f"{piece_name}-tint", fmt, manifest)
                else:
                    save(resize(piece, scale), spec["out"], piece_name, fmt, manifest)

    write_manifest(manifest)


def write_manifest(manifest: dict[str, tuple[str, int, int]]) -> None:
    lines = [
        "// Generado por scripts/process_art.py. No editar a mano.",
        "",
        "export const SPRITES = {",
        *(f'  "{n}": {{ file: "{f}", w: {w}, h: {h} }},' for n, (f, w, h) in sorted(manifest.items())),
        "} as const;",
        "",
        "export type SpriteName = keyof typeof SPRITES;",
        "",
    ]
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text("\n".join(lines))
    print(f"{MANIFEST.relative_to(ROOT)}: {len(manifest)} sprites")


if __name__ == "__main__":
    main()
