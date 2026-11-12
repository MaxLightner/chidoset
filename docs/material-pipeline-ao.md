# Chido material pipeline — AO-separated color (v0.16.19)

## Authored GLB contract

- Furniture exported with **Fabric** and **Wood** roles and `chido_color_uv_v1` must keep a dedicated tiled color UV (70 x 70 cm). This is independent from baked UV0.
- Legacy Tripo Prep output marked with `KHR_materials_unlit`, role metadata and a monochrome baked baseColor is normalized on import. The original map becomes a **linear** `aoMap` on `MeshStandardMaterial`. The new base color is white and has no baked map.
- At runtime, a colored fabric or wood texture is bound through the dedicated color UV shader. The AO remains a separate input; it is not flattened into a color image and is not multiplied twice.
- The exported shadow plane/alpha remains an independent baked object (not a procedural contact-shadow rectangle). Its black pigment is not tinted by the selected fabric or wood.
- sRGB is used for photographic colors, and NoColorSpace for AO. Do not apply a blanket gamma correction to data maps; matching Blender and Chido requires calibrated reference exposures/view transforms.
- Wood color swatches are 1024 x 1024 px representing the 70 x 70 cm UV tile, each less than 200 KB. Product thumbnails remain small (~256 px).
- The generation script is `scripts/generate-wood-textures.py`; output assets are committed under `assets/chido/wood-{oak,walnut,black}.jpg`.

## Smoke test

Open https://chidoset.ir/ , select the published Mani sofa (catalog index 32), try three fabric variants and three wood variants repeatedly. Confirm only the chosen role changes, while baked cavity shading and the original authored shadow remain stable. Rendering has to be evaluated on the target device; automated unit tests verify map ownership and data/color-space separation.
