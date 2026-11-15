// One floating tooltip for the HUD panels that clip their overflow (the site card, the dock): any
// element with a data-hint attribute shows it after a short hover, or at once on keyboard focus. The
// tip is fixed to the viewport, above the element (below it when there is no room), aligned to its
// left edge and kept on screen, so the panels' overflow never cuts it. It follows the attribute
// while shown (the sky words change as the solar-time scale is dragged). Purely visual: every
// element that wears a hint also carries its words for screen readers (aria-label or sr-only text).

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const HOVER_DELAY_MS = 250;
const GAP = 8;
const EDGE = 8;

export function HudHint() {
  const [hint, setHint] = useState<{ text: string; el: HTMLElement } | null>(null);
  const tip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer = 0;
    let alive = 0;
    let current: HTMLElement | null = null;
    let watch: MutationObserver | null = null;
    const hide = () => {
      window.clearTimeout(timer);
      window.clearInterval(alive);
      watch?.disconnect();
      watch = null;
      current = null;
      setHint(null);
    };
    const show = (el: HTMLElement) => {
      const text = el.dataset.hint;
      if (!text || !el.isConnected) return hide();
      current = el;
      watch?.disconnect();
      watch = new MutationObserver(() => {
        const next = el.dataset.hint;
        if (!next || !el.isConnected) hide();
        else setHint({ text: next, el });
      });
      watch.observe(el, { attributes: true, attributeFilter: ['data-hint'] });
      // The panel can go while the tip shows (the tour flies on): never leave a tip behind.
      window.clearInterval(alive);
      alive = window.setInterval(() => {
        if (!el.isConnected) hide();
      }, 300);
      setHint({ text, el });
    };
    const target = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('[data-hint]') : null);

    const over = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const el = target(e.target);
      if (el === current) return;
      window.clearTimeout(timer);
      if (!el) return hide();
      current = el;
      timer = window.setTimeout(() => show(el), HOVER_DELAY_MS);
    };
    const focusIn = (e: FocusEvent) => {
      const el = target(e.target);
      if (!el || !(e.target as Element).matches(':focus-visible')) return;
      window.clearTimeout(timer);
      show(el);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    window.addEventListener('pointerover', over, true);
    window.addEventListener('pointerdown', hide, true);
    window.addEventListener('focusin', focusIn, true);
    window.addEventListener('focusout', hide, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      hide();
      window.removeEventListener('pointerover', over, true);
      window.removeEventListener('pointerdown', hide, true);
      window.removeEventListener('focusin', focusIn, true);
      window.removeEventListener('focusout', hide, true);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  // Place it once its size is known: above and left-aligned, flipped below or nudged in at the edges.
  useLayoutEffect(() => {
    const t = tip.current;
    if (!t || !hint) return;
    const r = hint.el.getBoundingClientRect();
    const w = t.offsetWidth;
    const h = t.offsetHeight;
    const left = Math.max(EDGE, Math.min(r.left, window.innerWidth - EDGE - w));
    const top = r.top - GAP - h >= EDGE ? r.top - GAP - h : Math.min(r.bottom + GAP, window.innerHeight - EDGE - h);
    t.style.left = `${Math.round(left)}px`;
    t.style.top = `${Math.round(top)}px`;
    t.style.visibility = 'visible';
  }, [hint]);

  if (!hint) return null;
  return (
    <div ref={tip} className="hud-hint" aria-hidden="true" style={{ visibility: 'hidden' }}>
      {hint.text}
    </div>
  );
}
