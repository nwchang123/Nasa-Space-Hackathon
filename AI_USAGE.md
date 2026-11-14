# AI use

The team directed the project: the challenge choice, the roll-call concept, the audience and the review of every result.

Claude Code (Anthropic) wrote most of the code and drafted the machines' stories under that direction. Several Claude agents worked in parallel on separate parts (astronomy calculations, the machine stories and their fact check, the 3D scene and the console interface), and each part was tested before it was combined.

What this means for the content:

- **Facts.** The stories' dates, places and numbers were checked against NASA sources and recorded in `docs/FACT_CHECK.md`. Claims that could not be confirmed were removed or marked as approximate.
- **Voice.** The first-person voice of each machine is a storytelling device written for this project. No quotation is presented as something a machine or a person said unless the source is given.
- **Images and sound.** No AI-generated images, audio or 3D models are used. The globe maps are drawn procedurally in code and labelled illustrative. Console sounds are synthesized in the browser.
- **Calculations.** Lighting and distances use published methods (Mars24, Meeus lunar and solar theory, JPL approximate planetary elements), with tests against published reference values.
