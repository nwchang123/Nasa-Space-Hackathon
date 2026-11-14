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

3D models from NASA 3D Resources (https://science.nasa.gov/3d-resources/), which describes its files as "free and without copyright". Converted and compressed with glTF-Transform 4.5.1 (meshopt geometry, WebP textures up to 1024 px); otherwise unmodified:

- "Viking Lander", NASA/Michael D. Carbajal: used for Viking 1 and Viking 2 (`public/models/viking-lander.glb`)
- "InSight Cruise Lander (arm deployed)", NASA/Brian E. Kumanchik (`public/models/insight.glb`)
- "Ingenuity Mars Helicopter", NASA/Brian E. Kumanchik (`public/models/ingenuity.glb`)
- "Mars Exploration Rover – Opportunity (MER-B)", NASA/Ames Research Center: used for Spirit and Opportunity (`public/models/mer.glb`)

Mars globe: Viking MDIM 2.1 colorized global mosaic, NASA/JPL-Caltech/USGS, tiles from NASA Solar System Treks (Mars Trek, https://trek.nasa.gov/mars/), stitched into a 4096×2048 equirectangular map (`src/scene/maps/mars.webp`).

Pathfinder and Sojourner, Phoenix, and Perseverance's parachute and backshell have no NASA model; they are drawn procedurally in code and labelled illustrative. The NASA models show each machine as built, not as it rests today (for example, InSight's instruments are on its deck in the model but were placed on the ground in 2018–2019, and Ingenuity's rotor blades are intact in the model).

No NASA endorsement is implied, and no NASA logos or insignia are used.

## Fonts

- Martian Mono by Evil Martians, SIL Open Font License 1.1, via Fontsource.
- Newsreader by Production Type, SIL Open Font License 1.1, via Fontsource.

## Software

React, React DOM (MIT) · three.js (MIT) · React Three Fiber and drei (MIT) · Zustand (MIT) · Vite and Vitest (MIT) · TypeScript (Apache 2.0).
