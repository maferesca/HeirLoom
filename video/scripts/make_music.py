"""Synthesizes the ad's music bed + sound accents (30 s, 44.1 kHz stereo). Original, no samples.

120 BPM (a beat every 0.5 s) so every cut lands on a beat. Calm pads + soft plucks; a light kick/hat groove
from the Earth shot (6.5 s) on. Accents:
  0.35 s  crisp seed cue (glassy tick)
  2.00 s  soft thump on the cut to the question
  6.50 s  sharp accent: riser + hit on the Earth zoom
 14.00 s  strongest accent: long riser + deep boom + shimmer on the rotation comparison
 25.00 s  smaller accent on the rainfall scenario
 27.00 s  drums drop out; pads resolve for the close
"""
import wave
import numpy as np

SR = 44100
DUR = 30.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(11)
BEAT = 0.5


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def place(buf, sig, start, gain=1.0):
    i = int(start * SR)
    if i >= N:
        return
    seg = sig[: N - i] * gain
    buf[i : i + len(seg)] += seg


def env_adsr(n, a, r):
    tt = np.arange(n) / SR
    return np.minimum(1, tt / a) * np.exp(-tt / r)


# --- pads: Am9 | Fmaj7 | Cmaj7 | G6 every 4 s (8 beats), soft, detuned
chords = [[45, 52, 55, 59, 64], [41, 48, 52, 57, 64], [48, 52, 55, 59, 67], [43, 50, 55, 59, 64]]
pad = np.zeros(N)
for k in range(int(DUR / 4) + 1):
    ch = chords[k % 4]
    st, ln = k * 4.0 - 0.6, 5.2
    n = int(ln * SR)
    tt = np.arange(n) / SR
    e = np.clip(np.minimum(tt / 1.2, (ln - tt) / 1.4), 0, 1) ** 1.4
    s = np.zeros(n)
    for m in ch:
        f = hz(m)
        s += sum(np.sin(2 * np.pi * f * (1 + d) * tt + ph) for d, ph in [(0, 0), (0.0023, 1.1), (-0.0019, 2.3)]) / 3
        s += 0.2 * np.sin(2 * np.pi * 2 * f * tt)
    place(pad, s * e, max(0, st), 0.045)

# --- plucks: 8th-note arpeggio, quiet; fuller after the reveal
arp = np.zeros(N)
for b in range(int(DUR / (BEAT / 2))):
    st = b * BEAT / 2
    ch = chords[int(st // 4) % 4]
    notes = [ch[2] + 12, ch[3] + 12, ch[4] + 12, ch[3] + 12, ch[1] + 24, ch[3] + 12]
    if st < 2.0 or (st >= 27.0 and b % 2):
        continue
    amp = 0.035 if st < 14 else 0.06
    n = int(1.6 * SR)
    tt = np.arange(n) / SR
    f = hz(notes[b % len(notes)])
    s = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt) * np.exp(-tt * 6)) * env_adsr(n, 0.004, 0.35)
    place(arp, s, st, amp)

# --- groove: soft kick on beats, hats on off-beats (5 s - 27 s), ghost snare on 2 and 4 after the reveal
drums = np.zeros(N)
def kick():
    n = int(0.45 * SR); tt = np.arange(n) / SR
    f = 50 + 90 * np.exp(-tt * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7)
def hat():
    n = int(0.08 * SR); x = rng.standard_normal(n)
    x = np.diff(np.concatenate([[0], x]))
    return x * np.exp(-np.arange(n) / SR * 60)
def snare():
    n = int(0.25 * SR); tt = np.arange(n) / SR
    return (0.6 * rng.standard_normal(n) * np.exp(-tt * 22) + 0.4 * np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 18))
K, Hh, Sn = kick(), hat(), snare()
for b in range(int(DUR / BEAT)):
    st = b * BEAT
    if 6.5 <= st < 27.0:
        place(drums, K, st, 0.32 if st < 14 else 0.4)
        place(drums, Hh, st + BEAT / 2, 0.05)
        if st >= 14.0 and b % 4 == 2:
            place(drums, Sn, st, 0.09)

# --- accents
fx = np.zeros(N)
def riser(length, f0, f1):
    n = int(length * SR); tt = np.arange(n) / SR
    noise = rng.standard_normal(n)
    sweep = np.sin(2 * np.pi * np.cumsum(np.linspace(f0, f1, n)) / SR)
    e = (tt / length) ** 2.2
    return (0.5 * noise * np.linspace(0.2, 1, n) + 0.5 * sweep) * e
def boom(length, depth):
    n = int(length * SR); tt = np.arange(n) / SR
    f = 38 + depth * np.exp(-tt * 9)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.2)
    crack = rng.standard_normal(n) * np.exp(-tt * 40)
    return sub + 0.35 * crack
def shimmer(length):
    n = int(length * SR); tt = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * hz(m) * tt) for m in [76, 79, 83, 88]) / 4
    return s * np.minimum(1, tt / 0.02) * np.exp(-tt * 1.4)
def tick():
    n = int(0.6 * SR); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * 2637 * tt) + 0.6 * np.sin(2 * np.pi * 3951 * tt)) * np.exp(-tt * 14) + 0.3 * rng.standard_normal(n) * np.exp(-tt * 300)

place(fx, tick(), 0.35, 0.22)                      # seed cue
place(fx, boom(0.8, 60), 2.0, 0.25)                # cut to the question
r = riser(0.8, 300, 1800); place(fx, r, 6.5 - len(r) / SR, 0.12)
place(fx, boom(1.2, 120), 6.5, 0.55)               # Earth zoom: sharp
place(fx, tick(), 6.5, 0.12)
r = riser(1.5, 200, 2400); place(fx, r, 14.0 - len(r) / SR, 0.18)
place(fx, boom(2.2, 160), 14.0, 0.9)               # rotation comparison: strongest
place(fx, shimmer(2.5), 14.0, 0.22)
place(fx, boom(0.7, 80), 25.0, 0.22)               # rainfall scenario: smaller
place(fx, shimmer(1.2), 25.0, 0.06)

music = pad + arp
music *= np.interp(t, [0, 1.8, 2.0, 13.5, 14.0, 26.5, 27.0, 30], [0.6, 0.6, 0.8, 0.85, 1.0, 1.0, 0.85, 0.7])
mix = music + drums + fx

# small room reverb on everything but the low end
ir = rng.standard_normal(int(1.4 * SR)) * np.exp(-np.arange(int(1.4 * SR)) / (0.35 * SR))
ir /= np.abs(ir).sum() / 5
L = len(mix) + len(ir)
wet = np.fft.irfft(np.fft.rfft(music + 0.5 * fx, L) * np.fft.rfft(ir, L))[:N]
mix = mix + 0.45 * wet

fade = np.minimum(1, t / 0.05) * np.minimum(1, (DUR - t) / 1.8)
st = np.stack([mix * fade, np.roll(mix, int(0.012 * SR)) * fade], axis=1)
st = st / np.abs(st).max() * 0.92
with wave.open("public/music.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype("<i2").tobytes())
print("wrote public/music.wav")
