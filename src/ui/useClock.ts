import { useEffect, useState } from 'react';
import { useApp } from '../store';

/** Keeps store.nowMs fresh for live lighting (every 30 s). */
export function useLiveClock() {
  const tick = useApp(s => s.tick);
  useEffect(() => {
    const id = window.setInterval(() => tick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [tick]);
}

/** A ticking UTC clock string for the console header, 'HH:MM:SS UTC'. */
export function useUtcClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now.toISOString().slice(11, 19) + ' UTC';
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
