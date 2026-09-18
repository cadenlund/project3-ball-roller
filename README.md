# Ball Roller &mdash; Project 3

A 3D tilt-controlled ball rolling game on a narrow track floating in space.
Tilt to roll the ball down the track, jump the gaps off bounce pads, dodge
the spinners, and try not to fall off the sides.

By Caden Lund, Ben Gutowski and Jordan Berger.

## In game

Actual browser captures of the app at a phone-sized viewport. The menu uses sample
saved progress to show unlocked levels; the gameplay uses the real physics and
keyboard input.

| Level select | First Roll · dusk rose | Mind the Gap · lagoon |
|---|---|---|
| ![Level select with themed cards](docs/media/menu.png) | ![Ball on the rose-colored First Roll track](docs/media/level-1.png) | ![Bounce pads and coins on the lagoon track](docs/media/level-3.png) |

![A run through Mind the Gap with bounce pads and gaps](docs/media/gameplay.gif)

## Team and feature ownership

| Person | Features |
|---|---|
| Caden Lund | Physics, level design and engine tests; ongoing work: calibration, pause/resume, later levels, moving platforms and CI (#1–#5). |
| Ben Gutowski | Menu and level selection, score/results presentation, persistent settings, tutorial and countdown/HUD polish. |
| Jordan Berger (`JordanFFBerger`) | Sound effects (#11), haptics (#12), pickup/impact/finish animations (#13), per-level palettes and track edges (#14), app branding and this media gallery (#15). |

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
| `__tests__/` | Tests for physics, scoring, settings, feedback and themes |

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
| 2 | The Narrows | The track thins and shifts | 16s |
| 3 | Mind the Gap | Bounce pads launch you over holes in the track | 21s |
| 4 | Spin Cycle | Rotating bars sweep the lane | 25s |
| 5 | The Gauntlet | Gaps, bars and narrow lanes together | 32s |
| 6 | Sidewinder | The ground itself slides side to side | 21s |
| 7 | Crossfire | Spinners over lanes barely wider than the ball | 23s |
| 8 | The Long Way Home | The finale: every mechanic, at speed | 32s |

Pars are set against a scripted clean run of each level rather than by
feel &mdash; see `test-utils/autopilot.js` and `__tests__/playable.test.js`,
which fail the build if a level becomes impossible or its par becomes
unbeatable.

## Scoring

1000 base, +40/second under par, +250 per coin, -150 per fall, floored at
zero. Stars: one for finishing, two for beating par, three for every coin.
Levels unlock in order, and the best run per level is kept on device.

## Working on it

Branch, open a pull request, get a green check, merge. Every push and pull
request runs the full suite on GitHub Actions
(`.github/workflows/test.yml`), and `main` requires it to pass, so a broken
physics change cannot land by accident.

The suite is the fast way to know a change is sound: `engine.js`,
`levels.js`, `scoring.js` and `loop.js` are all pure functions over plain
data, so they run without a device or a GPU. Anything that changes how the
ball moves should come with a test that would have caught the change going
wrong &mdash; the level suite already refuses geometry that is unplayable,
and `__tests__/playable.test.js` refuses a level that cannot be finished or
a par that cannot be beaten.

```bash
npm test            # the whole suite
npm test -- engine  # one file, by name
```

## Running it

Install Node.js 24 LTS (includes npm) and Expo Go compatible with SDK 57 on your
phone. In the project directory:

```bash
npm ci
npm test -- --runInBand
npx expo start      # scan the QR code with Expo Go
```

Use the same Wi-Fi network, or `npx expo start --tunnel` if the phone cannot
reach the computer. For browser play, run `npm run web` and use WASD/arrow keys.
On Ubuntu, if DevTools reports missing shared libraries, install
`sudo apt-get install libnspr4 libnss3 libasound2t64`.

The Sound and Haptics switches in Settings apply immediately. Haptics need a
physical device and are disabled on web. Rolling audio stops when stationary,
airborne, backgrounded or outside gameplay.

## App branding

`assets/branding/mark.svg` is the editable, original ball-on-track mark. Its PNG
exports provide the app icon, Android adaptive foreground and splash image via
`app.json` and the `expo-splash-screen` plugin. Regenerate with
`node scripts/generate-branding.cjs` after installing the optional `sharp` tool.
The branding artwork is CC0 1.0, like the sound assets below.

Icon and splash changes require a fresh native build (`npm run android` with
Android Studio/SDK installed, or `npm run ios` on macOS with Xcode). Expo Go does
not reproduce the installed app's splash screen; verify a release build as
[Expo documents](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).

For device review: collect a coin, launch from a pad, land, hit a spinner, fall,
and finish a level. Repeat with Sound/Haptics disabled. Check each level palette,
then background/foreground the app and confirm audio does not continue in the
background. Particle effects use a fixed pool and a single instanced draw call;
60fps still needs profiling on the target phone.


## Sound credits

The seven WAV effects in `assets/sounds/` are original synthesized sounds created
for Ball Roller and dedicated to the public domain under CC0 1.0
(https://creativecommons.org/publicdomain/zero/1.0/). No sampled recordings are used.
Regenerate them with `python3 scripts/generate-sounds.py`. Audio uses `expo-audio`;
the Sound setting mutes effects and the rolling loop, including pending playback.

### Reproducing the README captures

Install optional capture tools outside the app dependencies:

```bash
npm install --prefix /tmp/ball-roller-media playwright sharp gifenc
/tmp/ball-roller-media/node_modules/.bin/playwright install chromium
npx expo export --platform web --output-dir /tmp/ball-roller-web
python3 -m http.server 8088 --bind 127.0.0.1 --directory /tmp/ball-roller-web
# In a second terminal, from this repository:
NODE_PATH=/tmp/ball-roller-media/node_modules node scripts/capture-media.cjs
```

The capture script seeds sample progress in its isolated browser profile and
records keyboard-controlled play; it does not change your saved phone progress.
