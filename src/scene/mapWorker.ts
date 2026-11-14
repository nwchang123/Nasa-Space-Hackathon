// Paints the illustrative surface maps off the main thread (~0.3 s each at 2048×1024).
import { paintMars, paintMoon } from './proceduralMaps';

interface MapRequest {
  body: 'moon' | 'mars';
  width: number;
  height: number;
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<MapRequest>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
};

scope.onmessage = e => {
  const { body, width, height } = e.data;
  const data = body === 'moon' ? paintMoon(width, height) : paintMars(width, height);
  scope.postMessage({ body, width, height, data }, [data.buffer]);
};
