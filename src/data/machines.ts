// The stops of Flight 73: the NASA machines left on Mars, in order of arrival.
// Order and ids must match MACHINE_IDS in ../types.ts.
//
// Every date, number and claim here is traced to a source in docs/FACT_CHECK.md.
// Dates are UTC (several NASA pages give US local dates; conversions are noted there).
// Coordinates are planetocentric latitude and EAST longitude (−180..180).

import type { Machine } from '../types';

export const MACHINES: Machine[] = [
  // ───────────────────────────── Mars ─────────────────────────────
  {
    id: 'viking-1',
    name: 'Viking 1 lander',
    shortName: 'Viking 1',
    kind: 'Lander',
    site: 'Chryse Planitia (Golden Plain)',
    // NASA gives 22.483°N, 47.94°W (planetographic); 22.27°N is the planetocentric equivalent.
    lat: 22.27,
    lon: -47.95,
    launched: '1975-08-20',
    arrived: '1976-07-20',
    lastContact: '1982-11-11',
    plannedLife: '90 days',
    actualLife: '6 years, 116 days',
    story: {
      why: 'I was the first spacecraft to land safely on Mars and keep working. I touched down on 20 July 1976, seven years to the day after Apollo 11 reached the Moon. My mission was to look for life.',
      found: 'My arm scooped soil into a tiny biology lab inside me. Some tests gave a weak signal that looked like life. But my chemistry instrument found no organic compounds, so the answer stayed inconclusive.',
      lastDay: 'Long after my main mission I kept sending weather reports, first daily, then weekly. On 11 November 1982, a faulty command sent from Earth cut me off. Every attempt to reach me again failed.',
      stillHere: 'In 1982 I was renamed the Thomas Mutch Memorial Station, after my imaging team’s leader. My record of 6 years and 116 days on Mars stood until Opportunity passed it in 2010. The question I came to ask is still open.',
    },
    facts: ['First successful Mars landing', '2 nuclear power generators', '4,500 photos from both landers'],
    sources: [{ label: 'NASA Science · Viking 1', url: 'https://science.nasa.gov/mission/viking-1/' }],
  },
  {
    id: 'viking-2',
    name: 'Viking 2 lander',
    shortName: 'Viking 2',
    kind: 'Lander',
    site: 'Utopia Planitia',
    // NASA gives 47.968°N, 225.71°W (planetographic); converted to planetocentric lat, east lon.
    lat: 47.64,
    lon: 134.29,
    launched: '1975-09-09',
    arrived: '1976-09-03',
    lastContact: '1980-04-12',
    plannedLife: '90 days',
    actualLife: 'About 3½ years',
    story: {
      why: 'My twin landed first, so I was sent somewhere different. Photos showed rough ground at my planned site. Controllers moved me north to Utopia Planitia, nearer the polar ice, where life seemed likelier.',
      found: 'I landed on 3 September 1976, tilted 8.5 degrees on a rocky plain. My biology tests on three soil samples matched my twin’s: puzzling, not proof. Scientists suspected that sunlight-made chemicals in the soil were mimicking life.',
      lastDay: 'My orbiter went first, shut down in July 1978 after a series of leaks. I kept sending data from the ground until 12 April 1980. Then I fell silent.',
      stillHere: 'In 2001 I was renamed the Gerald Soffen Memorial Station, after Viking’s project scientist. Our two orbiters sent back 52,663 images and mapped about 97 percent of Mars. My twin and I added 4,500 photos from the ground.',
    },
    facts: ['Landed 6,460 km from Viking 1', 'Tilted 8.5° on landing', '97% of Mars mapped by the orbiters'],
    sources: [{ label: 'NASA Science · Viking 2', url: 'https://science.nasa.gov/mission/viking-2/' }],
  },
  {
    id: 'pathfinder-sojourner',
    name: 'Mars Pathfinder lander and Sojourner rover',
    shortName: 'Pathfinder',
    kind: 'Lander',
    site: 'Ares Vallis',
    // Widely cited 19.13°N, 33.22°W; NASA's mission page names Ares Vallis without coordinates.
    lat: 19.13,
    lon: -33.22,
    approxPosition: true,
    launched: '1996-12-04',
    arrived: '1997-07-04',
    lastContact: '1997-09-27',
    plannedLife: 'Rover: 7 days',
    actualLife: 'Rover: 83 days',
    story: {
      why: 'We were sent to test new ways to land on Mars and to drive there. Instead of rockets all the way down, I fell wrapped in giant airbags. On 4 July 1997 I bounced about 15 times, up to 15 metres high.',
      found: 'My rover, Sojourner, weighed 10.6 kilograms and rolled down my ramp on the second sol. She studied rocks while I took more than 16,500 pictures. Rounded pebbles here hinted at running water, back when Mars was warmer.',
      lastDay: 'Sojourner was built for a seven-day mission and worked for 83. My final data reached Earth at 10:23 UTC on 27 September 1997. Engineers kept trying for five months, then ended the mission on 10 March 1998.',
      stillHere: 'I am the Carl Sagan Memorial Station, named after the astronomer who died the year before I landed. My airbag landing worked so well that Spirit and Opportunity used the same kind.',
    },
    facts: ['First rover on Mars', '10.6 kg rover', '16,500+ lander images', 'About 15 airbag bounces'],
    sources: [
      { label: 'NASA Science · Mars Pathfinder', url: 'https://science.nasa.gov/mission/mars-pathfinder/' },
      { label: 'NASA · NASA’s First Rover on the Red Planet', url: 'https://www.nasa.gov/image-article/nasas-first-rover-red-planet/' },
    ],
  },
  {
    id: 'spirit',
    name: 'Spirit rover',
    shortName: 'Spirit',
    kind: 'Rover',
    site: 'Troy, beside Home Plate, Gusev crater',
    // Final site is within a few kilometres of the landing point (14.5692°S, 175.4729°E).
    lat: -14.6,
    lon: 175.5,
    approxPosition: true,
    launched: '2003-06-10',
    arrived: '2004-01-04',
    lastContact: '2010-03-22',
    plannedLife: '90 sols',
    actualLife: '6 years, 2 months, 19 days',
    story: {
      why: 'My twin and I were sent to opposite sides of Mars to read its rocks for signs of past water. I landed in Gusev crater, which may once have held a lake. My airbags bounced 28 times before I rolled to a stop.',
      found: 'In 2006 a front wheel stopped turning, so I drove backwards, dragging it. In 2007 that dead wheel scraped up nearly pure silica. Deposits like that form in hot springs or steam vents, so ancient Mars was much wetter.',
      lastDay: 'On 1 May 2009 my wheels broke through a crust into soft soil at a place called Troy. Engineers tried for months to free me, then made me a stationary science station. My last signal came on 22 March 2010, as winter cold set in.',
      stillHere: 'NASA sent more than 1,300 commands before ending the search on 25 May 2011. I am still at Troy, where I could not tilt my panels toward the winter Sun. I worked more than 25 times longer than planned.',
    },
    facts: ['7.73 km driven', '25× planned lifetime', '1,300+ recovery commands'],
    sources: [
      { label: 'NASA Science · Spirit', url: 'https://science.nasa.gov/mission/mer-spirit/' },
      { label: 'NASA · Spirit Embedded in Soft Soil', url: 'https://www.nasa.gov/image-article/spirit-embedded-soft-soil-mars-as-engineers-devise-methods-free-spirit/' },
    ],
  },
  {
    id: 'opportunity',
    name: 'Opportunity rover',
    shortName: 'Opportunity',
    kind: 'Rover',
    site: 'Perseverance Valley, rim of Endeavour crater',
    // Western rim of the 22 km Endeavour crater, south-east of the landing site (1.9483°S, 354.474°E).
    lat: -2.3,
    lon: -5.4,
    approxPosition: true,
    launched: '2003-07-08',
    arrived: '2004-01-25',
    lastContact: '2018-06-10',
    plannedLife: '90 sols and 1 km',
    actualLife: 'More than 14 years',
    story: {
      why: 'I landed inside a small crater called Eagle on 25 January 2004, on the plains of Meridiani. Orbiters had spotted minerals there that hinted at a wet past. My job was to drive to the rocks and test that idea up close.',
      found: 'The rocks I studied confirmed that water had lasted on the surface of ancient Mars. I was built to drive one kilometre. I drove 45.16, and in 2015 I became the first to cover a marathon on another world.',
      lastDay: 'In June 2018 a dust storm wrapped the whole planet. The sky grew so dark that my solar panels could barely feed me. My last signal reached Earth on 10 June 2018.',
      stillHere: 'Engineers kept calling for months, then ended my mission on 13 February 2019. I rest on the slope of Perseverance Valley. On 11 October 2026, a rover named Perseverance finally drove past my distance record.',
    },
    facts: ['45.16 km driven', 'Marathon passed in 2015', '60× planned lifetime', 'Record stood until Oct 2026'],
    sources: [
      { label: 'NASA Science · Opportunity', url: 'https://science.nasa.gov/mission/mer-opportunity/' },
      { label: 'NASA Science · Spirit and Opportunity', url: 'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/' },
      { label: 'NASA · Opportunity Emerges in a Dusty Picture', url: 'https://www.nasa.gov/image-article/opportunity-emerges-dusty-picture/' },
    ],
  },
  {
    id: 'phoenix',
    name: 'Phoenix lander',
    shortName: 'Phoenix',
    kind: 'Lander',
    site: 'Vastitas Borealis, the Martian arctic',
    lat: 68.22,
    lon: -125.75,
    launched: '2007-08-04',
    arrived: '2008-05-25',
    lastContact: '2008-11-02',
    plannedLife: '90 sols',
    actualLife: '157 sols',
    story: {
      why: 'I landed farther north than any Mars mission before me, at a latitude like northern Alaska. Water ice was thought to hide just under the soil there. I brought a digging arm, tiny ovens and a chemistry lab to find out.',
      found: 'My arm dug a trench, and bright clumps inside it turned out to be water ice. I also found perchlorate, a salt that could feed microbes or supply astronauts with oxygen. And I watched snow fall from Martian clouds.',
      lastDay: 'Autumn came, and my solar power faded. On 2 November 2008, sol 157, I sent my last signal from the Arctic. My team’s final post for me online was the word “triumph”, written in binary.',
      stillHere: 'Engineers listened for me after the polar winter, in 2010, but heard nothing. An orbiter photographed me and saw damage, probably from heavy frost of frozen carbon dioxide. Knowing ice lies this close to the surface matters to anyone planning to live on Mars.',
    },
    facts: ['Northernmost Mars landing', 'Water ice confirmed', 'Perchlorate discovered'],
    sources: [
      { label: 'NASA Science · Mars Phoenix', url: 'https://science.nasa.gov/mission/phoenix/' },
      { label: 'NASA · 15 Years Ago: Phoenix Mars Lander Launches', url: 'https://www.nasa.gov/history/15-years-ago-phoenix-mars-lander-launches-to-the-red-planet/' },
    ],
  },
  {
    id: 'insight',
    name: 'InSight lander',
    shortName: 'InSight',
    kind: 'Lander',
    site: 'Elysium Planitia',
    // NASA: landing site centred at about 4.5°N, 135.9°E.
    lat: 4.5,
    lon: 135.9,
    approxPosition: true,
    launched: '2018-05-05',
    arrived: '2018-11-26',
    lastContact: '2022-12-15',
    plannedLife: '1 Mars year (about 2 Earth years)',
    actualLife: 'About 4 years',
    story: {
      why: 'Most Mars missions before me studied the surface and the air. I was sent to study the inside. My arm placed a seismometer on the ground, to take the planet’s pulse.',
      found: 'I felt 1,319 marsquakes, some set off by meteoroid impacts. Waves from two quakes on the far side of Mars travelled through its core. They showed a liquid iron core, smaller and denser than scientists had thought.',
      lastDay: 'Dust settled on my solar panels for four years, and my power slowly drained. My seismometer was the last instrument still switched on. I last spoke with Earth on 15 December 2022.',
      stillHere: 'In 2024 an orbiter photographed me, now the same reddish-brown as the ground. Those pictures help scientists learn how Martian dust moves. I also carry a small laser reflector, in case a future orbiter brings a laser.',
    },
    facts: ['1,319 marsquakes detected', 'First direct look at another planet’s core', '1.8 m robotic arm'],
    sources: [
      { label: 'NASA Science · InSight', url: 'https://science.nasa.gov/mission/insight/' },
      { label: 'NASA · NASA Retires InSight Mars Lander Mission', url: 'https://www.nasa.gov/missions/insight/nasa-retires-insight-mars-lander-mission-after-years-of-science/' },
      { label: 'NASA · InSight Study Provides Clearest Look Ever at Martian Core', url: 'https://www.nasa.gov/missions/insight/nasa-insight-study-provides-clearest-look-ever-at-martian-core/' },
      { label: 'NASA · Mars Orbiter Spots Retired InSight Lander', url: 'https://www.nasa.gov/missions/insight/nasa-mars-orbiter-spots-retired-insight-lander-to-study-dust-movement/' },
    ],
  },
  {
    id: 'mars2020-edl',
    name: 'Perseverance’s parachute and backshell',
    shortName: 'Backshell',
    kind: 'Landing hardware',
    site: 'Jezero crater, near Perseverance’s landing site',
    // ⚠ No NASA page found giving the backshell's own coordinates. NASA's orbital image (PIA24333)
    // shows it near Perseverance's landing point (widely cited 18.4447°N, 77.4508°E), so this is
    // that point, rounded. Approximate.
    lat: 18.44,
    lon: 77.45,
    approxPosition: true,
    launched: '2020-07-30',
    arrived: '2021-02-18',
    // No radio of its own: this is the day Perseverance let go of it during the landing.
    lastContact: '2021-02-18',
    lastContactLabel: 'Separated',
    plannedLife: 'Launch to landing',
    actualLife: 'About 7 months, as planned',
    noRadio: true,
    story: {
      why: 'We shielded Perseverance on its trip through deep space, with Ingenuity tucked under its belly. On 18 February 2021 we hit the Martian air at nearly 20,000 km/h. Our job was to slow everyone down.',
      found: 'Our parachute burst open in less than a second, from a 46 by 66 cm bundle to 21.5 metres wide. It was the biggest parachute ever used on Mars. Its orange and white panels hid “Dare Mighty Things” in binary, with JPL’s GPS coordinates around the edge.',
      lastDay: 'Partway down, Perseverance let go of us and flew on under rocket power. We fell and hit the ground at about 126 km/h. Our work ended that day, 18 February 2021.',
      stillHere: 'We still lie in Jezero crater, the backshell upright, the parachute spread out under dust. In April 2022 Ingenuity flew over us and took 10 colour photos. Engineers planning Mars Sample Return had asked for them, to help make future landings safer.',
    },
    facts: ['21.5 m parachute, biggest on Mars', '“Dare Mighty Things” in binary', 'Hit the ground at ~126 km/h', 'Photographed by Ingenuity, 2022'],
    sources: [
      { label: 'JPL · NASA’s Mars Helicopter Spots Gear That Helped Perseverance Rover Land', url: 'https://www.jpl.nasa.gov/news/nasas-mars-helicopter-spots-gear-that-helped-perseverance-rover-land/' },
      { label: 'JPL · Perseverance Provides Front-Row Seat to Landing', url: 'https://www.jpl.nasa.gov/news/nasas-mars-perseverance-rover-provides-front-row-seat-to-landing-first-audio-recording-of-red-planet/' },
      { label: 'NASA Science · Mars Decoder Ring', url: 'https://science.nasa.gov/resource/mars-decoder-ring/' },
      { label: 'NASA Science · Spacecraft Components on the Surface (PIA24333)', url: 'https://science.nasa.gov/photojournal/perseverance-and-mars-2020-spacecraft-components-on-the-surface/' },
    ],
  },
  {
    id: 'ingenuity',
    name: 'Ingenuity Mars Helicopter',
    shortName: 'Ingenuity',
    kind: 'Helicopter',
    site: 'Valinor Hills, Jezero crater',
    // Inside Jezero crater, near the Perseverance landing area; final spot known only roughly here.
    lat: 18.4,
    lon: 77.4,
    approxPosition: true,
    launched: '2020-07-30',
    arrived: '2021-02-18',
    // The team's last downlink. NASA reported in December 2024 that Ingenuity still sent weather
    // data to Perseverance about once a week, so this is not its last signal ever.
    lastContact: '2024-04-16',
    lastContactLabel: 'Last team downlink',
    plannedLife: 'Up to 5 flights in 30 days',
    actualLife: '72 flights in nearly 3 years',
    story: {
      why: 'I rode to Mars tucked under the belly of the Perseverance rover. The air there is less than one percent as thick as Earth’s. Nobody knew if a helicopter could fly in it, so I was sent to try.',
      found: 'On 19 April 2021 I lifted off: the first powered, controlled flight on another planet. I was meant to fly five times. I flew 72, scouting routes and science targets for the rover from above.',
      lastDay: 'On 18 January 2024 I made a hard landing that broke my rotor blades. I could never fly again. My team gathered for one last downlink on 16 April 2024.',
      stillHere: 'I stay at Valinor Hills as a stationary testbed. In December 2024 I was still sending weather data to Perseverance about once a week. Even my crash is useful: what it taught should help future Mars helicopters.',
    },
    facts: ['72 flights, 5 planned', '17.0 km flown', '24 m highest altitude', '1.8 kg'],
    sources: [
      { label: 'NASA Science · Ingenuity Mars Helicopter', url: 'https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/' },
      { label: 'NASA · Ingenuity Team Says Goodbye … for Now', url: 'https://www.nasa.gov/missions/mars-2020-perseverance/ingenuity-helicopter/nasas-ingenuity-mars-helicopter-team-says-goodbye-for-now/' },
      { label: 'NASA · First Aircraft Accident Investigation on Another World', url: 'https://www.nasa.gov/missions/mars-2020-perseverance/ingenuity-helicopter/nasa-performs-first-aircraft-accident-investigation-on-another-world/' },
    ],
  },
];

export const MACHINE_BY_ID: Record<string, Machine> = Object.fromEntries(MACHINES.map(m => [m.id, m]));
