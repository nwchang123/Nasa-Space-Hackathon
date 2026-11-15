# Blender model upgrades

The later runtime ground-contact and shadow repair is documented separately in [GROUNDING.md](GROUNDING.md). It keeps the seven GLB bytes unchanged and supersedes the earlier site-only vertical placements and hotspot heights described below.

The working project is `C:\Users\HP\Downloads\NASA\still-here`. `D:\sol-by-sol-release` is a different application and was not modified.

## Current delivery — global finish and rendering refinement, 15 November 2026

| GLB | Before bytes | Delivered bytes | Before → after triangles | Before → after draw primitives |
| --- | ---: | ---: | ---: | ---: |
| MER (Spirit / Opportunity) | 1,073,196 | 1,047,076 | 32,562 → 32,562 | 55 → 26 |
| Pathfinder / Sojourner | 1,448,448 | 1,399,016 | 77,866 → 77,866 | 15 → 15 |
| Phoenix | 2,267,996 | 1,750,120 | 114,500 → 59,999 | 13 → 13 |
| Backshell | 725,524 | 684,344 | 40,752 → 40,752 | 7 → 7 |
| InSight | 2,522,260 | 1,901,632 | 140,481 → 60,997 | 16 → 16 |
| Ingenuity | 403,504 | 394,580 | 9,124 → 9,124 | 35 → 35 |
| Viking 1 / 2 | 3,659,572 | 2,029,952 | 99,526 → 99,526 | 12 → 12 |
| **Total, seven unique files** | **12,100,500** | **9,206,720** | | **153 → 124** |

Every file is smaller; the total falls **23.91%**. The two rover stops still share one MER file, and the two Viking stops share one lander file. Draw primitives count the unique GLB mesh batches, not shadows, the terrain, procedural effects or the final whole-frame draw calls. Measured whole-frame results are recorded separately below. Exact delivered SHA-256 hashes, material flags and image dimensions are in [model-assets.json](model-assets.json). Initial source/export statistics and pinned input hashes are in [global-baseline.json](../scripts/model-upgrade/global-baseline.json).

All delivered materials have a normal map and a packed metallic/roughness map. Images are embedded WebP, colour at up to 1024 px and data maps at 256–512 px. Normal maps use WebP quality 94; colour and metallic/roughness use quality 82. Missing tangent attributes are generated with MikkTSpace on those primitives only, followed by bitwise welding. There are no external texture requests or Draco dependencies. Closed hardware uses back-face culling, with foil/fabric, thin panel surfaces and the open backshell coating/laminate retained as appropriate. Viking's shared paint material also covers its thin antenna dish and remains two-sided.

### Local Mars environment reflections

`src/scene/MarsEnvironment.tsx` renders a small local sky/ground gradient and broad sun lobe into a **64 px cube-face PMREM**. Its palette comes from the same `skyLook`, ambient sky/ground and site-local Sun as the diorama. There is no downloaded HDR image. `scene.environment` points at one stable CubeUV output texture; two source PMREMs blend into it over **1.25 s**, so a material's environment texture does not swap abruptly.

A palette/Sun change must exceed 0.025, the preceding blend must finish, and at least **1500 ms** must pass before another bake. An idle scene performs neither repeated PMREM bakes nor repeated blend passes. At most three owned PMREM/output targets are kept; old targets and generator resources are disposed. The scene environment intensity approaches **0.55 by day / 0.22 by night**. Instance-owned lit model materials use `envMapIntensity = 0.65`. Existing direct lights, including the 0.5 night fill, remain in place. This adds subdued metal reflections while retaining night contrast.

Both the main stage and AR Hangar's separate Canvas mount this component. Hangar's day/night selection drives its environment in the sandbox and WebXR scene. USDZ export carries standard PBR materials; OS Quick Look supplies its own lighting and does not export custom WebGL shader effects.

### Geometry and surface treatments

- **InSight:** starts from the pinned, decoded pre-refinement NASA conversion. Blender collapses only the dense static `deck`/support mesh, then restores its local bounding envelope. Total triangles are 60,997, with the **6.0 m** ground-normalized span, arm and instrument nodes preserved. The 11 original material families (14 exported slots including vertex-colour variants) receive normal/MR maps. Silver foil has metallic response and mild folds; the arrays and upward-facing deck receive a heavier, patchy orange-brown dust layer. **SEIS stays on the source deck**. The existing ground-wave centre, hotspots and story geometry are unchanged; this remains a presentation model, not an as-deployed reconstruction.
- **Phoenix:** only dense static inherited platform/support meshes are simplified, to 59,999 total triangles. The entire arm descendant branch is excluded. Cool finishes and light dust remain distinct from InSight's heavier dust.
- **MER:** static body/suspension pieces are grouped into six material batches in Blender. All six wheel nodes, the mast branch, seven arm nodes and `mer-right-front-contact` remain independent. New MR maps fill missing hardware slots. Runtime material clones give Spirit a pale silica scuff near the right-front wheel and Opportunity red-brown dust concentrated on upward-facing solar panels. Cached loader materials are never changed.
- **Viking:** retains all **99,526 original directed triangles**, their exact float32 positions and winding, original orientation and three-node `viking_car → polySurfa1 / polySurfa2` hierarchy. No position quantization, decode-transform nodes, join, displacement or simplification occurs. The nine material slots and **27 WebP images** remain. Small accessory colour maps (`blinn2SG`, `blinn6SG`, `blinn9SG`, `blinn10SG`, `blinn12SG`) become 512²; the four principal colours remain 1024²; all normal/MR maps remain 512². Ivory thermal paint receives slightly more legible panel-seam colour detail. Normal/tangent quantization is 12-bit and UVs 16-bit; positions remain lossless FLOAT32. [viking-materials.json](viking-materials.json) records the bake, images and hashes; [viking-contract.json](../scripts/model-upgrade/viking-contract.json) remains the immutable NASA reference.
- **Pathfinder / backshell:** their pinned compressed geometry and articulated frames are retained; missing normal/MR maps are supplied to the remaining hardware. The backshell wall, thermal tears and debris are unchanged. The parachute remains the original procedural Three.js mesh.
- **Ingenuity:** source positions, indices, rotor nodes and the broken-rotor rig are retained. Missing PBR data maps are added. Only `variant === 'real'` receives instance-owned mild landing dust/wear in the runtime; the golden holographic companion follows its original material path. Hangar uses the same real-body finish.

Paint, seams, dust, scuffs, foil relief, wear, resting/damage conditions and metal assignments are **illustrative artistic adjustments**, not measured present-day conditions, NASA-authored textures or engineering CAD. Credits and reconstruction sources are in [CREDITS.md](../CREDITS.md).

## Preserved animation and hotspot contracts

- **Spirit:** `wheel-{right|left}-{front|middle|rear}` and `mer-right-front-contact` remain. `rightFrontFoot` still resolves the actual jammed wheel through the site's sink/tilt. The silica strip follows terrain with its existing 0.012 m offset and 0.7 m reverse displacement.
- **Pathfinder:** `sojourner` retains unit scale and its parked position `[-2.6, 0, 0.5]`. Ramp centreline: `[0.39, 0.135, 0.629]` to `[1.256, 0.045, 1.121]`, direction `[0.866, 0, 0.5]`. Rover local +X is forward. The existing reverse APXS stop reaches the actual Barnacle Bill triangle surface; all eleven ramp samples remain tested.
- **Phoenix:** `phoenix-arm` retains shoulder `[-0.3, 1.06, 0.6]` and identity rest rotation; `phoenix-scoop` retains local `TIP = [-0.2, -1, 1.35]`. Its trench rotation and all hotspot surface-distance tests remain unchanged.
- **Viking:** immutable directed-triangle hashes, 2 m normalized height, original three-node graph, UV/tangent and 27-image requirements pass. The foot camera anchor remains within 5 mm of the unsplit NASA source estimate. Viking 1's scan camera and Viking 2's frost shader are unchanged.
- **EDL:** all **2231** canopy positions, colours and indices retain their exact [contract hashes](../scripts/model-upgrade/contracts.json); the decode overlay still shares the original position/index buffers. The ring decode, suspension lines and signature code are unchanged.
- **Ingenuity / Hangar:** rotor hierarchy, broken blade, table grounding, relative size layout and USDZ regression tests continue to pass. No station hotspot coordinates or camera distances changed in this refinement.

## Rebuild locally

Tools used: Blender **5.3.0** at `D:\SteamLibrary\steamapps\common\Blender\blender.exe`, Node **24.11.1**, pinned **@gltf-transform/cli@4.5.1**, and system Python **3.13 + Pillow** for the delivery manifest. Blender supplies Python/NumPy. No cloud 3D or texture generation service is used.

From the project root in PowerShell:

```powershell
.\scripts\model-upgrade\rebuild_global.ps1
# Optional explicit installation:
.\scripts\model-upgrade\rebuild_global.ps1 -Blender 'C:\path\to\blender.exe'
# Viking alone, with the same current compression policy:
.\scripts\model-upgrade\rebuild_viking.ps1
```

`rebuild_global.ps1` runs background Blender scripts, packs and validates all seven GLBs, then copies the verified files into `public/models/` and writes the manifest. It requires the existing local editable `.blend` sources under `assets-raw/model-upgrade/`, pinned pre-refinement exports under `assets-raw/global-refine/originals/`, the decoded `assets-raw/global-refine/insight-source.glb`, and raw NASA Viking source. These ignored local sources are intentionally separate from the web build. Pinned retained-input and InSight-source hashes prevent accidentally rebuilding from already-lossy/refined delivery files. Originals are never overwritten. Generated packed sources and intermediates go to `assets-raw/global-refine/`; Viking's packed source remains under `assets-raw/viking-material-upgrade/`.

`build_assets.py` remains the original NASA MER normalization / Pathfinder / Phoenix / backshell construction script. Its finalization now calls `global_finishes.refine_scene`, so newly generated static pieces receive the same batching, LOD eligibility and data-map rules. `rebuild.ps1` is the earlier four-model reconstruction entry point; use `rebuild_global.ps1` for the current seven-file delivery and compression policy.

To repack existing Blender exports without re-baking:

```powershell
npx -y --package=@gltf-transform/cli@4.5.1 node scripts/model-upgrade/pack_global.mjs
npx -y --package=@gltf-transform/cli@4.5.1 node scripts/model-upgrade/validate_global.mjs
# The rebuild entry point performs publication after validation.
python scripts/model-upgrade/asset_report.py
npm test
npm run build
```

Packing uses glTF-Transform meshopt high compression for rebuilt static assets, preserves existing quantization frames on Pathfinder/backshell/Ingenuity, and uses a separate position-lossless meshopt writer for Viking. Attribute/texture-only pruning removes unused buffers, and texture deduplication never merges articulated nodes.

## Verification

- **363 tests in 20 files pass**; `npm run build` passes TypeScript and Vite without errors.
- All **seven GLBs validate with 0 errors and 0 warnings**, including explicit tangent space for every normal-mapped primitive.
- Existing binary regressions decode the real meshopt buffers and retain all animation, contact, canopy and hotspot checks. New regressions cover fleet size, static triangle limits, MER node/batch retention, complete data maps, culling exceptions, reflection update throttling and per-instance shader/material isolation.
- Headless **1280×800** before/after captures cover nine stops: Viking 1 day/night/scan, Viking 2 frost, Pathfinder rollout/rock contact, Spirit drag, Opportunity storm, Phoenix trench, InSight day/night/quake, Backshell decode, Ingenuity endpoint, and AR Hangar's nine-model row day/night. Browser console/page errors: **0**. Existing Three.js Clock and PCFSoftShadowMap deprecation warnings remain.
- Seven additional Hangar close-ups check InSight day/night, both MER finishes, Phoenix, Viking and the real Ingenuity. An idle 180-frame interval adds **0 bakes**; eight rapid day/night toggles add **1 bake** during the input burst, then settle cleanly. The renderer's texture count stays at **129** throughout these idle/toggle checks.
- On matched settled wide views, Spirit and Opportunity frame calls fall **103 → 74**. The Hangar row falls **219 → 166** (24.2%), including its stage/grid/UI-associated scene objects. InSight's sampled visible triangles fall **177,165 → 97,681**, Phoenix **317,160 → 262,659**. These frame counts are view-dependent and exclude the occasional PMREM bake/blend pass.

The local comparison page and measured runtime reports are under ignored [output/playwright/global-refine/](../output/playwright/global-refine/index.html). The browser uses actual GPU/WebGL rendering and real animation frames; QA-only page variables do not ship in the app. Desktop Hangar is checked; a phone's camera/WebXR session requires a physical device and is not claimed by this headless check.
