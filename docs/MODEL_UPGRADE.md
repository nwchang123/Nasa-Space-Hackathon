# Blender model upgrade — 14 November 2026

The working project is `C:\Users\HP\Downloads\NASA\still-here`. The initially open `D:\sol-by-sol-release` folder contains a different application and was not modified.

## Delivered assets

| Asset | Shipped bytes | Triangles | Source / method |
| --- | ---: | ---: | --- |
| `public/models/mer.glb` | 1,073,196 | 32,562 | NASA detailed Spirit/Opportunity `.blend`, normalized to 1.5 m height, +Z front, six grounded wheels; restored packed colour/normal textures and adjusted PBR finishes |
| `public/models/pathfinder.glb` | 1,448,448 | 77,866 | Blender Python reconstruction: four tetrahedral faces unfolded, creased/seamed airbags, IMP mast, instrument boxes, rear ramp and separate Sojourner with six wheels, rocker-bogie links, hubs, grousers and rear APXS |
| `public/models/phoenix.glb` | 2,267,996 | 114,500 | Imported the existing NASA `public/models/insight.glb` after meshopt decoding; retained the shared platform/legs/arrays and rebuilt Phoenix's deck instruments, meteorological mast, lidar, SSI and arm |
| `public/models/backshell.glb` | 725,524 | 40,752 | Blender cone-shell reconstruction with impact deformation, torn thermal coating, laminate wall, interior ribs, attachment hardware and fragments |

Exact SHA-256 hashes, node counts, primitive counts and every embedded image's measured dimensions are in [model-assets.json](model-assets.json). All four files are below 3 MB, use `EXT_meshopt_compression`, and contain only embedded WebP images at 1024 px or smaller. New geometry was not simplified during compression. NASA source credits and the boundaries of the illustrative reconstructions are in [CREDITS.md](../CREDITS.md).

The MER archive is the official [NASA Spirit and Opportunity package](https://science.nasa.gov/3d-resources/mars-exploration-rover-spirit-and-opportunity/) listed in ASSETS.md. The extracted source `.blend` is 12,243,528 bytes, SHA-256 `1f1e2b246aca461d6d1d2b5f9ac9dff7fd225d242fc000131277457815e160c2`. Its original geometry handedness is retained. The new geometric right-front wheel (-X, +Z) is explicitly named, regardless of the source's legacy left/right labels.

## Rebuild locally

Tools used: Blender 5.3.0 at `D:\SteamLibrary\steamapps\common\Blender\blender.exe`, Node 24.11.1, `@gltf-transform/cli@4.5.1`, and Python 3.13 with Pillow for the delivery manifest. Blender supplies its own Python and NumPy. No cloud 3D generator or image-generation service is used.

From the project root in PowerShell:

```powershell
.\scripts\model-upgrade\rebuild.ps1
# A different Blender installation can be passed explicitly:
.\scripts\model-upgrade\rebuild.ps1 -Blender 'C:\path\to\blender.exe'
```

The entry point downloads the credited MER ZIP only when missing, decodes the current InSight GLB, then runs:

```powershell
& 'D:\SteamLibrary\steamapps\common\Blender\blender.exe' -b --disable-autoexec --python-exit-code 1 --python scripts/model-upgrade/build_assets.py -- all
```

It writes editable packed `mer.blend`, `pathfinder.blend`, `phoenix.blend` and `backshell.blend`, intermediate GLBs and measured anchors under ignored `assets-raw/model-upgrade/`. Original files from before this session are preserved under `assets-raw/model-upgrade/originals/`. This folder is intentionally not part of the web build.

Materials use deterministic Python/NumPy UV sampling for foil creases, fabric weave, paint and silicon. Phoenix's white, silver and silicon have a cooler palette with a light procedural dust deposit. Colour, roughness and tangent normal maps are written as packed images. These are procedural surface bakes, not photogrammetry or a high-to-low Cycles bake. Static mesh transforms are baked into vertices before export so the runtime bounding box does not lift the arm or ramp. Tangents are completed with glTF-Transform's MikkTSpace generator. Each asset is then compressed with:

```powershell
npx -y @gltf-transform/cli@4.5.1 tangents assets-raw/model-upgrade/phoenix-raw.glb assets-raw/model-upgrade/phoenix-tangents.glb --overwrite true
npx -y @gltf-transform/cli@4.5.1 optimize assets-raw/model-upgrade/phoenix-tangents.glb public/models/phoenix.glb --compress meshopt --texture-compress webp --texture-size 1024 --flatten false --join false --instance false --palette false --simplify false --prune false
npx -y @gltf-transform/cli@4.5.1 validate public/models/phoenix.glb
```

The no-flatten/no-join/no-instance settings preserve the articulated node hierarchy, metre-frame pivots and empty contact markers. Branches that share a static finish are joined in Blender before compression. Final files load through the existing bundled meshopt decoder; no Draco CDN is introduced. Native metre assets do not receive a second bounding-box scale from MODEL_REGISTRY.

## Animation contracts

- **Spirit:** six independent `wheel-{right|left}-{front|middle|rear}` nodes. `mer-right-front-contact` is read by `rightFrontFoot` through the existing sink/tilt pose. The silica strip follows ground height with its existing 0.012 m anti-z-fighting offset. Loading a GLB mid-action rebuilds the contact position.
- **Pathfinder:** `sojourner` retains unit scale and its original parked pose `[-2.6, 0, 0.5]`. The animation drives its local +X forward. Ramp centreline endpoints remain `[0.39, 0.135, 0.629]` and `[1.256, 0.045, 1.121]`, direction `[0.866, 0, 0.5]`. A perimeter-rail opening clears the egress path. The APXS is at axle level; the final reverse stop is calibrated from 2.68 to 2.56 m along the path so the actual new contact ring reaches the site's actual Barnacle Bill mesh. Ramp descent, forward swerve and reverse stages are retained.
- **Phoenix:** `phoenix-arm` has identity rest rotation and origin `PHOENIX_SHOULDER = [-0.3, 1.06, 0.6]`. Its `phoenix-scoop` marker is `TIP = [-0.2, -1, 1.35]` relative to the shoulder. InSight's `SEIS`, `arm_01`, `cable_02` groups and upper deck-only hardware are removed before adding Phoenix instruments. The original InSight asset is unchanged.
- **EDL:** only the shell/debris are in `backshell.glb`. The canopy and suspension lines are built outside the GLB's Suspense boundary and survive model loading. All 2,231 original canopy positions, colours and triangle indices match the pre-upgrade SHA-256 baselines in `scripts/model-upgrade/contracts.json`. The shader overlay still shares the canopy's exact position/index buffers.
- **Hotspots:** all twenty [01]–[04] anchors for the five affected stations are measured against the final surfaces; Spirit's include its site tilt/sink. Phoenix's framing and the radio antenna points are adjusted to the new hardware. The runtime's existing story, orbit, free-flight, scout camera and signature mechanisms remain in place. Sojourner/Phoenix references rebind when a loaded model replaces the fallback.

## Verification

```powershell
npm test
npm run build
python scripts/model-upgrade/asset_report.py
```

The suite includes the shipped compressed binary geometry, metre pivots, six MER wheel nodes, ramp clearance at eleven positions, APXS-to-actual-rock contact, Phoenix scoop rotation into the trench, all twenty hotspot-to-surface distances, texture/size/extension constraints and exact canopy hashes. The complete suite contains 290 tests in 15 files.

For browser QA, start the development server, open the app with a Playwright CLI session, take a fresh snapshot, and run `scripts/model-upgrade/browser-qa.js` through `run-code --filename`. Both headed visual inspection and a headless pass are used; the latter avoids Windows occlusion throttling. The script waits for real animation frames and uses the actual route buttons, hour sliders, bearing control, signature sliders, keyboard-activated hotspot buttons and Reset wide view. It records a complete revolution, slider poses and local companion flight for Pathfinder, Spirit, Opportunity, Phoenix and EDL. Screenshots are saved locally under ignored `output/playwright/model-upgrade/`. Save and assert the in-browser report after the run with:

```powershell
npx -y @playwright/cli -s=model-verify eval '() => JSON.stringify(window.__modelUpgradeReport)' --raw | python scripts/model-upgrade/save_browser_report.py
```

The project does not gain any production debug hook; the temporary report exists only in the QA browser page.

Final results after calibration (14 November 2026, Asia/Kuala_Lumpur):

- `npm test`: **290 passed, 15 test files**. `npm run build`: TypeScript and Vite build passed.
- glTF-Transform validation: **zero errors and zero warnings for all four final GLBs**. The bundled meshopt geometry is also actually decoded by the binary regression fixtures.
- Browser QA: **all five stations passed, no page errors or QA issues**. Each completed **405°** of orbit using the bearing control, its signature slider sequence, and a hotspot close-up with Ingenuity taking flight. Screenshots include the composed view, reverse view, signature result and companion close-up for each station.
- Pathfinder: APXS-to-nearest-rock-vertex distance **0.01465 m** at the final stop; the tighter triangle-surface contact regression passes at less than **0.012 m**. All eleven ramp clearance samples pass.
- Spirit: reverse displacement **0.7 m**; the complete silica strip remains at **0.012 m above the flat terrain**, aligned with the jammed wheel.
- Phoenix: measured shoulder `[-0.3000000, 1.0599580, 0.6000000]` after compression/grounding (within 0.05 mm of the specified shoulder). The scoop enters the ground during the digging motion, then raises while the four-sol ice sequence completes. The original `insight.glb` retains SHA-256 `b61af4d29e1ac87f9e114f0ba43ba63d9ed16daeb9cf499781852fbefb27f477`.
- EDL: **2,231 canopy vertices**, unchanged position/colour/index hashes, a shared position buffer in the decode overlay, and **all four rings decoded** at the final slider value.

Local evidence: [runtime report](../output/playwright/model-upgrade/report.json), [Pathfinder action](../output/playwright/model-upgrade/pathfinder-sojourner-signature.png), [Spirit action](../output/playwright/model-upgrade/spirit-signature.png), [Opportunity storm](../output/playwright/model-upgrade/opportunity-signature.png), [Phoenix action](../output/playwright/model-upgrade/phoenix-signature.png), [backshell and canopy](../output/playwright/model-upgrade/mars2020-edl-wide.png), and [EDL decode](../output/playwright/model-upgrade/mars2020-edl-signature.png). These QA files are local, ignored build artifacts, so those links are intended for the working checkout. The two browser console warnings are pre-existing Three.js deprecations (Clock and PCFSoftShadowMap).

The reconstructions, material wear and resting/damage conditions remain illustrative; this upgrade is not a claim of measured NASA engineering CAD accuracy.

## Viking material refresh — 15 November 2026

`public/models/viking-lander.glb` is re-exported from the local NASA/Michael D. Carbajal source `assets-raw/viking-lander.glb`. The earlier shipped file had been simplified to 68,432 triangles. This refresh uses all **99,526 original NASA triangles** (65,500 in `polySurfa1`, 34,026 in `polySurfa2`), with exact float32 triangle positions and winding, the original orientation, and the three-node `viking_car → polySurfa1 / polySurfa2` hierarchy. Geometry is not joined, flattened, remeshed, displaced or simplified. The packed editable source is `assets-raw/viking-material-upgrade/viking-materials.blend`.

The source had no UVs. Blender adds UV islands, then uses deterministic NumPy surface sampling and the packed-image pipeline from `build_assets.py` to bake these finishes:

| Source material | Illustrative finish |
| --- | --- |
| `blinn4SG`, `blinn11SG` | Aged ivory thermal paint, fine grains and shallow panel-seam normal detail |
| `blinn8SG`, `initialShadingGr` | Brushed aluminium and satin titanium, with varying roughness and metallic coverage |
| `blinn6SG`, `blinn9SG` | Carbon/charcoal instrument shrouds |
| `blinn2SG`, `blinn10SG` | Muted copper-gold foil and harness details |
| `blinn12SG` | Oxidised copper cable braid |

The white source materials also cover some feet and outer supports. Their lower, outward surfaces receive a metal finish through the baked maps, while keeping their original material slots and nodes. Orange-red dust is baked from upward-facing normals and normalized height above the ground, with patchiness and a stronger deposit on lower surfaces. Paint, microrelief, wear, metal assignments and dust are **illustrative artistic adjustments**, not measured present-day Viking surface conditions or NASA-authored textures. Normal maps provide surface detail; vertex positions remain unchanged.

The delivered asset is **3,659,572 bytes**, with 27 embedded WebP images: nine 1024² colour maps, nine 512² tangent normal maps and nine 512² packed roughness/metallic maps. Tangents are completed with glTF-Transform 4.5.1. The CLI resizes the data maps, compresses colour with WebP quality 88, and uses near-lossless WebP quality 90 for the data maps. Normal/tangent attributes use 12-bit precision and UVs 16-bit precision. Positions remain lossless FLOAT32. The final glTF-Transform meshopt writer compresses these buffers without position quantization, retaining the exact original three-node graph rather than adding decode-transform nodes. Attribute-only pruning removes unused buffers. Hashes, material mappings, texture dimensions and bake parameters are in [viking-materials.json](viking-materials.json); the immutable NASA geometry reference is [viking-contract.json](../scripts/model-upgrade/viking-contract.json).

Rebuild from the project root:

```powershell
.\scripts\model-upgrade\rebuild_viking.ps1
# Optional explicit Blender path:
.\scripts\model-upgrade\rebuild_viking.ps1 -Blender 'D:\SteamLibrary\steamapps\common\Blender\blender.exe'
```

This runs the background Blender bake, glTF-Transform CLI tangent/resize/WebP steps, the node-preserving meshopt writer and glTF validation before copying the result to `public/models/viking-lander.glb`. It uses the same local Blender 5.3.0 and pinned glTF-Transform CLI 4.5.1 as the previous assets. The raw NASA source is never overwritten.

`Lights.tsx` reduces the camera-side night fill from **0.85 to 0.5**, retaining the raking night key and the lander's dark-side volume. The runtime Viking model registry, Viking 1 scan-camera offsets and Viking 2 frost shader are unchanged. UV seam splits change the sampling weights of `rightFrontFoot` slightly: its new position is within **3.69 mm** of the unsimplified NASA source estimate, with the original normalized bounding box and 2 m height preserved.

Verification: **296 tests in 16 files pass**, `npm run build` passes, and glTF validation reports **0 errors and 0 warnings**. New asset regressions independently decode the shipped meshopt geometry and check exact directed triangle hashes, node structure, original orientation, foot-camera alignment, all nine PBR material slots, embedded WebP dimensions, UVs and tangents. Other station GLBs and the Viking signature source retain their pre-refresh hashes.

The 1280×800 browser comparison covers Viking 1 at 12:00 and 02:00, first-photo scan completion and clearing, and Viking 2 with frost off/on in daylight and at night. All nine source materials load their colour, normal and roughness/metallic maps. The scan retains its 728×280 render and responds to the slider; its grayscale exposure naturally responds to the darker metal footpad. The frost shader still chains the ground-edge shader. Browser console errors: **0**. Local comparison screenshots and runtime reports are under ignored `output/playwright/viking-materials/`; open [the comparison page](../output/playwright/viking-materials/index.html).
