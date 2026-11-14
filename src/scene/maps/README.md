# Mars surface maps

All three are equirectangular, 2:1, centred on 0° longitude (left edge = 180°W), north up.
Vite bundles them at build time; sources and licences are in `CREDITS.md` and `docs/ASSETS.md`.

- `mars.webp`: Viking MDIM 2.1 colour mosaic, 4096×2048. Shown first.
- `mars-8k.webp`: the same mosaic at 8192×4096. Loaded in the background about 2.5 s after the
  globe appears, then swapped in (skipped on GPUs whose max texture size is below 8192).
- `mars-height.jpg`: MGS MOLA elevation, 4096×2048, grey, read as linear data. The globe shader
  turns its slopes into relief shading under the real Sun (exaggerated; shape only, not metres).

If `mars.webp` is missing, an illustrative procedural map is painted instead.
