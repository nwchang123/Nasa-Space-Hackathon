// A QR code as crisp SVG, encoded on the spot (src/hangar/qr.ts): no library, no network.

import { useMemo } from 'react';
import { encodeQr, qrPath } from './qr';

/** The standard's quiet zone, in modules. */
const BORDER = 4;

export function QrCode({ text, size }: { text: string; size: number }) {
  const code = useMemo(() => encodeQr(text, 'M'), [text]);
  const n = code.size + BORDER * 2;
  return (
    <svg className="qr" width={size} height={size} viewBox={`0 0 ${n} ${n}`} role="img" aria-label={`QR code for ${text}`} shapeRendering="crispEdges">
      <rect width={n} height={n} fill="#ffffff" />
      <path d={qrPath(code, BORDER)} fill="#05070a" />
    </svg>
  );
}
