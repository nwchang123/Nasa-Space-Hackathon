// Ingenuity as the guide at every stop: a small radio bubble that rides above it in the diorama.
// On arrival (as Ingenuity hovers in and lands) it types out the stop's arrivalIntro, with radio
// squelch and telegraph ticks, and reads it aloud when the visitor has switched the voiceover on.
// When the visitor finishes the stop's signature action (the scan done, the frost on, the storm at
// full strength…) it answers with the stop's inheritance line and a telemetry chirp. While the
// camera is close up on a part, its header says what Ingenuity is scanning. After a while it folds
// into a small chip that replays the last message.
//
// Mounted inside the Diorama's group, so positions are diorama-local metres. It follows Ingenuity:
// its landing spot (with the arrival hover), or wherever the visitor or the hotspot autopilot has
// flown it (live.flyer, when that belongs to this stop).

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Vector3, type Group } from 'three';
import { LEG_SCRIPTS } from '../data/flight';
import { MACHINE_BY_ID } from '../data/machines';
import { SIGNATURES, type SignatureDef } from '../data/signatures';
import { currentStop, useApp } from '../store';
import type { MachineId } from '../types';
import { isMuted, playChirp, playRadioClose, playRadioOpen, playTypeTick } from '../ui/sound';
import { isVoiceOn, onVoiceChange, setVoice, speak, stopSpeaking, voiceSupported } from '../ui/voice';
import { live } from './registry';
import { SITE_PRESETS, siteLayout } from './sites';
import { useReducedMotion } from './useReducedMotion';
import './guide.css';

/** How far above Ingenuity's feet the bubble's stem ends, m (Ingenuity stands about 0.5 m tall). */
const LIFT_M = 0.72;
/** The bubble switches side when Ingenuity crosses this far past the screen's middle (NDC). */
const FLIP_BAND = 0.06;
const ndc = new Vector3();
/** Screen layout, CSS px (match guide.css): the stem's height and its inset from the panel's end. */
const STEM_PX = 46;
const STEM_LEFT_PX = 26;
/** Margin kept from the screen edges. */
const EDGE_PX = 16;
/** Gap kept from the HUD's top bar and its site tools (Wide view, Scout cam) at top right, px. */
const HUD_GAP_PX = 10;
/** Fallback when the top bar is not measurable: its bottom edge, px; and the top of the bottom dock as a fraction of the height. */
const TOP_BAR_PX = 64;
const DOCK_TOP = 0.68;
/** Gap kept above the bottom HUD, px. */
const FLOOR_GAP_PX = 10;
/** Typing speed, ms per character, and the pauses after punctuation and between lines. */
const CHAR_MS = 26;
const COMMA_MS = 120;
const STOP_MS = 260;
const LINE_MS = 460;
/** Delay before the first character, ms (lets the squelch play). */
const OPEN_MS = 360;
/** How long a finished message stays open before folding into the chip, ms. */
const HOLD_INTRO_MS = 12000;
const HOLD_REACT_MS = 9000;
/** After the pointer leaves an open bubble, it folds after this long, ms. */
const HOLD_AFTER_HOVER_MS = 3500;

const STORY_LABELS = ['Why I came', 'What I found', 'My last day', 'Still here'] as const;

/** The short tag shown over Ingenuity's reaction, per signature action. */
const REACT_TAG: Record<string, string> = {
  scan: 'First photo scanned',
  frost: 'Frost on the ground',
  roll: 'Sojourner is on Mars',
  drag: 'Silica scraped up',
  storm: 'Storm at full strength',
  scoop: 'Ice found, gone in four sols',
  quake: 'Marsquake recorded',
  larri: 'Reflector in view',
  decode: 'Parachute decoded',
  wake: 'Wake-up routine done',
};

/** What Ingenuity says it is scanning while the close-up camera is on a signature action. */
const SIG_SUBJECT: Record<string, string> = {
  scan: 'the first photo',
  frost: 'the frost',
  roll: 'the ramp',
  drag: 'the jammed wheel',
  storm: 'the dust',
  scoop: 'the trench',
  quake: 'the seismometer',
  larri: 'the reflector',
  decode: 'the parachute',
  wake: 'my own systems',
};

/** Sliders count as done near the top of their range, and re-arm once pulled well back. */
const SLIDER_DONE = 0.97;
const SLIDER_REARM = 0.6;
/** Toggles: the reaction waits for the effect to show, ms. */
const TOGGLE_REACT_MS = 1400;
/** Buttons react when their effect ends, but never later than this, ms. */
const BUTTON_REACT_MAX_MS = 10000;

interface Msg {
  /** Changes on every (re)play, so the same text can be typed again. */
  id: number;
  kind: 'intro' | 'react';
  tag: string;
  lines: string[];
}

/** The scene's flyer (written by the site flight), read defensively: valid only for this stop. */
interface FlyerLike {
  site: string | null;
  x: number;
  z: number;
  alt: number;
  ground: number;
}
function flyerFor(stop: MachineId): FlyerLike | null {
  const f = (live as { flyer?: FlyerLike }).flyer;
  return f && f.site === stop ? f : null;
}

/** What the close-up camera is on (store.focus), read defensively. */
interface FocusLike {
  kind: string;
  id: string;
}
const selectFocus = (s: object): FocusLike | null => (s as { focus?: FocusLike | null }).focus ?? null;
const selectScout = (s: object): boolean => !!(s as { scoutCam?: boolean }).scoutCam;

/** How much the bubble shows: at this stop's site stage, once the dive has settled and the screen is clear. */
function bubbleFade(stop: MachineId): number {
  const s = useApp.getState();
  if (s.phase !== 'flight' || s.flight.stage !== 'site' || currentStop(s.flight) !== stop) return 0;
  if (selectScout(s)) return 0;
  const shot = live.shot;
  if (shot.siteId !== stop || !live.site.valid || !shot.ingenuity) return 0;
  const settle = Math.min(1, Math.max(0, (shot.blend - 0.95) / 0.05));
  return settle * (1 - Math.min(1, live.black * 3));
}

export function GuideBubble({ stop }: { stop: MachineId }) {
  const anchor = useRef<Group>(null);
  const root = useRef<HTMLDivElement>(null);
  const shown = useRef(-1);
  const arrivedRef = useRef(false);
  const [arrived, setArrived] = useState(false);
  const lay = siteLayout(SITE_PRESETS[stop]);

  const box = useRef({ frame: 0, w: 0, h: 0, shift: 0, dx: 0, dy: 0, floor: 0, ceil: TOP_BAR_PX, tools: null as { left: number; top: number; bottom: number } | null });

  useFrame(({ camera, size }) => {
    const a = anchor.current;
    if (!a) return;
    const f = flyerFor(stop);
    if (f) a.position.set(f.x, f.ground + f.alt + LIFT_M, f.z);
    else a.position.set(lay.ingenuity[0], live.shot.hover + LIFT_M, lay.ingenuity[2]);

    const fade = bubbleFade(stop);
    if (!arrivedRef.current && fade > 0.95) {
      arrivedRef.current = true;
      setArrived(true);
    }
    const el = root.current;
    if (el && fade > 0) {
      // Open away from the middle of the screen, where the machine is: on the left half the bubble
      // grows leftward from Ingenuity, on the right half rightward (with a dead band against flicker).
      a.updateWorldMatrix(true, false);
      ndc.setFromMatrixPosition(a.matrixWorld).project(camera);
      let flip = el.classList.contains('flip');
      if (!flip && ndc.x < -FLIP_BAND) el.classList.add('flip');
      else if (flip && ndc.x > FLIP_BAND) el.classList.remove('flip');
      flip = el.classList.contains('flip');

      // Keep the panel (or the folded chip) on screen and clear of the HUD: below the top bar, above
      // the bearing bar or dock, and beside or below the site tools at top right. It slides sideways
      // while its stem stays on Ingenuity. (Measured every few frames: typing changes its height.)
      const b = box.current;
      const panel = el.firstElementChild as HTMLElement | null;
      if (panel && (b.frame++ % 8 === 0 || b.w === 0)) {
        b.w = panel.offsetWidth;
        b.h = panel.offsetHeight;
        // Stay above the bottom HUD: the 360° bearing bar when it shows, else the dock.
        const below = document.querySelector('.brg:not([hidden])') ?? document.querySelector('.dock');
        b.floor = below ? below.getBoundingClientRect().top - FLOOR_GAP_PX : size.height * DOCK_TOP;
        const bar = document.querySelector('.hud-top')?.getBoundingClientRect();
        b.ceil = bar && bar.height > 0 ? bar.bottom + HUD_GAP_PX : TOP_BAR_PX;
        const tools = document.querySelector('.site-tools')?.getBoundingClientRect();
        b.tools = tools && tools.width > 0 && tools.height > 0 ? { left: tools.left - HUD_GAP_PX, top: tools.top - HUD_GAP_PX, bottom: tools.bottom + HUD_GAP_PX } : null;
      }
      const rawX = ((ndc.x + 1) / 2) * size.width;
      const rawY = ((1 - ndc.y) / 2) * size.height;
      // Where the panel would sit with its stem's foot at (x, y), before any sideways slide.
      const leftAt = (x: number) => (flip ? x + STEM_LEFT_PX - b.w : x - STEM_LEFT_PX);
      // The slide that keeps [left, left + w] inside the screen and left of `right`.
      const slideFor = (left: number, right: number) => Math.round(Math.min(0, right - (left + b.w)) + Math.max(0, EDGE_PX - left));
      // Never slide so far that the stem leaves the panel (pinned at an edge, there is no stem).
      const limit = Math.max(0, b.w - 2 * STEM_LEFT_PX);
      const stemSlide = (shift: number) => (flip ? Math.max(0, Math.min(limit, shift)) : Math.min(0, Math.max(-limit, shift)));
      // The panel's right limit at a given foot height: the site tools' left edge where the two overlap vertically.
      const rightAt = (y: number) => {
        const t = b.tools;
        const top = y - STEM_PX - b.h;
        return t && top < t.bottom && y - STEM_PX > t.top ? t.left : size.width - EDGE_PX;
      };
      // When Ingenuity is out of frame (a close-up elsewhere), the radio stays on screen: the
      // bubble is pinned at the nearest edge, without its stem.
      const maxY = b.floor > 0 ? b.floor : size.height * DOCK_TOP;
      const minY = Math.min(maxY, b.ceil + STEM_PX + b.h);
      const sx = Math.min(size.width - EDGE_PX - STEM_LEFT_PX, Math.max(EDGE_PX + STEM_LEFT_PX, rawX));
      let sy = Math.min(maxY, Math.max(minY, rawY));
      // Beside the site tools and unable to slide clear of them with the stem attached (Ingenuity
      // is under or just left of them): drop below them instead, and the stem lets go.
      if (b.tools && ndc.z <= 1) {
        const left = leftAt(sx);
        const right = rightAt(sy);
        const fixed = left + stemSlide(slideFor(left, right)) + b.w <= right + 0.5;
        const under = b.tools.bottom + STEM_PX + b.h;
        if (!fixed && under <= maxY) sy = Math.max(sy, under);
      }
      const off = ndc.z > 1 || Math.abs(sx - rawX) > 1 || Math.abs(sy - rawY) > 1;
      const dx = ndc.z > 1 ? 0 : Math.round(sx - rawX);
      const dy = ndc.z > 1 ? 0 : Math.round(sy - rawY);
      if (dx !== b.dx || dy !== b.dy) {
        b.dx = dx;
        b.dy = dy;
        el.style.setProperty('--gb-dx', `${dx}px`);
        el.style.setProperty('--gb-dy', `${dy}px`);
      }
      el.classList.toggle('edge', off);
      const shift = slideFor(leftAt(sx), rightAt(sy));
      const clamped = off ? shift : stemSlide(shift);
      if (clamped !== b.shift) {
        b.shift = clamped;
        el.style.setProperty('--gb-shift', `${clamped}px`);
      }
    }
    const k = Math.round(fade * 100) / 100;
    if (k === shown.current || !el) return;
    shown.current = k;
    el.style.opacity = String(k);
    el.style.visibility = k > 0 ? 'visible' : 'hidden';
    el.classList.toggle('gb-on', k > 0.6);
  });

  return (
    <group ref={anchor}>
      <Html zIndexRange={[1, 0]} pointerEvents="none" className="gb-wrap">
        <RadioBubble stop={stop} arrived={arrived} rootRef={root} />
      </Html>
    </group>
  );
}

function RadioBubble({ stop, arrived, rootRef }: { stop: MachineId; arrived: boolean; rootRef: RefObject<HTMLDivElement | null> }) {
  const script = LEG_SCRIPTS[stop];
  const machine = MACHINE_BY_ID[stop];
  const reduced = useReducedMotion();
  const stage = useApp(s => s.flight.stage);
  const focus = useApp(selectFocus);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [typed, setTyped] = useState(0);
  const [open, setOpen] = useState(true);
  const [voice, setVoiceState] = useState(isVoiceOn);
  const [holdKey, setHoldKey] = useState(0);
  const hovered = useRef(false);
  const arrivedRef = useRef(arrived);
  arrivedRef.current = arrived;

  const text = msg ? msg.lines.join('\n') : '';
  const done = !!msg && typed >= text.length;

  // Arrival: the intro, once the camera has settled at the stop.
  useEffect(() => {
    if (arrived) setMsg({ id: Date.now(), kind: 'intro', tag: `Arrived · ${machine.shortName}`, lines: script.arrivalIntro });
  }, [arrived, script, machine]);

  // Reactions to the stop's signature actions.
  useEffect(() => {
    const defs = SIGNATURES[stop] ?? [];
    if (defs.length === 0) return;
    const timers: number[] = [];
    const sliderDone: Record<string, boolean> = {};
    const react = (def: SignatureDef) => {
      const s = useApp.getState();
      if (!arrivedRef.current || s.flight.stage !== 'site' || currentStop(s.flight) !== stop) return;
      setMsg({ id: Date.now(), kind: 'react', tag: REACT_TAG[def.key] ?? def.label, lines: [script.inheritance] });
    };
    let prev = useApp.getState().sig;
    const unsub = useApp.subscribe(s => {
      const sig = s.sig;
      if (sig === prev) return;
      const old = prev;
      prev = sig;
      for (const def of defs) {
        // Hold-to-charge: the action fires on release (sig[`${key}:fire`] = Date.now()); react
        // once its effect has played.
        if ((def.kind as string) === 'hold') {
          const fire = sig[`${def.key}:fire`];
          if (fire !== undefined && fire !== old[`${def.key}:fire`]) {
            timers.push(window.setTimeout(() => react(def), Math.min(BUTTON_REACT_MAX_MS, def.durationMs ?? 0)));
          }
          continue;
        }
        const v = sig[def.key];
        if (v === undefined || v === old[def.key]) continue;
        if (def.kind === 'button') {
          const wait = Math.min(BUTTON_REACT_MAX_MS, def.durationMs ?? 0);
          timers.push(window.setTimeout(() => react(def), wait));
        } else if (def.kind === 'toggle') {
          if (v === 1) timers.push(window.setTimeout(() => react(def), TOGGLE_REACT_MS));
        } else {
          const min = def.min ?? 0;
          const max = def.max ?? 1;
          const k = (v - min) / (max - min || 1);
          if (k >= SLIDER_DONE && !sliderDone[def.key]) {
            sliderDone[def.key] = true;
            react(def);
          } else if (k < SLIDER_REARM) sliderDone[def.key] = false;
        }
      }
    });
    return () => {
      unsub();
      for (const t of timers) window.clearTimeout(t);
    };
  }, [stop, script]);

  // Type the message out, with radio sounds, and read it aloud if the voiceover is on.
  useEffect(() => {
    if (!msg) return;
    const full = msg.lines.join('\n');
    setOpen(true);
    setHoldKey(0);
    playRadioOpen();
    if (msg.kind === 'react') playChirp();
    speak(msg.lines);
    if (reduced) {
      setTyped(full.length);
      return;
    }
    setTyped(0);
    let i = 0;
    let timer = 0;
    const step = () => {
      i++;
      setTyped(i);
      const ch = full[i - 1];
      if (ch !== ' ' && ch !== '\n' && i % 2 === 0) playTypeTick();
      if (i >= full.length) {
        playRadioClose();
        return;
      }
      const delay = ch === '\n' ? LINE_MS : /[.!?]/.test(ch) ? STOP_MS : /[,;:—]/.test(ch) ? COMMA_MS : CHAR_MS;
      timer = window.setTimeout(step, delay);
    };
    timer = window.setTimeout(step, OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [msg, reduced]);

  // A finished message folds into the chip after a while (not while the pointer is on it).
  useEffect(() => {
    if (!done || !open || !msg) return;
    const ms = holdKey > 0 ? HOLD_AFTER_HOVER_MS : msg.kind === 'intro' ? HOLD_INTRO_MS : HOLD_REACT_MS;
    const t = window.setTimeout(() => {
      if (!hovered.current) setOpen(false);
    }, ms);
    return () => window.clearTimeout(t);
  }, [done, open, msg, holdKey]);

  // When the camera closes in on a part, a finished message folds away so it does not cover the
  // close-up; the chip then says what Ingenuity is scanning.
  const focusKey = focus ? `${focus.kind}:${focus.id}` : null;
  useEffect(() => {
    if (focusKey && done) setOpen(false);
    // Only on a new subject, not when a message finishes while one is in view.
  }, [focusKey]);

  // Voiceover switch, kept in step with other bubbles; silence when muted or leaving the stop.
  useEffect(() => onVoiceChange(setVoiceState), []);
  useEffect(() => {
    if (stage !== 'site') stopSpeaking();
  }, [stage]);
  useEffect(() => {
    if (!voice) return;
    const t = window.setInterval(() => {
      if (isMuted()) stopSpeaking();
    }, 400);
    return () => window.clearInterval(t);
  }, [voice]);
  useEffect(() => () => stopSpeaking(), []);

  const replay = () => {
    if (msg) setMsg({ ...msg, id: Date.now() });
  };
  const toggleVoice = () => {
    const on = !voice;
    setVoice(on);
    if (on && msg) speak(msg.lines);
  };

  const status = focusLabel(focus, stop);
  const shownText = text.slice(0, typed);
  const shownLines = shownText.split('\n');
  const typing = !!msg && !done;

  return (
    <div ref={rootRef} className="gb" style={{ opacity: 0, visibility: 'hidden' }}>
      {msg && open ? (
        <div
          className={`gb-panel${msg.kind === 'react' ? ' react' : ''}${typing ? ' typing' : ''}`}
          onPointerEnter={() => {
            hovered.current = true;
          }}
          onPointerLeave={() => {
            hovered.current = false;
            setHoldKey(k => k + 1);
          }}
        >
          <div className="gb-head">
            <span className="gb-wave" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="gb-who">Ingenuity</span>
            <span className="gb-space" />
            {voiceSupported() && (
              <button type="button" className={`gb-btn gb-voice${voice ? ' on' : ''}`} aria-pressed={voice} onClick={toggleVoice} title="Read Ingenuity's lines aloud">
                <span aria-hidden="true">{voice ? '◉' : '○'}</span> Voiceover
              </button>
            )}
            <button type="button" className="gb-btn gb-fold" aria-label="Fold the radio bubble" onClick={() => setOpen(false)}>
              <span aria-hidden="true">–</span>
            </button>
          </div>
          <p className="gb-kicker">{msg.kind === 'react' && !done ? msg.tag : (status ?? msg.tag)}</p>
          <div className="gb-body" aria-hidden="true">
            {shownLines.map((line, i) => (
              <p key={i}>
                {line}
                {typing && i === shownLines.length - 1 && <span className="gb-caret" />}
              </p>
            ))}
          </div>
          <p className="gb-sr" aria-live="polite">
            {msg.lines.join(' ')}
          </p>
        </div>
      ) : (
        <button type="button" className={`gb-chip${msg ? '' : ' idle'}`} onClick={replay} disabled={!msg} aria-label="Replay Ingenuity's last message">
          <span className="gb-chip-dot" aria-hidden="true" />
          <span className="gb-who">Ingenuity</span>
          {status ? <span className="gb-tag">{status}</span> : msg && <span className="gb-tag">Replay ↻</span>}
        </button>
      )}
      <span className="gb-stem" aria-hidden="true" />
      <span className="gb-foot" aria-hidden="true" />
    </div>
  );
}

/** "Scanning 02 · What I found" while the close-up camera is on a hotspot or a signature action. */
function focusLabel(focus: FocusLike | null, stop: MachineId): string | null {
  if (!focus) return null;
  if (focus.kind === 'hotspot') {
    if (focus.id === 'call') return 'Scanning · antenna';
    const n = Number(focus.id);
    if (Number.isInteger(n) && n >= 0 && n < 4) return `Scanning ${String(n + 1).padStart(2, '0')} · ${STORY_LABELS[n]}`;
    return 'Scanning';
  }
  const def = (SIGNATURES[stop] ?? []).find(d => d.key === focus.id);
  return def ? `Scanning · ${SIG_SUBJECT[def.key] ?? def.label}` : 'Scanning';
}
