# Still Here

**A roll call for the machines we left behind.**

NASA Space Apps Challenge 2026 · *Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars*

You are on the night shift at a Deep Space Network console with a list of eighteen names: landers, rovers, a helicopter, experiment packages and probes that NASA left on the Moon, on Mars and in deep space. Call each one. Most answer with silence, and then tell you, in their own voice, why they came, what they found, how their last day went and what their work still does today. Three of them still answer.

## What makes it different

- **Lit like tonight.** The Moon and Mars on screen are lit from the Sun's real direction at this moment. Each site shows whether it is in daylight now; Mars sites show their local solar time (Mars24 algorithm).
- **Calls take real light time.** A call to the Moon waits the real round trip, about 2.5 seconds, computed for tonight's Earth–Moon distance. Calls to Mars and deep space use tonight's distance too; the console plays those waits faster and says by how much.
- **Some machines still answer.** Radio calls never come back. The laser channel finds the retroreflectors that Apollo 11, 14 and 15 left on the Moon. They need no power, and observatories still bounce lasers off them to measure the Moon's distance.
- **Sixty years in thirty seconds.** The opening time-lapse lights each machine on its real arrival date and dims it on its real last-signal date.
- **A postcard home.** The shift report ends with a postcard to one machine, drawn in the browser and saved as an image. Nothing is uploaded.

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
| `src/data/machines.ts` | The 18 machines: places, dates, first-person stories, facts and sources |
| `src/astro/` | Sun position on the Moon and Mars, Earth–Moon and Earth–Mars distances, light time |
| `src/scene/` | Three.js / React Three Fiber stage: globes, live lighting, markers, deep-space schematic, signal effects |
| `src/ui/` | Title, time-lapse, roll-call console, calls, story, report and postcard |
| `src/store.ts` | App state shared by the scene and the console |
| `docs/FACT_CHECK.md` | Every date and number in the stories, with its source |

React 19, TypeScript, Three.js, React Three Fiber, drei and Zustand. No accounts, no analytics, no server.

## Accuracy

- Dates, places and numbers in the stories come from NASA mission pages and the NASA Space Science Data Coordinated Archive. Each one is listed with its source in [`docs/FACT_CHECK.md`](docs/FACT_CHECK.md).
- No quotes are invented. The machines' first-person voice is a storytelling device; the facts inside it are real.
- Moon and Mars lighting and distances are computed, not looked up. The methods and their accuracy are documented in `src/astro/`, and the tests in `tests/astro.test.ts` check them against published values.
- Some numbers are estimates, such as the distances of the Pioneer probes and the Kepler telescope. The console marks them with `~` and says how they were estimated.
- The globe surface maps are illustrative: drawn in code with the real major features in their real places. Machine positions are real.

## Development record

This project was started from an empty folder on 14 November 2026 during the Sarawak Space Challenge (NASA Space Apps Challenge 2026). The git history records every step. AI assistance is described in [`AI_USAGE.md`](AI_USAGE.md); credits and licences are in [`CREDITS.md`](CREDITS.md).
