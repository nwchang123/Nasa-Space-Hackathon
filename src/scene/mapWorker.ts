// Paints the illustrative Mars map off the main thread (~0.3 s at 2048×1024).
import { paintMars } from './proceduralMaps';

interface MapRequest {
  body: 'mars';
  width: number;
  height: number;
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<MapRequest>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
};

scope.onmessage = e => {
  const { body, width, height } = e.data;
  const data = paintMars(width, height);
  scope.postMessage({ body, width, height, data }, [data.buffer]);
};
