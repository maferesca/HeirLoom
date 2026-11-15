"""Compares Kokoro female voices on one line: median pitch (F0) and length. Run with .venv-tts."""
import numpy as np
from kokoro_onnx import Kokoro

k = Kokoro("tts-models/kokoro-v1.0.onnx", "tts-models/voices-v1.0.bin")
LINE = "My grandfather is a farmer. He inspired me to build Heirloom around one question."


def f0_median(a, sr):
    fr = int(0.04 * sr); hop = int(0.01 * sr); out = []
    for i in range(0, len(a) - fr, hop):
        x = a[i:i + fr] * np.hanning(fr)
        if np.sqrt((x ** 2).mean()) < 0.02:
            continue
        c = np.correlate(x, x, "full")[fr - 1:]
        lo, hi = int(sr / 320), int(sr / 120)
        j = lo + np.argmax(c[lo:hi])
        if c[j] > 0.35 * c[0]:
            out.append(sr / j)
    return float(np.median(out)) if out else 0.0


for v in ["af_heart", "af_bella", "af_nicole", "af_sarah", "af_kore", "af_aoede", "af_nova", "af_river"]:
    a, sr = k.create(LINE, voice=v, speed=1.0, lang="en-us")
    print(f"{v:10s} f0={f0_median(a, sr):6.1f} Hz  len={len(a)/sr:5.2f}s")
