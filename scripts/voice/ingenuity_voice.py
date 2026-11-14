"""Pre-render Ingenuity's radio voice for the guide bubble, timed for the typewriter.

The voice: Kokoro-82M (Apache-2.0, run locally) voice `af_aoede`, unhurried, lifted a touch, with a
faint vocoder layer for a cool synthetic edge, a slow chorus shimmer, a cool EQ and a soft, wide
radio band (the app adds its own squelch). One clip per message: each stop's arrival intro and its
inheritance line, read from src/data/flight.ts.

For the typewriter, each clip carries spans [first char, end char, start s, end s] over the message
text (lines joined with "\n"): one per sentence, split again at commas where the voice pauses. The
bubble types each span while it is spoken and holds in the pauses (src/ui/voiceSync.ts).

Needs Node (to read the TypeScript lines), and a Python with kokoro-onnx and numpy, plus the model
files kokoro-v1.0.onnx and voices-v1.0.bin from github.com/thewh1teagle/kokoro-onnx releases
(model-files-v1.0). Run from the repository root:

    python -I scripts/voice/ingenuity_voice.py <dir with the model files>

Writes public/audio/ingenuity/<stop>-<intro|inheritance>.wav (16 kHz mono) and src/data/voiceClips.json.
"""
import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from kokoro_onnx import Kokoro

ROOT = Path.cwd()
MODELS = Path(sys.argv[1])
AUDIO_DIR = ROOT / "public" / "audio" / "ingenuity"
MANIFEST = ROOT / "src" / "data" / "voiceClips.json"

VOICE, LANG = "af_aoede", "en-us"
PACE = 0.92  # unhurried
LIFT, FORMANT = 1.08, 1.03  # a little lighter, not childish
SHEEN, SHEEN_F0 = 0.12, 196  # share of the vocoder layer, and its fixed pitch
SHIMMER = 0.28
SR, OUT_SR = 24000, 16000
LEAD_S, SENTENCE_GAP_S, LINE_GAP_S, TAIL_S = 0.12, 0.30, 0.48, 0.25
N, H = 1024, 256


# ---------------------------------------------------------------- the lines
def read_lines() -> dict:
    js = (
        "const m = await import('./src/data/flight.ts');"
        "console.log(JSON.stringify(Object.fromEntries(Object.entries(m.LEG_SCRIPTS)"
        ".map(([k, v]) => [k, { intro: v.arrivalIntro, inheritance: [v.inheritance] }]))));"
    )
    out = subprocess.run(["node", "--input-type=module", "-e", js], cwd=ROOT, capture_output=True, encoding="utf-8", check=True)
    return json.loads(out.stdout)


# ---------------------------------------------------------------- signal tools
def norm(x: np.ndarray, peak: float = 0.89) -> np.ndarray:
    return x / (np.abs(x).max() + 1e-9) * peak


def stft(x: np.ndarray) -> np.ndarray:
    pad = np.concatenate([np.zeros(N), x, np.zeros(N)])
    return np.fft.rfft(np.lib.stride_tricks.sliding_window_view(pad, N)[::H] * np.hanning(N), axis=1)


def istft(s: np.ndarray, length: int) -> np.ndarray:
    w = np.hanning(N)
    frames = np.fft.irfft(s, n=N, axis=1) * w
    out = np.zeros(H * (len(frames) - 1) + N)
    wsum = np.zeros_like(out)
    for i, f in enumerate(frames):
        out[i * H : i * H + N] += f
        wsum[i * H : i * H + N] += w * w
    return (out / np.maximum(wsum, 1e-6))[N : N + length]


FREQS = np.arange(N // 2 + 1) * SR / N


def envelope(mag: np.ndarray, lifter: int = 28) -> np.ndarray:
    cep = np.fft.irfft(np.log(mag + 1e-7), n=N, axis=1)
    cep[:, lifter : N - lifter] = 0
    return np.exp(np.fft.rfft(cep, axis=1).real)


def warp(env: np.ndarray, w: float) -> np.ndarray:
    return np.stack([np.interp(FREQS / w, FREQS, row) for row in env])


def lift(x: np.ndarray) -> np.ndarray:
    """Pitch up by LIFT (resampling; the speech was made slower by LIFT), formants back to FORMANT."""
    n = int(len(x) / LIFT)
    y = np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)
    s = stft(y)
    env = envelope(np.abs(s))
    return norm(istft(s * warp(env, FORMANT / LIFT) / (env + 1e-9), len(y)))


def vocoder_layer(x: np.ndarray) -> np.ndarray:
    t = np.arange(len(x)) / SR
    carrier = sum(np.sin(2 * np.pi * h * SHEEN_F0 * t) / h for h in range(1, int(11000 / SHEEN_F0)))
    carrier = carrier / np.abs(carrier).max() + 0.05 * np.random.default_rng(5).standard_normal(len(x))
    m, c = stft(x), stft(carrier)
    voc = norm(istft(c * envelope(np.abs(m)) / (envelope(np.abs(c)) + 1e-9), len(x)))
    return norm(SHEEN * voc + (1 - SHEEN) * norm(x))


def chorus(x: np.ndarray) -> np.ndarray:
    t = np.arange(len(x))
    d = (11.0 + 1.6 * np.sin(2 * np.pi * 0.27 * t / SR)) * SR / 1000
    return norm(x + SHIMMER * np.interp(t - d, t, x, left=0.0))


def biquad(x: np.ndarray, b, a) -> np.ndarray:
    b0, b1, b2 = (c / a[0] for c in b)
    a1, a2 = a[1] / a[0], a[2] / a[0]
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, v in enumerate(x):
        o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, v, y1, o
        y[i] = o
    return y


def rbj(kind: str, f: float, q: float = 0.707, gain_db: float = 0.0):
    w = 2 * np.pi * f / SR
    cw, sw = np.cos(w), np.sin(w)
    alpha = sw / (2 * q)
    A = 10 ** (gain_db / 40)
    if kind == "hp":
        return ((1 + cw) / 2, -(1 + cw), (1 + cw) / 2), (1 + alpha, -2 * cw, 1 - alpha)
    if kind == "lp":
        return ((1 - cw) / 2, 1 - cw, (1 - cw) / 2), (1 + alpha, -2 * cw, 1 - alpha)
    if kind == "peak":
        return (1 + alpha * A, -2 * cw, 1 - alpha * A), (1 + alpha / A, -2 * cw, 1 - alpha / A)
    sq = 2 * np.sqrt(A) * alpha
    return (
        (A * ((A + 1) + (A - 1) * cw + sq), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sq)),
        ((A + 1) - (A - 1) * cw + sq, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sq),
    )


def cool_eq(x: np.ndarray) -> np.ndarray:
    x = biquad(x, *rbj("hp", 150))
    x = biquad(x, *rbj("peak", 320, q=0.9, gain_db=-3.5))
    x = biquad(x, *rbj("peak", 3200, q=1.0, gain_db=2.0))
    return biquad(x, *rbj("shelf", 8500, q=0.7, gain_db=3.0))


def soft_radio(x: np.ndarray) -> np.ndarray:
    band = lambda y: biquad(biquad(y, *rbj("hp", 190)), *rbj("lp", 5600))
    v = band(norm(x, 0.8))
    v = np.tanh(1.35 * v) / np.tanh(1.35)
    return norm(v + band(np.random.default_rng(11).standard_normal(len(v)) * 0.008))


def to_out_rate(x: np.ndarray) -> np.ndarray:
    """Band-limited resample to OUT_SR (the radio band ends well below its Nyquist)."""
    n = int(round(len(x) * OUT_SR / SR))
    spec = np.fft.rfft(x)[: n // 2 + 1]
    return np.fft.irfft(spec, n=n) * n / len(x)


# ---------------------------------------------------------------- timing
def voiced(x: np.ndarray, frame: int = 240) -> np.ndarray:
    """Per 10 ms frame: is there speech?"""
    f = x[: len(x) // frame * frame].reshape(-1, frame)
    rms = np.sqrt((f ** 2).mean(axis=1))
    return rms > max(0.012, 0.06 * rms.max())


def trim(x: np.ndarray) -> np.ndarray:
    v = np.flatnonzero(voiced(x))
    if len(v) == 0:
        return x
    a, b = max(0, v[0] * 240 - 960), min(len(x), (v[-1] + 1) * 240 + 960)
    return x[a:b]


def pauses(x: np.ndarray, min_ms: int = 90) -> list[tuple[float, float]]:
    """Silences inside the speech (not at its ends), seconds."""
    v = voiced(x)
    out, start = [], None
    idx = np.flatnonzero(v)
    if len(idx) == 0:
        return out
    for i in range(idx[0], idx[-1] + 1):
        if not v[i] and start is None:
            start = i
        elif v[i] and start is not None:
            if (i - start) * 10 >= min_ms:
                out.append((start * 0.01, i * 0.01))
            start = None
    return out


def comma_pauses(text: str, x: np.ndarray) -> list[tuple[int, tuple[float, float]]]:
    """The commas (colons, dashes…) the voice really pauses at: (char after it, (pause start, end) s).

    Each mark takes the nearest unused pause to where it would fall at an even pace, if one is close;
    the splits are kept only if every piece is still spoken at a plausible pace.
    """
    dur = len(x) / SR
    rate = len(text) / dur
    gaps = pauses(x)
    chosen: list[tuple[int, tuple[float, float]]] = []
    after = 0.0
    for m in re.finditer(r"[,;:](?=\s)|—", text):  # not the comma in 1,319
        c = m.end()
        expect = dur * c / len(text)
        near = [g for g in gaps if g[0] >= after and abs((g[0] + g[1]) / 2 - expect) < 0.22 * dur]
        if not near:
            continue
        g = min(near, key=lambda g: abs((g[0] + g[1]) / 2 - expect))
        chosen.append((c, g))
        after = g[1]
    edges = [(0, 0.0)] + [e for c, (g0, g1) in chosen for e in ((c, g0), (c, g1))] + [(len(text), dur)]
    for (c0, t0), (c1, t1) in zip(edges[0::2], edges[1::2]):
        if not 0.6 * rate <= (c1 - c0) / max(t1 - t0, 1e-3) <= 1.7 * rate:
            return []
    return chosen


def sentences(line: str) -> list[tuple[int, int]]:
    """[start, end) character ranges of the sentences in a line."""
    out, start = [], 0
    for m in re.finditer(r"(?<=[.!?])\s+", line):
        out.append((start, m.start()))
        start = m.end()
    out.append((start, len(line)))
    return [r for r in out if r[1] > r[0]]


def speak_message(k: Kokoro, lines: list[str]) -> tuple[np.ndarray, list[list[float]]]:
    """The message as one clip (24 kHz, before effects) and its typing spans, times after the lift."""
    parts, spans, t = [np.zeros(int(LEAD_S * LIFT * SR))], [], LEAD_S * LIFT
    offset = 0
    for li, line in enumerate(lines):
        for si, (a, b) in enumerate(sentences(line)):
            text = line[a:b]
            x, _ = k.create(text.replace("’", "'"), voice=VOICE, speed=PACE / LIFT, lang=LANG)
            x = trim(np.asarray(x, dtype=np.float64))
            dur = len(x) / SR
            edges = [(0, 0.0)]
            for c, (g0, g1) in comma_pauses(text, x):
                edges += [(c, g0), (c, g1)]
            edges.append((len(text), dur))
            for (c0, t0), (c1, t1) in zip(edges[0::2], edges[1::2]):
                spans.append([offset + a + c0, offset + a + c1, (t + t0) / LIFT, (t + t1) / LIFT])
            parts.append(x)
            t += dur
            last_sentence = si == len(sentences(line)) - 1
            gap = (LINE_GAP_S if last_sentence else SENTENCE_GAP_S) * LIFT
            if not (last_sentence and li == len(lines) - 1):
                parts.append(np.zeros(int(gap * SR)))
                t += gap
        offset += len(line) + 1  # the "\n"
    parts.append(np.zeros(int(TAIL_S * LIFT * SR)))
    return np.concatenate(parts), spans


def write_wav(path: Path, x: np.ndarray) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(OUT_SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


def main() -> None:
    k = Kokoro(str(MODELS / "kokoro-v1.0.onnx"), str(MODELS / "voices-v1.0.bin"))
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []
    for stop, msgs in read_lines().items():
        for kind in ("intro", "inheritance"):
            lines = msgs[kind]
            raw, spans = speak_message(k, lines)
            x = soft_radio(cool_eq(chorus(vocoder_layer(lift(raw)))))
            x = norm(to_out_rate(x))
            name = f"{stop}-{kind}.wav"
            write_wav(AUDIO_DIR / name, x)
            duration = len(x) / OUT_SR
            manifest.append({
                "stop": stop,
                "kind": kind,
                "file": f"audio/ingenuity/{name}",
                "text": "\n".join(lines),
                "duration": round(duration, 3),
                "spans": [[s[0], s[1], round(s[2], 3), round(min(s[3], duration), 3)] for s in spans],
            })
            print(f"{name}: {duration:.1f} s, {len(spans)} spans")
    MANIFEST.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{MANIFEST.relative_to(ROOT)}: {len(manifest)} clips")


main()
