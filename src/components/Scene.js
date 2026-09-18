import { memo, useMemo, useRef } from 'react';
import { Color, Object3D, Shape, ShapeGeometry, Vector3 } from 'three';

import { isOpen } from '../game/engine';
import { FOV_BASE, createCameraRig, trackCamera } from '../game/camera';
import {
  advanceEffects,
  createEffects,
  PARTICLE_COUNT,
  RING_COUNT,
  STREAK_COUNT,
  TRAIL_COUNT,
} from '../game/visualEffects';
import { Canvas, useFrame } from './SceneCanvas';
import { Sky, SUN_DIRECTION } from './Sky';
import { buildDeckGeometry, buildRailGeometry } from './trackMesh';

import {
  BALLAST_RADIUS,
  BALL_RADIUS,
  BOOST_LIFT,
  BOOST_RADIUS,
  CANNON_RADIUS,
  GATE_HALF,
  GATE_HEIGHT,
  SWITCH_RADIUS,
  PAD_RADIUS,
  SPINNER_BAR_HALF,
  SPINNER_HALF_WIDTH,
  segmentShift,
  widthAt,
} from '../game/levels';

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
  const streaks = useRef();
  const trail = useRef();
  const rings = useRef();
  const halo = useRef();
  const beam = useRef();
  const padRefs = useRef([]);
  const boostRefs = useRef([]);
  const switchRefs = useRef([]);
  const gateRefs = useRef([]);
  const cannonRefs = useRef([]);
  const ballastRefs = useRef([]);
  const effects = useRef(createEffects(stateRef.current));
  const dummy = useMemo(() => new Object3D(), []);
  const spinnerRefs = useRef([]);
  const coinRefs = useRef([]);
  const segRefs = useRef([]);
  const rig = useRef(createCameraRig());
  const aimAt = useMemo(() => new Vector3(), []);

  // Parsed once: setting a material colour from a string re-parses it every
  // time, and these two are the only values a switch ever takes.
  // One arrow, shared by every booster in the level. Drawn pointing along +Y
  // in the shape's own plane, which the -90 degree pitch below turns into
  // "forward down the track".
  const arrow = useMemo(() => {
    const r = BOOST_RADIUS;
    const shape = new Shape();
    shape.moveTo(0, r * 1.15);
    shape.lineTo(-r, r * 0.05);
    shape.lineTo(-r * 0.4, r * 0.05);
    shape.lineTo(-r * 0.4, -r * 1.05);
    shape.lineTo(r * 0.4, -r * 1.05);
    shape.lineTo(r * 0.4, r * 0.05);
    shape.lineTo(r, r * 0.05);
    shape.closePath();
    return new ShapeGeometry(shape);
  }, []);

  const switchColors = useMemo(
    () => ({ off: new Color(theme.switchOff), on: new Color(theme.switchOn) }),
    [theme]
  );

  const movingSegments = useMemo(
    () => level.segments.map((seg, i) => (seg.moving ? i : -1)).filter((i) => i >= 0),
    [level]
  );
  // The deck and its two rails are swept along each centreline once, on load.
  // Nothing about a piece's shape changes at runtime - a sliding platform
  // moves its whole group - so this never has to be rebuilt.
  // An end is capped only where the track really ends: at the very start and
  // finish of the run, and on either side of a gap. Everywhere else the next
  // piece picks up exactly where this one stops.
  const decks = useMemo(
    () => level.segments.map((seg, i) => buildDeckGeometry(seg, {
      capStart: i === 0 || level.segments[i - 1].z1 !== seg.z0,
      capEnd: i === level.segments.length - 1 || level.segments[i + 1].z0 !== seg.z1,
    })),
    [level]
  );
  const rails = useMemo(() => level.segments.map(buildRailGeometry), [level]);

  useFrame(({ camera, size }, dt) => {
    const s = stateRef.current;
    if (!s) return;

    const fx = advanceEffects(effects.current, s, level, dt);

    if (ball.current) {
      ball.current.position.set(s.x, s.y, -s.z);
      ballShape.current.rotation.x -= (s.vz * dt) / BALL_RADIUS;
      const squash = fx.launch / 0.22;
      const stretch = !s.grounded && !squash ? Math.min(0.4, Math.abs(s.vy) / 55) : 0;
      ball.current.scale.set(1 + squash * 0.3 - stretch * 0.25, 1 - squash * 0.4 + stretch, 1 + squash * 0.3 - stretch * 0.25);
    }

    // --- Camera. All of the decisions live in game/camera.js, which is pure
    // and therefore testable: whether the ball is on screen is not something
    // to find out about on a device.
    rig.current.aspect = size.width / size.height;
    const cam = trackCamera(rig.current, level, s, dt, fx);
    camera.position.set(cam.seat.x + cam.shakeX, cam.seat.y + cam.shakeY, -cam.seat.z);
    aimAt.set(cam.aim.x, cam.aim.y, -cam.aim.z);
    camera.lookAt(aimAt);
    camera.rotation.z += cam.roll;
    // Rebuilding the projection matrix costs more than a tenth of a degree of
    // field of view is worth, so only a change you could actually see pays.
    if (Math.abs(camera.fov - cam.fov) > 0.15) {
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
    }

    // Sliding platforms follow the same clock the physics reads, so what is
    // drawn underfoot is exactly what the ball is standing on.
    for (const i of movingSegments) {
      const group = segRefs.current[i];
      if (group) group.position.x = level.segments[i].x + segmentShift(level.segments[i], s.time);
    }

    padRefs.current.forEach((pad, i) => {
      if (!pad) return;
      const pulse = i === fx.pad ? fx.padPulse / 0.4 : 0;
      pad.scale.set(1 + pulse * 0.3, 1 + pulse, 1 + pulse * 0.3);
      pad.material.emissiveIntensity = 0.85 + pulse;
    });
    level.boosters.forEach((b, i) => {
      const boost = boostRefs.current[i];
      if (!boost) return;
      const hit = i === fx.boost ? fx.boostPulse / 0.5 : 0;
      boost.scale.set(1 + hit * 0.4, 1 + hit * 0.4, 1);
      // Hovering, with a slow bob, so it reads as a thing suspended over the
      // track rather than a decal painted onto it.
      boost.position.y = b.y + Math.sin(fx.age * 2.4 + i) * 0.12;
      boost.material.emissiveIntensity = 1 + hit * 1.8 + 0.25 * Math.sin(fx.age * 6 + i);
    });
    // A switch you have thrown and a gate you have opened both have to read
    // as *done* from a distance - this is a puzzle, and the player's whole
    // job is knowing which locks are still shut.
    level.switches.forEach((w, i) => {
      const mesh = switchRefs.current[i];
      if (!mesh) return;
      const open = s.opened[i];
      const tint = open ? switchColors.on : switchColors.off;
      mesh.material.color.copy(tint);
      mesh.material.emissive.copy(tint);
      mesh.material.emissiveIntensity = open ? 1.5 : 0.7 + 0.35 * Math.sin(fx.age * 4);
      mesh.scale.y = open ? 0.35 : 1;
    });
    level.gates.forEach((gate, i) => {
      const mesh = gateRefs.current[i];
      if (!mesh) return;
      const open = isOpen(s, level, gate);
      // Sinking into the deck rather than blinking out, so it is obvious
      // *that* gate is the one the switch just dealt with.
      const target = open ? 0 : 1;
      mesh.scale.y += (target - mesh.scale.y) * Math.min(1, dt * 6);
      mesh.position.y = gate.y + (GATE_HEIGHT / 2) * mesh.scale.y;
      mesh.visible = mesh.scale.y > 0.02;
      mesh.material.opacity = 0.55 + 0.12 * Math.sin(fx.age * 3);
    });

    // A loaded cannon winds up before it fires, so the shot is telegraphed
    // rather than sprung, and the barrel points where it is going to throw you.
    level.cannons.forEach((c, i) => {
      const barrel = cannonRefs.current[i];
      if (!barrel) return;
      const loading = s.cannon === i ? 1 - s.cannonTime / (c.hold ?? 0.7) : 0;
      barrel.scale.setScalar(1 + loading * 0.18);
      barrel.children[0].material.emissiveIntensity = 0.6 + loading * 2.4;
    });

    level.ballast.forEach((b, i) => {
      const mesh = ballastRefs.current[i];
      if (!mesh) return;
      mesh.position.y = b.y + Math.sin(fx.age * 1.8 + i) * 0.1;
      mesh.rotation.y = fx.age * (b.mass > 1 ? 0.6 : 1.8);
      // Lit while it is the weight you are *not* carrying: it is a station to
      // go back to, and it should say so from across the level.
      mesh.material.emissiveIntensity = s.mass === b.mass ? 0.3 : 1.1;
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
    // The trail: ghosts of the ball, shrinking and fading behind it.
    if (trail.current) {
      fx.trail.forEach((ghost, i) => {
        dummy.position.set(ghost.x, ghost.y, ghost.z);
        dummy.scale.setScalar(ghost.life > 0 ? BALL_RADIUS * 0.92 * ghost.life ** 1.5 : 0);
        dummy.updateMatrix();
        trail.current.setMatrixAt(i, dummy.matrix);
      });
      trail.current.instanceMatrix.needsUpdate = true;
      trail.current.material.opacity = 0.12 + fx.rush * 0.3;
    }
    // Impact rings, thrown flat and opening outwards.
    if (rings.current) {
      fx.rings.forEach((r, i) => {
        const open = r.life > 0 ? 1 - r.life : 0;
        dummy.position.set(r.x, r.y, r.z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.setScalar(r.life > 0 ? r.size * (0.3 + open * 1.5) : 0);
        dummy.updateMatrix();
        rings.current.setMatrixAt(i, dummy.matrix);
      });
      dummy.rotation.set(0, 0, 0);
      rings.current.instanceMatrix.needsUpdate = true;
      rings.current.material.opacity = 0.55 * Math.max(...fx.rings.map((r) => r.life));
    }
    // The ball's own light, so it lifts the deck under it out of the haze.
    if (halo.current) {
      halo.current.position.set(s.x, s.y + 0.2, -s.z);
      halo.current.intensity = 9 + fx.rush * 10 + fx.boostPulse * 26;
    }
    if (beam.current) {
      beam.current.material.opacity = 0.1 + 0.04 * Math.sin(fx.age * 1.6) + fx.celebration * 0.25;
    }

    // Streaks of rushing air, drawn around the camera rather than the ball so
    // they read as the world going past instead of as a trail behind it.
    if (streaks.current) {
      streaks.current.material.opacity = fx.rush * 0.5;
      fx.streaks.forEach((p, i) => {
        dummy.position.set(camera.position.x + p.x, camera.position.y + p.y, camera.position.z - p.z);
        dummy.scale.set(0.035, 0.035, p.length);
        dummy.updateMatrix();
        streaks.current.setMatrixAt(i, dummy.matrix);
      });
      streaks.current.instanceMatrix.needsUpdate = true;
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
        m.position.y = c.y + Math.sin(s.time * 2 + i) * 0.12;
      }
    });
  });

  return (
    <>
      <color attach="background" args={[theme.background]} />
      {/* Long and soft: at this altitude the far end of the track should fade
          into the haze rather than hit a wall of fog a few metres out. */}
      <fog attach="fog" args={[theme.fog, 34, 210]} />
      <Sky theme={theme} stateRef={stateRef} />

      <ambientLight intensity={0.55} color={theme.horizon} />
      {/* The key light comes from where the sun is actually drawn, so the lit
          side of everything agrees with the sky behind it. A cool rim light
          opposite gives the warm/cool contrast, and a dim uplight off the
          cloud deck stops undersides going to pure black. */}
      <directionalLight
        position={[SUN_DIRECTION.x * 60, SUN_DIRECTION.y * 60, -SUN_DIRECTION.z * 60]}
        intensity={1.35}
        color={theme.keyLight}
      />
      <directionalLight position={[-8, 6, 8]} intensity={0.45} color={theme.rimLight} />
      <directionalLight position={[0, -30, 0]} intensity={0.25} color={theme.cloud} />
      {/* Travels with the ball: at this altitude nothing else lights the deck
          immediately under it, and a marble with no light of its own in a sky
          this big reads as a dot rather than as you. */}
      <pointLight ref={halo} distance={26} decay={2} intensity={9} color={theme.ballGlow} />

      {level.segments.map((seg, i) => (
        <group
          key={`seg${i}`}
          ref={(el) => (segRefs.current[i] = el)}
          position={[seg.x + segmentShift(seg, 0), seg.y0, -(seg.z0 + seg.z1) / 2]}
        >
          <mesh geometry={decks[i]}>
            <meshStandardMaterial color={theme.track} emissive={theme.trackGlow} emissiveIntensity={0.25} />
          </mesh>
          <mesh geometry={rails[i]}>
            <meshBasicMaterial color={theme.edge} />
          </mesh>
        </group>
      ))}

      {level.pads.map((p, i) => (
        <mesh key={`pad${i}`} ref={(el) => (padRefs.current[i] = el)} position={[p.x, p.y + 0.09, -p.z]}>
          <cylinderGeometry args={[PAD_RADIUS * 0.85, PAD_RADIUS * 0.85, 0.18, 24]} />
          <meshStandardMaterial color={theme.pad} emissive={theme.padGlow} emissiveIntensity={0.85} />
        </mesh>
      ))}

      {/* Boosters are green arrows hovering over the deck, pointing the way
          they throw you - unmistakably different from an orange pad you
          bounce off, and readable from far enough back to aim at. */}
      {level.boosters.map((b, i) => (
        <mesh
          key={`boost${i}`}
          ref={(el) => (boostRefs.current[i] = el)}
          geometry={arrow}
          position={[b.x, b.y, -b.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <meshStandardMaterial
            color={theme.boost}
            emissive={theme.boostGlow}
            emissiveIntensity={1}
            side={2}
            transparent
            opacity={0.92}
          />
        </mesh>
      ))}

      {/* A bar turns in the plane of the deck it is mounted on: pitched down
          the slope, rolled with the camber, and spinning about that plane's
          own normal. Nested groups rather than one Euler triple, so the order
          the three rotations compose in is not left to interpretation. */}
      {/* A cannon: a barrel lying along its own aim, so where it will throw
          you is readable before you roll into it. */}
      {level.cannons.map((c, i) => {
        const aim = c.aim;
        const flat = Math.hypot(aim.x ?? 0, aim.z ?? 0);
        return (
          <group
            key={`cannon${i}`}
            ref={(el) => (cannonRefs.current[i] = el)}
            position={[c.x, c.y + CANNON_RADIUS * 0.5, -c.z]}
            // The view flips z, so the barrel's heading does too.
            rotation={[0, Math.atan2(aim.x ?? 0, -(aim.z ?? 0)), 0]}
          >
            <mesh rotation={[Math.atan2(flat, aim.y ?? 0), 0, 0]}>
              <cylinderGeometry args={[CANNON_RADIUS * 0.5, CANNON_RADIUS * 0.72, CANNON_RADIUS * 2.2, 14, 1, true]} />
              <meshStandardMaterial
                color={theme.cannon}
                emissive={theme.cannonGlow}
                emissiveIntensity={0.6}
                side={2}
              />
            </mesh>
          </group>
        );
      })}

      {/* Ballast: heavy is a dense grey block, light an airy gold one. Both
          hover, both spin, and the one you are not carrying is the lit one. */}
      {level.ballast.map((b, i) => (
        <mesh key={`ballast${i}`} ref={(el) => (ballastRefs.current[i] = el)} position={[b.x, b.y, -b.z]}>
          {b.mass > 1
            ? <boxGeometry args={[BALLAST_RADIUS, BALLAST_RADIUS, BALLAST_RADIUS]} />
            : <octahedronGeometry args={[BALLAST_RADIUS * 0.8, 0]} />}
          <meshStandardMaterial
            color={b.mass > 1 ? theme.heavy : theme.light}
            emissive={b.mass > 1 ? theme.heavyGlow : theme.lightGlow}
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}

      {/* A switch: a plate set into the deck, lit while it is still unthrown. */}
      {level.switches.map((w, i) => (
        <mesh key={`sw${i}`} ref={(el) => (switchRefs.current[i] = el)} position={[w.x, w.y + 0.12, -w.z]}>
          <cylinderGeometry args={[SWITCH_RADIUS * 0.8, SWITCH_RADIUS * 0.95, 0.24, 6]} />
          <meshStandardMaterial color={theme.switchOff} emissive={theme.switchOff} emissiveIntensity={0.7} />
        </mesh>
      ))}

      {/* A gate: a slab across the lane, which drops into the deck when its
          switch is thrown. Scaled from the deck up, so it sinks rather than
          shrinking toward its own middle. */}
      {level.gates.map((gate, i) => (
        <mesh key={`gate${i}`} ref={(el) => (gateRefs.current[i] = el)} position={[gate.x, gate.y + GATE_HEIGHT / 2, -gate.z]}>
          <boxGeometry args={[gate.width, GATE_HEIGHT, GATE_HALF * 2]} />
          <meshStandardMaterial
            color={theme.gate}
            emissive={theme.gateGlow}
            emissiveIntensity={0.8}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}

      {level.spinners.map((sp, i) => (
        <group key={`sp${i}`} position={[sp.x, sp.y, -sp.z]} rotation={[Math.atan(sp.pitch ?? 0), 0, 0]}>
          <group rotation={[0, 0, sp.roll ?? 0]}>
            <group ref={(el) => (spinnerRefs.current[i] = el)}>
              <mesh>
                <boxGeometry args={[sp.length, SPINNER_BAR_HALF * 2, SPINNER_HALF_WIDTH * 2]} />
                <meshStandardMaterial color={theme.spinner} emissive={theme.spinnerGlow} emissiveIntensity={0.7} />
              </mesh>
            </group>
          </group>
        </group>
      ))}

      {level.coins.map((c, i) => (
        <mesh key={`coin${i}`} position={[c.x, c.y, -c.z]} ref={(el) => (coinRefs.current[i] = el)}>
          <torusGeometry args={[0.5, 0.2, 12, 24]} />
          <meshStandardMaterial color={theme.coin} emissive={theme.coinGlow} emissiveIntensity={0.75} />
        </mesh>
      ))}

      {/* The finish line: a glowing gate across the track. */}
      <mesh ref={goal} position={[level.goalX, level.goalY + 1.1, -level.goalZ]}>
        <boxGeometry args={[widthAt(level.segments[level.segments.length - 1], level.goalZ), 2.2, 0.25]} />
        <meshStandardMaterial
          color={theme.goal}
          emissive={theme.goalGlow}
          emissiveIntensity={0.9}
          transparent
          opacity={0.55}
        />
      </mesh>

      {/* A shaft of light standing over the finish, visible from a long way
          back so the end of the level is somewhere you can see rather than
          somewhere you arrive at. */}
      <mesh ref={beam} position={[level.goalX, level.goalY + 40, -level.goalZ]}>
        <cylinderGeometry args={[widthAt(level.mainSegments[level.mainSegments.length - 1], level.goalZ) * 0.45, 1.2, 80, 12, 1, true]} />
        <meshBasicMaterial color={theme.goal} transparent opacity={0.12} side={2} depthWrite={false} fog={false} />
      </mesh>

      <instancedMesh ref={trail} args={[null, null, TRAIL_COUNT]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color={theme.ballGlow} transparent opacity={0.2} depthWrite={false} />
      </instancedMesh>

      <instancedMesh ref={rings} args={[null, null, RING_COUNT]} frustumCulled={false}>
        <ringGeometry args={[0.72, 1, 28]} />
        <meshBasicMaterial color={theme.accent} transparent opacity={0} side={2} depthWrite={false} />
      </instancedMesh>

      <instancedMesh ref={particles} args={[null, null, PARTICLE_COUNT]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={theme.coin} />
      </instancedMesh>

      <instancedMesh ref={streaks} args={[null, null, STREAK_COUNT]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={theme.cloud} transparent opacity={0} depthWrite={false} fog={false} />
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
    <Canvas style={{ flex: 1 }} camera={{ fov: FOV_BASE, near: 0.1, far: 900 }}>
      <World key={level.id} level={level} stateRef={stateRef} />
    </Canvas>
  );
});
