# Real surface maps (optional)

The globes ship with illustrative, procedurally painted maps (features at their real positions,
pixels not measured). To use real mosaics, put equirectangular images here:

- `moon.jpg` (or `.png` / `.webp`): e.g. the NASA SVS "CGI Moon Kit" LROC colour map.
- `mars.jpg` (or `.png` / `.webp`): e.g. a Viking / MOLA global colour mosaic.

Requirements: 2:1 aspect, centred on 0° longitude (left edge = 180°W), north up.
2048×1024 or 4096×2048 is plenty. Vite bundles them at build time; credit the source in CREDITS.md.
