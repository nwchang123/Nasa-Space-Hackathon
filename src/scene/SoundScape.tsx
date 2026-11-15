// The continuous sound of Flight 73, driven from the scene: the ambient pad (slow chords under
// everything, a little lower on the ground), Ingenuity's rotors whenever they turn
// (the prologue's hold-to-throttle test, take-off, cruise and boost, the dive and landing, the
// visitor or the autopilot hovering it beside a part), the Mars wind bed (only at the landing
// sites, faint, howling with Opportunity's dust storm), the hum of a hold-to-charge action, and
// the operation sounds: precision detents for every slider and for the 360° site orbit, toggle
// clicks, dug and scraped soil, the Scout Cam viewfinder, and the site camera pushing in and out.
// Renderless. Nothing plays on the title screen; the visitor has clicked by the time it starts.

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { SIGNATURES } from '../data/signatures';
import { currentStop, useApp, type AppState } from '../store';
import {
  playDetent,
  playFocusIn,
  playFocusOut,
  playFrost,
  playLaserPing,
  playRedZone,
  playStormGust,
  playToggle,
  playViewfinder,
  setAmbience,
  setChargeLoop,
  setRotorLoop,
  setWind,
} from '../ui/sound';
import { ambientLevel } from '../ui/ambientScore';
import { RED_ZONE, useThrottle } from '../ui/throttle';
import { HOME } from '../flight/route';
import { live } from './registry';

/** Wind levels, 0..1: over the globe (none: the ambient pad is the flight's background), standing
 * at a site, and the extra a full dust storm adds. */
const WIND_FLIGHT = 0;
const WIND_SITE = 0.62;
const WIND_STORM = 0.38;
/** Opportunity's storm slider range (tau). */
const TAU_MIN = 1;
const TAU_MAX = 11;
/** Slider detents per full range, and the shortest gap between two ticks, ms. */
const DETENTS = 40;
const TICK_GAP_MS = 35;
/** Orbit detents: one per this many degrees of azimuth, and per this much zoom. */
const AZ_STEP_DEG = 5;
const ZOOM_STEP = 0.05;
/** Boost: rotor pitch +20 %, a little louder; eased at this rate, 1/s. */
const BOOST_PITCH = 0.2;
const BOOST_LOUD = 0.1;
const BOOST_RATE = 3;
/** Ingenuity hovering beside a part: a slightly lower, steadier rotor. */
const HOVER_PITCH = 0.92;
/** The red-zone warning beat, ms. */
const RED_BEAT_MS = 330;
/** A storm gust plays once the slider has moved this much (fraction of its range) since the last. */
const GUST_MOVE = 0.12;
const GUST_GAP_MS = 400;

/** Ingenuity flown at a site (by the visitor or the hotspot autopilot), read defensively. */
function flyer(): { site: string | null; rotor: number } | null {
  const f = (live as unknown as { flyer?: { site?: string | null; rotor?: number } }).flyer;
  return f && f.site ? { site: f.site, rotor: f.rotor ?? 0 } : null;
}

/** Store fields owned by other sessions, read defensively. */
type FocusLike = { kind?: string; id?: string; strength?: number } | null | undefined;
const focusOf = (s: AppState) => (s as AppState & { focus?: FocusLike }).focus;
const resetOf = (s: AppState) => (s as AppState & { viewResetAt?: number }).viewResetAt ?? 0;
const scoutOf = (s: AppState) => !!(s as AppState & { scoutCam?: boolean }).scoutCam;

const range = (min: number | undefined, max: number | undefined) => ({ lo: min ?? 0, span: (max ?? 1) - (min ?? 0) || 1 });

export function SoundScape() {
  const boostK = useRef(0);
  const orbit = useRef({ site: null as string | null, az: 0, zoom: 0, at: 0 });
  const lastRed = useRef(0);

  // Store-driven one-shots: signature actions, the site camera, the Scout Cam.
  useEffect(() => {
    let lastDetent = 0;
    let lastGust = 0;
    let gustMove = 0;
    let lastFocusAt = 0;
    const unsub = useApp.subscribe((s, prev) => {
      const now = performance.now();

      // ---- signature actions at this stop
      if (s.sig !== prev.sig && s.phase === 'flight' && s.flight.stage === 'site') {
        const stop = currentStop(s.flight);
        const defs = stop ? (SIGNATURES[stop] ?? []) : [];
        for (const def of defs) {
          const id = `${stop}:${def.key}`;
          if (def.kind === 'hold') {
            // The charge hum runs from the frame loop; a click when the hold starts.
            const held = s.sig[`${def.key}:hold`] === 1;
            const was = prev.sig[`${def.key}:hold`] === 1;
            if (held && !was) playToggle(true);
            continue;
          }
          const v = s.sig[def.key];
          const was = prev.sig[def.key];
          if (v === undefined || v === was) continue;
          if (def.kind === 'toggle') {
            const on = v === 1;
            playToggle(on);
            if (on && id === 'viking-2:frost') playFrost();
            if (on && id === 'insight:larri') playLaserPing();
          } else if (def.kind === 'slider') {
            const { lo, span } = range(def.min, def.max);
            const k = Math.min(1, Math.max(0, (v - lo) / span));
            const k0 = Math.min(1, Math.max(0, ((was ?? def.initial ?? lo) - lo) / span));
            // Precision detents: one tick per 1/40 of the range crossed.
            if (Math.floor(k * DETENTS) !== Math.floor(k0 * DETENTS) && now - lastDetent >= TICK_GAP_MS) {
              lastDetent = now;
              playDetent(k);
            }
            // The texture of what the slider moves. (Spirit's dragged wheel and Phoenix's scoop play
            // their own scrape and dig from their effects, only while the wheel or scoop is at work.)
            const moved = Math.abs(k - k0);
            if (id === 'opportunity:storm') {
              gustMove += moved;
              if (gustMove >= GUST_MOVE && now - lastGust > GUST_GAP_MS) {
                gustMove = 0;
                lastGust = now;
                playStormGust(k);
              }
            }
          } else {
            // A press click for any remaining button (their effects play their own sounds).
            playToggle(true);
          }
        }
      }

      // ---- the site camera pushing in on a part, and back out to the wide view
      const f = focusOf(s);
      const pf = focusOf(prev);
      if (f && f !== pf && (f.strength ?? 1) >= 0.75) {
        const same = pf && pf.kind === f.kind && pf.id === f.id && (pf.strength ?? 1) >= 0.75;
        if (!same && now - lastFocusAt > 500) {
          lastFocusAt = now;
          playFocusIn();
        }
      }
      if (resetOf(s) !== resetOf(prev) && resetOf(s) > 0) playFocusOut();

      // ---- the Scout Cam viewfinder (the capture's shutter is played by the Scout Cam itself)
      if (scoutOf(s) !== scoutOf(prev)) playViewfinder(scoutOf(s));
    });
    return unsub;
  }, []);

  // Silence the loops while the tab is hidden (no frames run then to keep them in step).
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        setRotorLoop(0);
        setWind(0);
        setAmbience(0);
        setChargeLoop(0);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      setRotorLoop(0);
      setWind(0);
      setAmbience(0);
      setChargeLoop(0);
    };
  }, []);

  // The continuous loops and the orbit detents, every frame.
  useFrame((_, delta) => {
    const s = useApp.getState();
    if (s.phase !== 'flight' || (typeof document !== 'undefined' && document.hidden)) {
      setRotorLoop(0);
      setWind(0);
      setAmbience(0);
      setChargeLoop(0);
      return;
    }
    const now = performance.now();
    const dt = Math.min(0.1, delta);
    const f = s.flight;
    const shot = live.shot;

    // ---- rotors: the prologue test and take-off/landing follow the shot; cruise is full speed;
    // boost raises the pitch; hovering beside a part follows the flyer, a little lower and steadier.
    let speed = shot.ingenuity ? shot.rotor : 0;
    let pitch = 1;
    if (f.stage === 'flying' && shot.arc && shot.blend < 0.02) speed = Math.max(speed, 1);
    const boosting = f.stage === 'flying' && s.boost;
    boostK.current += ((boosting ? 1 : 0) - boostK.current) * (1 - Math.exp(-BOOST_RATE * dt));
    if (boostK.current < 0.001) boostK.current = 0;
    pitch *= 1 + BOOST_PITCH * boostK.current;
    speed *= 1 + BOOST_LOUD * boostK.current;
    const fl = flyer();
    if (fl && fl.rotor > speed) {
      speed = fl.rotor;
      pitch = HOVER_PITCH;
    }
    setRotorLoop(speed, pitch);

    // ---- the prologue's red zone: a warning beat while the throttle is held in it
    if (f.stage === 'prologue') {
      const th = useThrottle.getState();
      if (th.holding && th.throttle >= RED_ZONE && now - lastRed.current >= RED_BEAT_MS) {
        lastRed.current = now;
        playRedZone();
      }
    }

    // ---- wind: present all through the flight, fuller on the ground, louder in the storm
    const ground = shot.siteId && live.site.valid ? shot.blend : 0;
    let wind = WIND_FLIGHT + (WIND_SITE - WIND_FLIGHT) * ground;
    if (f.stage === 'site' && currentStop(f) === 'opportunity') {
      const tau = s.sig.storm ?? TAU_MIN;
      wind += WIND_STORM * Math.min(1, Math.max(0, (tau - TAU_MIN) / (TAU_MAX - TAU_MIN))) * ground;
    }
    setWind(Math.min(1, wind));
    setAmbience(ambientLevel(ground));

    // ---- a hold-to-charge action building up
    let charge = 0;
    if (f.stage === 'site') {
      const stop = currentStop(f);
      for (const def of stop ? (SIGNATURES[stop] ?? []) : []) {
        if (def.kind === 'hold' && s.sig[`${def.key}:hold`] === 1) charge = Math.max(charge, s.sig[def.key] ?? 0);
      }
    }
    setChargeLoop(charge);

    // ---- the 360° site orbit: soft detents every 5° of turn and every 0.05 of zoom, only while the
    // visitor can orbit (standing at a stop, or at home before take-off and after landing back)
    const o = orbit.current;
    const azStep = Math.floor((live.siteOrbit.az * 180) / Math.PI / AZ_STEP_DEG);
    const zoomStep = Math.round(live.siteOrbit.zoom / ZOOM_STEP);
    const orbiting =
      shot.blend > 0.95 &&
      !!shot.siteId &&
      (f.stage === 'site' || (shot.siteId === HOME && (f.stage === 'prologue' || f.stage === 'epilogue')));
    if (!orbiting || o.site !== shot.siteId) {
      // Arriving, leaving or easing back: follow quietly, no ticks.
      o.site = orbiting ? shot.siteId : null;
      o.az = azStep;
      o.zoom = zoomStep;
    } else if (azStep !== o.az || zoomStep !== o.zoom) {
      const turned = azStep !== o.az;
      o.az = azStep;
      o.zoom = zoomStep;
      if (now - o.at >= TICK_GAP_MS) {
        o.at = now;
        if (turned) {
          const deg = ((((live.siteOrbit.az * 180) / Math.PI) % 360) + 360) % 360;
          playDetent(deg / 360, true);
        } else playDetent(0.08 + 0.25 * Math.min(1, Math.max(0, (live.siteOrbit.zoom - 0.35) / 1.45)), true);
      }
    }
  });

  return null;
}
