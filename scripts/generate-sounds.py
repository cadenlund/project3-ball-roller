"""Generate the project's original CC0 sound effects (22.05 kHz mono PCM)."""
import math, random, wave, struct
from pathlib import Path
random.seed(3)
out = Path(__file__).resolve().parents[1] / 'assets/sounds'
out.mkdir(parents=True, exist_ok=True)
rate = 22050
for name, duration in [('roll', 1), ('coin', .25), ('pad', .32), ('spinner', .3), ('fall', .65), ('goal', 1), ('tap', .07)]:
    samples = []
    phase = 0
    for i in range(int(rate * duration)):
        t = i / rate
        u = t / duration
        envelope = min(1, t / .008) * (1-u)**2
        if name == 'roll':
            value = .1 * (math.sin(2*math.pi*85*t) + .4*math.sin(2*math.pi*173*t))
        elif name == 'fall':
            value = .45 * random.uniform(-1, 1) * envelope * math.sin(math.pi*u)
        elif name == 'goal':
            freq = [523.25, 659.25, 783.99, 1046.5][min(3, int(t / .2))]
            phase += 2*math.pi*freq/rate
            value = .35 * math.sin(phase) * envelope
        else:
            freq = {'coin': 1200 + 1000*u, 'pad': 180 + 600*u, 'spinner': 210, 'tap': 900}[name]
            phase += 2*math.pi*freq/rate
            value = .35 * (math.sin(phase) + (.3*math.sin(phase*2.73) if name == 'spinner' else 0)) * envelope
        samples.append(struct.pack('<h', int(max(-1, min(1, value))*32767)))
    with wave.open(str(out / (name + '.wav')), 'wb') as f:
        f.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        f.writeframes(b''.join(samples))
