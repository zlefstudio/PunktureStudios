"""Tight-crop the live-queue ritual tool sprites and print their config values.

The artwork in assets-src/animations/ is drawn on large 1408x768 canvases that are
95% empty. Shipping those means ~6 MB of transparent pixels to every phone that
opens /live.html. This script crops each sprite to its visible pixels, removes
faint checkerboard noise and resizes it to about 3x its on-screen size, then writes
the result to public/animations/ and prints the numbers for src/components/ritualConfig.ts.

usage:   python scripts/prepare-ritual-assets.py          (needs Pillow: pip install pillow)
edit:    TOOLS below. `anchor` is the working point in the ORIGINAL image (pixels): the
         cotton bud head, marker tip, needle tip or centre of the mirror glass.
         `show` is how many stage pixels tall (the long side) the tool appears on the 400px stage.
"""
from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets-src' / 'animations'
OUT = ROOT / 'public' / 'animations'
RESOLUTION = 3          # output pixels per stage pixel (sharp on 3x phone screens)
MARGIN = 6              # original pixels kept around the visible art (anti-aliasing, outline)

TOOLS = {
    'cottonbuds': dict(anchor=(704, 147), show=88),
    'marker':     dict(anchor=(706, 65),  show=92),
    'mirror':     dict(anchor=(701, 276), show=150),
    'needle':     dict(anchor=(713, 68),  show=84),
}


def visible_box(alpha):
    """Bounding box of every solid blob of at least ~3,000 px (ignores checkerboard specks)."""
    q = 4
    w, h = alpha.size
    small = alpha.resize((w // q, h // q), Image.BOX).point(lambda v: 255 if v > 100 else 0)
    W, H = small.size
    px = small.load()
    seen = [[False] * W for _ in range(H)]
    boxes = []
    for y in range(H):
        for x in range(W):
            if px[x, y] and not seen[y][x]:
                queue, area = deque([(x, y)]), 0
                seen[y][x] = True
                x0 = x1 = x
                y0 = y1 = y
                while queue:
                    cx, cy = queue.popleft()
                    area += 1
                    x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < W and 0 <= ny < H and px[nx, ny] and not seen[ny][nx]:
                                seen[ny][nx] = True
                                queue.append((nx, ny))
                if area >= 30:
                    boxes.append((x0 * q, y0 * q, (x1 + 1) * q, (y1 + 1) * q))
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    print('// Paste into RITUAL_CONFIG.tools (adjust angles/positions separately)')
    for name, spec in TOOLS.items():
        image = Image.open(SRC / f'{name}.png').convert('RGBA')
        alpha = image.getchannel('A').point(lambda v: 0 if v < 14 else v)   # drop faint checker noise
        image.putalpha(alpha)
        x0, y0, x1, y1 = visible_box(alpha)
        x0, y0 = max(0, x0 - MARGIN), max(0, y0 - MARGIN)
        x1, y1 = min(image.width, x1 + MARGIN), min(image.height, y1 + MARGIN)
        crop = image.crop((x0, y0, x1, y1))
        scale = spec['show'] * RESOLUTION / (y1 - y0)
        size = (round(crop.width * scale), round(crop.height * scale))
        # Resize with premultiplied alpha so edges stay clean (no dark halos).
        resized = crop.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')
        resized.save(OUT / f'{name}.png', optimize=True)
        ax, ay = (spec['anchor'][0] - x0) * scale, (spec['anchor'][1] - y0) * scale
        stage = 1 / RESOLUTION
        print(f"{name}: naturalWidth: {size[0]}, naturalHeight: {size[1]}, displayHeight: {size[1] * stage:.1f}, "
              f"anchor: {{ x: {ax:.0f}, y: {ay:.0f} }},  // {(OUT / f'{name}.png').stat().st_size // 1024} KB")


if __name__ == '__main__':
    main()
