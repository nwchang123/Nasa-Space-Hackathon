// Ingenuity as the guide, all the way: a radio feed docked at the HUD's top-left edge, just under
// the route bar, so the diorama in the middle of the screen stays clear. One feed per stage:
// - at home before lift-off, once the opening dive has landed: who Ingenuity is and how Flight 72
//   broke its blades (the dock holds the rotor test until this has been said), then, after the
//   failed test, the turn to Flight 73;
// - on each leg, from the take-off: Ingenuity's lines on the way;
// - at each stop, once the camera has settled and Ingenuity has landed: the stop's arrivalIntro;
// - home again: the closing lines.
// Each message is typed out with radio squelch and telegraph ticks, and Ingenuity reads it aloud
// (the voiceover, on unless the visitor switched it off): its recorded clip where there is one,
// the browser's speech otherwise; the typing keeps pace with the voice, pausing where it pauses.
// When the visitor finishes a stop's signature action (the scan done, the frost on, the storm at
// full strength…) it answers with the stop's inheritance line and a telemetry chirp. While the
// camera is close up on a part, its header says what Ingenuity is scanning. After a while it folds
// into a one-line chip that replays the last message. It hides under the scout camera's viewfinder.
// What it is saying, and when the visitor has heard it, is published in useFeed (src/ui/tour.ts).
//
// Rendered by the HUD (src/ui/hud/Hud.tsx). Its height is published on the HUD as --feed-h, so the
// site card below it in the same left column never grows into it.

import { useEffect, useMemo, useRef, useState } from 'react';
import { EPILOGUE, LEG_SCRIPTS, PROLOGUE, PROLOGUE_TEST_AT } from '../data/flight';
import { MACHINE_BY_ID } from '../data/machines';
import { SIGNATURES, type SignatureDef } from '../data/signatures';
import { HOME, hop } from '../flight/route';
import { currentStop, useApp, type AppState, type Stage } from '../store';
import type { MachineId } from '../types';
import { isMuted, playChirp, playRadioClose, playRadioOpen, playTypeTick } from '../ui/sound';
import { readingMs, useFeed, useTour } from '../ui/tour';
import { isVoiceOn, onVoiceChange, preloadVoice, setVoice, speak, stopSpeaking, voiceSupported, type Speech } from '../ui/voice';
import { live } from './registry';
import { useReducedMotion } from './useReducedMotion';
import './guide.css';

/** Typing speed without the voice (or once it stops), ms per character, and the pauses after punctuation and between lines. */
const CHAR_MS = 26;
const COMMA_MS = 120;
const STOP_MS = 260;
const LINE_MS = 460;
/** Delay before the first character and the voice, ms (lets the squelch play). */
const OPEN_MS = 360;
/** How long a finished message stays open before folding into the chip, ms. */
const HOLD_INTRO_MS = 12000;
const HOLD_REACT_MS = 9000;
/** After the pointer leaves an open feed, it folds after this long, ms. */
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

/** What the close-up camera is on during a signature action, as the bubble names it. */
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
  /** 'intro': the feed's opening message; 'imagine': the prologue's turn to Flight 73; 'react': a signature action's answer. */
  kind: 'intro' | 'imagine' | 'react';
  tag: string;
  lines: string[];
}

/** One stage's feed. */
interface Feed {
  /** Also the React key: 'prologue', 'flying:<leg>:<from>:<start>', 'site:<stop>', 'epilogue'. */
  key: string;
  /** The stop standing at (site stage only): its signature actions and close-ups. */
  stop: MachineId | null;
  /** The opening message, said once the feed is fully up. */
  intro: { tag: string; lines: string[] };
  /** How much the feed shows now, 0..1, polled each animation frame. */
  fade(): number;
}

/** What the close-up camera is on (store.focus), read defensively. */
interface FocusLike {
  kind: string;
  id: string;
}
const selectFocus = (s: object): FocusLike | null => (s as { focus?: FocusLike | null }).focus ?? null;
const selectScout = (s: object): boolean => !!(s as { scoutCam?: boolean }).scoutCam;

/** How much a feed standing at `stop` shows: in `stage`, once the dive has settled there and the screen is clear. */
function settledFade(stop: MachineId, stage: Stage): number {
  const s = useApp.getState();
  if (s.phase !== 'flight' || s.flight.stage !== stage) return 0;
  if (stage === 'site' && currentStop(s.flight) !== stop) return 0;
  if (selectScout(s)) return 0;
  const shot = live.shot;
  if (shot.siteId !== stop || !live.site.valid || !shot.ingenuity) return 0;
  const settle = Math.min(1, Math.max(0, (shot.blend - 0.95) / 0.05));
  return settle * (1 - Math.min(1, live.black * 3));
}

/** In `stage` at all (the leg's feed shows from the take-off), clear of the black dip and the viewfinder. */
function stageFade(stage: Stage): number {
  const s = useApp.getState();
  if (s.phase !== 'flight' || s.flight.stage !== stage || selectScout(s)) return 0;
  return 1 - Math.min(1, live.black * 3);
}

/** Home again: the closing lines come up this long after the epilogue began even if the view never settled at home, ms. */
const EPILOGUE_FEED_LATE_MS = 4000;

/** The current stage's feed key, or null outside the flight. */
function feedKey(s: AppState): string | null {
  if (s.phase !== 'flight') return null;
  const f = s.flight;
  if (f.stage === 'prologue' || f.stage === 'epilogue') return f.stage;
  if (f.stage === 'flying') return `flying:${f.leg}:${f.from}:${f.stageStartedAt}`;
  const stop = currentStop(f);
  return stop ? `site:${stop}` : null;
}

function feedFor(key: string): Feed {
  const [kind, a, b] = key.split(':');
  if (kind === 'prologue') {
    return { key, stop: null, intro: { tag: 'Valinor Hills · Flight 72', lines: PROLOGUE.slice(0, PROLOGUE_TEST_AT) }, fade: () => settledFade(HOME, 'prologue') };
  }
  if (kind === 'epilogue') {
    // The view rises to the whole globe while the closing lines are still being said: once the
    // feed is up it stays up. (If the view never settled at home, it comes up anyway.)
    let up = false;
    return {
      key,
      stop: null,
      intro: { tag: 'Home again', lines: EPILOGUE },
      fade: () => {
        const s = useApp.getState();
        const late = s.flight.stage === 'epilogue' && Date.now() - s.flight.stageStartedAt > EPILOGUE_FEED_LATE_MS;
        if (!up && (settledFade(HOME, 'epilogue') > 0.95 || late)) up = true;
        return up ? stageFade('epilogue') : settledFade(HOME, 'epilogue');
      },
    };
  }
  if (kind === 'flying') {
    const h = hop(b as MachineId, Number(a));
    const to = MACHINE_BY_ID[h.to];
    // The scripted lines name the planned leg's geometry, so a direct hop gets a plain line instead.
    const lines = h.onRoute ? LEG_SCRIPTS[h.to].enRoute : [`Off the planned route: straight from ${MACHINE_BY_ID[h.from].shortName} to ${to.shortName}.`];
    return { key, stop: null, intro: { tag: `${h.onRoute ? `Leg ${Number(a) + 1}` : 'Direct hop'} · to ${to.shortName}`, lines }, fade: () => stageFade('flying') };
  }
  const stop = a as MachineId;
  return { key, stop, intro: { tag: `Arrived · ${MACHINE_BY_ID[stop].shortName}`, lines: LEG_SCRIPTS[stop].arrivalIntro }, fade: () => settledFade(stop, 'site') };
}

/** Ingenuity's radio feed, one per stage of the flight; nothing outside it. */
export function GuideBubble() {
  const key = useApp(feedKey);
  const feed = useMemo(() => (key ? feedFor(key) : null), [key]);
  return feed ? <RadioFeed key={feed.key} feed={feed} /> : null;
}

function RadioFeed({ feed }: { feed: Feed }) {
  const stop = feed.stop;
  const reduced = useReducedMotion();
  const focus = useApp(selectFocus);
  const root = useRef<HTMLDivElement>(null);
  const [arrived, setArrived] = useState(false);
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

  // Shown once the camera has settled at the stop (that moment is the arrival), hidden under the
  // scout camera's viewfinder and while the screen fades to black. Polled each animation frame and
  // written to the DOM directly. The HUD learns the feed's height (0 while hidden) as --feed-h.
  useEffect(() => {
    const el = root.current;
    const hud = el?.parentElement;
    if (!el || !hud) return;
    let raf = 0;
    let shown = -1;
    let landed = false;
    const publish = () => hud.style.setProperty('--feed-h', shown > 0 ? `${Math.ceil(el.offsetHeight)}px` : '0px');
    const resize = new ResizeObserver(publish);
    resize.observe(el);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const fade = feed.fade();
      if (!landed && fade > 0.95) {
        landed = true;
        setArrived(true);
      }
      const k = Math.round(fade * 100) / 100;
      if (k === shown) return;
      const was = shown > 0;
      shown = k;
      el.style.opacity = String(k);
      el.style.visibility = k > 0 ? 'visible' : 'hidden';
      el.classList.toggle('on', k > 0.6);
      if (k > 0 !== was) publish();
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      hud.style.removeProperty('--feed-h');
    };
  }, [feed]);

  // The opening message, once the feed is fully up (at a stop: once the camera has settled there).
  useEffect(() => {
    if (arrived) setMsg({ id: Date.now(), kind: 'intro', tag: feed.intro.tag, lines: feed.intro.lines });
  }, [arrived, feed]);

  // The prologue, after the failed rotor test: the turn to Flight 73.
  const imagine = useApp(s => feed.key === 'prologue' && s.flight.stage === 'prologue' && s.prologue.step === 'imagine');
  useEffect(() => {
    if (imagine) setMsg({ id: Date.now(), kind: 'imagine', tag: 'Flight 73', lines: PROLOGUE.slice(PROLOGUE_TEST_AT) });
  }, [imagine]);

  // What the feed is saying, for the dock and the auto tour; and once it has been heard (the voice
  // finished) or, without the voice, had its time to be read.
  const speechRef = useRef<Speech | null>(null);
  useEffect(() => {
    useFeed.setState({ key: feed.key, kind: msg?.kind ?? null, id: msg?.id ?? 0, done: false });
  }, [feed, msg]);
  useEffect(() => () => useFeed.setState({ key: '', kind: null, id: 0, done: false }), []);
  useEffect(() => {
    if (!done || !msg) return;
    const read = readingMs(text);
    const t = window.setInterval(() => {
      const sp = speechRef.current;
      const spDone = sp ? sp.done() : null;
      const elapsed = Date.now() - msg.id - OPEN_MS;
      // While the voice is still going, wait for it (within reason); without it, the reading time.
      const heard = spDone !== null ? spDone || elapsed > read * 2 + 4000 : elapsed >= read;
      if (heard) {
        window.clearInterval(t);
        if (useFeed.getState().id === msg.id) useFeed.setState({ done: true });
      }
    }, 150);
    return () => window.clearInterval(t);
  }, [done, msg, text]);

  // Reactions to the stop's signature actions.
  useEffect(() => {
    if (!stop) return;
    const script = LEG_SCRIPTS[stop];
    const defs = SIGNATURES[stop] ?? [];
    if (defs.length === 0) return;
    const timers: number[] = [];
    // A slider that opens already run (its preset, e.g. Sojourner down the ramp) counts as done
    // until it is pulled back, so the first nudge does not set off the reaction.
    const sliderDone: Record<string, boolean> = {};
    for (const def of defs) {
      if (def.kind !== 'slider' || def.preset === undefined) continue;
      const min = def.min ?? 0;
      sliderDone[def.key] = (def.preset - min) / ((def.max ?? 1) - min || 1) >= SLIDER_DONE;
    }
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
          // Fired by the auto tour while the narrator reads (AutoTour.tsx): no answer over the narrator.
          if (fire !== undefined && fire !== old[`${def.key}:fire`] && useTour.getState().demo !== def.key) {
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
          if (v === 1 && useTour.getState().demo !== def.key) timers.push(window.setTimeout(() => react(def), TOGGLE_REACT_MS));
        } else {
          const min = def.min ?? 0;
          const max = def.max ?? 1;
          const k = (v - min) / (max - min || 1);
          if (k >= SLIDER_DONE && !sliderDone[def.key]) {
            sliderDone[def.key] = true;
            // Run by the auto tour while the narrator reads it (AutoTour.tsx): no answer over the narrator.
            if (useTour.getState().demo !== def.key) react(def);
          } else if (k < SLIDER_REARM) sliderDone[def.key] = false;
        }
      }
    });
    return () => {
      unsub();
      for (const t of timers) window.clearTimeout(t);
    };
  }, [stop]);

  // Load the feed's voice clips (a stop's intro and inheritance) ahead of the arrival.
  useEffect(() => {
    if (voice) preloadVoice(stop ? [feed.intro.lines, [LEG_SCRIPTS[stop].inheritance]] : [feed.intro.lines]);
  }, [voice, feed, stop]);

  // Type the message out, with radio sounds, and read it aloud if the voiceover is on. With the
  // voice, the typing follows the clip's own clock (each phrase typed while it is spoken); without
  // it, or once it is stopped or fails, the typing runs on a timer from wherever it had got to.
  useEffect(() => {
    if (!msg) return;
    const full = msg.lines.join('\n');
    setOpen(true);
    setHoldKey(0);
    playRadioOpen();
    if (msg.kind === 'react') playChirp();
    let i = 0;
    let timer = 0;
    let raf = 0;
    let speech: Speech | null = null;
    speechRef.current = null;
    if (reduced) {
      setTyped(full.length);
      timer = window.setTimeout(() => {
        speech = speak(msg.lines);
        speechRef.current = speech;
      }, OPEN_MS);
      return () => {
        window.clearTimeout(timer);
        speech?.stop();
      };
    }
    setTyped(0);
    /** Show the first n characters, with a tick for the typing and the squelch once it is all out. */
    const show = (n: number) => {
      if (n <= i) return;
      let tick = false;
      for (let j = i; j < n; j++) if (full[j] !== ' ' && full[j] !== '\n' && (j + 1) % 2 === 0) tick = true;
      i = Math.min(n, full.length);
      setTyped(i);
      if (tick) playTypeTick();
      if (i >= full.length) playRadioClose();
    };
    const step = () => {
      show(i + 1);
      if (i >= full.length) return;
      const ch = full[i - 1];
      const delay = ch === '\n' ? LINE_MS : /[.!?]/.test(ch) ? STOP_MS : /[,;:—]/.test(ch) ? COMMA_MS : CHAR_MS;
      timer = window.setTimeout(step, delay);
    };
    const follow = () => {
      const n = speech?.charsAt() ?? null;
      if (n === null) {
        speech = null;
        speechRef.current = null;
        timer = window.setTimeout(step, CHAR_MS);
        return;
      }
      show(n);
      if (i < full.length) raf = requestAnimationFrame(follow);
    };
    timer = window.setTimeout(() => {
      speech = speak(msg.lines);
      speechRef.current = speech;
      if (speech) follow();
      else step();
    }, OPEN_MS);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      speech?.stop();
    };
  }, [msg, reduced]);

  // A finished message folds into the chip after a while (not while the pointer is on it).
  useEffect(() => {
    if (!done || !open || !msg) return;
    const ms = holdKey > 0 ? HOLD_AFTER_HOVER_MS : msg.kind === 'react' ? HOLD_REACT_MS : HOLD_INTRO_MS;
    const t = window.setTimeout(() => {
      if (!hovered.current) setOpen(false);
    }, ms);
    return () => window.clearTimeout(t);
  }, [done, open, msg, holdKey]);

  // When the camera closes in on a part, a finished message folds away; the chip then says what
  // Ingenuity is scanning.
  const focusKey = focus ? `${focus.kind}:${focus.id}` : null;
  useEffect(() => {
    if (focusKey && done) setOpen(false);
    // Only on a new subject, not when a message finishes while one is in view.
  }, [focusKey]);

  // Voiceover switch, kept in step with the voice module; silence when muted or leaving the stage.
  useEffect(() => onVoiceChange(setVoiceState), []);
  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => {
    if (!voice) return;
    const t = window.setInterval(() => {
      if (isMuted()) stopSpeaking();
    }, 400);
    return () => window.clearInterval(t);
  }, [voice]);

  const replay = () => {
    if (msg) setMsg({ ...msg, id: Date.now() });
  };
  // Switching the voice on replays the message, so it is heard with the typing in step.
  const toggleVoice = () => {
    const on = !voice;
    setVoice(on);
    if (on) replay();
  };

  const status = stop ? focusLabel(focus, stop) : null;
  const shownText = text.slice(0, typed);
  const shownLines = shownText.split('\n');
  const typing = !!msg && !done;
  const kicker = msg ? (msg.kind === 'react' && !done ? msg.tag : (status ?? msg.tag)) : null;

  return (
    <div ref={root} className="radio-feed" style={{ opacity: 0, visibility: 'hidden' }}>
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
          {/* The channel strip: the radio level, a hairline, the voiceover switch and the fold. */}
          <div className="gb-head">
            <span className="gb-wave" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="gb-rule" aria-hidden="true" />
            <span className="gb-ctl">
              {voiceSupported() && (
                <button type="button" className={`gb-btn gb-voice${voice ? ' on' : ''}`} aria-pressed={voice} onClick={toggleVoice} title="Read Ingenuity's lines aloud">
                  <span className="gb-br" aria-hidden="true">
                    [
                  </span>
                  Voiceover
                  <span className="gb-br" aria-hidden="true">
                    ]
                  </span>
                </button>
              )}
              <button type="button" className="gb-btn gb-fold" aria-label="Fold Ingenuity's radio feed" title="Fold" onClick={() => setOpen(false)}>
                [-]
              </button>
            </span>
          </div>
          <p className="gb-title">
            <span className="gb-br" aria-hidden="true">
              [
            </span>
            <span className="gb-who">Ingenuity</span>
            <span className="gb-sep" aria-hidden="true">
              //
            </span>
            <span className="gb-kicker">{kicker}</span>
            <span className="gb-br" aria-hidden="true">
              ]
            </span>
          </p>
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
          <span className="gb-br" aria-hidden="true">
            [
          </span>
          <span className="gb-who">Ingenuity</span>
          <span className="gb-sep" aria-hidden="true">
            ·
          </span>
          <span className="gb-tag">{status ?? (msg ? 'Replay' : 'Standing by')}</span>
          <span className="gb-br" aria-hidden="true">
            ]
          </span>
        </button>
      )}
    </div>
  );
}

/**
 * What the close-up camera is on, "02 · What I found", "The antenna": the one place it is named
 * (the reticle shows only "Scanning" / "Target lock", the pin only its number).
 */
function focusLabel(focus: FocusLike | null, stop: MachineId): string | null {
  if (!focus) return null;
  if (focus.kind === 'hotspot') {
    if (focus.id === 'call') return 'The antenna';
    const n = Number(focus.id);
    if (Number.isInteger(n) && n >= 0 && n < 4) return `${String(n + 1).padStart(2, '0')} · ${STORY_LABELS[n]}`;
    return 'Scanning';
  }
  const def = (SIGNATURES[stop] ?? []).find(d => d.key === focus.id);
  if (!def) return 'Scanning';
  const subject = SIG_SUBJECT[def.key] ?? def.label;
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}
