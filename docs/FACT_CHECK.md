# Fact check: Flight 73

> The Moon and deep-space sections (Surveyor 3, Apollo 11/14/15/17, Pioneer 10/11,
> NEAR Shoemaker, Dawn, Kepler) were removed when the project moved to Mars only. They are in
> git history before commit `dca821e`.

Every date, number and claim in `src/data/machines.ts` (the nine stops) and `src/data/flight.ts`
(Ingenuity's lines for Flight 73), with where it was checked. Pages were read on 14 November 2026.
NSSDCA (nssdc.gsfc.nasa.gov) could not be opened from the build environment, so NASA Science,
nasa.gov and JPL pages were used instead.

**Conventions**

- Dates are UTC. Where a NASA page gives a US local date, the UTC date is noted.
- Coordinates are planetocentric latitude and east longitude (−180..180).
- **Marked ⚠** = not confirmed on a NASA page in this pass. These are well-established figures
  stated as approximate, values flagged `approxPosition: true` in the data, or claims derived
  from the data (and tested in `tests/flight.test.ts`).
- Flight 73 itself is fiction. The UI says so on the title screen and in the footer
  (`FICTION_NOTE`). Nothing below is about the imagined flight; it is about the real facts it
  passes.
- **Who is on the route.** The title screen, README, submission and page description say Flight 73
  visits "the NASA landers and rovers whose work on Mars is done". That set is complete: Viking 1
  and 2, Mars Pathfinder with Sojourner, Spirit, Opportunity, Phoenix and InSight are all stops
  (plus Perseverance's backshell and parachute, and Ingenuity's own home). Mars Polar Lander and
  the Deep Space 2 probes were lost on arrival in 1999 and never worked on the surface ⚠.
  Curiosity and Perseverance are not stops because they are still working: NASA says both are
  "still operational" as of 11 Oct 2026, and that Curiosity "remains hard at work" (PERSREC,
  checked 14 Nov 2026). The earlier wording, "every NASA machine that reached Mars before it",
  was dropped on 14 Nov 2026 because Curiosity reached Mars before Ingenuity and is not a stop.

Short source keys:

| Key | URL |
|---|---|
| V1 | https://science.nasa.gov/mission/viking-1/ |
| V2 | https://science.nasa.gov/mission/viking-2/ |
| MPF | https://science.nasa.gov/mission/mars-pathfinder/ |
| SOJ | https://www.nasa.gov/image-article/nasas-first-rover-red-planet/ |
| SPI | https://science.nasa.gov/mission/mer-spirit/ |
| TROY | https://www.nasa.gov/image-article/spirit-embedded-soft-soil-mars-as-engineers-devise-methods-free-spirit/ |
| OPP | https://science.nasa.gov/mission/mer-opportunity/ |
| MER | https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/ |
| OPPD | https://www.nasa.gov/image-article/opportunity-emerges-dusty-picture/ |
| PHX | https://science.nasa.gov/mission/phoenix/ |
| PHX15 | https://www.nasa.gov/history/15-years-ago-phoenix-mars-lander-launches-to-the-red-planet/ |
| INS | https://science.nasa.gov/mission/insight/ |
| INSR | https://www.nasa.gov/missions/insight/nasa-retires-insight-mars-lander-mission-after-years-of-science/ |
| INSC | https://www.nasa.gov/missions/insight/nasa-insight-study-provides-clearest-look-ever-at-martian-core/ |
| INSD | https://www.nasa.gov/missions/insight/nasa-mars-orbiter-spots-retired-insight-lander-to-study-dust-movement/ |
| RR | https://www.nasa.gov/image-article/retroreflectors-from-apollo-mars/ |
| M2020 | https://science.nasa.gov/mission/mars-2020-perseverance/ |
| JPL2022 | https://www.jpl.nasa.gov/news/nasas-mars-helicopter-spots-gear-that-helped-perseverance-rover-land/ |
| JPLFRS | https://www.jpl.nasa.gov/news/nasas-mars-perseverance-rover-provides-front-row-seat-to-landing-first-audio-recording-of-red-planet/ |
| DECODER | https://science.nasa.gov/resource/mars-decoder-ring/ |
| RBASICS | https://science.nasa.gov/planetary-science/programs/mars-exploration/rover-basics/ |
| PIA24333 | https://science.nasa.gov/photojournal/perseverance-and-mars-2020-spacecraft-components-on-the-surface/ |
| ING | https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/ |
| INGB | https://www.nasa.gov/missions/mars-2020-perseverance/ingenuity-helicopter/nasas-ingenuity-mars-helicopter-team-says-goodbye-for-now/ |
| INGX | https://www.nasa.gov/missions/mars-2020-perseverance/ingenuity-helicopter/nasa-performs-first-aircraft-accident-investigation-on-another-world/ |
| PERSREC | https://science.nasa.gov/blogs/perseverance-mars-rover/2026/10/12/nasas-perseverance-sets-off-world-record-for-total-distance-driven/ |

## The nine stops (`src/data/machines.ts`)

### viking-1
| Claim | Source |
|---|---|
| Launch 20 Aug 1975; landed 20 Jul 1976 (11:53 UT); stopped 11 Nov 1982 after a faulty command; recovery failed | V1 |
| First truly successful Mars landing; designed to look for evidence of life | V1 |
| Coordinates: V1 gives 22.483° N, 47.94° W (planetographic); data use 22.27° N, −47.95° (planetocentric equivalent) ⚠ conversion | V1 / ⚠ |
| Landed seven years to the day after Apollo 11 (20 Jul 1969), kept as a date anchor only | V1 (landing date) |
| Biology results a weak positive; organic-compound test found none | V1 |
| Daily, then weekly weather reports; renamed Thomas Mutch Memorial Station in Jan 1982 | V1 |
| Two SNAP-19 RTGs per lander; landers returned 4,500 photos | V1 |
| Record 6 years 116 days broken by Opportunity on 20 May 2010 | OPP |
| "The question I came to ask is still open": Perseverance's 2025 sample holds *potential* biosignatures that need more study | M2020 |
| Planned life "90 days" ⚠ (Viking primary mission) | ⚠ |

### viking-2
| Claim | Source |
|---|---|
| Launch 9 Sep 1975; landed 3 Sep 1976; lander data until 12 Apr 1980 | V2 |
| Original site rough; moved to Utopia Planitia near the polar cap for water and a better chance of life | V2 |
| 47.968° N, 225.71° W (planetographic) → 47.64° N, 134.29° E ⚠ conversion | V2 / ⚠ |
| Tilted 8.5°; 6,460 km from Viking 1; three soil samples; inconclusive; UV-made reactants suspected | V2 |
| Note: the route's great circle between our two Viking coordinates is 6,511 km. NASA's 6,460 km is a rounded figure; the 0.8 % gap comes from rounding and the coordinate conversion. The fact chip keeps NASA's number. | V2 / derived |
| Orbiter ended 24 Jul 1978 after leaks | V2 |
| Renamed Gerald Soffen Memorial Station (July 2001) | V2 |
| Orbiters: 52,663 images, ~97% mapped; landers: 4,500 photos | V1, V2 |

### pathfinder-sojourner
| Claim | Source |
|---|---|
| Launch 4 Dec 1996; landed 4 Jul 1997 at Ares Vallis | MPF |
| Airbags first used; ~15 bounces, up to 15 m high | MPF |
| First-ever robotic rover on Mars (Sojourner) | MPF |
| Sojourner 10.6 kg; rolled down the ramp on sol 2 | MPF |
| >16,500 lander images; rounded pebbles suggest running water in a warmer past | MPF |
| Carl Sagan Memorial Station | MPF |
| 83 days of a planned 7-day rover mission; final data 10:23 UTC 27 Sep 1997; ended 10 Mar 1998 | SOJ |
| Spirit/Opportunity used the same type of airbags | SPI |
| Coordinates 19.13° N, 33.22° W ⚠ widely cited, not on the NASA page; flagged `approxPosition` | ⚠ |

### spirit
| Claim | Source |
|---|---|
| Launch 10 Jun 2003 (17:58 UTC); landed 3 Jan 2004 20:35 PST = 4 Jan 2004 UTC; 28 bounces | SPI |
| Landing 14.5692° S, 175.4729° E; Gusev a possible former lake | SPI, MER |
| Twins sent to opposite sides of Mars | SPI, MER |
| Front wheel stopped (2006); dragged wheel exposed nearly pure silica (2007) → hot springs or steam vents | SPI |
| Driving backwards dragging the right-front wheel at Troy | TROY |
| Stuck in soft soil 1 May 2009 near Home Plate; made a stationary platform; tilt not achieved | SPI, TROY |
| Last contact 22 Mar 2010; >1,300 commands; search ended 25 May 2011; cold the likely cause | SPI |
| 7.73 km; 6 y 2 m 19 d; >25× planned life | SPI |
| Final position −14.6°, 175.5° ⚠ approximate (within a few km of the landing point; 7.73 km total drive) | ⚠ |

### opportunity
| Claim | Source |
|---|---|
| Launch 7 Jul 2003 20:18 PDT = 8 Jul 2003 UTC; landed 25 Jan 2004 (04:54 UTC) in Eagle crater | OPP |
| Minerals suggested a wet history; rovers confirmed long-standing water | MER |
| Designed for 90 sols and 1,000 m; 45.16 km; marathon passed March 2015; 60× life expectancy | OPP |
| Planet-wide dust storm; tau above 10; last signal 10 Jun 2018 | OPP, OPPD |
| Command frequency raised in Sept 2018; end declared 13 Feb 2019 | OPPD, OPP |
| Final resting place: Perseverance Valley | OPP |
| Record passed by Perseverance on 11 Oct 2026 | OPP, MER |
| Final position −2.3°, −5.4° ⚠ approximate (western rim of the 22 km Endeavour crater) | ⚠ |

### phoenix
| Claim | Source |
|---|---|
| Launch 4 Aug 2007; landed 25 May 2008 (23:38 UT); 68.22° N, 234.25° E (= −125.75°) | PHX |
| Farther north than any previous mission; latitude like northern Alaska | PHX, PHX15 |
| Robotic arm, tiny ovens, portable lab | PHX, PHX15 |
| Bright clumps in the trench were water ice, just below the surface; perchlorate (microbe energy source, possible oxygen) | PHX, PHX15 |
| Snow falling from cirrus clouds | PHX15 |
| Nominal mission 90 sols; last signal 2 Nov 2008 (sol 157); final post "triumph" in binary | PHX15 |
| No contact in Jan 2010; MRO images show damage, likely from CO₂ ice | PHX15 |
| "Knowing ice lies this close to the surface matters to anyone planning to live on Mars": NASA's SkyFall helicopters are meant to scout human landing sites and map subsurface water ice; perchlorate a possible oxygen source for future missions | ING, PHX15 |

### insight
| Claim | Source |
|---|---|
| Launch 5 May 2018; landed 26 Nov 2018, Elysium Planitia; site ~4.5° N, 135.9° E | INS |
| Studied the deep interior; "pulse, temperature and reflexes"; arm placed the seismometer | INS |
| 1,319 marsquakes; seismometer last instrument on; last contact 15 Dec 2022 | INSR |
| Far-side quakes (2021) → liquid iron core smaller and denser than thought | INSC |
| HiRISE image 23 Oct 2024: panels reddish-brown; used to study dust movement | INSD |
| Carries the Laser Retroreflector for InSight; no Mars laser currently in the works | RR |
| 1.8 m arm | INS |
| Planned life "1 Mars year" ⚠ (prime mission length) | ⚠ |

### mars2020-edl (Perseverance's parachute and backshell) — new
| Claim | Source |
|---|---|
| Launched with Perseverance 30 Jul 2020; landed 18 Feb 2021 | M2020, ING, JPL2022 |
| The cone-shaped backshell protected the rover in deep space and during its fiery descent on 18 Feb 2021 | JPL2022 |
| Ingenuity rode under the rover's belly | ING (see ingenuity) |
| Hit the Martian atmosphere at nearly 20,000 km/h (12,500 mph) | JPL2022 |
| Parachute deployed in less than a second, from a 46 × 66 cm (18 × 26 in) packed cylinder to 21.5 m (70.5 ft) wide | JPLFRS |
| Biggest parachute ever deployed on Mars | JPL2022 |
| White and international-orange gores spell DARE MIGHTY THINGS in binary; outer band gives GPS coordinates for JPL | DECODER, RBASICS |
| Perseverance jettisoned the parachute and backshell earlier in the landing sequence; the hovering descent stage lowered the rover (sky crane) | PIA24333 |
| Backshell hit the surface at about 126 km/h (78 mph); sits upright; parachute spread out and dust-covered | JPL2022 |
| Ingenuity photographed it on Flight 26, 19 Apr 2022: 10 aerial colour images | JPL2022 |
| Mars Sample Return engineers asked for the images; they could help ensure safer landings for future spacecraft such as the Sample Return lander | JPL2022 |
| `lastContact` 2021-02-18 with label "Separated": the hardware never had a radio, so the date is when Perseverance let go of it, not a signal | PIA24333 / data convention |
| "About 7 months" = launch 30 Jul 2020 to landing 18 Feb 2021 | derived |
| Position 18.44° N, 77.45° E ⚠ — the backshell's own coordinates were not found on a NASA page. PIA24333 shows it near Perseverance's landing point (widely cited 18.4447° N, 77.4508° E), so the data use that point, rounded, with `approxPosition: true` | PIA24333 / ⚠ |

### ingenuity
| Claim | Source |
|---|---|
| Launch 30 Jul 2020; landed 18 Feb 2021 (under Perseverance) | ING |
| Air <1% as dense as Earth's | ING |
| First flight 19 Apr 2021, first powered controlled flight on another planet; planned ≤5 flights in 30 days; 72 flights | ING |
| Aerial scout for scientists and rover planners (and for engineers studying Perseverance's landing-gear debris) | ING |
| Last flight 18 Jan 2024; hard landing; rotor blades significantly damaged; mission ended 25 Jan 2024 | ING, INGB, INGX |
| Final team downlink 16 Apr 2024; stays at Valinor Hills as a stationary testbed | INGB |
| Site-panel note "can't be called from Earth directly … Perseverance, its base station, relayed messages": Perseverance "serves as a base station for Ingenuity"; the farewell message was sent to Perseverance, which handed it to Ingenuity (checked 14 Nov 2026). Not claimed: whether Perseverance is still in range in 2026. | INGB |
| `lastContactLabel` "Last team downlink": INGX (Dec 2024) says Ingenuity still beamed weather and avionics data to Perseverance about once a week, so 16 Apr 2024 is not its last signal ever | INGB, INGX |
| Accident findings expected to benefit future Mars helicopters | INGX |
| 17.0 km flown; 24.0 m max altitude; 1.8 kg | ING |
| Position 18.4° N, 77.4° E ⚠ approximate (Jezero crater) | ⚠ |

## Flight 73 script (`src/data/flight.ts`) — new

`FICTION_NOTE`: "Flight 73 never happened. Every machine, place and date on the way is real."

### Prologue
| Line / claim | Source |
|---|---|
| Flight 72 on 18 Jan 2024 was planned as a brief vertical hop to check flight systems (and photograph the area) | INGX |
| "The sand below was probably too smooth for my navigation camera to follow": NASA's most likely cause is too little surface texture in featureless sand ripples for the downward-looking navigation camera. The line says "probably" because NASA does. | INGX |
| Hard landing; rotor blades broke (a blade piece lies ~15 m away) | INGB, INGX |
| Team said goodbye with a final downlink on 16 Apr 2024; unable to fly | INGB |

### En route and inheritance lines
| Stop | Line / claim | Source |
|---|---|---|
| viking-1 | Viking 1 landed 1976, almost 45 years before Ingenuity (20 Jul 1976 → 18 Feb 2021 = 44.6 y) | V1, ING / derived, tested |
| viking-1 | Stops are visited in the order they landed | `MACHINE_IDS`, tested |
| viking-1 | "Everyone on this flight landed after you. You showed it could be done." First truly successful Mars landing | V1, tested |
| viking-2 | Shortest way to Viking 2 runs almost over the north pole (route reaches 88° N) | `route.ts` interpolate, tested |
| viking-2 | Both Viking landers worked at once from 1976 to 1980 | V1, V2, tested |
| viking-2 | Viking 2 moved north toward the polar ice; almost 32 years later (Sep 1976 → May 2008) Phoenix landed farther north and dug ice up | V2, PHX15 / derived, tested |
| pathfinder | No NASA landing for almost 21 years after the Vikings (Sep 1976 → Jul 1997) ⚠ no NASA Mars landing in between (Mars Observer and Mars Global Surveyor were orbiters) | ⚠ derived, tested |
| pathfinder | Pathfinder carried the first rover on Mars | MPF |
| pathfinder | "Every NASA rover since has followed her, including the one that carried me here" ⚠ chronological (Spirit, Opportunity, Curiosity, Perseverance) | ⚠, ING |
| spirit | Leg crosses the equator; Spirit is the first southern stop | `route.ts`, tested |
| spirit | Spirit landed Jan 2004; Opportunity 21 days later | SPI, OPP, tested |
| spirit | Stuck in soft soil, Spirit became a stationary science platform; Ingenuity is now a stationary testbed | SPI, TROY, INGB |
| opportunity | Longest leg of Flight 73; twins on opposite sides of Mars; path passes close to the south pole (route reaches 86° S) | `route.ts` (tested), SPI, MER |
| opportunity | Opportunity showed water lasted on the surface | MER |
| opportunity | Jezero was once a lake; Perseverance found potential biosignatures ("Sapphire Canyon", published Sept 2025), which need more study — the line says "possible signs" | M2020 |
| phoenix | Phoenix in the Martian arctic, chosen in concert with NASA's "follow the water" strategy | PHX15 |
| phoenix | Reused the cancelled Mars Surveyor 2001 spacecraft | PHX15 |
| phoenix | Carries a DVD for future visitors, called "the first library on Mars" (installed by The Planetary Society) | PHX15 |
| phoenix | Water ice just below the surface; future helicopters (SkyFall) are meant to map subsurface water ice | PHX15, ING |
| insight | Landed Nov 2018, just over two years before Ingenuity (2.2 y) | INS / derived, tested |
| insight | Stationary lander; seismometer recorded marsquakes | INS, INSR |
| insight | Looked inside Mars down to its liquid core; Ingenuity's highest altitude 24 m | INSC, ING |
| mars2020-edl | Ingenuity photographed the parachute and backshell on Flight 26, Apr 2022 | JPL2022 |
| mars2020-edl | The images may help future landings be safer | JPL2022 |
| ingenuity | Last hop is the shortest leg | `route.ts`, tested |
| ingenuity | Perseverance photographed part of a rotor blade ~15 m (49 ft) west of Ingenuity (image 24 Feb 2024) | INGB, INGX |
| ingenuity | SkyFall will build on Ingenuity; a trio of next-gen helicopters, deployed mid-air, to scout human landing sites and map subsurface water ice | ING |

### Arrival intros (`arrivalIntro`, Ingenuity's radio bubble at each stop)
| Stop | Line / claim | Source |
|---|---|---|
| viking-1 | Chryse Planitia, the Golden Plain; in 1976 the first spacecraft to land safely on Mars and keep working | V1 |
| viking-2 | Utopia Planitia, nearer the polar ice; landed tilted (8.5°) among boulders; data home for more than three and a half years (3 Sep 1976 → 12 Apr 1980 = 3.6 y) | V2 / derived |
| pathfinder | Ares Vallis; came down in giant airbags, about 15 bounces; Sojourner the first rover to drive on Mars | MPF |
| spirit | Troy, beside Home Plate, Gusev crater; stuck in soft soil there; the dragged wheel exposed nearly pure silica → ancient hot springs or steam vents | SPI, TROY |
| opportunity | Perseverance Valley, Endeavour crater rim; designed to drive 1,000 m, drove 45.16 km (more than a marathon); showed water lasted on the surface | OPP, MER |
| phoenix | The Martian arctic; landed farther north than any Mars mission before it; its trench exposed water ice just under the soil | PHX15 |
| insight | Elysium Planitia; sent to study the inside of Mars; 1,319 marsquakes; waves from two far-side quakes revealed a liquid iron core | INS, INSR, INSC |
| mars2020-edl | Jezero crater; the parachute and backshell slowed Perseverance (Ingenuity under its belly); biggest parachute ever used on Mars; its gores spell a message in binary | JPL2022, ING, DECODER |
| ingenuity | Valinor Hills, Jezero crater; the real Ingenuity rests there with broken blades; planned up to five flights, flew 72 | ING, INGB |
| every stop | The last line invites the visitor to click a numbered hotspot, which Ingenuity flies to and scans: the app's own interaction and part of the imagined flight, covered by `FICTION_NOTE` | — |
| every stop | Reactions to a signature action replay the stop's `inheritance` line (sourced above) | — |

### Epilogue
| Line / claim | Source |
|---|---|
| Ingenuity stands near the apex of a sand ripple at Valinor Hills | INGB |
| Software update makes it wake daily, test solar panel, batteries (and electronics), take a colour photo and collect temperature data. The line says the update "tells me to" — whether it still runs in Nov 2026 is not known | INGB |
| Memory could hold about 20 years of daily data, kept for whoever revisits Valinor Hills | INGB |
| SkyFall helicopters planned for Mars (no launch date given) | ING |

## V3: HUD, prologue, title telemetry and navcam

| Line / claim | Source |
|---|---|
| Prologue lines "I will never fly again." and "But let me imagine one last flight. Flight 73.": fiction framing, covered by `FICTION_NOTE`. The other prologue lines repeat facts logged under "Prologue" above. | fiction |
| Prologue rotor test (spin-up, imbalance fault) and the amber-gold "phantom" Ingenuity that flies Flight 73: fiction, covered by `FICTION_NOTE`. The real Ingenuity stays at Valinor Hills (it is drawn there at the last stop). | fiction, INGB |
| Fault text "Rotor imbalance — blades damaged on Flight 72" / "Rotor test failed": the test is fiction; the blade damage on Flight 72 (18 Jan 2024) is real | INGB, INGX |
| Map marker hover label "Name · year": the year of `machine.arrived`, sourced per stop above | per stop |
| Title facts "across 9 stops" = 8 sites + Ingenuity's home; its tooltip "Ingenuity's 72 real flights covered 17.0 km" | `MACHINE_IDS`, ING |
| Title facts "… for a radio call there and back" (e.g. "21 min 55 s"): Earth–Mars light time, round trip, now, computed live from JPL's approximate Keplerian elements (Standish), see CREDITS | CREDITS |
| Title facts "… local solar time at Jezero": Mars local true solar time at Ingenuity's listed longitude (77.4° E), live, Mars24 algorithm (Allison & McEwen 2000); the globe is lit to match, see CREDITS | CREDITS |
| Epilogue stats "17.0 km / 72 real flights" | ING |
| Site card relay note at stop 9 (Perseverance relayed messages): logged under "ingenuity" above, confirmed | INGB |
| "Navcam B&W view" in flight: Ingenuity carries "one black-and-white 0.5 megapixel downward-facing navigation camera" (INGPK, key listed under "Signature actions" below; checked 14 Nov 2026; ING mentions the navigation camera but not its colour). The overlay deliberately shows no altitude: the flight arcs are exaggerated (up to 0.22 Mars radii), so a number would mislead. | INGPK, INGX |

## Signature actions (`src/data/signatures.ts`, `src/scene/signatures/`) — V3

One hands-on moment per stop. Captions and readouts are in `signatures.ts`; the scene effects are
re-creations in this 3D scene, never NASA imagery. Extra source keys for this section:

| Key | URL |
|---|---|
| PIA00381 | https://science.nasa.gov/photojournal/first-photograph-taken-on-mars-surface/ |
| V2ICE | https://www.nasa.gov/image-article/viking-lander-image-of-ice-mars/ |
| BBILL | https://science.nasa.gov/resource/sojourners-apxs-studies-barnacle-bill/ |
| OPPH | https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/ |
| PHXSNOW | https://www.jpl.nasa.gov/news/nasa-mars-lander-sees-falling-snow-soil-data-suggest-liquid-past/ |
| PIA24431 | https://science.nasa.gov/photojournal/mars-decoder-ring/ ("Mars Decoder Ring", NASA's annotated image: 34 11 58 N, 118 10 31 W) |
| INGPK | https://www.jpl.nasa.gov/news/press_kits/ingenuity/landing/mission/spacecraft/ |

| Stop | Caption / readout claim | Source |
|---|---|---|
| viking-1 | First photograph ever taken on the surface of Mars, minutes after landing on 20 July 1976; rocks, sand and one of the lander's footpads | PIA00381, V1 |
| viking-1 | The picture is rendered from this scene ("Re-created here from this scene"), grey-scale, revealed in vertical strips. The reveal and framing are illustrative; the panel credits the 1976 original as PIA00381. | illustrative |
| viking-2 | 18 May 1979: a thin coating of water ice on rocks and soil, one Martian year after frost first formed there | V2ICE |
| viking-2 | Frost pattern (patchy, on up-facing ground and rocks) is illustrative | illustrative |
| pathfinder | Sojourner rolled down the rear ramp late on sol 2 (night of 5 July 1997); the ramp was tilted 20° | MPF |
| pathfinder | First rock analysis on sol 3, on the rock Barnacle Bill (APXS on the rover's rear) | BBILL, MPF |
| pathfinder | The rock's shape and place, the rover's path off the ramp, and the model ramp's tilt (about 10°, not 20°) are illustrative | illustrative |
| spirit | Right-front wheel stopped turning in 2006; Spirit drove backwards dragging it | SPI, TROY |
| spirit | In 2007 the dragged wheel exposed nearly pure silica, evidence of ancient hot springs or steam vents | SPI |
| spirit | Distance backed up (0.7 m) and the trench's look are illustrative | illustrative |
| opportunity | Tau (atmospheric opacity) reached an estimated 10.8 over Opportunity on the morning of 10 June 2018; last signal that day | OPPH, OPP |
| opportunity | Readout "direct sunlight ≈ P % of a tau-1 day (simple model)": Beer–Lambert, e^−(τ−1), Sun overhead, no scattered skylight. A teaching model, labelled as one; no watts or NASA power figures are claimed. Sky colours, darkening and dust are illustrative. | model (tested) |
| phoenix | Whitish clumps in a trench vanished over four sols: water ice sublimating | PHX15 |
| phoenix | Its laser detected snow from clouds about 4 km up, vaporising before reaching the ground | PHXSNOW |
| phoenix | Trench and clump places, the arm's motion, and the snow's height (compressed to a few metres) are illustrative | illustrative |
| insight | The arm placed the seismometer on the ground; 1,319 marsquakes recorded; mission ended December 2022 | INS, INSR |
| insight | Expanding rings and the slight shake visualise a quake; not to scale and not a recorded event | illustrative |
| insight | LaRRI: a small laser retroreflector on the deck; when NASA described it in 2020, no laser for this kind of Mars research was in the works | RR |
| insight | The dashed beam marks where a future laser would aim; no laser is shown firing | illustrative |
| mars2020-edl | Gores spell DARE MIGHTY THINGS in binary, one word per ring; the outer band gives JPL's coordinates 34°11′58″N 118°10′31″W | DECODER, RBASICS, PIA24431 |
| mars2020-edl | The model's orange/white gore pattern does not reproduce the real bit pattern; the overlay only shows which ring holds which word | illustrative |
| ingenuity | Last software update: wake daily, test solar panel and batteries, take a colour photo, collect temperature data. "Whether it still does today is not known." | INGB, INGX |
| ingenuity | Glints and the shutter flash cue each step; Ingenuity's camera has no flash | illustrative |

## Not used, on purpose

- No transmissions or quotes are put in anyone's mouth. The popular line attributed to
  Opportunity is a reporter's paraphrase of telemetry, so it is left out. The team leads' quotes
  in INGB and INGX are paraphrased as facts (e.g. "for whoever visits next"), never quoted.
- Opportunity's final wake-up song was not confirmed in this pass. Phoenix's ice clumps vanishing
  over four sols (PHX15) is now used by the Phoenix signature action.
- Opportunity's solar power in watts during the 2018 storm: no NASA figure was found in this
  pass, so the storm readout gives a relative, labelled simple model instead.
- "Viking → follow the water" was dropped: NASA ties the "follow the water" strategy to the
  Phoenix era (PHX15), not to Viking, so it appears only on the Phoenix leg.
- Viking 1's old line "Every Mars lander since has chased the question I asked" was removed:
  Pathfinder and InSight were not life-detection missions.
- "All four blades snapped" (INGX) is NASA's most likely scenario, not a confirmed finding, so
  the text says only that the blades broke.
- No terrain names along the legs (volcanoes, plains, canyons). Only geometric claims checked
  with `interpolate()` in `route.ts` are used ("almost over the north pole", "crosses the equator").
- The backshell's own coordinates and its distance from Ingenuity: not found on a NASA page.
- Mars Sample Return's present status and SkyFall's launch date: not claimed. Only the 2022 MSR
  request and the SkyFall plan as NASA describes it are used.
- Ingenuity "still working in 2026": not claimed. The latest NASA report found (Dec 2024) says
  weekly weather data to Perseverance; the epilogue describes the programmed routine.
