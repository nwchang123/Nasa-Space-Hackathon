# Submission draft — Still Here: Flight 73

> 草稿，提交前对照 Space Apps 提交表单的实际字段和字数限制再改。英文部分可以直接粘贴。已按第三版（全屏 HUD、开场转子测试、每站互动）更新。带 [TODO] 的地方要等部署好以后再填。

## Project name

Still Here: Flight 73

## High-level summary

Ingenuity, the first aircraft on another world, flew 72 times on Mars before a broken rotor blade grounded it for good in January 2024. *Still Here: Flight 73* imagines the one flight it never got to make. The visitor first tries to spin up the real helicopter's damaged rotors; when they fail, an imagined Ingenuity lifts off without it. Starting from its resting place in Jezero crater, Ingenuity flies about 53,000 km across Mars to visit the NASA landers and rovers whose work on Mars is done, in the order they arrived, and then flies home. At each stop the abandoned machine tells its own story (why it came, what it found, how its last day went and what its work still does today), the visitor gets one hands-on moment from its mission, and Ingenuity names what it inherited from it. The flight is fiction; every machine, place and date is real, and each distance is measured between the machines' recorded resting places. Mars is lit by the Sun's real position at this moment, each site shows its real local solar time, and radio calls from Earth wait on tonight's real Earth–Mars light time before the silence comes back. The result turns hardware that most people think of as junk into a chain of inheritance that runs from Viking in 1976 to the helicopters NASA plans to send next.

## Links

- Final project: [TODO GitHub Pages URL]
- Source code: [TODO GitHub repository URL]
- Demo: [TODO 30-second video or slides, whichever the form asks for]

## Project details

**What it does.** A full-screen 3D browser experience in three parts.

- *Prologue.* At Ingenuity's resting place the visitor spins up its rotors. They never reach flight speed, a rotor-fault warning names the blades damaged on Flight 72, and a translucent, imagined Ingenuity lifts off while the real one stays on the sand.
- *Flight.* Nine legs across a 3D Mars lit by the real Sun, with the real great-circle distance and heading of each leg. The visitor can hold Space to boost, skip a leg, or switch to a black-and-white navcam looking straight down, with live latitude, longitude, heading and Sun height.
- *Stops.* Each site can be orbited with the mouse and is lit as it is right now; a 24-hour slider shows it at any hour of today's sol. Numbered hotspots on the hardware open the machine's first-person story in four short beats. Each stop has one hands-on moment from its mission: scanning Viking 1's first photo from the surface, Viking 2's winter frost, Sojourner rolling down its ramp, Spirit dragging its jammed wheel, the 2018 dust storm darkening Opportunity's sky, Phoenix scooping ice and seeing snow, a marsquake under InSight, the binary message in Perseverance's parachute, and Ingenuity's daily wake-up routine. A radio call from Earth waits on the real light time and goes unanswered, and Ingenuity says what it inherited.
- *Home.* The imagined Ingenuity settles back into the real one. A flight log totals the trip, and the visitor can write a postcard to one machine and save it as an image.

**How it works.** React, TypeScript and Three.js (React Three Fiber), built as a static site with no server, accounts or tracking. The globe uses NASA's Viking colour mosaic with MOLA relief shaded by the real Sun. Machines combine credited NASA 3D Resources assets with illustrative Blender reconstructions. Spirit and Opportunity use NASA's detailed MER `.blend`; Pathfinder/Sojourner and the damaged backshell are authored with local Blender Python, and Phoenix is adapted from the existing NASA InSight platform with rebuilt mission instruments and a separate shoulder-pivoted arm. Procedural UV-baked PBR maps and glTF-Transform 4.5.1 compression (meshopt, WebP up to 1024 px) keep them suitable for the browser. Articulated node transforms, ramp coordinates and the original canopy vertex order are preserved for the signature actions. Sun position and local solar time on Mars use the Mars24 algorithm (Allison & McEwen, 2000), for the current moment or any hour of the sol. Earth–Mars distance uses JPL's approximate planetary elements and is checked against JPL Horizons. Distances between sites use the great-circle formula on Mars. These calculations are unit tested against published reference values.

**Why it matters.** The challenge asks how equipment left on the Moon and Mars can be remembered. Most people know a few rover names and nothing about what happened to the machines afterwards. Seeing the hardware through the eyes of another abandoned machine makes the history personal, the real distances make the scale of Mars felt, and the inheritance line shows that each "dead" machine is the reason the next one worked. The tone is honest: the app says clearly what is imagined, sources every claim, and marks resting places that are known only approximately.

**Who it is for.** The general public, with no prior knowledge needed, on a desktop or laptop browser. A full flight takes about 10–15 minutes; every leg can be boosted or skipped, any stop can be reached straight from the route bar, and every story can be read without making the call.

**What we would do next.** Other languages, starting with Malay and Chinese. More of the hardware left behind, such as heat shields, descent stages and the Mars 2020 sky crane, and the same idea for NASA hardware on the Moon. A classroom mode with short activities for each stop. A phone layout. [TODO 团队确认这几条]

## Use of artificial intelligence

We used Claude Code (Anthropic) as a coding and writing assistant. Under the team's direction it wrote most of the code and drafted the narration and the machines' stories; several AI agents worked in parallel on separate parts and each part was tested before it was combined. Codex (OpenAI) subsequently assisted with local Blender Python modeling, NASA asset adaptation, compression and animation regression checks. The authored/adapted reconstructions and procedural PBR texture bakes are disclosed and labelled illustrative; no cloud image, video, audio or 3D generation service was used. Dates, places and numbers are sourced in `docs/FACT_CHECK.md`. Full details are in `AI_USAGE.md` and `CREDITS.md`.

## NASA data

- NASA Science and NASA JPL mission pages for Viking 1 and 2, Mars Pathfinder and Sojourner, Spirit, Opportunity, Phoenix, InSight, Mars 2020 and Ingenuity: dates, landing sites, mission events and current status. [TODO: paste the final list of URLs from docs/FACT_CHECK.md]
- NASA Space Science Data Coordinated Archive (NSSDCA) mission records.
- JPL Horizons, used to check the Earth–Mars distance calculation.
- NASA 3D Resources models: "Viking Lander" (used for Viking 1 and 2), "InSight Cruise Lander (arm deployed)" (also the adapted Phoenix platform), "Ingenuity Mars Helicopter" and the detailed "Mars Exploration Rover – Spirit and Opportunity" `.blend` (used for both MER rovers). Pathfinder/Sojourner and the damaged backshell are original illustrative reconstructions, not NASA model downloads. Full source links and modifications are listed in `CREDITS.md`.
- Mars globe: Viking MDIM 2.1 colour mosaic (NASA/JPL-Caltech/USGS) and MGS MOLA elevation (NASA/GSFC MOLA Science Team), both from NASA Solar System Treks (Mars Trek).
- NASA Photojournal and JPL news releases behind the hands-on moments, e.g. PIA00381 (Viking 1's first photo) and PIA24431 (the parachute's code), listed in `docs/FACT_CHECK.md`.

## Space agency partner and other data

- Mars24 algorithm (NASA GISS) and Allison & McEwen (2000) for Mars local time and Sun position.
- Italian Space Agency (ASI): the laser retroreflector carried on InSight, as described on NASA's pages. [TODO: confirm wording against FACT_CHECK]

## References

See `docs/FACT_CHECK.md` for every claim and its source, and `CREDITS.md` for fonts, software and methods.

---

## 30-second demo video (script draft)

Screen recording only, no stock footage. Captions on screen, no voice-over required.

| Time | Picture | Caption |
|---|---|---|
| 0–3 s | Title screen, Mars turning, route breathing, Ingenuity's beacon at Jezero | Ingenuity flew 72 times on Mars. |
| 3–7 s | Prologue: rotors spin up, shake, "Rotor imbalance" warning; the translucent Ingenuity lifts off | This is the flight it never got to make. |
| 7–11 s | Flying over the lit globe, odometer running, Space held for boost; a second of navcam | 53,000 km to every NASA lander and rover whose work on Mars is done. |
| 11–15 s | Viking 1: orbit around the lander, the first photo scanning in | Every machine, place and date is real. |
| 15–19 s | Opportunity: dust-storm slider dragged up, the sky goes dark, "Last signal · 10 June 2018" | Even the light: each site is lit by the Sun as it is right now. |
| 19–23 s | InSight marsquake rings, then the parachute decoding DARE MIGHTY THINGS | Touch what each one did. |
| 23–27 s | Home: the two Ingenuities merge, wake-up routine, flight log | Each one handed something on. |
| 27–30 s | Title card with project name and link | Still Here: Flight 73 · [link] |

Screenshots for each shot are in `docs/screenshots/flight-73/` (01–15).

## Checklist before 18:00 on 15 November

- [ ] Deployed to GitHub Pages and opened in Chrome on a laptop (desktop only; no phone layout planned)
- [ ] Frame rate checked in Chrome with `?fps` on a laptop like the judges' (title, a flight, a site with an action running)
- [ ] Sound checked once with speakers on (rotor spin-up, fault, quake, shutter)
- [ ] Demo recorded and uploaded
- [ ] All [TODO] above filled
- [ ] FACT_CHECK.md has a source for every number shown in the app (V3 sections are in; one last pass after the final text freeze)
- [ ] CREDITS.md lists every downloaded asset with its licence
- [x] Screenshots of version 3 in `docs/screenshots/flight-73/`
