"""Narration with an offline neural voice (Kokoro-82M via kokoro-onnx). Run with .venv-tts:
    .venv-tts/Scripts/python scripts/make_vo_kokoro.py
Voice: a blend of Kokoro's af_heart (warm, clear) and af_kore (lower register).
Writes public/vo/NN.wav (trimmed, loudness-matched) and public/vo/vo.json (durations in s).
"""
import json
import os
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

k = Kokoro("tts-models/kokoro-v1.0.onnx", "tts-models/voices-v1.0.bin")
VOICE = 0.62 * k.get_voice_style("af_heart") + 0.38 * k.get_voice_style("af_kore")

# (text, speed, emphasis on the last word in dB). Spanish name given as phonemes so it is not read as "Jesus".
LINES = [
    ("My grandfather is a farmer.", 0.9, 0),
    ("He inspired me to build Heirloom around one question:", 1.08, 0),
    ("What should I plant next?", 1.0, 3.5),
    ("In Jesús Carranza, Heirloom combines NASA climate records, regional soil estimates, and what farmers know about their land.", 1.2, 0),
    ("It shows what you could plant each cycle,", 0.93, 0),
    ("why the option fits the constraints you shared,", 0.93, 0),
    ("and what to check before you decide.", 0.95, 0),
    ("Compare your options before you plant.", 0.88, 0),
]


def synth(text, speed):
    ph = k.tokenizer.phonemize(text.replace("Jesús Carranza", "Jesus Carranza"), "en-us")
    ph = ph.replace("dʒˈiːzəs kæɹˈænzə", "hɛsˈuːs kɑɹˈɑnsə")
    return k.create(ph, voice=VOICE, speed=speed, is_phonemes=True)


def trim(a, sr, thr=0.01):
    idx = np.where(np.abs(a) > thr)[0]
    return a[max(0, idx[0] - int(0.03 * sr)): min(len(a), idx[-1] + int(0.12 * sr))]


os.makedirs("public/vo", exist_ok=True)
for f in os.listdir("public/vo"):
    if f.endswith(".wav"):
        os.remove(os.path.join("public/vo", f))
out = {}
for i, (text, speed, emph) in enumerate(LINES):
    a, sr = synth(text, speed)
    a = trim(a, sr)
    if emph:  # lift the final word: gain ramp over the last ~0.45 s
        n = len(a); s = max(0, n - int(0.45 * sr))
        g = np.ones(n); g[s:] = np.linspace(1, 10 ** (emph / 20), n - s) ** 0.6
        a = a * g
    rms = np.sqrt((a[np.abs(a) > 0.01] ** 2).mean())
    a = np.clip(a * (0.11 / rms), -0.98, 0.98)
    # 8 ms fades
    f = int(0.008 * sr); a[:f] *= np.linspace(0, 1, f); a[-f:] *= np.linspace(1, 0, f)
    name = f"{i:02d}.wav"
    sf.write(f"public/vo/{name}", a.astype(np.float32), sr, subtype="PCM_16")
    out[name] = round(len(a) / sr, 3)
    print(name, out[name], text)
json.dump(out, open("public/vo/vo.json", "w"), indent=1)
