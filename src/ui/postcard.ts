// Renders a postcard to a machine as a PNG, entirely in the browser.

import type { Machine } from '../types';
import { formatDate } from './callPlan';

const W = 1500;
const H = 1000;

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function renderPostcard(machine: Machine, message: string, from: string): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Card stock.
  ctx.fillStyle = '#ece5d6';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = `rgba(80,60,30,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  }

  // Left: the address side, night panel.
  ctx.fillStyle = '#0b0f14';
  ctx.fillRect(40, 40, 640, H - 80);
  ctx.strokeStyle = 'rgba(143,179,201,0.35)';
  ctx.setLineDash([3, 7]);
  for (let r = 90; r < 420; r += 70) {
    ctx.beginPath();
    ctx.arc(360, 520, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = '#f2a93b';
  ctx.beginPath();
  ctx.arc(360, 520, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8fb3c9';
  ctx.font = '300 22px "Martian Mono", monospace';
  ctx.fillText('STILL HERE · DSN NIGHT SHIFT', 90, 120);
  ctx.fillStyle = '#e9e4d8';
  ctx.font = 'italic 400 60px "Newsreader", serif';
  for (const [i, line] of wrapLines(ctx, machine.name, 540).entries()) ctx.fillText(line, 90, 200 + i * 66);
  ctx.font = '300 20px "Martian Mono", monospace';
  ctx.fillStyle = '#c9c2b2';
  wrapLines(ctx, machine.site, 540).forEach((line, i) => ctx.fillText(line, 90, H - 200 + i * 30));
  ctx.fillStyle = '#8fb3c9';
  ctx.fillText(`${formatDate(machine.arrived)} — ${formatDate(machine.lastContact)}`, 90, H - 110);

  // Right: the message side.
  ctx.strokeStyle = '#b9ae98';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(760, 120);
  ctx.lineTo(760, H - 120);
  ctx.stroke();

  // Stamp.
  ctx.save();
  ctx.translate(W - 170, 170);
  ctx.rotate(-0.12);
  ctx.strokeStyle = '#a2522c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#a2522c';
  ctx.font = '600 17px "Martian Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('DEEP SPACE', 0, -18);
  ctx.fillText('NETWORK', 0, 6);
  ctx.font = '300 15px "Martian Mono", monospace';
  ctx.fillText(new Date().toISOString().slice(0, 10), 0, 34);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#5b4c36';
  ctx.font = '300 20px "Martian Mono", monospace';
  ctx.fillText(`To ${machine.shortName},`, 810, 300);
  ctx.fillStyle = '#1d1a15';
  ctx.font = 'italic 400 40px "Newsreader", serif';
  const lines = wrapLines(ctx, message || 'Thank you for everything you showed us.', 600).slice(0, 10);
  lines.forEach((line, i) => ctx.fillText(line, 810, 370 + i * 52));
  ctx.fillStyle = '#5b4c36';
  ctx.font = '300 20px "Martian Mono", monospace';
  ctx.fillText(from ? `— ${from}` : '— the night shift', 810, Math.min(H - 110, 420 + lines.length * 52));

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not render the postcard'))), 'image/png'));
}
