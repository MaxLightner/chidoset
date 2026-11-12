"""Regenerate three 1024px color swatches for a 70cm x 70cm furniture UV tile."""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'chido'
SIZE = 1024
X, Y = np.meshgrid(np.arange(SIZE, dtype=np.float32), np.arange(SIZE, dtype=np.float32))
T = 2 * np.pi

def make(name, seed):
    path = ROOT / ('wood-' + name + '.jpg')
    try:
        source = Image.open(path).convert('RGB')
        source.load()
        base = np.asarray(source.resize((SIZE, SIZE), Image.Resampling.BICUBIC), dtype=np.float32)
    except (OSError, ValueError):
        # Do not propagate previously truncated/invalid JPEG assets.
        colors = {'oak': (208, 157, 105), 'walnut': (130, 83, 47), 'black': (73, 62, 51)}
        base = np.empty((SIZE, SIZE, 3), dtype=np.float32)
        for i, value in enumerate(colors[name]):
            base[:, :, i] = value
        base += (9 * np.sin(T * (X * 16 / SIZE + 1.4 * np.sin(T * Y * 2 / SIZE)))
                 + 5 * np.sin(T * (X * 32 / SIZE - np.sin(T * Y * 3 / SIZE))))[..., None]
    rng = np.random.default_rng(seed)
    # Integer-frequency waves are periodic in both axes; material color never contains AO.
    bend = 2.9 * np.sin(T * (Y * 2 / SIZE + X / SIZE)) + 1.25 * np.sin(T * (Y * 7 / SIZE - X * 2 / SIZE)) + .45 * np.sin(T * Y * 13 / SIZE)
    grain = 2.0 * np.sin(T * (X * 44 / SIZE + bend)) + 1.15 * np.sin(T * (X * 97 / SIZE + bend * 1.7)) + .6 * np.sin(T * X * 213 / SIZE)
    base += (grain + rng.normal(0, .65, (SIZE, SIZE)).astype(np.float32))[..., None]
    if name == 'black':
        base = base * .93 + 36.0
    elif name == 'oak':
        base = base * 1.02 + 3.0
    else:
        base = base * 1.04 + 7.0
    image = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), 'RGB')
    for quality in (74, 69, 63, 57, 51):
        image.save(path, 'JPEG', quality=quality, optimize=True, subsampling=0)
        if path.stat().st_size < 160000:
            break
    print(name, image.size, path.stat().st_size)

if __name__ == '__main__':
    for name, seed in (('oak', 101), ('walnut', 212), ('black', 323)):
        make(name, seed)
