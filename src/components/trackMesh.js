/**
 * Turns a track segment's centreline into geometry.
 *
 * A segment is no longer a box: it bends, weaves, climbs and dips, so the
 * deck has to be swept along the curve rather than stretched between two
 * corners. This walks the centreline in small steps and lays down a ribbon of
 * quads - the top surface, two skirts down its sides, and an underside - so
 * the track reads as one continuous solid rather than a chain of slabs.
 *
 * Geometry is built in the segment's own space: z runs from -halfLength to
 * +halfLength, x is offset from the piece's entry line and y from its entry
 * height, so a sliding platform is still just a group whose position moves.
 * The view flips z (see Scene.js), which is why every z here is negated.
 *
 * Pieces are meant to be indistinguishable from one continuous ribbon, so the
 * width is sampled along the piece rather than taken once - a narrowing
 * tapers across it instead of stepping in at the seam - and the caps at
 * either end are only drawn where the track actually stops.
 */
import { BufferAttribute, BufferGeometry } from 'three';

import { bankAt, centerAt, heightAt, widthAt } from '../game/levels';

export const DECK_THICKNESS = 1.1;
/**
 * Metres between centreline samples. The ribbon is a polyline, so this is
 * what decides whether a corner reads as a curve or as a row of facets -
 * and the bank rolls fastest exactly where the curve is tightest, so it
 * wants to be well under a metre.
 */
const STEP = 0.7;
const MIN_STEPS = 4;

/**
 * Sample the centreline of a segment at `time`, in the segment's own space.
 * The renderer uses this for the deck and the rails; the camera uses the same
 * numbers so what it frames is exactly what the ball is rolling on.
 */
export function sampleSegment(seg, time = 0) {
  const span = seg.z1 - seg.z0;
  const steps = Math.max(MIN_STEPS, Math.ceil(span / STEP));
  const mid = (seg.z0 + seg.z1) / 2;
  const samples = [];
  for (let i = 0; i <= steps; i++) {
    const z = seg.z0 + (span * i) / steps;
    samples.push({
      // Local to the group, which already sits at the piece's entry line.
      x: centerAt(seg, z, time) - centerAt(seg, seg.z0, time),
      y: heightAt(seg, z) - seg.y0,
      z: -(z - mid),
      half: widthAt(seg, z) / 2,
      // The same bank the physics uses, so the surface drawn under the ball
      // is the surface the ball is actually rolling on.
      bank: bankAt(seg, z),
    });
  }
  return samples;
}

/**
 * A closed ribbon: top deck, both skirts and an underside. Positions only -
 * `computeVertexNormals` works out the shading, and nothing here is textured,
 * so no UVs are needed.
 */
export function buildDeckGeometry(seg, { capStart = true, capEnd = true } = {}) {
  const samples = sampleSegment(seg, 0);

  // Four corners of the cross-section at every sample: top-left, top-right,
  // bottom-right, bottom-left, rolled by the local bank angle.
  const rings = samples.map(({ x, y, z, half, bank }) => {
    const cos = Math.cos(bank);
    const sin = Math.sin(bank);
    const corner = (across, down) => [
      x + across * cos - down * -sin,
      y + across * sin + down * cos,
      z,
    ];
    return [
      corner(-half, 0), corner(half, 0),
      corner(half, -DECK_THICKNESS), corner(-half, -DECK_THICKNESS),
    ];
  });

  const positions = [];
  const indices = [];
  for (const ring of rings) for (const [x, y, z] of ring) positions.push(x, y, z);

  // Stitch consecutive rings into four faces, then cap both ends so the piece
  // does not read as hollow where it meets a gap.
  //
  // Winding matters: the ribbon is swept toward -Z (the view flips the
  // engine's +Z), so a quad taken in ring order comes out facing *into* the
  // deck. Every face is wound the other way round, which puts the outward
  // side out - otherwise backface culling quietly removes the top of the
  // track and you look straight through it at the inside of its own skirts.
  for (let i = 0; i < rings.length - 1; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    for (let c = 0; c < 4; c++) {
      const d = (c + 1) % 4;
      indices.push(a + c, b + d, b + c, a + c, a + d, b + d);
    }
  }
  // Cap an end only where there is actually an opening. Two pieces that meet
  // with no gap between them would otherwise each draw a wall across the
  // joint - coplanar, unlit from the front, and clearly visible as a seam
  // straight across a track that is meant to be continuous.
  const last = (rings.length - 1) * 4;
  if (capStart) indices.push(0, 2, 1, 0, 3, 2);
  if (capEnd) indices.push(last + 0, last + 1, last + 2, last + 0, last + 2, last + 3);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** The glowing lips along both edges of the deck, as one thin ribbon. */
export function buildRailGeometry(seg) {
  const samples = sampleSegment(seg, 0);
  const positions = [];
  const indices = [];

  // Both rails in one geometry. They are drawn with the same unlit material
  // and never move independently, so keeping them apart only bought the scene
  // an extra draw call per segment - eighteen of them on a long level.
  for (const side of [-1, 1]) {
    const base = positions.length / 3;
    samples.forEach(({ x, y, z, half, bank }, i) => {
      const cos = Math.cos(bank);
      const sin = Math.sin(bank);
      const lip = half - 0.04;
      for (const across of [side * lip - 0.05, side * lip + 0.05]) {
        positions.push(x + across * cos, y + across * sin + 0.03, z);
      }
      if (i > 0) {
        // Same winding rule as the deck: outward is up, for the same reason.
        const a = base + (i - 1) * 2;
        indices.push(a, a + 3, a + 2, a, a + 1, a + 3);
      }
    });
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
