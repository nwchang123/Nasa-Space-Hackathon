# Product

Still Here: Flight 73 is a 3D interactive story. Ingenuity, the Mars helicopter whose blades broke on its 72nd flight, narrates an imagined last flight: it visits every NASA machine on Mars in the order they arrived, hears each one's story, and flies home.

## Platform

Desktop web browser (Chrome first), full-screen WebGL. No phone layout is planned; small windows degrade gracefully but are not designed for. An optional AR hangar shows the nine machines on a table.

## Stack

React 19, React Three Fiber 9 with drei, three.js 0.183, zustand, Vite 7, Vitest. Fonts self-hosted through Fontsource: Newsreader and Martian Mono. Ingenuity's voice lines are pre-recorded clips with a browser speech fallback.

## Users

The general public, including hackathon judges who may give it only a few minutes. English only. Many will watch rather than click, so the experience must move along on its own.

## Product Purpose

Make the abandoned machines on Mars feel present: where each one is, what it did, how it ended, and what it passed on to the next. Every machine, place and date is real; only Flight 73 itself is imagined, and the work says so on screen.

## Positioning

An archival mission briefing crossed with a live instrument console, not a game HUD and not a SaaS dashboard. The 3D scene is the work; the interface is the instrument you watch it through.

## Operating Context

Watched in one sitting, often on a laptop, sometimes projected. Sound is optional. The local solar time at each site is real, so a visit can be in daylight or at night.

## Capabilities and Constraints

- One continuous camera shot from orbit to each site and back; no hard cuts.
- An auto tour moves the visit along by itself. Any touch on the view pauses it; it picks up again after a quiet spell, or from the top bar.
- Each stop offers one hands-on action. It is offered, never required.
- Assets are NASA 3D Resources models and Mars Trek mosaics, with downloads approved one by one.

## Brand Commitments

- Facts stay facts: dates, names and places come from the fact-check file, and the fiction note stays visible.
- The diorama owns the centre of the screen at all times.

## Evidence on Hand

NASA model and imagery credits live in CREDITS.md; the fact check lives in docs/.

## Product Principles

1. The machine is the subject. The interface recedes.
2. Say each thing once. A line Ingenuity speaks is not repeated in a panel.
3. Never hold the visitor hostage: everything that waits for a click also moves on by itself.
4. Real time, real light: the Sun at each site is the real Sun now, or the hour the visitor picks.

## Accessibility & Inclusion

Keyboard reachable controls with a visible amber focus ring, screen-reader text for the route and the radio feed, reduced-motion variants (cuts covered by a short dip to black), and captions for every spoken line through the typed radio feed.
