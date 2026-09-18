import { memo, useMemo, useRef } from 'react';
import { Object3D } from 'three';
import { advanceEffects, createEffects, PARTICLE_COUNT } from '../game/visualEffects';
import { Canvas, useFrame } from './SceneCanvas';

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
  const theme = level.theme;
  const ball = useRef();
  const ballShape = useRef();
  const goal = useRef();
  const particles = useRef();
  const padRefs = useRef([]);
  const effects = useRef(createEffects(stateRef.current));
  const dummy = useMemo(() => new Object3D(), []);
  const spinnerRefs = useRef([]);
  const coinRefs = useRef([]);

  useFrame(({ camera }, dt) => {
    const s = stateRef.current;
    if (!s) return;

    const fx = advanceEffects(effects.current, s, level, dt);

    if (ball.current) {
      ball.current.position.set(s.x, s.y, -s.z);
      ballShape.current.rotation.x -= (s.vz * dt) / BALL_RADIUS;
      const shrink = Math.max(0.05, Math.min(1, 1 + s.y / 8));
      const squash = fx.launch / 0.22;
      const stretch = !s.grounded && s.y > BALL_RADIUS && !squash ? Math.min(0.4, Math.abs(s.vy) / 55) : 0;
      ball.current.scale.set(shrink * (1 + squash * 0.3 - stretch * 0.25), shrink * (1 - squash * 0.4 + stretch), shrink * (1 + squash * 0.3 - stretch * 0.25));
    }

    // Chase camera: slightly behind and above, leaning into the ball's lane.
    const shake = fx.shake * 0.55;
    camera.position.set(s.x * 0.5 + Math.sin(fx.age * 91) * shake, 5.5 + Math.cos(fx.age * 73) * shake, -s.z + 9);
    camera.lookAt(s.x * 0.7, 0.8, -s.z - 7);

    padRefs.current.forEach((pad, i) => {
      if (!pad) return;
      const pulse = i === fx.pad ? fx.padPulse / 0.4 : 0;
      pad.scale.set(1 + pulse * 0.3, 1 + pulse, 1 + pulse * 0.3);
      pad.material.emissiveIntensity = 0.85 + pulse;
    });
    if (goal.current) {
      goal.current.material.opacity = 0.45 + 0.1 * Math.sin(fx.age * 2) + fx.celebration * 0.4;
      goal.current.material.emissiveIntensity = 0.9 + fx.celebration * 2;
      goal.current.scale.y = 1 + fx.celebration * 0.3;
    }
    if (particles.current) {
      fx.particles.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(p.life > 0 ? p.life * 0.23 : 0);
        dummy.updateMatrix();
        particles.current.setMatrixAt(i, dummy.matrix);
      });
      particles.current.instanceMatrix.needsUpdate = true;
    }

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
      <color attach="background" args={[theme.background]} />
      <fog attach="fog" args={[theme.fog, 24, 80]} />
      <ambientLight intensity={0.65} color="#ffffff" />
      {/* Low warm "sun" as the key light, a dim cyan rim light for that
          retro-sunset warm/cool contrast. */}
      <directionalLight position={[6, 12, -4]} intensity={1.15} color={theme.keyLight} />
      <directionalLight position={[-8, 6, 8]} intensity={0.4} color={theme.rimLight} />

      {level.segments.map((seg, i) => (
        <group key={`seg${i}`} position={[seg.x, 0, -(seg.z0 + seg.z1) / 2]}>
          <mesh position={[0, -0.55, 0]}>
            <boxGeometry args={[seg.width, 1.1, seg.z1 - seg.z0]} />
            <meshStandardMaterial color={theme.track} emissive={theme.trackGlow} emissiveIntensity={0.25} />
          </mesh>
          {[-1, 1].map(side => (
            <mesh key={side} position={[side * (seg.width / 2 - 0.04), 0.015, 0]}>
              <boxGeometry args={[0.08, 0.03, seg.z1 - seg.z0]} />
              <meshBasicMaterial color={theme.edge} />
            </mesh>
          ))}
        </group>
      ))}

      {level.pads.map((p, i) => (
        <mesh key={`pad${i}`} ref={(el) => (padRefs.current[i] = el)} position={[p.x, 0.09, -p.z]}>
          <cylinderGeometry args={[PAD_RADIUS * 0.85, PAD_RADIUS * 0.85, 0.18, 24]} />
          <meshStandardMaterial color={theme.pad} emissive={theme.padGlow} emissiveIntensity={0.85} />
        </mesh>
      ))}

      {level.spinners.map((sp, i) => (
        <group key={`sp${i}`} position={[sp.x, 0.6, -sp.z]} ref={(el) => (spinnerRefs.current[i] = el)}>
          <mesh>
            <boxGeometry args={[sp.length, 0.5, SPINNER_HALF_WIDTH * 2]} />
            <meshStandardMaterial color={theme.spinner} emissive={theme.spinnerGlow} emissiveIntensity={0.7} />
          </mesh>
        </group>
      ))}

      {level.coins.map((c, i) => (
        <mesh key={`coin${i}`} position={[c.x, c.y ?? 0.9, -c.z]} ref={(el) => (coinRefs.current[i] = el)}>
          <torusGeometry args={[0.5, 0.2, 12, 24]} />
          <meshStandardMaterial color={theme.coin} emissive={theme.coinGlow} emissiveIntensity={0.75} />
        </mesh>
      ))}

      {/* The finish line: a glowing gate across the track. */}
      <mesh ref={goal} position={[goalSeg.x, 1.1, -level.goalZ]}>
        <boxGeometry args={[goalSeg.width, 2.2, 0.25]} />
        <meshStandardMaterial
          color={theme.goal}
          emissive={theme.goalGlow}
          emissiveIntensity={0.9}
          transparent
          opacity={0.55}
        />
      </mesh>

      <instancedMesh ref={particles} args={[null, null, PARTICLE_COUNT]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={theme.coin} />
      </instancedMesh>
      <group ref={ball}>
      <mesh ref={ballShape}>
        <sphereGeometry args={[BALL_RADIUS, 24, 24]} />
        <meshStandardMaterial color={theme.ball} emissive={theme.ballGlow} emissiveIntensity={0.2} />
      </mesh>
      </group>
    </>
  );
}

/** memo: the HUD re-renders every frame; the canvas must not re-mount with it. */
export const Scene = memo(function Scene({ level, stateRef }) {
  return (
    <Canvas style={{ flex: 1 }} camera={{ fov: 60, near: 0.1, far: 120 }}>
      <World key={level.id} level={level} stateRef={stateRef} />
    </Canvas>
  );
});
