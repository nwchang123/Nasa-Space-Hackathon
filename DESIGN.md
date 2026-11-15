---
name: Still Here: Flight 73
description: A NASA archival briefing read through a precision telemetry console, over a live Mars diorama.
colors:
  ink: "#05070a"
  ink-2: "#0a0e13"
  panel: "rgba(5, 7, 10, 0.82)"
  line: "#2a3440"
  line-soft: "rgba(143, 179, 201, 0.16)"
  amber: "#f2a93b"
  amber-soft: "rgba(242, 169, 59, 0.14)"
  ghost: "#8fb3c9"
  bone: "#e9e4d8"
  bone-dim: "#a9a397"
  signal-green: "#7dff9a"
  fault: "#ff6a3d"
typography:
  display:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "clamp(56px, 7vw, 96px)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.02em"
  machine-name:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.1
  story:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "clamp(15px, 1.15vw, 16.5px)"
    fontWeight: 400
    lineHeight: 1.42
  radio:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.38
  telemetry:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "9.5px"
    fontWeight: 300
    lineHeight: 1.45
    letterSpacing: "0.14em"
  telemetry-tag:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "8px"
    letterSpacing: "0.14em"
  telemetry-micro:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "8.5px"
    letterSpacing: "0.14em"
  telemetry-small:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "9px"
    letterSpacing: "0.12em"
  readout:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "10px"
    letterSpacing: "0.06em"
  readout-large:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "11px"
    letterSpacing: "0.04em"
  label:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "10.5px"
    fontWeight: 400
    letterSpacing: "0.1em"
rounded:
  hairline: "2px"
spacing:
  hud-gap: "16px"
  top-bar: "42px"
  base: "28px"
components:
  button-primary:
    backgroundColor: "transparent"
    textColor: "{colors.amber}"
    typography: "{typography.label}"
    rounded: "{rounded.hairline}"
    padding: "0.72em 1em"
  button-primary-hover:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink}"
  top-bar-switch:
    backgroundColor: "transparent"
    textColor: "{colors.bone-dim}"
    typography: "{typography.telemetry}"
  hud-panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.hairline}"
    padding: "8px 12px"
---

# Design System: Still Here: Flight 73

## Overview

A night shift at a deep-space tracking station. The visitor watches Mars through an instrument: hairline frames, bracketed telemetry, an amber signal for whatever is live. The machines speak in an editorial serif, the console in a fine monospace. The Experience mode rule governs everything: the 3D diorama is the work and holds the centre of the screen; the HUD keeps to the edges and recedes.

## Colors

Deep-space ink with warm bone text and one live accent.

### Primary

- **Signal amber** `#f2a93b`: the live thing only. The stop we are at, the primary action, the section being read, the radio rail, focus rings.

### Secondary

- **Ghost blue** `#8fb3c9`: instruments and secondary actions (signature controls, route, ruler ticks).

### Neutral

- **Ink** `#05070a` and **ink-2** `#0a0e13` for the page and panels; panels at 82% so the scene shows through faintly without blur.
- **Bone** `#e9e4d8` for reading text, **bone-dim** `#a9a397` for telemetry and labels.
- **Hairlines** `#2a3440` and `rgba(143,179,201,0.16)`.

### Named Rules

- **One amber at a time.** If two things are amber, one of them is wrong.
- **Signal green** `#7dff9a` is reserved for live data and Ingenuity's answer to the visitor's own action.
- No neon, no purple or cyan glow, no gradients on text.

## Typography

Newsreader (italic for the machines' own voice and names, roman for Ingenuity's radio) against Martian Mono (uppercase, tracked, for all telemetry and controls).

### Hierarchy

1. Display: the title, Newsreader italic, up to 96px.
2. Machine name: Newsreader italic 21px.
3. Story and radio text: Newsreader 15 to 16.5px, measure under 68ch.
4. Labels and buttons: Martian Mono 10 to 10.5px, uppercase, 0.1em.
5. Telemetry: Martian Mono 8.5 to 9.5px, bone-dim, tabular numerals.

The jump from 9.5px telemetry to 15px+ prose is deliberate: data recedes, words lead.

## Layout

Perimeter instruments around a clear centre. A 42px top bar (brand, route, switches); the radio feed under it at the left and the site tools at the right; along the bottom baseline the site card (left), the console of bearing ruler and stage dock (centre) and the scout photos (right); the fiction note in its own strip under the baseline. The route shows only the current stop's name below 1800px wide; the rest show their number, and their name on hover or focus.

## Elevation & Depth

Flat. Panels are ink with 1px hairlines; no drop shadows, no blur, no glow inside the HUD. Text straight over the scene gets a soft dark halo (text-shadow) for legibility, never a box.

## Shapes

2px corners everywhere. Rails and dividers are 1px; no coloured side borders thicker than 1px.

## Components

### Buttons

- **Primary**: amber 1px outline, amber uppercase mono; fills amber on hover. One per panel at most (Fly on, Lift off, Hold to spin up).
- **Top-bar switches**: quiet words, no frame at rest; a hairline on hover and focus; amber while on.
- **Text buttons**: underlined mono, for skips and "Next" links.

### Cards / Containers

The site card and stage dock are `hud-panel`s. Nothing nests a card inside a card.

### Navigation

The route strip: nine dots on a dashed line; amber for here, filled bone for visited, hollow for ahead.

### Radio feed

Ingenuity's lines, typed in time with its voice, on a 1px amber rail over a soft ink gradient. It folds to a one-line chip that replays the message. Its text is never repeated elsewhere on screen.

## Do's and Don'ts

### Do:

- Keep the diorama in the middle of the screen at every viewport.
- Say each line once, in the radio feed.
- Let every waiting step move on by itself.
- Keep focus rings visible (1px amber, 2px offset).

### Don't:

- Don't use SaaS card grids, neon gradients, purple or cyan light, or decorative glassmorphism.
- Don't add kickers or section numbers that carry no information.
- Don't put a frame round every control; frames are for panels and the one primary action.
