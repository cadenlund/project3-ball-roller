/**
 * The world the track hangs in.
 *
 * The track is a ribbon a very long way up, and the scene has to say so. A
 * graded sky that goes pale at the horizon and deep overhead; a low sun with
 * the haze it smears along the horizon; stars, because at this altitude the
 * sky above you is nearly black; banks of cloud drifting far below, and a
 * thinner veil of it overhead so the ball is flying *between* layers rather
 * than over one; and the ground so distant it is barely a suggestion.
 *
 * None of it is interactive. It exists so the drop has a floor you can almost
 * see, and so rolling off the edge reads as falling rather than as the level
 * simply ending.
 *
 * Everything is generated from theme colours and drawn with unlit vertex
 * colours or instancing - no textures, no shaders, nothing that behaves
 * differently on expo-gl than it does in a browser.
 */
import { memo, useMemo, useRef } from 'react';
import { BufferAttribute, Color, Object3D, SphereGeometry, Vector3 } from 'three';

import { useFrame } from './SceneCanvas';

export const CLOUD_COUNT = 44;
export const HIGH_CLOUD_COUNT = 16;
export const STAR_COUNT = 160;
const CLOUD_BAND = 320;    // how far along Z the cloud field repeats
const CLOUD_TOP = -14;     // the highest a low cloud may sit below the track
const CLOUD_BOTTOM = -110;
const HIGH_CLOUD_Y = 46;
const GROUND_Y = -230;
const SKY_RADIUS = 400;

/** Where the sun sits, as a direction. Low and off to one side, for long light. */
export const SUN_DIRECTION = new Vector3(0.46, 0.2, -0.86).normalize();

/**
 * A dome painted with a vertical gradient - zenith, the pale band at eye
 * level, and the dark haze below it - plus the sun's glow smeared into the
 * sky around it. All baked into vertex colours, so it behaves the same
 * everywhere and costs nothing per frame.
 */
function useSkyGeometry({ sky, horizon, ground, sun, haze }) {
  return useMemo(() => {
    const geometry = new SphereGeometry(SKY_RADIUS, 40, 28);
    const position = geometry.getAttribute('position');
    const zenith = new Color(sky);
    const band = new Color(horizon);
    const floor = new Color(ground);
    const glow = new Color(haze ?? horizon);
    const disc = new Color(sun ?? horizon);
    const colors = new Float32Array(position.count * 3);
    const mixed = new Color();
    const point = new Vector3();

    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).divideScalar(SKY_RADIUS);
      const h = point.y; // -1 at the nadir, +1 overhead
      if (h >= 0) {
        // Weight the blend low so the pale band stays a strip near eye level
        // rather than washing out the whole upper sky.
        mixed.copy(band).lerp(zenith, Math.pow(h, 0.45));
      } else {
        mixed.copy(band).lerp(floor, Math.pow(-h, 0.35));
      }

      // The sun. A tight core and a wide, soft bloom around it, added rather
      // than blended so it reads as light and not as a sticker.
      const toSun = Math.max(0, point.dot(SUN_DIRECTION));
      const bloom = Math.pow(toSun, 6) * 0.55 + Math.pow(toSun, 40) * 0.9;
      const core = Math.pow(toSun, 900);
      mixed.lerp(glow, Math.min(0.85, bloom));
      mixed.lerp(disc, Math.min(1, core));
      colors.set([mixed.r, mixed.g, mixed.b], i * 3);
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    return geometry;
  }, [sky, horizon, ground, sun, haze]);
}

/**
 * Deterministic scatter - no Math.random, so the weather is identical every
 * time a level is loaded and a replay looks like the run it replays.
 */
const frac = (v) => v - Math.floor(v);
const hash = (i, k) => frac(Math.sin(i * k) * 43758.5453);

function cloudField(count, { top, bottom, spread, band }) {
  return Array.from({ length: count }, (_, i) => ({
    x: (hash(i + 1, 12.9898) - 0.5) * spread,
    y: top + hash(i + 1, 78.233) * (bottom - top),
    z: hash(i + 1, 39.425) * band,
    radius: 9 + hash(i + 1, 27.61) * 24,
    drift: 0.5 + hash(i + 1, 51.07) * 1.6,
  }));
}

/** Stars sit on the dome itself, thickest overhead where the sky is darkest. */
function starField() {
  return Array.from({ length: STAR_COUNT }, (_, i) => {
    const a = hash(i + 1, 17.31) * Math.PI * 2;
    // Bias toward the zenith: low stars would sit in the bright haze anyway.
    const h = Math.pow(hash(i + 1, 63.7), 0.6);
    const r = Math.sqrt(1 - h * h);
    return {
      x: Math.cos(a) * r,
      y: h,
      z: Math.sin(a) * r,
      size: 0.5 + hash(i + 1, 91.3) * 1.3,
      twinkle: hash(i + 1, 5.11) * 6.28,
    };
  });
}

export const Sky = memo(function Sky({ theme, stateRef }) {
  const geometry = useSkyGeometry(theme);
  const clouds = useRef();
  const highClouds = useRef();
  const stars = useRef();
  const dome = useRef();
  const low = useMemo(
    () => cloudField(CLOUD_COUNT, { top: CLOUD_TOP, bottom: CLOUD_BOTTOM, spread: 260, band: CLOUD_BAND }),
    []
  );
  const high = useMemo(
    () => cloudField(HIGH_CLOUD_COUNT, { top: HIGH_CLOUD_Y, bottom: HIGH_CLOUD_Y + 34, spread: 300, band: CLOUD_BAND }),
    []
  );
  const sparks = useMemo(starField, []);
  const dummy = useMemo(() => new Object3D(), []);

  useFrame(({ camera }, dt) => {
    const s = stateRef.current;
    // The dome, the stars and the ground travel with the camera: they are
    // meant to be unreachably far away, and a fixed one would slide past as
    // the ball moves and give the distance away.
    if (dome.current) dome.current.position.set(camera.position.x, 0, camera.position.z);
    if (stars.current) stars.current.position.copy(camera.position);
    if (!s) return;

    // Wrap each bank around the ball so there is always weather below and
    // ahead, without carrying a cloud for every metre of a long level.
    const place = (mesh, field, squash) => {
      if (!mesh) return;
      for (let i = 0; i < field.length; i++) {
        const cloud = field[i];
        const drifted = cloud.z + cloud.drift * s.time * 0.6;
        const z = -(s.z + ((drifted - s.z) % CLOUD_BAND + CLOUD_BAND) % CLOUD_BAND - CLOUD_BAND * 0.25);
        dummy.position.set(cloud.x, cloud.y, z);
        dummy.scale.set(cloud.radius, cloud.radius * squash, cloud.radius * 0.8);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    place(clouds.current, low, 0.24);
    place(highClouds.current, high, 0.1);

    if (stars.current) {
      for (let i = 0; i < sparks.length; i++) {
        const star = sparks[i];
        dummy.position.set(star.x, star.y, star.z).multiplyScalar(SKY_RADIUS * 0.92);
        dummy.scale.setScalar(star.size * (0.7 + 0.3 * Math.sin(s.time * 1.6 + star.twinkle)));
        dummy.updateMatrix();
        stars.current.setMatrixAt(i, dummy.matrix);
      }
      stars.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <mesh ref={dome} geometry={geometry}>
        <meshBasicMaterial vertexColors side={1} fog={false} depthWrite={false} />
      </mesh>

      <instancedMesh ref={stars} args={[null, null, STAR_COUNT]} frustumCulled={false}>
        <sphereGeometry args={[1, 5, 4]} />
        <meshBasicMaterial color={theme.star ?? '#ffffff'} fog={false} depthWrite={false} transparent opacity={0.85} />
      </instancedMesh>

      {/* The ground, far enough down to be almost pure haze. */}
      <mesh position={[0, GROUND_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1600, 1600]} />
        <meshBasicMaterial color={theme.ground} fog={false} transparent opacity={0.55} />
      </mesh>

      {/* Cloud below, and a thinner veil above, so the track hangs between. */}
      <instancedMesh ref={clouds} args={[null, null, CLOUD_COUNT]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 7]} />
        <meshBasicMaterial color={theme.cloud} transparent opacity={0.16} depthWrite={false} fog={false} />
      </instancedMesh>
      <instancedMesh ref={highClouds} args={[null, null, HIGH_CLOUD_COUNT]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color={theme.cloud} transparent opacity={0.09} depthWrite={false} fog={false} />
      </instancedMesh>
    </>
  );
});
