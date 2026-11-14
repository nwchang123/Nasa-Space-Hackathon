# AI use

The team directed the project: the challenge choice, the concept (first a roll call, then Ingenuity's imagined Flight 73), the audience, and the review of every result.

Claude Code (Anthropic) wrote most of the code and drafted the narration and the machines' stories under that direction. Several Claude agents worked in parallel on separate parts (astronomy calculations, the stories and their fact check, the 3D scene, the interface, and the search for NASA 3D assets), and each part was tested before it was combined. Version 3 was built the same way: four agents, each owning its own files, built the full-screen interface, the rotor-test prologue and navcam, the site orbit, hotspots and sun slider, and the hands-on action at each stop, against a shared contract written first; one lead agent combined them and checked the result in the browser.

What this means for the content:

- **Facts.** Dates, places and numbers were checked against NASA sources and recorded in `docs/FACT_CHECK.md`. Claims that could not be confirmed were removed or marked as approximate.
- **Voice.** Flight 73 is imagined, and the first-person voices of Ingenuity and the other machines are storytelling devices written for this project. No quotation is presented as something a machine or a person said.
- **Images, models and sound.** No AI-generated images, audio or 3D models are used. The globe uses NASA's Viking colour mosaic and MOLA elevation; machines with no NASA 3D model are simplified silhouettes built in code and labelled illustrative; NASA 3D models and maps are credited in `CREDITS.md`. The hands-on actions are re-creations in the 3D scene, not NASA imagery. All sounds are synthesized in the browser.
- **Calculations.** Lighting, local time and distances use published methods (Mars24, JPL approximate planetary elements), with tests against published reference values.
