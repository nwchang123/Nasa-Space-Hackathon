# Submission draft — Still Here: Flight 73

> 草稿，提交前对照 Space Apps 提交表单的实际字段和字数限制再改。英文部分可以直接粘贴。带 [TODO] 的地方要等第二版完成、部署好以后再填。

## Project name

Still Here: Flight 73

## High-level summary

Ingenuity, the first aircraft on another world, flew 72 times on Mars before a broken rotor blade grounded it for good in January 2024. *Still Here: Flight 73* imagines the one flight it never got to make. Starting from its resting place in Jezero crater, Ingenuity flies about 53,000 km across Mars to visit every NASA machine that reached the planet before it, in the order they arrived, and then flies home. At each stop the abandoned machine tells its own story (why it came, what it found, how its last day went and what its work still does today) and Ingenuity names what it inherited from it. The flight is fiction; every place, date, distance and number is real. Mars is lit by the Sun's real position at this moment, each site shows its real local solar time, and radio calls from Earth wait on tonight's real Earth–Mars light time before the silence comes back. The result turns hardware that most people think of as junk into a chain of inheritance that runs from Viking in 1976 to the helicopters NASA plans to send next.

## Links

- Final project: [TODO GitHub Pages URL]
- Source code: [TODO GitHub repository URL]
- Demo: [TODO 30-second video or slides, whichever the form asks for]

## Project details

**What it does.** A browser experience in three parts: a short prologue at Ingenuity's resting place, a nine-leg flight across a 3D Mars, and a flight log with a postcard the visitor can save. Each leg shows the real great-circle distance and heading. Each stop shows the machine's site in its real current light, its first-person story in four short beats, a radio call that goes unanswered, and one line of inheritance from Ingenuity.

**How it works.** React, TypeScript and Three.js (React Three Fiber), built as a static site with no server, accounts or tracking. Sun position and local solar time on Mars use the Mars24 algorithm (Allison & McEwen, 2000). Earth–Mars distance uses JPL's approximate planetary elements and is checked against JPL Horizons. Distances between sites use the great-circle formula on Mars. These calculations are unit tested against published reference values.

**Why it matters.** The challenge asks how equipment left on the Moon and Mars can be remembered. Most people know a few rover names and nothing about what happened to the machines afterwards. Seeing the hardware through the eyes of another abandoned machine makes the history personal, the real distances make the scale of Mars felt, and the inheritance line shows that each "dead" machine is the reason the next one worked. The tone is honest: the app says clearly what is imagined, sources every claim, and marks resting places that are known only approximately.

**Who it is for.** The general public, with no prior knowledge needed. A full flight takes about 10–15 minutes; every leg can be skipped and every story can be read without making the call.

**What we would do next.** [TODO after version 2: e.g. other languages, more hardware such as heat shields and backshells, a classroom mode]

## Use of artificial intelligence

We used Claude Code (Anthropic) as a coding and writing assistant. Under the team's direction it wrote most of the code and drafted the narration and the machines' stories; several AI agents worked in parallel on separate parts and each part was tested before it was combined. Every date, place and number was checked against NASA sources and recorded in `docs/FACT_CHECK.md`. No AI-generated images, video, audio or 3D models are used. Full details are in `AI_USAGE.md`.

## NASA data

- NASA Science and NASA JPL mission pages for Viking 1 and 2, Mars Pathfinder and Sojourner, Spirit, Opportunity, Phoenix, InSight, Mars 2020 and Ingenuity: dates, landing sites, mission events and current status. [TODO: paste the final list of URLs from docs/FACT_CHECK.md]
- NASA Space Science Data Coordinated Archive (NSSDCA) mission records.
- JPL Horizons, used to check the Earth–Mars distance calculation.
- [TODO if approved and used: NASA 3D Resources models and a NASA Mars global map, with file names]

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
| 0–4 s | Title screen, Mars turning, Ingenuity at Jezero | Ingenuity flew 72 times on Mars. |
| 4–8 s | Prologue: the broken blade, "Lift off" pressed | This is the flight it never got to make. |
| 8–13 s | Flying: route line across the globe, odometer running | 53,000 km to visit every NASA machine that came before it. |
| 13–18 s | Arrival at Opportunity, site lit by the real current Sun | Every place, date and number is real. Even the light. |
| 18–23 s | Radio call: signal meter, real light time, silence | Calls from Earth take tonight's real light time. Nothing answers. |
| 23–27 s | Inheritance line, then the flight log and postcard | Each one handed something on. |
| 27–30 s | Title card with project name and link | Still Here: Flight 73 · [link] |

## Checklist before 18:00 on 15 November

- [ ] Deployed to GitHub Pages and opened on a phone and a laptop
- [ ] Demo recorded and uploaded
- [ ] All [TODO] above filled
- [ ] FACT_CHECK.md has a source for every number shown in the app
- [ ] CREDITS.md lists every downloaded asset with its licence
- [ ] Final screenshots in `docs/screenshots/`
