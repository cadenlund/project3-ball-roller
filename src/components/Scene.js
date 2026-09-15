import { memo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber/native';

import { BALL_RADIUS, PAD_RADIUS, SPINNER_HALF_WIDTH } from '../game/levels';

/**
 * Draws a level and the ball with three.js. Purely a view: it reads the
 * engine state out of `stateRef` every GL frame and moves meshes to match,
 * so nothing here owns any game logic.
 *
 * The engine's track runs along +Z, but a camera looking down +Z puts world
 * +X on the LEFT of the screen, which makes steering feel inverted. So the
 * view draws everything at z = -engineZ and looks down -Z, three.js's
 * natural facing, where +X is screen-right.
 */
function World({ level, stateRef }) {
  const ball = useRef();
  const spinnerRefs = useRef([]);
  const coinRefs = useRef([]);

  useFrame(({ camera }, dt) => {
    const s = stateRef.current;
    if (!s) return;

    if (ball.current) {
      ball.current.position.set(s.x, s.y, -s.z);
      ball.current.rotation.x -= (s.vz * dt) / BALL_RADIUS;
    }

    // Chase camera: slightly behind and above, leaning into the ball's lane.
    camera.position.set(s.x * 0.5, 5.5, -s.z + 9);
    camera.lookAt(s.x * 0.7, 0.8, -s.z - 7);

    // With the z flip, the engine's bar angle in (x, z) is exactly rotation.y.
    level.spinners.forEach((sp, i) => {
      const m = spinnerRefs.current[i];
      if (m) m.rotation.y = sp.phase + sp.speed * s.time;
    });

    level.coins.forEach((c, i) => {
      const m = coinRefs.current[i];
      if (m) {
        m.visible = !s.coins[i];
        m.rotation.y = s.time * 2.5;
      }
    });
  });

  const goalSeg = level.segments[level.segments.length - 1];

  return (
    <>
      <color attach="background" args={['#020617']} />
      <fog attach="fog" args={['#020617', 24, 80]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 12, -4]} intensity={1.1} />

      {level.segments.map((seg, i) => (
        <mesh key={`seg${i}`} position={[seg.x, -0.55, -(seg.z0 + seg.z1) / 2]}>
          <boxGeometry args={[seg.width, 1.1, seg.z1 - seg.z0]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      ))}

      {level.pads.map((p, i) => (
        <mesh key={`pad${i}`} position={[p.x, 0.09, -p.z]}>
          <cylinderGeometry args={[PAD_RADIUS * 0.85, PAD_RADIUS * 0.85, 0.18, 24]} />
          <meshStandardMaterial color="#f59e0b" emissive="#b45309" emissiveIntensity={0.7} />
        </mesh>
      ))}

      {level.spinners.map((sp, i) => (
        <group key={`sp${i}`} position={[sp.x, 0.6, -sp.z]} ref={(el) => (spinnerRefs.current[i] = el)}>
          <mesh>
            <boxGeometry args={[sp.length, 0.5, SPINNER_HALF_WIDTH * 2]} />
            <meshStandardMaterial color="#f43f5e" emissive="#9f1239" emissiveIntensity={0.5} />
          </mesh>
        </group>
      ))}

      {level.coins.map((c, i) => (
        <mesh key={`coin${i}`} position={[c.x, c.y ?? 0.9, -c.z]} ref={(el) => (coinRefs.current[i] = el)}>
          <torusGeometry args={[0.5, 0.2, 12, 24]} />
          <meshStandardMaterial color="#fbbf24" emissive="#a16207" emissiveIntensity={0.6} />
        </mesh>
      ))}

      {/* The finish line: a glowing gate across the track. */}
      <mesh position={[goalSeg.x, 1.1, -level.goalZ]}>
        <boxGeometry args={[goalSeg.width, 2.2, 0.25]} />
        <meshStandardMaterial
          color="#22c55e"
          emissive="#15803d"
          emissiveIntensity={0.8}
          transparent
          opacity={0.55}
        />
      </mesh>

      <mesh ref={ball}>
        <sphereGeometry args={[BALL_RADIUS, 24, 24]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
    </>
  );
}

/** memo: the HUD re-renders every frame; the canvas must not re-mount with it. */
export const Scene = memo(function Scene({ level, stateRef }) {
  return (
    <Canvas style={{ flex: 1 }} camera={{ fov: 60, near: 0.1, far: 120 }}>
      <World level={level} stateRef={stateRef} />
    </Canvas>
  );
});
