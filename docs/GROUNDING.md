# Site grounding and shadow repair

The repair is in `C:\Users\HP\Downloads\NASA\still-here`. It changes runtime placement, terrain and shadow rendering; all seven GLB files retain their material-upgrade SHA-256 hashes. NASA geometry, the six MER wheel nodes/contact marker, Sojourner/APXS, Phoenix's shoulder and scoop, and Ingenuity's rotor/broken-tip hierarchy remain intact.

## Directional shadow precision

The site light remains 80 m from its target. `Lights.tsx` fits the orthographic footprint around the machine, companion landing area and clearing. Most close views use a **72–88 m** depth interval around that light, with a wider interval for the 18 m EDL clearing. The frustum expands for a physical Ingenuity flown beyond its initial area. Bias is **−0.00005**, with normal bias **0.003 × SITE_SCALE**.

The previous 200 m interval and −0.0004 bias alone moved the shadow comparison by about 80 mm, before the 20 mm normal offset. The fitted static-site intervals now keep the combined nominal offset below **6 mm**. Shadow-map resolution stays 2048². The much smaller footprint at close stations also improves the size of a ground texel.

## Physical floor and soil

`normalizeModel` retains its established uniform scale/framing calculation, but obtains the vertical floor from actual transformed vertices. Rotating a mesh's local bounding box can place empty box corners below every real vertex: on the NASA Ingenuity this left the actual toes about 23–25 mm above the nominal ground. Real-vertex grounding corrects that error. Sub-10-micrometre differences retain the legacy floor to preserve Viking's exact normalized camera/frame contract.

Ordinary site bodies settle **12 mm** into the soil through the model registry pose. Spirit retains its pre-existing tilted, deeply stuck stance. The real Ingenuity settles **13 mm**, smoothly releasing that offset over its first 0.12 m of takeoff. The physical aircraft left at home during phantom flight uses the same landing datum. Its rig is published before lights/contact rendering, and the golden phantom keeps its existing material and no physical contact-shadow layer.

After free flight, Ingenuity samples the terrain slope, aligns its whole landing frame and checks the ground under all four real toes before settling. This correction also releases over the first 0.12 m of takeoff; it never deforms a leg or changes a rotor/broken-marker child transform.

Viking 2 keeps its 8.5° illustrative tilt. Its lift falls from 0.20 to **0.18 m**, with a broad, continuous procedural soil bank matching the pad plane under the raised side. The outer slope blends into the surrounding soil. Only this site adds a locally finer terrain grid. The real pads sink slightly into the sloping soil instead of standing above a flat plane or on separate artificial platforms. The soil bank is an artistic reconstruction, not measured Viking landing-site topography.

`Ground.heightAt` now samples the **actual two terrain triangles**, rather than a different analytic height between coarse mesh vertices. Clearing generation includes the grid-cell margin needed for the whole advertised area to remain flat. Pathfinder's clearing is **3.6 m**, EDL's **18 m**. Rocks, flight landing heights, signature decals and contact patches all use the same rendered surface.

The canopy was concurrently moved to `parachute.ts` and given a separate cloth-shape/material revision. That work is retained. Grounding changes its whole placement by **−26 mm**, leaving the current lowest folds about **4.5 mm** above the flat soil, and enables `castShadow`. The 2231-vertex ring topology and original colour/index ordering remain; the current position reference in `contracts.json` belongs to that separate shape revision. Decode geometry still shares the actual canopy position/index buffers, with labels sampled on the new surface. Body/canopy and Ingenuity story anchors follow their affected surfaces; the grounding repair does not change camera distance settings or local animation coordinates.

## Contact occlusion

`GroundContacts.tsx` and `ContactShadowMesh` render one batched contact layer per active site. Bottom islands are measured from the loaded model once. Six separate Sojourner contacts belong to the animated rover node; MER contacts follow its existing drag transform. Four real Ingenuity feet and low canopy folds are included.

Each soft radial patch samples terrain at every vertex and sits **3 mm** above it. Premultiplied custom blending multiplies the existing ground colour, with low contrast and feathered vertex alpha, so the layer darkens the soil without glowing at night. It writes no depth and casts no additional shadow. Strength decreases as a part rises, and the batch fades with the minimum of the site's ground/machine fades, including late model loading. No extra shadow render target, downloaded texture or per-foot draw call is introduced. Owned geometry/materials are disposed on unmount; object contact references live in a WeakMap rather than JSON-cloned `userData`.

## Verification

Final checks after integrating the concurrent canopy revision: **405 tests in 26 files pass**, and `npm run build` passes TypeScript and Vite. The matched captures contain eight before/after pairs and 22 final screenshots. A real keyboard-controlled flight moves Ingenuity about **5.81 m** from the original clearing; after it settles, all four toe gaps remain **10.8–14.4 mm below** the sampled terrain, with the broken-tip marker present.

The regression suite includes real-vertex floor reproduction, all three Viking/Phoenix/InSight pads, all six Opportunity wheels, four Ingenuity toes, actual terrain ray intersections, triangle-height interpolation, moving/flying/fading contact patches, and capacity for the backshell/debris plus all low canopy folds. A posed APXS-to-actual-rock test confirms the 12 mm site sink preserves contact within 12 mm. Existing Viking exact triangle/image/camera tests, canopy buffer hashes, hotspot surface-distance, Phoenix arm and Hangar tests remain unchanged.

Matched **1280×800** before/after screenshots cover Viking 1, Viking 2, Opportunity and Ingenuity at noon and in lower morning light. The final pass also checks all other stops, Viking scanning and frost, Pathfinder rollout/APXS, Spirit drag, Phoenix's trench and the complete EDL decode. Rear views check Viking 2's far pad and Ingenuity's other feet.

| Actual site contact | Measured sink below rendered terrain |
| --- | ---: |
| Viking 1, three pads | 12.0 mm |
| Viking 2, three tilted pads | 18.0–21.6 mm |
| Opportunity, six wheels | 12.0 mm |
| Phoenix, three pads | 12.0 mm |
| InSight, three pads | 9.5–12.0 mm |
| Real Ingenuity, four toes | 10.8–13.0 mm |

Local evidence is under ignored `output/playwright/grounding/`: [comparison page](../output/playwright/grounding/index.html), runtime reports, screenshots, `npm-test.log` and `npm-build.log`. Browser page/JavaScript errors are zero. Three.js deprecations, ANGLE constant-rounding notices and Program object warnings observed on the EDL transition remain recorded in `after/final-console.log` and `after/edl-integrated-console.log`; warnings were not suppressed. Visual and signature checks pass. Desktop WebGL captures do not establish a physical phone/WebXR result.
