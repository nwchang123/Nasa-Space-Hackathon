# Credits and sources

## Mission data and stories

- NASA Space Science Data Coordinated Archive (NSSDCA): https://nssdc.gsfc.nasa.gov/
- NASA Science mission pages: https://science.nasa.gov/
- NASA Jet Propulsion Laboratory news and mission pages: https://www.jpl.nasa.gov/
- Per-claim sources: `docs/FACT_CHECK.md`

NASA material is used for education under NASA's media guidelines. NASA does not endorse this project.

## Methods

- Mars local time and Sun position: Allison, M. & McEwen, M. (2000), *A post-Pathfinder evaluation of areocentric solar coordinates*, Planetary and Space Science 48; NASA GISS Mars24 algorithm.
- Earth–Mars distance and light time: Standish, E. M., *Keplerian Elements for Approximate Positions of the Major Planets*, JPL Solar System Dynamics; checked against JPL Horizons.
- Time scales and general methods: Meeus, J., *Astronomical Algorithms* (2nd ed.).
- Distances and headings between sites: great-circle (haversine) formula on a sphere of radius 3,389.5 km.

## Images and 3D models

NASA source models come from [NASA 3D Resources](https://science.nasa.gov/3d-resources/), which describes its files as "free and without copyright". All seven shipped GLBs use glTF-Transform 4.5.1, meshopt geometry and embedded WebP textures up to 1024 px, with normal and metallic/roughness maps on every material. NASA hardware geometry, locally authored reconstructions and illustrative surface treatments are distinguished below:

- "Viking Lander", NASA/Michael D. Carbajal: used for Viking 1 and Viking 2 (`public/models/viking-lander.glb`). Reimported from `assets-raw/viking-lander.glb` with all 99,526 original triangles, their exact float32 positions/winding, orientation and three-node hierarchy retained. Blender 5.3.0 adds UVs and procedurally baked ivory thermal paint, brushed aluminium/titanium, charcoal instrument covers and copper-gold foil/cable finishes. Grain, panel seams, microrelief, wear and upward/low-surface Mars dust are illustrative artistic adjustments, not measured surface conditions or NASA-authored textures. The five small accessory colour maps are 512 px; four principal colour maps are 1024 px; all 18 normal and packed roughness/metallic maps remain 512 px. The existing Viking 1 scan camera and Viking 2 ground/rock frost shader remain unchanged. See `scripts/model-upgrade/rebuild_viking.ps1` and `docs/MODEL_UPGRADE.md`.
- "InSight Cruise Lander (arm deployed)", NASA/Brian E. Kumanchik (`public/models/insight.glb`): adapted from the existing NASA conversion. Blender reduces only the dense static deck/support mesh, retaining its bounding envelope, instrument/arm nodes and 6 m span; total triangles fall from 140,481 to 60,997. All 11 original material families receive illustrative normal and metal/roughness maps, silver-foil response and heavier upward-facing solar-array/deck dust, recalling the mission's dust-limited power supply. SEIS remains on the source model's deck; its existing ground-wave illustration and hotspots are unchanged.
- "Ingenuity Mars Helicopter", NASA/Brian E. Kumanchik (`public/models/ingenuity.glb`): the source geometry and rotor hierarchy are retained. Missing PBR data maps are supplied locally. Instance-owned runtime materials add mild dust and wear to the real endpoint aircraft only; the amber holographic companion keeps its existing material. The broken-rotor rig remains a project-authored illustrative condition.
- ["Mars Exploration Rover – Spirit and Opportunity", NASA](https://science.nasa.gov/3d-resources/mars-exploration-rover-spirit-and-opportunity/): the detailed official `.blend` replaces the earlier simplified MER-B model for both rovers (`public/models/mer.glb`). Blender 5.3.0 normalizes orientation/size and grounds the six independent wheels; packed NASA diffuse/normal maps and UVs are retained, with a baked silicon tint on the pale solar-cell maps and PBR silver finishes. Static body/suspension pieces are batched by material (55 to 26 draw primitives); all wheel, mast, arm and contact-marker nodes remain separate. Instance-owned shaders distinguish Spirit's pale wheel-area silica scuffs and Opportunity's red-brown panel dust while sharing one GLB. The finish adjustments and resting poses are illustrative.
- `public/models/pathfinder.glb`: an original, AI-assisted Blender Python reconstruction of Pathfinder and Sojourner, based on [NASA mission references](https://science.nasa.gov/mission/mars-pathfinder/). Includes unfolded tetrahedral petals, wrinkled/seamed Vectran airbags, IMP mast, a rear egress ramp and a separate six-wheel rocker-bogie rover. Illustrative reconstruction, not a NASA-supplied model.
- `public/models/phoenix.glb`: adapted in Blender from this project's NASA/Brian E. Kumanchik `insight.glb`. The shared deck, landing legs and arrays are retained at Phoenix scale; InSight's instrument group, tethers, deployment arm and upper deck hardware are removed. Phoenix TEGA/MECA boxes, SSI camera, meteorological mast, lidar and shoulder-pivoted digging arm are authored in Python, with cool white/silver finishes and a light procedural dust layer. Static platform/support LOD reduces 114,500 triangles to 59,999; the authored arm/scoop branch is excluded. [NASA Phoenix references](https://science.nasa.gov/mission/mars-phoenix/) inform the reconstruction; it is not an official Phoenix model or a measured post-winter pose.
- `public/models/backshell.glb`: an original Blender Python reconstruction of a damaged Mars 2020 backshell, including a deformed double-wall cone, thermal-coating tear, internal bracing, retention hardware and fragments. Damage is illustrative. The canopy and suspension lines remain procedural Three.js geometry; the original canopy's vertex, colour and index buffers are preserved for the interactive ring decode.

Current fleet refinement: `scripts/model-upgrade/rebuild_global.ps1`, `global_finishes.py`, `refine_assets.py` and `pack_global.mjs`; original reconstruction: `build_assets.py`. Gold/silver foil, woven fabric, paint and silicon use deterministic UV-baked colour, roughness and tangent normal maps sampled in Python/NumPy (not a high-to-low photogrammetry bake). Only static MER pieces are joined in Blender; compression never flattens or joins articulated hierarchies. Closed opaque hardware culls back faces; thin foil/fabric and open backshell walls retain two-sided rendering. WebP uses quality 94 for normals and 82 for other maps, with 256–512 px data maps and colour maps up to 1024 px. Viking keeps all 27 images and exact float32 positions. Local packed sources and pinned pre-refinement exports remain under ignored `assets-raw/`; the seven delivered files total 9,206,720 bytes, 23.91% below their 12,100,500-byte baseline. See `docs/MODEL_UPGRADE.md` and the measured manifest `docs/model-assets.json`.

Metal reflections use a local procedural Mars sky/ground scene filtered with Three.js PMREM, without an external HDR image. The 64 px cube-face environment updates at most every 1.5 seconds and blends between bakes over 1.25 seconds, using the same component in Flight 73 and AR Hangar. Surface colours, dust, scuffs, foil relief and this environmental lighting are illustrative artistic treatments.

Site grounding uses actual mesh vertices as the vertical datum, modest runtime soil settling (12 mm for ordinary machines, 13 mm for the real Ingenuity), and a shallow illustrative soil bank beneath Viking 2's tilted stance. One batched, terrain-following multiply contact layer adds local occlusion beneath feet, wheels and canopy folds; directional shadows use a fitted depth range and smaller bias. Grounding lowers the canopy's whole placement 26 mm; the current authored shape in `parachute.ts` keeps its lowest folds about 4.5 mm above the soil. Its 2231-vertex ring topology, colour/index ordering and shared decode surface are retained; the separate cloth-shape revision owns the updated position reference. These grounding changes do not alter the seven GLB files. See `docs/GROUNDING.md` for the measurements and verification.

Mars globe: Viking MDIM 2.1 colorized global mosaic, NASA/JPL-Caltech/USGS, tiles from NASA Solar System Treks (Mars Trek, https://trek.nasa.gov/mars/), stitched into equirectangular maps of 4096×2048 (`src/scene/maps/mars.webp`, shown first) and 8192×4096 (`src/scene/maps/mars-8k.webp`, swapped in once loaded on GPUs that support it).

Relief: MGS MOLA global elevation (MOLA 128/64 ppd merge), NASA/GSFC MOLA Science Team, tiles from NASA Solar System Treks, stitched to 4096×2048, lightly smoothed and saved as `src/scene/maps/mars-height.jpg`. The globe shades this relief with the real Sun; relief is exaggerated for legibility, and the 8-bit stretched elevation is used for shape only, not for heights in metres.

Authored/adapted models are labelled illustrative. NASA originals show the hardware as built, not a measured present-day resting condition (for example, InSight's instruments are on its deck in the model but were placed on the ground in 2018–2019, and Ingenuity's rotor blades are intact in the source). Procedural loading/error silhouettes remain available for every station.

No NASA endorsement is implied. No new NASA logos or insignia were added to the reconstructions.

## Voice

- Ingenuity's spoken lines (`public/audio/ingenuity/`) were generated locally with the [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) text-to-speech model by hexgrad (Apache License 2.0), voice `af_aoede`, run through [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) (MIT) and ONNX Runtime (MIT). Its phonemizer, espeak-ng (GPL-3.0), was used only to make the clips and is not shipped. The radio treatment (a slight pitch lift, a faint vocoder layer, chorus, EQ and band limit) is this project's own Python/NumPy processing: `scripts/voice/ingenuity_voice.py`.
- The other machines' stories, which the auto tour reads aloud in each machine's own words (`public/audio/narrator/`), were generated the same way with the Kokoro-82M voice `am_michael`, with only a light EQ and no radio treatment, so the narrator and Ingenuity are always told apart.
- Every spoken line has a clip; only a line without one would fall back to the browser's own speech synthesis. Every other sound is synthesized in the browser.

## Fonts

- Martian Mono by Evil Martians, SIL Open Font License 1.1, via Fontsource.
- Newsreader by Production Type, SIL Open Font License 1.1, via Fontsource.

## Software

React, React DOM (MIT) · three.js (MIT) · React Three Fiber and drei (MIT) · Zustand (MIT) · Vite and Vitest (MIT) · TypeScript (Apache 2.0).
