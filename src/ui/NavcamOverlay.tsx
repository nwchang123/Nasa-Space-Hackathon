// Ingenuity's navigation-camera view while flying (store.camMode 'navcam'): a reticle with tick
// marks over the black-and-white downward view, and the ground point under the helicopter, its
// heading and the distance left. The real helicopter's navigation camera was a downward-looking
// black-and-white camera; here it is a way to watch the ground of Mars slide by. The camera rig
// writes the numbers (scene/navcam.ts); this reads them on its own animation frame. Mounted by
// the HUD; draws nothing unless the view is on.

import { useEffect, useRef } from 'react';
import { siteSky } from '../astro';
import { compassShort } from '../flight/route';
import { navcam } from '../scene/navcam';
import { useApp } from '../store';
import './navcam.css';

const lat = (d: number) => `${Math.abs(d).toFixed(2)}° ${d >= 0 ? 'N' : 'S'}`;
const lon = (d: number) => `${Math.abs(d).toFixed(2)}° ${d >= 0 ? 'E' : 'W'}`;
const km = (n: number) => `${Math.round(n).toLocaleString('en-US')} km`;

export function NavcamOverlay() {
  const wanted = useApp(s => s.camMode === 'navcam' && s.phase === 'flight' && s.flight.stage === 'flying');
  const root = useRef<HTMLDivElement>(null);
  const fields = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!wanted) {
      root.current?.classList.remove('on');
      return;
    }
    let raf = 0;
    let shown = false;
    const last: Record<string, string> = {};
    const put = (key: string, text: string) => {
      const el = fields.current[key];
      if (el && last[key] !== text) {
        last[key] = text;
        el.textContent = text;
      }
    };
    const step = () => {
      const on = navcam.k > 0.5;
      if (on !== shown) {
        shown = on;
        root.current?.classList.toggle('on', on);
      }
      if (on) {
        put('lat', lat(navcam.lat));
        put('lon', lon(navcam.lon));
        put('hdg', `${String(Math.round((navcam.headingDeg + 360) % 360)).padStart(3, '0')}° ${compassShort(navcam.headingDeg)}`);
        put('togo', km(navcam.kmToGo));
        put('to', navcam.to);
        // The night side is dark to a camera too: say so, rather than show an unexplained black.
        const sun = siteSky('mars', navcam.lat, navcam.lon, new Date()).elevationDeg;
        put('sun', sun > 0 ? `${Math.round(sun)}° up` : `${Math.round(-sun)}° below · night side`);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [wanted]);

  if (!wanted) return null;
  const ref = (key: string) => (el: HTMLElement | null) => {
    fields.current[key] = el;
  };
  return (
    <div ref={root} className="navcam" aria-hidden="true">
      <div className="navcam-corners" />
      <div className="navcam-tag">
        <span className="rec" />
        Navcam · black and white · looking down
      </div>
      <div className="navcam-reticle">
        <div className="navcam-ticks" />
        <div className="navcam-ring" />
      </div>
      <dl className="navcam-read">
        <dt>Lat</dt>
        <dd ref={ref('lat')} />
        <dt>Lon</dt>
        <dd ref={ref('lon')} />
        <dt>Heading</dt>
        <dd ref={ref('hdg')} />
        <dt>To go</dt>
        <dd ref={ref('togo')} />
        <dt>Next</dt>
        <dd ref={ref('to')} />
        <dt>Sun</dt>
        <dd ref={ref('sun')} />
      </dl>
    </div>
  );
}
