# Real surface maps (optional)

The Mars globe ships with an illustrative, procedurally painted map (features at their real
positions, pixels not measured). To use a real mosaic, put an equirectangular image here:

- `mars.jpg` (or `.png` / `.webp`): e.g. a Viking / MOLA global colour mosaic.

Requirements: 2:1 aspect, centred on 0° longitude (left edge = 180°W), north up.
2048×1024 or 4096×2048 is plenty. Vite bundles them at build time; credit the source in CREDITS.md.
