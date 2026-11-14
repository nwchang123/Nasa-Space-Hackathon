# Still Here: Flight 73

**Ingenuity flew 72 times on Mars. This is the flight it never got to make.**

NASA Space Apps Challenge 2026 · *Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars*

In January 2024, Ingenuity — the first aircraft on another world — broke its rotor blades on its 72nd flight and never flew again. In *Still Here: Flight 73*, it imagines one more flight: from its resting place in Jezero crater to every NASA machine that reached Mars before it, in the order they arrived, and then home. At each stop the machine tells its own story: why it came, what it found, how its last day went and what its work still does today. Then Ingenuity says what it inherited from it.

> Flight 73 never happened. Every machine, place and date on the way is real.

## What makes it different

- **A real machine as the guide.** The narrator is a piece of abandoned NASA hardware, telling the story of the ones that came before it.
- **The distance is the story.** Nine legs, about 53,000 km across Mars, with real great-circle distances and headings. Ingenuity's 72 real flights covered 17.0 km.
- **Lit like right now.** Mars is lit from the Sun's real direction at this moment. Every stop shows its real local solar time, and its scene is lit by the Sun's real height and direction there (Mars24 algorithm).
- **Calls take real light time.** Radio calls from Earth wait on tonight's real Earth–Mars distance; the console shows how much it speeds the wait up. Nothing answers.
- **A line of inheritance.** Each stop hands something on — airbag landings, proof of past water, ice under the soil, a map of the deep interior — until it reaches Ingenuity, and from Ingenuity to the helicopters that come next.
- **A postcard home.** The flight log ends with a postcard to one machine, drawn in the browser and saved as an image. Nothing is uploaded.

## Run it

Node.js 24.11 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:5190/>.

```bash
npm test
npm run build
```

`npm run build` type-checks and writes a static site to `dist/`. The included GitHub Actions workflow deploys it to GitHub Pages with the right base path.

## How it is built

| Path | What it does |
|---|---|
| `src/types.ts` | Shared data contracts |
| `src/data/machines.ts` | The stops: places, dates, first-person stories, facts and sources |
| `src/data/flight.ts` | Ingenuity's narration: prologue, each leg, inheritance lines, epilogue |
| `src/flight/route.ts` | Great-circle legs, distances, headings and the flight timing |
| `src/astro/` | Sun position and local solar time on Mars (Mars24), Earth–Mars distance and light time |
| `src/scene/` | Three.js / React Three Fiber: the globe, the route, Ingenuity's flight, the site scenes |
| `src/ui/` | Title, flight console, radio call, story, flight log and postcard |
| `docs/FACT_CHECK.md` | Every date and number, with its source |
| `docs/PLAN-flight-73.md` | The plan this version was built from |

React 19, TypeScript, Three.js, React Three Fiber, drei and Zustand. No accounts, no analytics, no server.

## Accuracy

- Dates, places and numbers come from NASA mission pages. Each one is listed with its source in [`docs/FACT_CHECK.md`](docs/FACT_CHECK.md).
- The flight and the machines' first-person voices are storytelling devices. No quotes are invented.
- Lighting, local time and distances are computed, not looked up; `tests/astro.test.ts` checks them against published reference values and JPL Horizons.
- Resting places known only roughly are marked "approx." in the app.
- The globe surface map and any placeholder models are illustrative and labelled as such.

## Development record

This project was started from an empty folder on 14 November 2026 during the Sarawak Space Challenge (NASA Space Apps Challenge 2026). The git history records every step, including the first version (a roll call across the Moon, Mars and deep space) and the move to this Mars-only flight. AI assistance is described in [`AI_USAGE.md`](AI_USAGE.md); credits and licences are in [`CREDITS.md`](CREDITS.md).
