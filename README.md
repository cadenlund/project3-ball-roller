# Ball Roller &mdash; Project 3

A 3D tilt-controlled ball rolling game on a narrow track floating in space.
Tilt to roll the ball down the track, jump the gaps off bounce pads, dodge
the spinners, and try not to fall off the sides.

By Caden Lund, Ben Gutow and Jordan.

> **Status: foundation.** The structure, physics, levels, input and scoring
> are in place and tested. Art, sound, menu polish and level tuning are the
> work still to come &mdash; split up in the
> [issues](https://github.com/cadenlund/project3-ball-roller/issues).

## Controls

The ball goes only where the phone is tilted, like a marble on a board.
Neutral is a natural hold with the phone tipped ~45&deg; toward you: tip it
away to roll forward, pull it upright to brake and roll back, tilt sideways
to steer. Each level caps how fast the ball can roll.

Where there is no accelerometer (simulator, web, desktop) the game falls back
automatically: **WASD or arrow keys** on web, and an on-screen D-pad
everywhere else. `useTilt` picks the source at startup; nothing else in the
game knows or cares which one is live.

## Layout

| Path | Purpose |
|---|---|
| `src/game/levels.js` | The five level definitions: track pieces, pads, spinners, coins |
| `src/game/engine.js` | Ball physics: rolling, steering, gravity, falls, pads, spinners |
| `src/game/scoring.js` | Points, stars, time formatting |
| `src/game/progress.js` | Best score per level, saved to device storage |
| `src/game/useTilt.js` | Accelerometer input with keyboard fallback |
| `src/components/Scene.js` | Draws a level with three.js (via expo-gl) |
| `src/screens/` | Level select and gameplay screens |
| `__tests__/` | 105 tests over levels, physics and scoring |

### Why it is split this way

`engine.js` and `scoring.js` are pure functions over plain data &mdash; no
React, no three.js, no timers. `step(state, level, tilt, dt)` returns a new
state and never mutates its input, so the entire game can be simulated in a
test without a device or a GPU. The suite leans on that: it rolls each level
for thousands of frames to assert the ball never sinks through the track,
that every gap has a pad strong enough to clear it, and that levels 1 and 3
are literally beatable by just holding full forward tilt.

`Scene.js` is the opposite: purely a view. It reads the engine state every GL
frame and moves meshes to match, and owns no game logic at all.

Levels are authored as a `run` &mdash; an ordered list of track pieces with a
length, width, lateral offset and optional gap &mdash; which `buildLevel`
expands into the absolute spans the engine and renderer share. A level reads
as one list, not a pile of coordinates.

## Levels

| # | Name | Idea | Par |
|---|---|---|---|
| 1 | First Roll | Wide lane, learn to steer | 14s |
| 2 | The Narrows | The track thins and shifts | 17s |
| 3 | Mind the Gap | Bounce pads launch you over holes in the track | 24s |
| 4 | Spin Cycle | Rotating bars sweep the lane | 26s |
| 5 | The Gauntlet | Everything at once | 32s |

## Scoring

1000 base, +40/second under par, +250 per coin, -150 per fall, floored at
zero. Stars: one for finishing, two for beating par, three for every coin.
Levels unlock in order, and the best run per level is kept on device.

## Running it

```bash
npm install
npm test
npx expo start      # scan the QR code with Expo Go
```

## Sound credits

The seven WAV effects in `assets/sounds/` are original synthesized sounds created
for Ball Roller and dedicated to the public domain under CC0 1.0
(https://creativecommons.org/publicdomain/zero/1.0/). No sampled recordings are used.
Regenerate them with `python3 scripts/generate-sounds.py`. Audio uses `expo-audio`;
the Sound setting mutes effects and the rolling loop, including pending playback.
