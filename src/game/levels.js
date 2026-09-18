/**
 * Level definitions and track geometry.
 *
 * A level is a ribbon of track threaded through open sky, running along the
 * +Z axis. The ball rolls forward on its own; the player steers it along a
 * centreline that bends, weaves, climbs and drops, and tries not to fall off
 * into the clouds.
 *
 * Levels are authored as a `run`: an ordered list of pieces laid end to end,
 * each of which says how the centreline evolves across it rather than where
 * it sits in the world. A piece carries:
 *
 *   length  - how far it runs along Z
 *   width   - how wide the deck is by the END of the piece; it starts as wide
 *             as the piece before it and tapers across, so the track never
 *             steps from one width to another at a seam
 *   gap     - empty space after it, to be jumped
 *   bend    - lateral metres swept across the piece, eased in and out, so a
 *             run of bends reads as one continuous sweeping curve
 *   wave    - { amplitude, cycles } weaving inside the piece, tapered at both
 *             ends so it grows out of, and settles back into, straight track
 *   rise    - metres of elevation gained (or lost) across the piece
 *   step    - metres up or down from where the last piece ended, before this
 *             one starts. Only makes sense across a gap: it is a cliff, and
 *             the jump has to carry the difference
 *   crest   - a hump: +metres arcs the middle of the piece up into a hill you
 *             can launch off, -metres scoops it into a dip that builds speed
 *   moving  - { amplitude, speed, phase } to slide the whole deck sideways
 *
 * A level may also carry `spurs`: side lanes that run *alongside* the main
 * one rather than after it. A spur is an ordinary `run` given its own
 * starting z, x and height, so two pieces of track can occupy the same stretch
 * of the level at different lateral positions - a fork. That is what lets a
 * stage ask a question the player has to leave the racing line to answer, and
 * it is the only way a route can double back: a dead-end spur has to be
 * driven out of in reverse.
 *
 * Only `length` and `width` are ever required. Every piece starts where the
 * last one ended - same lateral position, same height - so authoring a level
 * is describing a journey, not bookkeeping coordinates. `buildLevel` resolves
 * that into the absolute segments the engine and the renderer share.
 *
 * cannons  - roll in and it holds you, then fires you along a fixed aim. The
 *             aim never changes, so the puzzle is never "how do I shoot this"
 *             - it is "which cannon do I need, and how do I get into it"
 * ballast   - roll over one to change the ball's mass. A heavy ball is shoved
 *             around less and launches less far; a light one is thrown a long
 *             way and pushed about by everything. Some doors only a heavy
 *             ball can open, and some jumps only a light one can make
 * switches - roll over one to open every gate that shares its `id`. `needs`
 *            makes it a weighted plate, which ignores a ball too light to
 *            press it; `hold` makes it a timer, which shuts again
 * gates    - a barrier across the deck; it stops the ball dead until the
 *            switch that opens it has been hit. This is the level's lock and
 *            key: what makes a stage a puzzle rather than a test of nerve is
 *            that the way on is shut, and the way to open it is somewhere you
 *            have to notice and go and get
 * pads     - bounce pads; roll over one to launch and clear the next gap
 * boosters - speed pads; they slam the ball past its normal cruising speed,
 *            and with `launch` they double as ramps, throwing the ball
 *            into the air with the speed
 * spinners - bars that sweep the track and shove the ball sideways
 * coins    - optional pickups, worth points; `lift` is height over the deck
 * goalZ    - cross this line to finish (computed: near the end of the run)
 * speed    - the ball's cruising speed under tilt alone, world units/s
 * parTime  - seconds; finishing under par is worth bonus points
 */

/**
 * Gravity lives here rather than in the engine because the geometry needs it
 * too: how hard a corner is banked is a question about what speed balances it.
 */
export const GRAVITY = 55; // world units/s^2
export const BALL_RADIUS = 0.5;
export const COIN_RADIUS = 0.9;
export const PAD_RADIUS = 1.6;
export const BOOST_RADIUS = 1.7;
/** Boosters hover over the deck rather than lying flush in it. */
export const BOOST_LIFT = 0.55;
export const SWITCH_RADIUS = 1.7;
export const CANNON_RADIUS = 1.8;
export const BALLAST_RADIUS = 1.7;
export const BALLAST_LIFT = 0.6;  // it hovers, like a booster
export const CANNON_HOLD = 0.7;   // seconds in the barrel before it fires
export const GATE_HALF = 0.4;     // half the thickness of a closed gate
export const GATE_HEIGHT = 2.4;   // a launched ball can clear it; a rolling one cannot
export const SPINNER_HALF_WIDTH = 0.35;
export const SPINNER_HEIGHT = 1.6;    // a launched ball flies clear above this
export const SPINNER_LIFT = 0.6;      // how high over the deck a bar pivots
export const SPINNER_BAR_HALF = 0.25; // half the bar's own thickness

/**
 * How far below the lowest piece of track the ball has to sink before the run
 * is lost. Relative, because a level that climbs to fifty metres would
 * otherwise take an age to "fall" past a fixed line - and one that dives
 * below it would lose the ball while it was still on the deck.
 */
export const FALL_DEPTH = 7;
export const FALL_Y = -FALL_DEPTH; // the fall line of a level that never leaves y=0

/** Shared semantic colors, also available to menu cards and future levels. */
export const DEFAULT_THEME = Object.freeze({
  background: '#171025', fog: '#171025', track: '#785470', trackGlow: '#382139',
  edge: '#f9b8ce', accent: '#f9b8ce', pad: '#ffb44c', padGlow: '#e87129',
  boost: '#7cff9d', boostGlow: '#18b552',
  switchOff: '#ff9d7a', switchOn: '#9dffb4', gate: '#ff7d6a', gateGlow: '#a8281c',
  cannon: '#cdb5ff', cannonGlow: '#6a3ecb',
  heavy: '#8fa0b8', heavyGlow: '#3c4a5e', light: '#ffe9a8', lightGlow: '#d19b2a',
  spinner: '#ff655e', spinnerGlow: '#9c2637', coin: '#ffe38c', coinGlow: '#f5a636',
  ball: '#fff4e6', ballGlow: '#ffb477', goal: '#85f5dd', goalGlow: '#28a894',
  keyLight: '#ffe1cb', rimLight: '#d5acff',
  // The sky the track hangs in: zenith overhead, horizon at eye level, and the
  // cloud deck far below that sells the drop. `sun` is the low star the key
  // light comes from, and `haze` the band of light it smears along the horizon.
  sky: '#3b2b5c', horizon: '#c98fa8', cloud: '#e8cdd8', ground: '#2a1c33',
  sun: '#ffd9b0', haze: '#ff9e7a', star: '#fff4e6',
});

const LEVEL_THEMES = [
  {}, // dusk rose
  { background: '#08182a', fog: '#08182a', track: '#345d82', trackGlow: '#183655',
    edge: '#9edfff', accent: '#9edfff', ballGlow: '#9edfff', keyLight: '#d9eeff', rimLight: '#80bfff',
    sky: '#0d2c4d', horizon: '#7fc4e8', cloud: '#cfeaff', ground: '#0a2136' },
  { background: '#082420', fog: '#082420', track: '#397b70', trackGlow: '#16453f',
    edge: '#a2f7dc', accent: '#a2f7dc', ballGlow: '#89eacd', goal: '#e7ff9b', keyLight: '#dcffe9', rimLight: '#7bdad0',
    sky: '#0b3c35', horizon: '#8fe3c6', cloud: '#d3fff0', ground: '#0a2e2a' },
  { background: '#2a1020', fog: '#2a1020', track: '#884660', trackGlow: '#4d2038',
    edge: '#ffc1a4', accent: '#ffc1a4', spinner: '#ff8e63', spinnerGlow: '#bb432d', ballGlow: '#ffc1a4',
    keyLight: '#ffe0bc', rimLight: '#fa9fb4',
    sky: '#48203a', horizon: '#ffae8d', cloud: '#ffdccb', ground: '#33162a' },
  { background: '#11112e', fog: '#11112e', track: '#595084', trackGlow: '#302552',
    edge: '#d2c2ff', accent: '#d2c2ff', pad: '#ffc266', coin: '#fff0a6', ballGlow: '#cdb1ff',
    keyLight: '#f1dcff', rimLight: '#9ba7ff',
    sky: '#1d1a4a', horizon: '#a99cff', cloud: '#ddd6ff', ground: '#151233' },
  // 6 - deep sea: the sliding decks read best over cold, empty water.
  { background: '#04242c', fog: '#04242c', track: '#2e6b78', trackGlow: '#123a44',
    edge: '#9ff0ff', accent: '#9ff0ff', ballGlow: '#9ff0ff', goal: '#c7ff8f', keyLight: '#dbfaff', rimLight: '#6fd2e8',
    sky: '#073844', horizon: '#79d7e8', cloud: '#c8f4ff', ground: '#052a33' },
  // 7 - ballast: iron and rust, for a level about what things weigh.
  { background: '#241610', fog: '#241610', track: '#7a5340', trackGlow: '#402a1e',
    edge: '#ffcf9e', accent: '#ffcf9e', heavy: '#7f8ca3', light: '#fff0b8',
    ballGlow: '#ffcf9e', goal: '#a8ffd0', keyLight: '#ffe6c8', rimLight: '#c08f6a',
    sky: '#3a2417', horizon: '#e3a271', cloud: '#f7ddc4', ground: '#1a0f09' },
  // 8 - the battery: violet powder-smoke, for a level made of cannons.
  { background: '#1c0a2e', fog: '#1c0a2e', track: '#5d3a86', trackGlow: '#301a4b',
    edge: '#e0bcff', accent: '#e0bcff', cannon: '#d8c4ff', cannonGlow: '#7a4ae0',
    ballGlow: '#e0bcff', goal: '#9dffc4', keyLight: '#f4e4ff', rimLight: '#9d7ae8',
    sky: '#2b0f44', horizon: '#c48fe8', cloud: '#e8d4f7', ground: '#150722' },
  // 9 - corkscrew: the descent, in cold slate and low sun.
  { background: '#1b1a2b', fog: '#1b1a2b', track: '#4e4d70', trackGlow: '#282740',
    edge: '#ffc48f', accent: '#ffc48f', ballGlow: '#ffc48f', goal: '#8ff5c4',
    keyLight: '#ffe3c4', rimLight: '#8f9ce0',
    sky: '#242240', horizon: '#ffab7a', cloud: '#ffd9c0', ground: '#171626' },
  // 10 - the balance: almost nothing, so the thread of track is the picture.
  { background: '#060a14', fog: '#060a14', track: '#2c3a55', trackGlow: '#111a2c',
    edge: '#eaf4ff', accent: '#eaf4ff', coin: '#fff6c9', ballGlow: '#eaf4ff',
    goal: '#9dffdc', keyLight: '#f4faff', rimLight: '#5f7fbd',
    sky: '#0a1426', horizon: '#5d7ea8', cloud: '#9fb6d4', ground: '#04070f' },
  // 11 - the vault: cold green stone and brass, for a level that is a lock.
  { background: '#0a2226', fog: '#0a2226', track: '#3c6b63', trackGlow: '#17403c',
    edge: '#c8f0d8', accent: '#c8f0d8', pad: '#ffcf6b', coin: '#ffe9a8',
    switchOff: '#ff8d6b', switchOn: '#9dffb4', gate: '#ff7d6a', gateGlow: '#a8281c',
    ballGlow: '#c8f0d8', goal: '#ffe07a', keyLight: '#e6fff2', rimLight: '#74c8d8',
    sky: '#0e3a3c', horizon: '#86d6bf', cloud: '#cdf2e4', ground: '#082024' },
  // 12 - midnight gold again for the finale, one shade colder.
  { background: '#07101f', fog: '#07101f', track: '#3a4675', trackGlow: '#1b2242',
    edge: '#ffd98a', accent: '#ffd98a', pad: '#ffd166', coin: '#fff4b0',
    ballGlow: '#ffd98a', goal: '#7cf2c9', keyLight: '#fff0d0', rimLight: '#8fa6ff',
    sky: '#101a34', horizon: '#93a0d2', cloud: '#d2daf6', ground: '#060d1a' },
];

/* ---------------------------------------------------------------------------
 * Centreline shape
 *
 * Every piece is parameterised by u, running 0 to 1 along its length. The
 * shaping functions below all go to zero at u=0 and u=1 in their value, their
 * slope *and* their curvature. Position and heading matching is what stops a
 * seam being a visible kink; matching curvature as well is what stops it
 * being a visible *crease*, and it is the same idea as the clothoid
 * transitions real roads use - curvature ramps in and out rather than
 * switching on. It also means the banking below, which is driven by
 * curvature, is continuous across every joint instead of snapping.
 * ------------------------------------------------------------------------ */

/** Smootherstep: a unit of change eased in and out, flat to second order. */
const ease = (u) => u * u * u * (u * (6 * u - 15) + 10);
const easeSlope = (u) => 30 * u * u * (u - 1) * (u - 1);
const easeCurve = (u) => u * (120 * u * u - 180 * u + 60);

/** A hump peaking at 1 halfway along, flat to second order at both ends. */
const hump = (u) => Math.sin(Math.PI * u) ** 4;
const humpSlope = (u) => 4 * Math.PI * Math.sin(Math.PI * u) ** 3 * Math.cos(Math.PI * u);
const humpCurve = (u) => {
  const s = Math.sin(Math.PI * u);
  const c = Math.cos(Math.PI * u);
  return 4 * Math.PI * Math.PI * s * s * (3 * c * c - s * s);
};

/**
 * How hard the deck leans into a turn.
 *
 * Banking is not decoration: it tips the surface so part of the sideways force
 * the ball needs to get round a corner comes out of gravity instead of out of
 * steering, which is exactly what it does on a real road. The angle that
 * balances a corner exactly is tan(b) = v^2 * curvature / g, so the bank is
 * derived from that and not from a number picked for looks. Lean harder than
 * balance and the camber stops being grip and becomes a slide the player has
 * to fight; a gentle bend then leans gently and a tight one leans hard, which
 * is what makes the lean readable as information about the corner.
 */
export const BANK_BALANCE = 1.3; // a shade over balanced, so corners help
export const MAX_BANK = 0.42;    // radians, about 24 degrees, whatever happens
export const DEFAULT_SPEED = 11;
const TAN_MAX_BANK = Math.tan(MAX_BANK);
const DEFAULT_BANK_SCALE = (BANK_BALANCE * DEFAULT_SPEED * DEFAULT_SPEED) / GRAVITY;

/**
 * The weave window. A raw sine would leave the piece heading off at an angle
 * at both ends; multiplying by sin^2 grows the weave out of straight track
 * and settles it back down before the seam.
 */
const window2 = (u) => Math.sin(Math.PI * u) ** 2;
const window2Slope = (u) => Math.PI * Math.sin(2 * Math.PI * u);
const window2Curve = (u) => 2 * Math.PI * Math.PI * Math.cos(2 * Math.PI * u);

/** Where along its own length z falls on a piece, clamped to its ends. */
export function segmentU(seg, z) {
  const span = seg.z1 - seg.z0;
  return span > 0 ? Math.max(0, Math.min(1, (z - seg.z0) / span)) : 0;
}

function waveAt(seg, u) {
  if (!seg.wave) return 0;
  const { amplitude, cycles, phase = 0 } = seg.wave;
  return amplitude * Math.sin(2 * Math.PI * cycles * u + phase) * window2(u);
}

function waveSlope(seg, u) {
  if (!seg.wave) return 0;
  const { amplitude, cycles, phase = 0 } = seg.wave;
  const angle = 2 * Math.PI * cycles * u + phase;
  return amplitude * (
    2 * Math.PI * cycles * Math.cos(angle) * window2(u) +
    Math.sin(angle) * window2Slope(u)
  );
}

function waveCurve(seg, u) {
  if (!seg.wave) return 0;
  const { amplitude, cycles, phase = 0 } = seg.wave;
  const angle = 2 * Math.PI * cycles * u + phase;
  const w = 2 * Math.PI * cycles;
  return amplitude * (
    -w * w * Math.sin(angle) * window2(u) +
    2 * w * Math.cos(angle) * window2Slope(u) +
    Math.sin(angle) * window2Curve(u)
  );
}

/**
 * How far a segment has slid sideways from its authored line at `time`. Zero
 * for ordinary track; a moving platform swings as a sine so it is continuous,
 * reversible and identical on every replay of the same moment.
 */
export function segmentShift(seg, time) {
  if (!seg.moving) return 0;
  const { amplitude, speed, phase = 0 } = seg.moving;
  return amplitude * Math.sin(phase + speed * time);
}

/** Lateral centre of the deck at z: the bend, the weave, and any sliding. */
export function centerAt(seg, z, time = 0) {
  if (seg.straight) return seg.x + segmentShift(seg, time);
  const u = segmentU(seg, z);
  return seg.x + (seg.bend ?? 0) * ease(u) + waveAt(seg, u) + segmentShift(seg, time);
}

/** Height of the deck surface at z. */
export function heightAt(seg, z) {
  if (seg.level) return seg.y0;
  const u = segmentU(seg, z);
  return seg.y0 + (seg.y1 - seg.y0) * ease(u) + (seg.crest ?? 0) * hump(u);
}

/** How wide the deck is at z: it tapers from w0 to width across the piece. */
export function widthAt(seg, z) {
  if (seg.w0 === seg.width) return seg.width;
  return seg.w0 + (seg.width - seg.w0) * ease(segmentU(seg, z));
}

/** dy/dz of the deck - the slope gravity drags the ball along. */
export function slopeAt(seg, z) {
  if (seg.level) return 0;
  const span = seg.z1 - seg.z0;
  if (span <= 0) return 0;
  const u = segmentU(seg, z);
  return ((seg.y1 - seg.y0) * easeSlope(u) + (seg.crest ?? 0) * humpSlope(u)) / span;
}

/** dx/dz of the centreline - which way the track is heading under the ball. */
export function driftAt(seg, z) {
  if (seg.straight) return 0;
  const span = seg.z1 - seg.z0;
  if (span <= 0) return 0;
  const u = segmentU(seg, z);
  return ((seg.bend ?? 0) * easeSlope(u) + waveSlope(seg, u)) / span;
}

/** d2x/dz2 - how hard the track is *turning*, which is what sets the bank. */
export function curvatureAt(seg, z) {
  if (seg.straight) return 0;
  const span = seg.z1 - seg.z0;
  if (span <= 0) return 0;
  const u = segmentU(seg, z);
  return ((seg.bend ?? 0) * easeCurve(u) + waveCurve(seg, u)) / (span * span);
}

/**
 * The roll of the deck at z. Negative curvature (a left-hander) raises the
 * right-hand edge and vice versa, so the track always leans into its corner
 * and never away from it.
 */
/**
 * The *tangent* of the bank angle, which is what almost everything actually
 * wants: the surface height across the deck is offset * tan(bank), the camber
 * force is g * tan / (1 + tan^2), and the width across a lean is
 * offset * sqrt(1 + tan^2).
 *
 * Because the angle is atan of the balance term, and tan(atan(v)) is just v,
 * this is exact with no trigonometry at all - and clamping the angle to
 * MAX_BANK is the same as clamping v to tan(MAX_BANK), since atan is
 * monotonic. That removes an arctangent and a tangent from every call in the
 * hot path, which at 120Hz with catch-up is most of the geometry's cost.
 *
 * seg.bankScale is BANK_BALANCE * speed^2 / g, fixed when the level is built:
 * a corner is banked for the speed it is meant to be taken at.
 */
export function bankTanAt(seg, z) {
  if (seg.straight) return 0;
  const v = curvatureAt(seg, z) * (seg.bankScale ?? DEFAULT_BANK_SCALE);
  return -Math.max(-TAN_MAX_BANK, Math.min(TAN_MAX_BANK, v));
}

/** The bank as an angle. For the renderer and for anything reasoning in radians. */
export function bankAt(seg, z) {
  return Math.atan(bankTanAt(seg, z));
}

/** 1 / cos(bank), as a square root rather than a trig call. */
export function bankSecAt(seg, z) {
  const tan = bankTanAt(seg, z);
  return tan === 0 ? 1 : Math.sqrt(1 + tan * tan);
}

/**
 * How far a world x is from the centreline, measured *along the banked deck*
 * rather than horizontally. This is the number that decides whether the ball
 * is still on the track, and it is what the deck's own width is measured in.
 */
export function acrossAt(seg, x, z, time = 0) {
  return (x - centerAt(seg, z, time)) * bankSecAt(seg, z);
}

/**
 * The height of the deck surface under a world (x, z). On a banked corner the
 * outside edge is genuinely higher than the inside, so where the ball sits
 * depends on which side of the deck it is on - without this the ball rides
 * the flat centreline height and visibly sinks into the raised half.
 */
export function surfaceAt(seg, x, z, time = 0) {
  // across * sin(bank) is (x - centre)/cos(bank) * sin(bank), which is just
  // (x - centre) * tan(bank).
  const tan = bankTanAt(seg, z);
  return heightAt(seg, z) + (tan === 0 ? 0 : (x - centerAt(seg, z, time)) * tan);
}

/**
 * How fast the deck surface is moving up or down under a ball travelling at
 * (vx, vz) - the total derivative of `surfaceAt` along the ball's path.
 *
 * This is what a grounded ball has to match to stay on the track, and the
 * sideways half of it is not optional: on a banked corner the surface falls
 * away across its own width, so a ball sliding down the camber is running off
 * a descent even where the track is perfectly level along its length. Match
 * only the length-wise slope and the deck drops out from under the ball on
 * every corner it leans into.
 *
 * d/dz is taken numerically because the centreline, the height and the bank
 * angle all vary along z and it is their combined effect that matters; d/dx
 * is just the camber, which is exact.
 */
const SURFACE_EPS = 0.05;
export function surfaceRate(seg, x, z, vx, vz, time = 0) {
  // Only a piece that never bends can skip the camber terms. Bailing out on
  // the bank angle being zero *here* would be wrong: curvature passes through
  // zero in the middle of every bend, and that is exactly where the lean is
  // changing fastest.
  if (seg.straight) return slopeAt(seg, z) * vz;
  const tan = bankTanAt(seg, z);

  // The surface is Y = h(z) + (x - c(z)) * t(z), so dY/dz at fixed x is
  // h' - c'*t + (x - c)*t' - the centreline climbing, the centreline sliding
  // out from under a leaning deck, and the lean itself opening or closing.
  // Only t' needs a numerical derivative, and because t is the clamped
  // curvature term rather than an angle, that derivative is taken on
  // curvature - the cheapest thing in the chain, not the whole surface.
  const scale = seg.bankScale ?? DEFAULT_BANK_SCALE;
  const offset = x - centerAt(seg, z, time);
  // At the clamp the lean has stopped changing, so t' is simply zero.
  let dTan = 0;
  if (Math.abs(curvatureAt(seg, z) * scale) < TAN_MAX_BANK) {
    dTan =
      -((curvatureAt(seg, z + SURFACE_EPS) - curvatureAt(seg, z - SURFACE_EPS)) * scale) /
      (2 * SURFACE_EPS);
  }
  const alongZ = slopeAt(seg, z) - driftAt(seg, z) * tan + offset * dTan;
  return alongZ * vz + tan * vx;
}

/** Where a segment's centre sits at its midpoint - a whole-piece summary. */
export function segmentCenter(seg, time = 0) {
  return centerAt(seg, (seg.z0 + seg.z1) / 2, time);
}

/** Lateral position a piece hands over to its neighbour, and inherits. */
export const entryX = (seg) => seg.x;
export const exitX = (seg) => seg.x + (seg.bend ?? 0);

/**
 * The track segment under (x, z) at `time`, or null - null underfoot means
 * falling. `time` only matters where a level uses moving platforms.
 */
export function segmentAt(level, x, z, time = 0) {
  // Called several times per physics step, and the physics runs at 120Hz with
  // catch-up, so this is written as a plain loop that works the bank angle out
  // once rather than as a predicate that derives it twice.
  const segments = level.segments;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (z < seg.z0 || z > seg.z1) continue;
    const offset = x - centerAt(seg, z, time);
    const across = offset * bankSecAt(seg, z);
    if (Math.abs(across) <= widthAt(seg, z) / 2 + BALL_RADIUS * 0.4) return seg;
  }
  return null;
}

/**
 * The centreline at any z at all, on the track or not - what the camera aims
 * at and the autopilot steers for. Over a gap it runs the straight line the
 * ball would fly; past either end it holds the nearest piece's line, so there
 * is never a frame with nothing to look at.
 */
export function trackPointAt(level, z, time = 0, nearX = null) {
  const segs = level.segments;
  // Where a level forks there is more than one answer, so the caller says
  // which lane it means by passing the x it is asking from - the camera and
  // the driver both mean "the track I am on", not "the first one listed".
  let on = null;
  let onX = null;
  let bestGap = Infinity;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (z < seg.z0 || z > seg.z1) continue;
    if (nearX == null) { on = seg; break; }
    const centre = centerAt(seg, z, time);
    const gap = Math.abs(centre - nearX);
    if (gap < bestGap) { bestGap = gap; on = seg; onX = centre; }
  }
  if (on) return { x: onX ?? centerAt(on, z, time), y: heightAt(on, z), segment: on };

  const spine = level.mainSegments ?? segs;
  const first = spine[0];
  if (z < first.z0) {
    return { x: centerAt(first, first.z0, time), y: heightAt(first, first.z0), segment: null };
  }
  const last = spine[spine.length - 1];
  if (z > last.z1) {
    return { x: centerAt(last, last.z1, time), y: heightAt(last, last.z1), segment: null };
  }

  const next = spine.find((s) => s.z0 > z);
  const prev = spine[spine.indexOf(next) - 1];
  const t = (z - prev.z1) / (next.z0 - prev.z1);
  return {
    x: centerAt(prev, prev.z1, time) * (1 - t) + centerAt(next, next.z0, time) * t,
    y: heightAt(prev, prev.z1) * (1 - t) + heightAt(next, next.z0) * t,
    segment: null,
  };
}

/**
 * Lay one chain of pieces end to end from a starting point. The main run and
 * every spur are built by the same code - a spur is only a run that starts
 * somewhere other than the beginning of the level.
 */
function layRun(run, { z = 0, x = 0, y = 0, lane = 0 } = {}) {
  const segments = [];
  let w; // width handed on from the previous piece, so narrowings taper

  for (const piece of run) {
    const startX = piece.x ?? x;
    const startY = piece.y ?? y + (piece.step ?? 0);
    const seg = {
      z0: z,
      z1: z + piece.length,
      x: startX,
      // w0 is where the deck starts wide, `width` where it ends up. Inheriting
      // w0 from the piece before is what keeps the edges of the track
      // continuous through a narrowing rather than stepping in at the seam.
      w0: piece.entryWidth ?? w ?? piece.width,
      width: piece.width,
      bend: piece.bend ?? 0,
      y0: startY,
      y1: startY + (piece.rise ?? 0),
      crest: piece.crest ?? 0,
      ...(piece.wave ? { wave: { phase: 0, ...piece.wave } } : {}),
      ...(piece.moving ? { moving: piece.moving } : {}),
      lane,
    };
    segments.push(seg);
    x = exitX(seg);
    y = seg.y1;
    w = seg.width;
    z = seg.z1 + (piece.gap ?? 0);
  }
  return { segments, end: z };
}

/**
 * The height a ball resting on the deck would sit at, for any (x, z) at all -
 * on the track, off the side of it, or out over a gap.
 *
 * Off the edge this extends the deck's own plane outward, and over a gap it
 * follows the line a jump would take. That is what lets the engine ask the
 * question it actually needs answered: was the ball above the track a moment
 * ago, or is it already below it and on its way down?
 */
export function deckPlaneAt(level, x, z, time = 0) {
  const seg = segmentAt(level, x, z, time);
  if (seg) return surfaceAt(seg, x, z, time) + BALL_RADIUS * bankSecAt(seg, z);
  const point = trackPointAt(level, z, time, x);
  if (point.segment) {
    return surfaceAt(point.segment, x, z, time) + BALL_RADIUS * bankSecAt(point.segment, z);
  }
  return point.y + BALL_RADIUS; // over a gap: the line the jump follows
}

/** Expand a raw level into segments with absolute spans, plus start/goal. */
export function buildLevel(raw) {
  const main = layRun(raw.run);
  const segments = [...main.segments];
  // Spurs are appended after the main chain, so `segments` still opens with
  // the level's spine and anything walking it in order reads the main route.
  (raw.spurs ?? []).forEach((spur, i) => {
    segments.push(...layRun(spur.run, {
      z: spur.z, x: spur.x ?? 0, y: spur.y ?? 0, lane: i + 1,
    }).segments);
  });

  const speed = raw.speed ?? DEFAULT_SPEED;
  for (const seg of segments) {
    seg.bankScale = (BANK_BALANCE * speed * speed) / GRAVITY;
    // Most pieces are straight, or level, or both. Saying so once here is
    // what lets the hot path skip the trig and the arctangent behind a bank
    // angle that is always going to come out zero.
    seg.straight = !seg.bend && !seg.wave;
    seg.level = seg.y0 === seg.y1 && !seg.crest;
  }

  const mainSegments = main.segments;
  const last = mainSegments[mainSegments.length - 1];
  const z = main.end;
  const level = { segments, mainSegments, totalLength: z };
  const goalZ = raw.goalZ ?? last.z1 - 2;

  // Props are authored by where they sit on the track, not by where they sit
  // in the world: `across` is metres from the centreline and `lift` is metres
  // above the deck. A coin stays a coin whether the track under it runs
  // straight and level or banks through a curve forty metres up.
  const place = (thing, defaultLift) => {
    const lift = thing.lift ?? defaultLift;
    const point = trackPointAt(level, thing.z);
    return {
      ...thing,
      lift,
      x: thing.x ?? point.x + (thing.across ?? 0),
      y: thing.y ?? point.y + lift,
    };
  };

  const heights = segments.flatMap((seg) =>
    // Sample rather than just taking the ends: a dip sinks below both of them.
    Array.from({ length: 9 }, (_, i) => heightAt(seg, seg.z0 + ((seg.z1 - seg.z0) * i) / 8))
  );

  return {
    pads: [],
    spinners: [],
    coins: [],
    boosters: [],
    switches: [],
    gates: [],
    cannons: [],
    ballast: [],
    ...raw,
    theme: { ...DEFAULT_THEME, ...LEVEL_THEMES[raw.id - 1], ...raw.theme },
    segments,
    mainSegments,
    totalLength: z,
    goalZ,
    goalX: centerAt(last, goalZ, 0),
    goalY: heightAt(last, goalZ),
    fallY: Math.min(...heights) - FALL_DEPTH,
    pads: (raw.pads ?? []).map((p) => place(p, 0)),
    boosters: (raw.boosters ?? []).map((b) => place(b, BOOST_LIFT)),
    spinners: (raw.spinners ?? []).map((sp) => {
      const placed = place(sp, SPINNER_LIFT);
      const seg = segments.find((g) => sp.z >= g.z0 && sp.z <= g.z1);
      if (!seg) return placed;
      // Mounted in the plane of the deck, and lifted by whatever the track's
      // own curvature bulges above that plane across the sweep.
      return {
        ...placed,
        pitch: slopeAt(seg, sp.z),
        roll: bankAt(seg, sp.z),
        y: sp.y ?? surfaceAt(seg, placed.x, sp.z, 0) + sweepClearance(level, placed, seg) + (sp.lift ?? SPINNER_LIFT),
      };
    }),
    coins: (raw.coins ?? []).map((c) => place(c, 0.9)),
    switches: (raw.switches ?? []).map((w) => place(w, 0)),
    gates: (raw.gates ?? []).map((g) => place(g, 0)),
    cannons: (raw.cannons ?? []).map((c) => place(c, 0)),
    // A route is a list of places on the track, so it is placed like one.
    ...(raw.route ? { route: raw.route.map((p) => place(p, 0)) } : {}),
    ballast: (raw.ballast ?? []).map((b) => place(b, BALLAST_LIFT)),
    // Where the first segment actually is at t=0, not where it was authored:
    // a level opening on a moving platform would otherwise spawn the ball
    // beside the deck rather than on it.
    start: {
      x: centerAt(mainSegments[0], 3, 0),
      y: heightAt(mainSegments[0], 3),
      z: 3,
    },
  };
}

/**
 * How far a spinner's bar has to be held off the deck under its pivot.
 *
 * A bar is a long rigid thing on a track that is neither flat nor level, so
 * it is mounted in the plane of the deck it sits on - pitched down the slope
 * and rolled with the camber - and turns in that plane. What is left is only
 * the track's *curvature*: over the length of the sweep the real surface
 * bulges above that flat plane on a crest or inside a bend, and the bar has
 * to clear the worst of it. Hanging it level instead would mean lifting it by
 * the whole fall of the slope, high enough to roll underneath.
 */
export function sweepClearance(level, sp, seg) {
  const slope = slopeAt(seg, sp.z);
  const bank = bankAt(seg, sp.z);
  const deck = surfaceAt(seg, sp.x, sp.z, 0);
  const reach = sp.length / 2 + SPINNER_BAR_HALF;
  let worst = 0;
  for (let i = 0; i < 48; i++) {
    const angle = (i * 2 * Math.PI) / 48;
    for (const r of [reach, reach * 0.66, reach * 0.33]) {
      const x = sp.x + Math.cos(angle) * r;
      const z = sp.z + Math.sin(angle) * r;
      const under = level.segments.find((g) => z >= g.z0 && z <= g.z1);
      if (!under) continue;
      const plane = deck + (z - sp.z) * slope + (x - sp.x) * Math.tan(bank);
      worst = Math.max(worst, surfaceAt(under, x, z, 0) - plane);
    }
  }
  return worst;
}

/**
 * Everything that can launch the ball over a gap, and how high it throws it.
 *
 * A pad delivers an impulse, so how high it throws the ball depends on what
 * the ball weighs - and a level with ballast on it is a level where the
 * lightest weight available is part of the answer. The apex here is therefore
 * the best case: what the gap needs is that it can be cleared, not that it
 * can be cleared at any weight.
 */
export function launchers(level) {
  const lightest = Math.min(1, ...(level.ballast ?? []).map((b) => b.mass));
  const apex = (impulse) => (impulse / lightest) ** 2 / (2 * GRAVITY);
  return [
    ...level.pads.map((p) => ({ z: p.z, apex: apex(p.power), speed: 1 })),
    ...level.boosters
      .filter((b) => b.launch)
      .map((b) => ({ z: b.z, apex: apex(b.launch), speed: b.speed ?? 1 })),
  ];
}

/**
 * Fly a cannon's shot and report where it comes down. A cannon's aim is
 * fixed, so where it puts the ball is a fact about the level rather than
 * about the player - and it had better be somewhere there is track.
 */
export function cannonShot(level, cannon, { dt = 1 / 120, maxSeconds = 12 } = {}) {
  let x = cannon.x;
  let y = cannon.y + BALL_RADIUS;
  let z = cannon.z;
  let vx = cannon.aim.x ?? 0;
  let vy = cannon.aim.y ?? 0;
  let vz = cannon.aim.z ?? 0;
  let apex = y;
  for (let t = 0; t < maxSeconds; t += dt) {
    vy -= GRAVITY * dt;
    x += vx * dt;
    y += vy * dt;
    z += vz * dt;
    apex = Math.max(apex, y);
    if (t < 0.1) continue; // clear of the barrel before looking for ground
    const seg = segmentAt(level, x, z, 0);
    if (seg && y <= surfaceAt(seg, x, z, 0) + BALL_RADIUS * bankSecAt(seg, z)) {
      return { x, y, z, t, apex, landed: true, segment: seg };
    }
    if (y < level.fallY) break;
  }
  return { x, y, z, apex, landed: false, segment: null };
}

/**
 * A note on launching: a grounded ball rides the deck, so it keeps whatever
 * vertical speed the slope under it implies. Roll off the top of a crest
 * faster than gravity can pull you down its far side and you leave the track
 * - which is why the sharp crests below are paired with boosters, and why the
 * gentle ones are just hills.
 */
export const LEVELS = [
  {
    id: 1,
    name: 'First Light',
    hint: 'Tilt to steer. Follow the track where it goes.',
    speed: 10,
    parTime: 16,
    // Skill, not puzzle - the one level that only asks you to drive. It is
    // still the widest track in the game, and everything after it is thinner.
    run: [
      { length: 26, width: 5 },
      { length: 28, width: 4.6, bend: 5 },
      { length: 28, width: 4.4, bend: -6, rise: 4 },
      { length: 30, width: 4.6, bend: 1, crest: -2.2 },
    ],
    coins: [{ z: 40, across: -1 }, { z: 68, across: 1 }, { z: 100, across: 0 }],
  },
  {
    id: 2,
    name: 'The Narrows',
    hint: 'It thins as it weaves. Small corrections, early.',
    speed: 11,
    parTime: 22,
    // The puzzle: precision. The deck narrows and it weaves - but never both
    // hard at once. The tightest piece is nearly straight and the liveliest
    // one is the wider of the two.
    run: [
      { length: 24, width: 4.6 },
      { length: 28, width: 3.8, bend: 3, rise: 5 },
      { length: 30, width: 3.6, wave: { amplitude: 2.2, cycles: 1 } },
      { length: 26, width: 2.6, bend: -2, rise: -6 },   // narrow, and near straight
      { length: 30, width: 3.4, wave: { amplitude: 1.8, cycles: 1 } },
      { length: 28, width: 4.4, bend: 3, rise: 5 },
    ],
    coins: [{ z: 40, across: 1 }, { z: 70, across: -0.9 }, { z: 122, across: 0.8 }, { z: 152, across: 0 }],
  },
  {
    id: 3,
    name: 'Mind the Gap',
    hint: 'Four jumps, and the far side is not always level.',
    speed: 11,
    parTime: 25,
    // The puzzle: reading an arc. Every gap is a pad and a landing, and the
    // ledges step up and down across them.
    run: [
      { length: 28, width: 4.4, gap: 4 },
      { length: 26, width: 4.2, bend: 4, rise: 5, gap: 4.5, step: -2.5 },
      { length: 28, width: 4, bend: -4, crest: 2.6, step: 2 },   // jump up onto it
      { length: 24, width: 4, bend: 3, rise: -6, gap: 4 },
      { length: 26, width: 4, bend: -3, rise: 5, gap: 4, step: -4 },
      { length: 30, width: 4.6, bend: 2, step: -3 },
    ],
    pads: [
      { z: 27, power: 20 },
      { z: 57, power: 23 },   // this one has to climb onto a higher ledge
      { z: 113.5, power: 20 },
      { z: 143.5, power: 20 },
    ],
    coins: [
      { z: 30, lift: 3.2 },
      { z: 60, lift: 3.2 },
      { z: 75, across: 1.2 },
      { z: 116.5, lift: 3.2 },
      { z: 146.5, lift: 3.2 },
    ],
  },
  {
    id: 4,
    name: 'Slipstream',
    hint: 'Green is speed. You need to still have it at the end.',
    speed: 12,
    parTime: 19,
    // The puzzle: momentum as a resource. The ramp at the end cannot clear
    // the gap on cruising speed alone - only a ball that has held its line
    // well enough to still be carrying the boost gets across.
    run: [
      { length: 26, width: 4.6 },
      { length: 34, width: 4.2, bend: 6, rise: -5 },
      { length: 30, width: 4.2, bend: -6 },
      { length: 28, width: 4, wave: { amplitude: 3, cycles: 1 }, rise: 4 },
      { length: 28, width: 3.8, bend: 5, crest: -2.6, gap: 7 },
      { length: 34, width: 4.4, bend: -3, rise: 3, step: -5 },
    ],
    boosters: [
      { z: 30, speed: 1.6 },
      { z: 92, speed: 1.7 },
      { z: 142, speed: 1.8, launch: 20 },   // the ramp off the end
    ],
    coins: [
      { z: 48, across: 1.3 },
      { z: 78, across: -1.3 },
      { z: 122, across: 1.2 },
      { z: 147, lift: 3.2 },
      { z: 170, across: 0 },
    ],
  },
  {
    id: 5,
    name: 'Spin Cycle',
    hint: 'Time your way past the bars, uphill and down.',
    speed: 12,
    parTime: 28,
    // The puzzle: timing. Every bar sweeps a wide, readable stretch, but the
    // track under them climbs and drops, so no two are met at the same speed.
    run: [
      { length: 28, width: 4.8 },
      { length: 32, width: 4.2, bend: -5, rise: 7 },
      { length: 32, width: 4.8, wave: { amplitude: 2.6, cycles: 1 } },
      { length: 28, width: 4.2, bend: 5, crest: 2.6 },
      { length: 34, width: 4.8, rise: -9 },
      { length: 30, width: 4.2, wave: { amplitude: 2.2, cycles: 1 }, rise: 3 },
      { length: 28, width: 4.8, bend: 2 },
    ],
    spinners: [
      { z: 20, length: 4.4, speed: 2.4, phase: 0 },
      { z: 48, length: 4.4, speed: -2.8, phase: 1.3 },
      { z: 104, length: 4.4, speed: 3.2, phase: 2.1 },
      { z: 140, length: 4.4, speed: -2.4, phase: 0.9 },
      { z: 192, length: 4.6, speed: -2.6, phase: 0.4 },
    ],
    coins: [{ z: 50, across: 1.2 }, { z: 106, across: -1.2 }, { z: 166, across: 1.2 }, { z: 190, across: 0 }],
  },
  {
    id: 6,
    name: 'Sidewinder',
    hint: 'The ground slides, and it does not always reach.',
    speed: 12,
    parTime: 25,
    // The puzzle: patience. Three sliding decks, and the last is across a gap
    // - you have to launch at the moment it is swinging back to meet you.
    run: [
      { length: 26, width: 4.4 },
      { length: 30, width: 3.8, moving: { amplitude: 3, speed: 1.1, phase: 0 } },
      { length: 26, width: 4, bend: 4, rise: 5 },
      { length: 30, width: 3.6, moving: { amplitude: 3.4, speed: 1.4, phase: 1.6 } },
      { length: 28, width: 4, wave: { amplitude: 2.6, cycles: 1 }, rise: -4, gap: 4 },
      { length: 30, width: 4.2, moving: { amplitude: 2.6, speed: -1.6, phase: 0.8 }, step: -3 },
      { length: 28, width: 4.4, bend: -3, rise: 2 },
    ],
    pads: [{ z: 139, power: 21 }],
    coins: [{ z: 40, x: 0 }, { z: 98, x: 4 }, { z: 125, across: 0 }, { z: 143, lift: 3.4 }, { z: 190, x: 4 }],
  },
  {
    id: 7,
    name: 'Ballast',
    hint: 'Some doors need weight. Some jumps cannot carry it.',
    speed: 11,
    parTime: 38,
    // The puzzle: you cannot be heavy and light at once.
    //
    // The plate at 78 is a weighted one - only a heavy ball presses it, and
    // nothing gets past the gate until it has been pressed. But the jump at
    // the end is an impulse, and an impulse barely lifts a heavy ball: the
    // only way over that gap is light. So the answer is to go out heavy, open
    // the door, and then go *back* for the light ballast before using it.
    //
    // Both stations sit off to one side, in a lane you can steer around, so
    // the return trip is not undone by the station it passes on the way.
    run: [
      { length: 30, width: 4.6 },
      { length: 26, width: 4.6, bend: 3 },
      { length: 28, width: 4.6, bend: -3 },
      { length: 28, width: 4.2, rise: 4 },
      { length: 26, width: 4, bend: 3, gap: 5 },
      { length: 30, width: 4.4, step: -3 },
    ],
    ballast: [
      { z: 40, across: -1.6, mass: 0.6 },   // light: hug the left lane
      { z: 66, across: 1.6, mass: 2 },      // heavy: hug the right
    ],
    switches: [{ z: 78, id: 'dock', needs: 2 }],
    gates: [{ z: 96, id: 'dock', width: 4.6 }],
    pads: [{ z: 137, power: 13 }],
    coins: [
      { z: 52, across: 0 },
      { z: 88, across: 0 },
      { z: 120, across: 1 },
      { z: 140, lift: 3 },
      { z: 160, across: 0 },
    ],
    route: [
      { across: 1.6, z: 66 },    // out on the right, and pick up the weight
      { across: 0, z: 80 },      // onto the plate
      { across: -1.6, z: 40 },   // back down the left lane for the light one
      { across: -1.6, z: 62 },   // still left, so the heavy station is missed
      { across: 0, z: 100 },     // through the door it opened
      { across: 0, z: 150 },
    ],
  },
  {
    id: 8,
    name: 'The Cannon',
    hint: 'Nothing here can be jumped. Pick the right barrel.',
    speed: 11,
    parTime: 34,
    // The puzzle: a cannon's aim never changes, so the question is never how
    // to shoot it - it is which one you need and how to get into it.
    //
    // The launch platform carries two. The right-hand barrel is aimed at the
    // onward track, and that track is gated. The left-hand one is aimed at an
    // island hanging over nothing, which holds the switch - and a third
    // barrel to get back off it again.
    run: [
      { length: 30, width: 4.4 },
      { length: 26, width: 4.2, bend: 2 },
      { length: 18, width: 10, gap: 30 },   // the launch platform
      { length: 40, width: 4.4, x: 2, entryWidth: 4.4 }, // where the right barrel lands
      { length: 30, width: 4.4, bend: -3, rise: 3 },
    ],
    spurs: [
      // The island: reachable only by the left barrel, and a dead end but for
      // the barrel that throws you back off it.
      { z: 92, x: -11, y: 0, run: [{ length: 18, width: 6 }] },
    ],
    cannons: [
      // Left barrel: onto the island, landing short of the switch rather
      // than over the top of it - the shot delivers you, it does not solve
      // the level for you. 1.3 seconds of flight, so the lift is g*t/2.
      { z: 70, x: -0.5, aim: { x: -8.1, y: 35.8, z: 18.5 } },
      // Right barrel: forty metres down the track, landing just short of the
      // gate it cannot open.
      { z: 70, x: 4.5, aim: { x: -1.6, y: 44, z: 25 } },
      // And the barrel on the island, which throws you back to the platform.
      { z: 100, x: -11, aim: { x: 9.3, y: 38.5, z: -24.3 } },
    ],
    switches: [{ z: 96, x: -11, id: 'battery' }],
    gates: [{ z: 112, x: 2, id: 'battery', width: 4.4 }],
    coins: [
      { z: 40, across: 1 },
      { z: 62, across: 0 },
      { z: 98, x: -11 },
      { z: 124, x: 2 },
      { z: 160, across: 0 },
    ],
    route: [
      { x: -0.5, z: 70 },   // into the left barrel
      { x: -11, z: 97 },    // onto the island, over the switch
      { x: -11, z: 100 },   // into the barrel that fires you home
      { x: 4.5, z: 70 },    // back on the platform, into the right barrel
      { x: 2, z: 124 },     // through the gate it opened
      { x: 2, z: 150 },
    ],
  },
  {
    id: 9,
    name: 'Corkscrew',
    hint: 'Climb, then let go. The way down winds.',
    speed: 13,
    parTime: 24,
    // The puzzle: the descent. A banked weave that drops twenty-four metres
    // through two full swings - the only way down is to stay with it.
    run: [
      { length: 26, width: 4.6 },
      { length: 42, width: 4.2, bend: 3, rise: 10 },
      { length: 28, width: 4, crest: 2.6 },
      { length: 60, width: 4, wave: { amplitude: 2.8, cycles: 2 }, rise: -24 },
      { length: 26, width: 4, bend: -4, rise: -6, gap: 5 },
      { length: 32, width: 4.4, bend: 3, rise: 4, step: -6 },
    ],
    boosters: [
      { z: 108, speed: 1.5 },
      { z: 180, speed: 1.8, launch: 18 },
    ],
    coins: [
      { z: 84, across: 1.2 },
      { z: 118, across: -1.3 },
      { z: 148, across: 1.3 },
      { z: 184.5, lift: 2.6 },
      { z: 210, across: 0 },
    ],
  },
  {
    id: 10,
    name: 'The Balance',
    hint: 'Slow. Thin. All lean. Ride the camber, do not fight it.',
    speed: 9,
    parTime: 38,
    // The puzzle: balance, and nothing else.
    //
    // A single continuous corkscrew, wound three times and dropped thirty
    // metres, on a deck barely wider than two ball diameters. It is slow on
    // purpose: slow means the corner is banked for a slow ball, and a deck
    // leaning this hard under a ball this size is something you hold a line
    // across rather than something you steer along. Every metre of it is the
    // same question asked again.
    run: [
      { length: 24, width: 3.6 },                                      // the last wide ground
      { length: 22, width: 2.8, bend: 2 },                             // and it narrows
      { length: 70, width: 2.6, wave: { amplitude: 2.2, cycles: 2 }, rise: -16 },
      { length: 20, width: 3 },                                        // one breath
      { length: 70, width: 2.4, wave: { amplitude: 2, cycles: 2 }, rise: -14 },
      { length: 26, width: 3.6, bend: 2, rise: 2 },
    ],
    coins: [
      { z: 60, across: 0 },
      { z: 96, across: 0 },
      { z: 140, across: 0 },
      { z: 180, across: 0 },
      { z: 215, across: 0 },
    ],
  },
  {
    id: 11,
    name: 'The Locksmith',
    hint: 'The way on is shut, and it does not stay open long.',
    speed: 11,
    parTime: 46,
    // The puzzle: the level is a lock, the key is behind you, and it is on a
    // timer. The run ends on a junction over a fifty-metre drop bridged by
    // two lanes: the right one goes where you want and is gated, the left one
    // holds the switch and stops dead twenty metres later over nothing.
    //
    // So you take the wrong lane deliberately, hit the switch, and reverse
    // the whole way back out to the junction - and the gate shuts again
    // twelve seconds after you press it, so the way back is the clock.
    run: [
      { length: 30, width: 4.4 },
      { length: 30, width: 4.2, bend: 4 },
      { length: 26, width: 6, bend: -4 },
      { length: 14, width: 18, gap: 50 },            // the junction, over the drop
      { length: 40, width: 4.2, x: 6, entryWidth: 4 },
      { length: 34, width: 4.4, bend: -6, rise: 3 },
    ],
    spurs: [
      { z: 100, x: 6, run: [{ length: 50, width: 4 }] },   // the way on, shut
      { z: 100, x: -6, run: [{ length: 35, width: 4 }] },  // the key, going nowhere
    ],
    gates: [{ z: 112, x: 6, id: 'vault', width: 4 }],
    switches: [{ z: 130, x: -6, id: 'vault', hold: 12 }],
    coins: [
      { z: 45, across: 1.2 },
      { z: 78, across: -1.6 },
      { z: 126, x: -6 },
      { z: 165, x: 6 },
      { z: 205, across: 0 },
    ],
    route: [
      { x: 0, z: 92 },
      { x: -6, z: 98 },
      { x: -6, z: 131 },   // over the switch - the clock starts here
      { x: -6, z: 94 },    // reverse right off the spur before turning
      { x: 6, z: 97 },     // across the junction
      { x: 6, z: 148 },    // and through before it shuts
    ],
  },
  {
    id: 12,
    name: 'The Long Way Home',
    hint: 'Everything you know, and a long way down.',
    speed: 13,
    parTime: 38,
    // The puzzle: all of them in sequence, with nowhere flat to recover.
    run: [
      { length: 26, width: 4.4, gap: 4.5 },
      { length: 28, width: 4, bend: 4, rise: 4, step: -3 },
      { length: 28, width: 5, bend: -4, crest: -2.6 },
      { length: 30, width: 3.8, moving: { amplitude: 3, speed: 1.5, phase: 0.3 } },
      { length: 32, width: 5.2, bend: 3, rise: 8 },
      { length: 28, width: 4.2, crest: 2.6 },
      { length: 34, width: 4.4, bend: -5, rise: -14, wave: { amplitude: 2, cycles: 1 } },
      { length: 28, width: 3.8, moving: { amplitude: 3.2, speed: -1.8, phase: 2.2 } },
      { length: 30, width: 4.4, wave: { amplitude: 2.4, cycles: 1 }, rise: 3 },
    ],
    pads: [{ z: 25, power: 21 }],
    boosters: [{ z: 152, speed: 1.75, launch: 14 }],
    spinners: [
      { z: 80, length: 4.4, speed: 2.8, phase: 0 },
      { z: 122, length: 4.2, speed: 2.4, phase: 0.6 },
      { z: 174, length: 4.2, speed: 2.6, phase: 2.3 },
    ],
    coins: [
      { z: 28, lift: 3.2 },
      { z: 112, x: 0 },
      { z: 138, across: -1.3 },
      { z: 192, across: 1.3 },
      { z: 218, x: -2 },
      { z: 252, across: 0 },
    ],
  },
].map(buildLevel);

export function getLevel(id) {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`No level with id ${id}`);
  return level;
}

export const LEVEL_COUNT = LEVELS.length;
