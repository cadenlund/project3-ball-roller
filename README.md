# Ball Roller &mdash; Project 3

A tilt-controlled ball rolling game with five levels of increasing
complexity. Roll the ball to the goal, grab coins, avoid holes.

By Caden Lund.

> **Status: foundation.** The structure, physics, levels, input and scoring
> are in place and tested. Art, sound, menus polish and level tuning are the
> work still to come.

## Controls

The ball is steered by tilting the device &mdash; the accelerometer reports
gravity, so the ball rolls downhill the way a real one would.

Where there is no accelerometer (simulator, web, desktop) the game falls back
automatically: **arrow keys or WASD** on web, and an on-screen D-pad
everywhere else. `useTilt` picks the source at startup; nothing else in the
game knows or cares which one is live.

## Layout

| Path | Purpose |
|---|---|
| `src/game/levels.js` | The five level definitions, in world coordinates |
| `src/game/engine.js` | Ball physics, collision, coins, holes, goal |
| `src/game/scoring.js` | Points, stars, time formatting |
| `src/game/progress.js` | Best score per level, saved to device storage |
| `src/game/useTilt.js` | Accelerometer input with keyboard fallback |
| `src/components/Board.js` | Draws a level with SVG |
| `src/screens/` | Level select and gameplay screens |
| `__tests__/` | 61 tests over levels, physics and scoring |

### Why it is split this way

`engine.js` and `scoring.js` are pure functions over plain data &mdash; no
React, no timers, no rendering. `step(state, level, tilt, dt)` returns a new
state and never mutates its input, so the entire game can be simulated in a
test without a device. The suite leans on that: it rolls each level for
hundreds of frames to assert the ball never escapes the world, never tunnels
through a wall, and that no level ships with its start or goal buried in
geometry.

Levels are described in a fixed 100x100 world space and scaled to the screen
at render time, so a level plays identically on any display and none of the
geometry depends on pixels.

## Levels

| # | Name | Idea | Par |
|---|---|---|---|
| 1 | First Roll | Open room, learn the tilt | 12s |
| 2 | Doorway | One wall, one gap | 16s |
| 3 | Mind the Gap | Holes reset the level | 22s |
| 4 | Switchback | Three corridors, no shortcuts | 30s |
| 5 | The Spiral | In to the centre, the long way | 45s |

## Scoring

1000 base, +40/second under par, +250 per coin, -150 per fall, floored at
zero. Stars: one for finishing, two for beating par, three for every coin.
Levels unlock in order, and the best run per level is kept on device.

## Running it

```bash
npm install
npm test
npx expo start      # press i for iOS, a for Android, w for web
```
