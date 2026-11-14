// Ingenuity at home: run the daily routine its last software update set (INGB). Each step ticks
// off in a checklist above it, with a small cue on the model: a glow as it wakes, a glint on the
// solar panel, a warm glow in the body for the batteries, a white blink and a shutter for the
// colour photo. Whether it still does this today is not known (said in the caption).

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdditiveBlending, Sprite, SpriteMaterial } from 'three';
import { playShutter } from '../../ui/sound';
import { smoothstep } from '../layout';
import { useReducedMotion } from '../useReducedMotion';
import { SigTag, siteShown, sigNow, softDot, type SiteSignatureProps } from './common';
import { buttonProgress, WAKE_STEPS, wakeStepsDone } from './logic';

const WAKE_MS = 9000;
/** A bump 0..1..0 over [a, b]. */
const bump = (t: number, a: number, b: number) => smoothstep(a, (a + b) / 2, t) * (1 - smoothstep((a + b) / 2, b, t));

function cue(color: string, size: number): Sprite {
  const s = new Sprite(new SpriteMaterial({ map: softDot(), color, blending: AdditiveBlending, transparent: true, opacity: 0, depthWrite: false }));
  s.scale.setScalar(size);
  s.visible = false;
  return s;
}

export function IngenuityWake({ stop, lay }: SiteSignatureProps) {
  const reduced = useReducedMotion();
  const shown = useRef(0);
  const [done, setDone] = useState(0);
  const doneRef = useRef(0);
  const shutterFor = useRef<number | undefined>(undefined);
  const cues = useMemo(
    () => ({
      wake: cue('#9fd0ff', 0.55),
      panel: cue('#fff1c9', 0.5),
      battery: cue('#ffb36b', 0.32),
      photo: cue('#ffffff', 0.7),
    }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(cues).forEach(c => c.material.dispose());
    },
    [cues],
  );

  useFrame(() => {
    const at = sigNow('wake');
    const now = Date.now();
    const p = buttonProgress(at, WAKE_MS, now, reduced);
    const site = siteShown(stop);
    if (p === null) {
      Object.values(cues).forEach(c => (c.visible = false));
      shown.current = 0;
      if (doneRef.current !== 0) setDone((doneRef.current = 0));
      return;
    }
    shown.current = site;
    const n = wakeStepsDone(p);
    if (n !== doneRef.current) setDone((doneRef.current = n));
    if (n >= 4 && shutterFor.current !== at && now - (at ?? 0) < WAKE_MS + 500) {
      shutterFor.current = at;
      playShutter();
    }
    // Cues only while it runs, and only with motion allowed (they blink).
    const levels = reduced
      ? { wake: 0, panel: 0, battery: 0, photo: 0 }
      : {
          wake: bump(p, 0, 0.22),
          panel: bump(p, 0.18, 0.34),
          battery: bump(p, 0.42, 0.58),
          photo: bump(p, 0.665, 0.72),
        };
    for (const [k, s] of Object.entries(cues) as [keyof typeof cues, Sprite][]) {
      s.material.opacity = levels[k] * site;
      s.visible = s.material.opacity > 0.003;
    }
  });

  const [x, , z] = lay.ingenuity;
  return (
    <group position={[x, 0, z]}>
      <primitive object={cues.wake} position={[0.05, 0.22, 0.05]} />
      <primitive object={cues.panel} position={[0, 0.6, 0]} />
      <primitive object={cues.battery} position={[0.05, 0.2, 0.05]} />
      <primitive object={cues.photo} position={[0.08, 0.1, 0.1]} />
      {/* On the ground beside it (screen-left of the home camera), clear of the rotor's hotspots. */}
      <SigTag position={[-0.62, 0.02, -0.23]} show={() => shown.current}>
        Daily routine
        <ul className="sig-list">
          {WAKE_STEPS.map((s, i) => (
            <li key={s} className={i < done ? 'done' : undefined}>
              {s}
            </li>
          ))}
        </ul>
      </SigTag>
    </group>
  );
}
