# Fact check: the 18 machines

Every date, number and claim in `src/data/machines.ts`, with where it was checked.
Pages were read on 14 November 2026. NSSDCA (nssdc.gsfc.nasa.gov) could not be opened from the
build environment, so NASA Science and nasa.gov pages were used instead; NSSDCA links from the
challenge's resource list are kept as extra references for the Apollo entries.

**Conventions**

- Dates are UTC. Where a NASA page gives a US local date, the UTC date is noted.
- Coordinates are planetocentric latitude and east longitude (−180..180).
- **Marked ⚠** = not confirmed on a NASA page in this pass. These are either well-established
  figures stated as approximate, or values flagged `approxPosition: true` in the data.

Short source keys:

| Key | URL |
|---|---|
| S3 | https://science.nasa.gov/mission/surveyor-3/ |
| A11O | https://www.nasa.gov/missions/apollo/apollo-11/apollo-11-mission-overview/ |
| A11PSE | https://science.nasa.gov/resource/apollo-11-seismic-experiment/ |
| LLR | https://www.nasa.gov/missions/apollo/apollo-11/the-apollo-experiment-that-keeps-on-giving/ |
| LLR2 | https://www.nasa.gov/missions/laser-beams-reflected-between-earth-and-moon-boost-science/ |
| RR | https://www.nasa.gov/image-article/retroreflectors-from-apollo-mars/ |
| A14 | https://www.nasa.gov/missions/apollo/apollo-14-mission-details/ |
| A15 | https://www.nasa.gov/missions/apollo/apollo-15-mission-details/ |
| A17 | https://www.nasa.gov/missions/apollo/apollo-17-mission-details/ |
| A17L | https://www.nasa.gov/history/50-years-ago-apollo-17-lands-at-taurus-littrow/ |
| A17P | https://www.nasa.gov/history/50-years-ago-apollo-17-post-mission-activities/ |
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
| ING | https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/ |
| INGB | https://www.nasa.gov/missions/mars-2020-perseverance/ingenuity-helicopter/nasas-ingenuity-mars-helicopter-team-says-goodbye-for-now/ |
| P10 | https://science.nasa.gov/mission/pioneer-10/ |
| P11 | https://science.nasa.gov/mission/pioneer-11/ |
| NEAR | https://science.nasa.gov/mission/near-shoemaker/ |
| DAWN | https://science.nasa.gov/mission/dawn/ |
| DAWNE | https://www.nasa.gov/news-release/nasas-dawn-mission-to-asteroid-belt-comes-to-end/ |
| DAWNS | https://science.nasa.gov/mission/dawn/mission-status/ |
| DAWNC | https://www.nasa.gov/news-release/nasa-spacecraft-becomes-first-to-orbit-a-dwarf-planet/ |
| DAWNB | https://www.nasa.gov/centers-and-facilities/jpl/mystery-solved-bright-areas-on-ceres-come-from-salty-water-below/ |
| KEP | https://science.nasa.gov/mission/kepler/ |
| KEPG | https://science.nasa.gov/universe/exoplanets/goodnight-kepler-final-commands-for-space-telescope/ |

## Moon

### surveyor-3
| Claim | Source |
|---|---|
| Launched 17 Apr 1967 (07:05 UT); landed 20 Apr 1967 (00:04 UT); last contact 4 May 1967 | S3 |
| 3° S, 23.41° W, Ocean of Storms | S3 |
| Reflective rocks confused the descent radar; bounced twice (10 m, 3 m) | S3 |
| TV camera and surface sampler; 4 trenches, bearing tests; soil like wet sand, able to support an Apollo LM | S3 |
| 6,326 TV pictures | S3 |
| Last contact two days after lunar night began | S3 |
| Apollo 12 landed ~197 yd (180 m) away; crew recovered the camera and scoop on 19 Nov 1969; ~2½ years of exposure | S3 |
| Planned life "one lunar day" ⚠ (solar-powered Surveyor; S3 confirms contact ended at nightfall) | S3 / ⚠ |

### apollo-11
| Claim | Source |
|---|---|
| Launch 16 Jul 1969; landing 20 Jul 1969 | A11O |
| Coordinates 0.71° N, 23.63° E | A11O |
| Descent stage left behind as the launch pad | Challenge resources (NASA Space Apps) |
| First seismometer on the Moon; detected moonquakes and meteorite hits; solar-powered | A11PSE |
| Stopped responding to commands 04:00 UT 25 Aug 1969, probably from midday overheating; ~3 weeks of data | A11PSE |
| Retroreflector of 100 corner cubes; needs no power; still used | LLR, RR |
| Observatories in New Mexico, France, Italy and Germany fire lasers at the arrays | LLR |
| Moon recedes 3.8 cm (1.5 in) per year | LLR, LLR2 |
| Crew stay "about 21½ hours" ⚠ (standard Apollo figure, 21 h 36 min) | ⚠ |
| "Laser echo in under 3 s" — round trip at 356,000–407,000 km is ~2.4–2.7 s | derived |

### apollo-14
| Claim | Source |
|---|---|
| Launch 31 Jan 1971 (4:03 pm EST = 21:03 UTC); landed 5 Feb 1971 | A14 |
| Most precise landing to date, ~87 ft from target | A14 |
| Coordinates 3.65° S, 17.48° W (Fra Mauro) | A14 |
| Seismometers at Apollo 12, 14, 15, 16 transmitted until Sept 1977; gave a look at internal structure | A11PSE |
| All ALSEP stations shut down 30 Sep 1977 when funding ran out; >1 trillion bits returned | A17P |
| 100 corner cubes; older reflectors return weaker signal, dust suspected | LLR2 |
| New generation of reflectors approved | LLR |
| Crew stay "about 33½ hours" ⚠ (standard Apollo figure, 33 h 31 min) | ⚠ |

### apollo-15
| Claim | Source |
|---|---|
| Launch 26 Jul 1971; landed 30 Jul 1971 at Hadley–Apennine | A15 |
| Coordinates 26.08° N, 3.66° E | A15 |
| First car humans drove on the Moon; 3 EVAs; 17.5 miles driven; >170 lb samples; ALSEP set up | A15 |
| Lunar stay "almost three days" | A15 |
| Rover carried folded on the side of the LM | A17L (same LRV design) |
| Reflector of 300 corner cubes, largest of the Apollo arrays | LLR, LLR2 |
| Laser ranging shows a fluid lunar core and tests Einstein's gravity (no composition dependence) | LLR |
| Station silent 30 Sep 1977 | A17P |

### apollo-17
| Claim | Source |
|---|---|
| Launch 7 Dec 1972 (12:33 am EST = 05:33 UTC); landing 11 Dec 1972 | A17 |
| Coordinates 20.16° N, 30.77° E | A17 |
| Schmitt first scientist-astronaut on the Moon; LRV 30.5 km; 110.4 kg samples; 75 h surface stay | A17 |
| TV camera on the rover steered from MCC by Ed Fendell, "Captain Video" | A17L |
| Rover parked at the "VIP site" ~158 m from the LM; televised the liftoff | A17L |
| Liftoff 14 Dec 1972 | A17 |
| ALSEP switched off 30 Sep 1977 | A17P |

## Mars

### viking-1
| Claim | Source |
|---|---|
| Launch 20 Aug 1975; landed 20 Jul 1976 (11:53 UT); stopped 11 Nov 1982 after a faulty command; recovery failed | V1 |
| First truly successful Mars landing; designed to look for evidence of life | V1 |
| Coordinates: V1 gives 22.483° N, 47.94° W (planetographic); data use 22.27° N, −47.95° (planetocentric equivalent) ⚠ conversion | V1 / ⚠ |
| Biology results a weak positive; organic-compound test found none | V1 |
| Daily, then weekly weather reports; renamed Thomas Mutch Memorial Station in Jan 1982 | V1 |
| Two SNAP-19 RTGs per lander; landers returned 4,500 photos | V1 |
| Record 6 years 116 days broken by Opportunity on 20 May 2010 | OPP |
| Planned life "90 days" ⚠ (Viking primary mission) | ⚠ |

### viking-2
| Claim | Source |
|---|---|
| Launch 9 Sep 1975; landed 3 Sep 1976; lander data until 12 Apr 1980 | V2 |
| Original site rough; moved to Utopia Planitia near the polar cap for water and a better chance of life | V2 |
| 47.968° N, 225.71° W (planetographic) → 47.64° N, 134.29° E ⚠ conversion | V2 / ⚠ |
| Tilted 8.5°; 6,460 km from Viking 1; three soil samples; inconclusive; UV-made reactants suspected | V2 |
| Orbiter ended 24 Jul 1978 after leaks | V2 |
| Renamed Gerald Soffen Memorial Station (July 2001) | V2 |
| Orbiters: 52,663 images, ~97% mapped; landers: 4,500 photos | V1, V2 |

### pathfinder-sojourner
| Claim | Source |
|---|---|
| Launch 4 Dec 1996; landed 4 Jul 1997 at Ares Vallis | MPF |
| Airbags first used; ~15 bounces, up to 15 m high | MPF |
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
| Front wheel stopped (2006); dragged wheel exposed nearly pure silica (2007) → hot springs or steam vents | SPI |
| Driving backwards dragging the right-front wheel at Troy | TROY |
| Stuck in soft soil 1 May 2009 near Home Plate; made a stationary platform; tilt not achieved | SPI |
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
| Farther north than any previous mission; latitude like northern Alaska | PHX |
| Robotic arm, tiny ovens, portable lab | PHX |
| Bright clumps in the trench were water ice; perchlorate (microbe energy source, possible oxygen) | PHX, PHX15 |
| Snow falling from cirrus clouds | PHX15 |
| Nominal mission 90 sols; last signal 2 Nov 2008 (sol 157); final post "triumph" in binary | PHX15 |
| No contact in Jan 2010; MRO images show damage, likely from CO₂ ice | PHX15 |

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

### ingenuity
| Claim | Source |
|---|---|
| Launch 30 Jul 2020; landed 18 Feb 2021 (under Perseverance) | ING |
| Air <1% as dense as Earth's | ING |
| First flight 19 Apr 2021, first powered controlled flight on another planet; planned ≤5 flights in 30 days; 72 flights | ING |
| Aerial scout for scientists and rover planners | ING |
| Last flight 18 Jan 2024; rotor blades damaged; mission ended 25 Jan 2024 | ING, INGB |
| Final team downlink 16 Apr 2024; stays at Valinor Hills; daily wake-up, solar panel and battery tests, photo, temperatures | INGB |
| 17.0 km flown; 24.0 m max altitude; 1.8 kg | ING |
| SkyFall helicopters build on Ingenuity | ING |
| Position 18.4° N, 77.4° E ⚠ approximate (Jezero crater) | ⚠ |

## Deep space

### pioneer-10
| Claim | Source |
|---|---|
| Launch 2 Mar 1972 local (01:49 UT on 3 Mar; the NASA page pairs "March 2" with the UT time); data use 1972-03-03 | P10 |
| First through the asteroid belt; first past Jupiter (closest 4 Dec 1973); first all-nuclear electrical power | P10 |
| Fewer asteroid hits than expected; ~500 Jupiter pictures incl. the Great Red Spot; radiation-triggered false commands | P10 |
| Designed for 21 months; lasted >30 years; last signal 23 Jan 2003 from 12.23 billion km | P10 |
| Heading in the general direction of Aldebaran; ~2 million years; plaque (man, woman, 14 pulsars) | P10 |
| `headingEclipticLon` 80.8° (ecliptic lat +3.0°): heliocentric position in 2026 from JPL Horizons | JPL Horizons (via astro module) |

### pioneer-11
| Claim | Source |
|---|---|
| Launch 6 Apr 1973 (02:11 UT); Jupiter 3 Dec 1974; Saturn 1 Sep 1979 | P11 |
| First pictures of Jupiter's polar regions; first spacecraft to fly by Saturn | P11 |
| ~13,000 mi (20,900 km) from Saturn; 114,000 km/h; ring-plane crossing beyond the outer ring; 440 images; first conclusive evidence of a magnetic field | P11 |
| Last routine contact 30 Sep 1995; last engineering data 24 Nov 1995 (used as `lastContact`) | P11 |
| Toward Aquila; near Lambda Aquilae in almost four million years; carries a message | P11 |
| `headingEclipticLon` 284.7° (ecliptic lat +13.8°): heliocentric position in 2026 from JPL Horizons | JPL Horizons (via astro module) |

### near-shoemaker
| Claim | Source |
|---|---|
| Launch 17 Feb 1996; Mathilde flyby 27 Jun 1997; Eros orbit 14 Feb 2000; first to orbit an asteroid | NEAR |
| Landed 12 Feb 2001 (19:44 UT) at 6.4 km/h south of Himeros; 69 descent photos; first to land on an asteroid | NEAR |
| Not designed as a lander; returned gamma-ray data ~2 weeks; last contact 28 Feb 2001 (cold) | NEAR |
| Contact attempt 10 Dec 2002 failed; renamed for Eugene M. Shoemaker | NEAR |
| No magnetic field; >70% mapped by near-infrared spectrometer | NEAR |
| Planned "about 1 year orbiting Eros" ⚠ (orbit lasted Feb 2000–Feb 2001) | ⚠ |

### dawn
| Claim | Source |
|---|---|
| Launch 27 Sep 2007; ion propulsion; Vesta 2011–2012; Ceres orbit 6 Mar 2015 | DAWN, DAWNC |
| First to orbit a dwarf planet; first to orbit two extraterrestrial targets | DAWNC, DAWNE |
| Bright areas mostly sodium carbonate from a brine reservoir ~40 km deep | DAWNB |
| Dipped to 35 km above Ceres | DAWNB, DAWNS |
| Hydrazine ran out late Oct 2018; missed sessions 31 Oct and 1 Nov; 6.9 billion km travelled | DAWNE, DAWNS |
| Orbit lasts at least 20 years, >99% confidence for 50; planetary protection | DAWNE |
| Dwarf planets could have hosted oceans, potentially still do | DAWNE |
| `lastContact` 2018-10-30 ⚠: last healthy status report (DAWNS); exact last-signal time not published | DAWNS / ⚠ |

### kepler
| Claim | Source |
|---|---|
| Launch 6 Mar 2009 local (7 Mar 2009 UTC) | KEP |
| Single instrument with a spacecraft built around it; largest digital camera in space at the time; 1.4 m mirror | KEP |
| 150,000 stars in Cygnus; designed for 3½ years; transits | KEP |
| Lost precise pointing in 2013 → K2 | KEP |
| >2,600 planets; more planets than stars | KEP |
| Retired 30 Oct 2018; "goodnight" commands 15 Nov 2018 shut down transmitters; anniversary of Johannes Kepler's death (1630) | KEPG |
| Earth-trailing, safe orbit around the Sun; data mined for years | KEPG, challenge resources |

## Not used, on purpose

- No transmissions are quoted. The popular line attributed to Opportunity is a reporter's
  paraphrase of telemetry, not a message, so it is left out.
- Opportunity's final wake-up song, Phoenix ice "vanishing" over days, and Apollo 17's tracks
  seen from orbit were left out because they were not confirmed in this pass.
