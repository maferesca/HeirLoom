"""Trims leading/trailing silence from public/vo/*.wav and writes public/vo/vo.json with durations (s)."""
import glob, json, wave
import numpy as np
out = {}
for f in sorted(glob.glob("public/vo/*.wav")):
    w = wave.open(f); sr = w.getframerate(); a = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2"); w.close()
    idx = np.where(np.abs(a) > 400)[0]
    s, e = max(0, idx[0] - int(0.03 * sr)), min(len(a), idx[-1] + int(0.08 * sr))
    a = a[s:e]
    w = wave.open(f, "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(a.tobytes()); w.close()
    out[f.replace("\\", "/").split("/")[-1]] = round(len(a) / sr, 3)
json.dump(out, open("public/vo/vo.json", "w"), indent=1)
print(out)
