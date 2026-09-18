"""Generate the project's original CC0 sound effects (22.05 kHz mono PCM)."""
import math, random, wave, struct
from pathlib import Path
random.seed(3)
out = Path(__file__).resolve().parents[1] / 'assets/sounds'
out.mkdir(parents=True, exist_ok=True)
rate = 22050


def write(name, samples):
    with wave.open(str(out / (name + '.wav')), 'wb') as f:
        f.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        f.writeframes(b''.join(
            struct.pack('<h', int(max(-1, min(1, v)) * 32767)) for v in samples))


for name, duration in [('roll', 1), ('coin', .25), ('pad', .32), ('spinner', .3),
                       ('fall', .65), ('goal', 1), ('tap', .07), ('boost', .45),
                       ('switch', .5), ('gate', .22),
                       ('cannon', .55), ('fire', .4), ('ballast', .3)]:
    samples = []
    phase = 0
    for i in range(int(rate * duration)):
        t = i / rate
        u = t / duration
        envelope = min(1, t / .008) * (1 - u) ** 2
        if name == 'roll':
            value = .1 * (math.sin(2 * math.pi * 85 * t) + .4 * math.sin(2 * math.pi * 173 * t))
        elif name == 'fall':
            value = .45 * random.uniform(-1, 1) * envelope * math.sin(math.pi * u)
        elif name == 'goal':
            freq = [523.25, 659.25, 783.99, 1046.5][min(3, int(t / .2))]
            phase += 2 * math.pi * freq / rate
            value = .35 * math.sin(phase) * envelope
        elif name == 'cannon':
            # Winding up: a rising whine while the barrel loads.
            phase += 2 * math.pi * (140 + 340 * u * u) / rate
            value = .22 * math.sin(phase) * min(1, u * 3)
        elif name == 'fire':
            # And the bang: a hard low thump with the air behind it.
            phase += 2 * math.pi * (190 - 120 * u) / rate
            value = (.4 * math.sin(phase) + .3 * random.uniform(-1, 1)) * (1 - u) ** 2.2
        elif name == 'ballast':
            # A dull clunk: something heavy locking into place.
            phase += 2 * math.pi * (90 + 40 * u) / rate
            value = (.34 * math.sin(phase) + .12 * math.sin(phase * 3.1)) * envelope
        elif name == 'switch':
            # Two notes up: the sound of something unlocking, not of a pickup.
            freq = 392.0 if u < .45 else 587.33
            phase += 2 * math.pi * freq / rate
            value = .32 * (math.sin(phase) + .25 * math.sin(phase * 2)) * min(1, u * 14) * (1 - u) ** 1.2
        elif name == 'gate':
            # A dull stop: the ball hitting something that is not going to move.
            phase += 2 * math.pi * 120 / rate
            value = (.3 * math.sin(phase) + .22 * random.uniform(-1, 1)) * envelope
        elif name == 'boost':
            # A rising sweep with air moving underneath it: the whoosh of being
            # thrown forward rather than the pop of being thrown up.
            phase += 2 * math.pi * (260 + 900 * u * u) / rate
            value = (.26 * math.sin(phase) + .2 * random.uniform(-1, 1)) * min(1, u * 6) * (1 - u) ** 1.6
        else:
            freq = {'coin': 1200 + 1000 * u, 'pad': 180 + 600 * u, 'spinner': 210, 'tap': 900}[name]
            phase += 2 * math.pi * freq / rate
            value = .35 * (math.sin(phase) + (.3 * math.sin(phase * 2.73) if name == 'spinner' else 0)) * envelope
        samples.append(value)
    write(name, samples)

# --- Drone -------------------------------------------------------------------
# The bed under the bed. Wind says "moving"; this says "high up, and a long
# way from anything" - a slow stack of fifths detuned against each other so it
# beats gently rather than sitting still, with no attack anywhere in it. It is
# mixed low enough to be felt rather than heard.
duration = 6.0
fade = int(rate * .5)
count = int(rate * duration)
raw = []
partials = [(55.0, .5), (82.5, .34), (110.0, .26), (164.5, .13), (220.5, .07)]
for i in range(count):
    t = i / rate
    value = 0.0
    for freq, gain in partials:
        # A second voice a few cents off gives the slow beating.
        value += gain * (math.sin(2 * math.pi * freq * t) + .7 * math.sin(2 * math.pi * freq * 1.003 * t))
    swell = 1 + .22 * math.sin(2 * math.pi * t * .07) + .12 * math.sin(2 * math.pi * t * .18)
    raw.append(value * .085 * swell)

drone = raw[:count - fade]
for i in range(fade):
    blend = i / fade
    drone[i] = drone[i] * blend + raw[count - fade + i] * (1 - blend)
write('drone', drone)

# --- Wind -------------------------------------------------------------------
# The bed that plays under everything: the track floats thousands of feet up,
# and silence up there reads as a bug. Two one-pole lowpass filters over white
# noise give the soft roar of moving air without any of the hiss, and a slow
# amplitude wobble keeps it from sounding like a flat hum. The last quarter
# second is crossfaded over the first so the loop has no seam to hear.
duration = 4.0
fade = int(rate * .25)
count = int(rate * duration)
low = band = 0.0
raw = []
for i in range(count):
    white = random.uniform(-1, 1)
    low += (white - low) * .035          # the body of the wind
    band += (white - band) * .28         # a little air over the top
    gust = 1 + .32 * math.sin(2 * math.pi * i / rate * .21) + .18 * math.sin(2 * math.pi * i / rate * .53)
    raw.append((low * 5.2 + band * .55) * .42 * gust)

wind = raw[:count - fade]
for i in range(fade):
    blend = i / fade
    wind[i] = wind[i] * blend + raw[count - fade + i] * (1 - blend)
write('wind', wind)
