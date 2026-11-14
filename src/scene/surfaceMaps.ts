// Surface map loading. A NASA mosaic dropped into src/scene/maps/ (mars.jpg, or .png / .webp)
// is bundled and used automatically; otherwise the illustrative procedural map is painted in a
// worker. Resolved at build time, so a missing file never causes a 404.

import { useEffect, useState } from 'react';
import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { paintMars } from './proceduralMaps';

export type Body = 'mars';

const MAP_W = 2048;
const MAP_H = 1024;

const overrides = import.meta.glob('./maps/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function overrideUrl(body: Body): string | undefined {
  const key = Object.keys(overrides).find(k => new RegExp(`/maps/${body}\\.(jpe?g|png|webp)$`, 'i').test(k));
  return key ? overrides[key] : undefined;
}

export function hasRealMap(body: Body): boolean {
  return overrideUrl(body) !== undefined;
}

function finish(tex: Texture): Texture {
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.minFilter = LinearMipmapLinearFilter;
  // Sharp at the grazing angles of the chase camera (three.js clamps to what the GPU supports).
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  return tex;
}

function pixelsToTexture(data: Uint8ClampedArray, width: number, height: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.putImageData(new ImageData(new Uint8ClampedArray(data.buffer as ArrayBuffer), width, height), 0, 0);
  return finish(new CanvasTexture(canvas));
}

function paintInWorker(body: Body): Promise<Texture> {
  return new Promise(resolve => {
    const fallback = () => {
      // No worker support: paint on the main thread after the first frame.
      setTimeout(() => {
        const data = paintMars(MAP_W, MAP_H);
        resolve(pixelsToTexture(data, MAP_W, MAP_H));
      }, 50);
    };
    let worker: Worker;
    try {
      worker = new Worker(new URL('./mapWorker.ts', import.meta.url), { type: 'module' });
    } catch {
      fallback();
      return;
    }
    worker.onmessage = (e: MessageEvent<{ data: Uint8ClampedArray; width: number; height: number }>) => {
      worker.terminate();
      resolve(pixelsToTexture(e.data.data, e.data.width, e.data.height));
    };
    worker.onerror = () => {
      worker.terminate();
      fallback();
    };
    worker.postMessage({ body, width: MAP_W, height: MAP_H });
  });
}

function loadMap(body: Body): Promise<Texture> {
  const url = overrideUrl(body);
  if (!url) return paintInWorker(body);
  return new Promise(resolve => {
    new TextureLoader().load(
      url,
      tex => resolve(finish(tex)),
      undefined,
      () => resolve(paintInWorker(body)),
    );
  });
}

// Shared, reference-counted cache. Release is deferred so React StrictMode's
// mount → unmount → mount in development does not repaint the map.
const cache = new Map<Body, { promise: Promise<Texture>; refs: number; timer?: ReturnType<typeof setTimeout> }>();

function acquire(body: Body): Promise<Texture> {
  let entry = cache.get(body);
  if (!entry) {
    entry = { promise: loadMap(body), refs: 0 };
    cache.set(body, entry);
  }
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = undefined;
  }
  entry.refs++;
  return entry.promise;
}

function release(body: Body) {
  const entry = cache.get(body);
  if (!entry) return;
  entry.refs--;
  if (entry.refs > 0) return;
  entry.timer = setTimeout(() => {
    cache.delete(body);
    void entry.promise.then(t => t.dispose());
  }, 3000);
}

/** The surface map for a body, or null while it is being prepared. */
export function useSurfaceMap(body: Body): Texture | null {
  const [tex, setTex] = useState<Texture | null>(null);
  useEffect(() => {
    let alive = true;
    void acquire(body).then(t => {
      if (alive) setTex(t);
    });
    return () => {
      alive = false;
      release(body);
    };
  }, [body]);
  return tex;
}
