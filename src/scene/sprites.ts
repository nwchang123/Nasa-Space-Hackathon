// Small canvas textures shared by markers and effects (created once per page).

import { CanvasTexture, SRGBColorSpace, type Texture } from 'three';

let glow: Texture | null = null;
let ring: Texture | null = null;
let dot: Texture | null = null;

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) draw(ctx, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Soft radial glow, white (tinted by the material colour). */
export function glowTexture(): Texture {
  if (!glow) {
    glow = canvasTexture(128, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.12, 'rgba(255,255,255,0.75)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
  }
  return glow;
}

/** Thin circle outline. */
export function ringTexture(): Texture {
  if (!ring) {
    ring = canvasTexture(128, (ctx, s) => {
      ctx.strokeStyle = 'rgba(255,255,255,1)';
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
  return ring;
}

/** Hard round dot with a slight soft edge (point sprites, pulses). */
export function dotTexture(): Texture {
  if (!dot) {
    dot = canvasTexture(64, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.45, 'rgba(255,255,255,1)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
  }
  return dot;
}
