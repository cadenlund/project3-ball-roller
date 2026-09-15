import Svg, { Circle, G, Rect } from 'react-native-svg';

import { BALL_RADIUS, COIN_RADIUS, GOAL_RADIUS, HOLE_RADIUS, WORLD } from '../game/levels';

/**
 * Renders a level. Draws in world units and lets SVG scale to the device, so
 * nothing here has to know the screen size.
 */
export function Board({ level, state, size }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${WORLD} ${WORLD}`}>
      <Rect x={0} y={0} width={WORLD} height={WORLD} rx={3} fill="#0f172a" />

      <G>
        {level.holes.map((h, i) => (
          <Circle key={`h${i}`} cx={h.x} cy={h.y} r={HOLE_RADIUS} fill="#020617" />
        ))}

        <Circle cx={level.goal.x} cy={level.goal.y} r={GOAL_RADIUS} fill="#22c55e" opacity={0.28} />
        <Circle cx={level.goal.x} cy={level.goal.y} r={GOAL_RADIUS * 0.45} fill="#22c55e" />

        {level.coins.map((c, i) =>
          state.coins[i] ? null : (
            <Circle key={`c${i}`} cx={c.x} cy={c.y} r={COIN_RADIUS} fill="#fbbf24" />
          )
        )}

        {level.walls.map((w, i) => (
          <Rect key={`w${i}`} x={w.x} y={w.y} width={w.w} height={w.h} rx={0.8} fill="#334155" />
        ))}

        <Circle cx={state.x} cy={state.y} r={BALL_RADIUS} fill="#e2e8f0" />
      </G>
    </Svg>
  );
}
