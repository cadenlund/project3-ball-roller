/**
 * Ball physics and level state.
 *
 * Everything here is a pure function over plain data - no React, no timers,
 * no rendering - so the whole game can be simulated and unit tested without a
 * device. `step()` takes the current state plus a tilt vector and returns the
 * next state; it never mutates its input.
 *
 * The world: the track runs along +Z and the ball goes only where it is
 * tilted - tilt.y rolls it forward and back, tilt.x steers it left and right,
 * like a marble on a board. Leave the track under the ball and gravity takes
 * over.
 *
 * The track is not flat, and it is not level either. A grounded ball rides
 * the deck, which means three things: gravity drags it along whatever slope
 * it is standing on, so hills cost speed and dips pay it back; it keeps the
 * vertical speed that slope implies, so cresting a rise fast enough throws it
 * into the air; and on a banked corner it sits on the tilted surface and
 * gravity pulls it down the camber, which is what makes a banked turn hold
 * the ball through it instead of merely looking like it would.
 */

import {
  BALL_RADIUS,
  BALLAST_RADIUS,
  BOOST_RADIUS,
  CANNON_HOLD,
  CANNON_RADIUS,
  GRAVITY,
  COIN_RADIUS,
  FALL_Y,
  GATE_HALF,
  GATE_HEIGHT,
  PAD_RADIUS,
  SWITCH_RADIUS,
  SPINNER_HALF_WIDTH,
  SPINNER_HEIGHT,
  acrossAt,
  bankSecAt,
  bankTanAt,
  centerAt,
  deckPlaneAt,
  segmentAt,
  segmentShift,
  slopeAt,
  surfaceAt,
  surfaceRate,
  widthAt,
} from './levels';

// Gravity is defined alongside the geometry, which needs it to work out how
// hard a corner has to be banked to balance the speed it is taken at.
export { GRAVITY };
export const STEER_ACCEL = 34;    // lateral units/s^2 at full tilt
export const DRIVE_ACCEL = 30;    // forward/back units/s^2 at full tilt
export const ROLL_DRAG = 0.12;    // velocity retained per second while grounded
export const MAX_LATERAL = 11;    // lateral speed cap, units/s
export const REVERSE_FACTOR = 0.5;// reversing is allowed, at half the speed cap
export const AIR_CONTROL = 0.45;  // tilt strength while airborne
export const SPIN_PUSH = 9;       // sideways shove from a spinner hit

/**
 * How much of a banked corner's lean the ball actually feels. 1 is the honest
 * physics - gravity down a tilted deck - which is what turns banking from
 * decoration into grip: part of the sideways force needed to get round a
 * corner comes out of the track instead of out of the player's steering.
 */
export const BANK_GRIP = 1;

/**
 * How far the deck may already be above the ball and still catch it.
 *
 * Landing is a crossing, not a position: the ball has to have come down
 * *onto* the deck. Without that, anything whose (x, z) happened to be over
 * track got stood up on it - so a ball that had rolled off the outside of a
 * bend and fallen ten metres would be teleported back up the moment the track
 * curved over the top of it, or a platform slid back underneath. The
 * tolerance is only wide enough to absorb one step of overshoot.
 */
export const LAND_TOLERANCE = 0.5;

/**
 * Mass. A ball only ever weighs what the last piece of ballast it rolled over
 * said it weighs, and nothing else about it changes: the whole point is that
 * the same rolling and steering behave the same at any weight. What mass
 * decides is what the ball can be *done to* - how far an impulse throws it,
 * and how hard a spinner can shove it - because that is what makes weight a
 * key rather than a handicap. Heavy opens doors a light ball cannot; light
 * makes jumps a heavy ball cannot.
 */
export const DEFAULT_MASS = 1;

/**
 * Tilt alone can only drive the ball up to the level's cruising speed.
 * Gravity down a slope, and boosters, are what carry it past - up to this
 * multiple of cruise, beyond which drag always wins.
 */
export const OVERSPEED = 2.4;
export const BOOST_TIME = 2.6;    // seconds a booster holds its raised cap
export const BOOST_SPEED = 1.7;   // default booster target, as a multiple of cruise
/**
 * Drag is what normally pulls the ball back to cruising speed, and it is
 * strong. While a booster is lit most of it is switched off, so the speed it
 * gives actually survives the corner after it instead of evaporating in the
 * first half second - which is the whole point of the pickup.
 */
export const BOOST_SLIP = 0.25;   // fraction of normal drag while boosting
/** Steering authority scales up with the boost, or it becomes unsteerable. */
export const BOOST_STEER = 1.35;

export const STATUS = {
  PLAYING: 'playing',
  FELL: 'fell',
  FINISHED: 'finished',
};

export function createGameState(level) {
  return {
    levelId: level.id,
    x: level.start.x,
    y: (level.start.y ?? 0) + BALL_RADIUS,
    z: level.start.z,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: true,
    boost: 0,      // seconds of raised speed cap left
    boostCap: 1,   // the multiple of cruising speed that cap is raised to
    onBooster: -1, // which booster is underfoot, so one crossing fires once
    mass: DEFAULT_MASS,
    cannon: -1,    // which cannon is holding the ball, if any
    cannonTime: 0, // and how long until it fires
    onCannon: -1,  // and which barrel it is inside, so one shot is one shot
    time: 0,
    status: STATUS.PLAYING,
    coins: level.coins.map(() => false), // collected flags, by index
    // Seconds each switch's lock stays open for. Infinity once a permanent
    // switch has been thrown; counting down for one on a timer; zero for one
    // that has not been pressed, or whose time has run out.
    opened: level.switches.map(() => 0),
    falls: 0,
    events: [],
    feedback: { pad: 0, boost: 0, spinner: 0, landing: 0, lastPad: -1, lastBoost: -1 },
  };
}

const clamp1 = (v) => Math.max(-1, Math.min(1, v));

/** A gate is open while any switch carrying its id is still holding it open. */
export function isOpen(state, level, gate) {
  return level.switches.some((w, i) => w.id === gate.id && state.opened[i] > 0);
}

/**
 * Advance the world by dt seconds.
 * `tilt` is {x, y} in roughly -1..1, from the accelerometer or the keyboard.
 */
export function step(state, level, tilt, dt) {
  if (state.status !== STATUS.PLAYING) return state;

  const s = {
    ...state,
    coins: [...state.coins],
    opened: [...state.opened],
    events: [],
    feedback: { ...state.feedback },
  };
  s.time += dt;
  s.boost = Math.max(0, s.boost - dt);

  // Locks on a timer run down whatever else is happening. A permanent switch
  // holds its gate at Infinity and is simply never counted down.
  for (let i = 0; i < s.opened.length; i++) {
    if (s.opened[i] > 0 && s.opened[i] !== Infinity) s.opened[i] = Math.max(0, s.opened[i] - dt);
  }

  // A ball in a cannon is not rolling, falling or steering - it is loaded.
  // Everything below is skipped until the barrel lets go of it.
  if (s.cannon >= 0) {
    const cannon = level.cannons[s.cannon];
    s.cannonTime -= dt;
    s.x = cannon.x;
    s.y = cannon.y + BALL_RADIUS;
    s.z = cannon.z;
    s.vx = s.vy = s.vz = 0;
    s.grounded = false;
    s.onCannon = s.cannon;
    if (s.cannonTime <= 0) {
      s.cannon = -1;
      s.vx = cannon.aim.x ?? 0;
      s.vy = cannon.aim.y ?? 0;
      s.vz = cannon.aim.z ?? 0;
      s.events.push({ type: 'fire' });
    }
    return s;
  }

  // Tilt drives both axes. Weaker in the air - you can nudge a jump, not
  // redirect it - and rolling drag only applies with the track underfoot.
  const control = s.grounded ? 1 : AIR_CONTROL;
  const boosting = s.boost > 0;
  s.vx += clamp1(tilt.x) * STEER_ACCEL * control * (boosting ? BOOST_STEER : 1) * dt;

  // Forward drive stops dead at the cruising cap rather than overshooting it,
  // so the ball settles at exactly the level's speed on the flat. While a
  // booster is lit the cap is raised, which is the whole of what a booster
  // does after the initial shove.
  const cap = level.speed * (boosting ? s.boostCap : 1);
  const drive = clamp1(tilt.y) * DRIVE_ACCEL * control * dt;
  if (drive > 0 && s.vz < cap) s.vz = Math.min(cap, s.vz + drive);
  else if (drive < 0 && s.vz > -cap * REVERSE_FACTOR) s.vz = Math.max(-cap * REVERSE_FACTOR, s.vz + drive);

  // Spinners sweep the track and shove whatever they touch sideways.
  for (const sp of level.spinners) {
    if (s.y >= (sp.y ?? 0) + SPINNER_HEIGHT) continue;
    const a = sp.phase + sp.speed * s.time;
    const ux = Math.cos(a);
    const uz = Math.sin(a);
    const dx = s.x - sp.x;
    const dz = s.z - sp.z;
    const along = dx * ux + dz * uz;
    const perp = dx * -uz + dz * ux;
    if (Math.abs(along) <= sp.length / 2 && Math.abs(perp) < SPINNER_HALF_WIDTH + BALL_RADIUS) {
      const sign = perp >= 0 ? 1 : -1;
      const clear = SPINNER_HALF_WIDTH + BALL_RADIUS - Math.abs(perp) + 0.02;
      s.x += -uz * sign * clear;
      s.z += ux * sign * clear;
      // A heavy ball shrugs off a bar that would fling a light one away.
      s.vx += (-uz * sign * SPIN_PUSH) / s.mass;
      s.vz += (ux * sign * SPIN_PUSH) / s.mass;
      s.events.push({ type: 'spinner' });
      s.feedback.spinner++;
    }
  }

  // Gravity along the deck underfoot. Down the slope: climbing bleeds speed,
  // dropping builds it. Down the camber: a banked corner leans the ball
  // toward its inside, which is most of what makes one holdable at speed.
  // Only while grounded - in the air, gravity is already doing all of this.
  if (s.grounded) {
    const under = segmentAt(level, s.x, s.z, state.time);
    if (under) {
      const slope = slopeAt(under, s.z);
      s.vz -= (GRAVITY * slope) / Math.sqrt(1 + slope * slope) * dt;
      // sin(b) * cos(b) is tan / (1 + tan^2) - the camber pull without a
      // single trig call, which matters at 120Hz with catch-up.
      const tan = bankTanAt(under, s.z);
      s.vx -= (GRAVITY * BANK_GRIP * tan) / (1 + tan * tan) * dt;
    }
  }

  if (s.grounded) {
    // Exponential, so it is framerate independent - and mostly lifted while a
    // booster is lit, which is what lets the surge carry.
    const drag = Math.pow(ROLL_DRAG, dt * (boosting ? BOOST_SLIP : 1));
    s.vx *= drag;
    s.vz *= drag;
  }
  s.vx = Math.max(-MAX_LATERAL, Math.min(MAX_LATERAL, s.vx));
  const runaway = level.speed * OVERSPEED;
  s.vz = Math.max(-runaway, Math.min(runaway, s.vz));

  s.x += s.vx * dt;
  s.z += s.vz * dt;

  // Gravity, then let the track catch the ball if it is there to catch it.
  // Grounding is tested against where the track is *now*, so a platform that
  // has slid out from under the ball drops it.
  s.vy -= GRAVITY * dt;
  s.y += s.vy * dt;
  s.grounded = false;
  const floor = segmentAt(level, s.x, s.z, s.time);
  if (floor) {
    // A moving platform carries what is standing on it: the ball keeps its
    // place on the deck rather than being left behind by it. Only grounded -
    // a ball in the air is not held by anything - and only as far as the deck
    // itself reaches, so a deck that slides out past the ball drops it rather
    // than dragging it along off its own edge.
    const carried = floor.moving
      ? s.x + segmentShift(floor, s.time) - segmentShift(floor, state.time)
      : s.x;
    const held = Math.abs(acrossAt(floor, carried, s.z, s.time)) <= widthAt(floor, s.z) / 2 + BALL_RADIUS * 0.4;
    // Resting height is measured off the banked surface and offset along its
    // normal, so the ball sits *on* a tilted deck rather than half inside it.
    const deck = surfaceAt(floor, carried, s.z, s.time) + BALL_RADIUS * bankSecAt(floor, s.z);
    // A ball already on the deck is trivially above it; only one arriving
    // from somewhere else has to prove it came down from above rather than
    // drifting under the track and being scooped back up by it.
    const wasAbove =
      state.grounded ||
      state.y >= deckPlaneAt(level, state.x, state.z, state.time) - LAND_TOLERANCE;
    if (s.y <= deck && held && wasAbove) {
      s.x = carried;
      s.y = deck;
      s.grounded = true;
      // Riding the deck: the ball takes whatever vertical speed the surface
      // under it is moving at - down the slope, and down the camber of a
      // banked corner - rather than being pinned flat. That is what glues it
      // to a descent and to a lean, and what throws it off the top of a crest
      // it is carrying too much speed to follow down the far side.
      s.vy = surfaceRate(floor, s.x, s.z, s.vx, s.vz, s.time);
      if (!state.grounded) {
        s.events.push({ type: 'landing' });
        s.feedback.landing++;
      }
    }
  }

  // Bounce pads launch a grounded ball.
  if (s.grounded) {
    for (const [index, p] of level.pads.entries()) {
      if (Math.abs(s.x - p.x) < PAD_RADIUS && Math.abs(s.z - p.z) < PAD_RADIUS) {
        s.events.push({ type: 'pad', index });
        s.feedback.pad++;
        s.feedback.lastPad = index;
        // An impulse, not a speed: the same pad throws a light ball high and
        // barely lifts a heavy one.
        s.vy = p.power / s.mass;
        s.grounded = false;
        break;
      }
    }
  }

  // Boosters slam the ball up to a multiple of cruising speed and hold the
  // cap there for a beat, so the speed survives the curve after it. One with
  // `launch` is a ramp as well, and throws the ball into the air with it.
  const touching = level.boosters.findIndex(
    (b) => Math.abs(s.x - b.x) < BOOST_RADIUS && Math.abs(s.z - b.z) < BOOST_RADIUS
  );
  // A pad you bounce off throws you clear of itself; a booster you simply
  // roll over does not, so without remembering which one is underfoot it
  // would fire again on every frame the ball spent crossing it - dozens of
  // times, for one pickup. It arms again as soon as the ball leaves it.
  if (touching !== s.onBooster) {
    s.onBooster = touching;
    const b = level.boosters[touching];
    if (b && s.grounded) {
      s.events.push({ type: 'boost', index: touching });
      s.feedback.boost++;
      s.feedback.lastBoost = touching;
      s.boostCap = b.speed ?? BOOST_SPEED;
      // A booster never slows you down: it is a floor on your speed, not a
      // setting for it, so hitting one while already quick still adds.
      s.vz = Math.max(s.vz, level.speed * s.boostCap);
      s.boost = Math.max(s.boost, BOOST_TIME);
      if (b.launch) {
        s.vy = b.launch / s.mass;
        s.grounded = false;
      }
    }
  }

  // Ballast changes what the ball weighs, and nothing else. It is a station,
  // not a pickup: roll back over it any time to change back.
  for (const b of level.ballast) {
    if (Math.abs(s.x - b.x) < BALLAST_RADIUS && Math.abs(s.z - b.z) < BALLAST_RADIUS &&
        Math.abs(s.y - b.y) < BALLAST_RADIUS && s.mass !== b.mass) {
      s.mass = b.mass;
      s.events.push({ type: 'ballast' });
      break;
    }
  }

  // Cannons. Roll into one and it takes hold of the ball; everything after
  // that is out of the player's hands, which is the point - a cannon is an
  // answer, and the puzzle is working out which one you need.
  const inBarrel = level.cannons.findIndex(
    (c) => Math.abs(s.x - c.x) < CANNON_RADIUS && Math.abs(s.z - c.z) < CANNON_RADIUS &&
           Math.abs(s.y - c.y) < CANNON_RADIUS * 1.5
  );
  // A cannon fires the ball from where it was loaded, so the moment after it
  // fires the ball is still inside the barrel. Without remembering which one
  // it just left, it would be swallowed again on the very next step and fire
  // forever. It arms again as soon as the ball is clear of it.
  if (s.cannon < 0 && inBarrel >= 0 && inBarrel !== s.onCannon) {
    const barrel = level.cannons[inBarrel];
    s.cannon = inBarrel;
    s.cannonTime = barrel.hold ?? CANNON_HOLD;
    // Loaded means loaded: the ball is in the barrel from this moment, not
    // from the next frame, so it never sits half in and half out of one.
    s.x = barrel.x;
    s.y = barrel.y + BALL_RADIUS;
    s.z = barrel.z;
    s.vx = s.vy = s.vz = 0;
    s.grounded = false;
    s.boost = 0;
    s.events.push({ type: 'cannon', index: inBarrel });
  }
  s.onCannon = inBarrel;

  // Switches and gates: the puzzle layer. A gate is solid until its switch
  // has been hit, and a ball that reaches one is simply stopped by it - so a
  // shut gate is a question ("where is the switch?") rather than a death.
  //
  // `needs` makes a switch a weighted plate, which a ball too light to press
  // simply rolls over. `hold` makes it a timer, which shuts again - so the
  // question stops being "where is the switch" and becomes "can I get there
  // from the switch in time".
  level.switches.forEach((w, i) => {
    if (Math.abs(s.x - w.x) >= SWITCH_RADIUS || Math.abs(s.z - w.z) >= SWITCH_RADIUS) return;
    if (s.y - w.y >= GATE_HEIGHT) return;
    if (s.mass < (w.needs ?? 0)) return;
    const already = s.opened[i];
    s.opened[i] = w.hold ?? Infinity;
    // Standing on a timer keeps it topped up, but only announce it once.
    if (already <= 0) s.events.push({ type: 'switch', index: i });
  });

  for (const gate of level.gates) {
    if (isOpen(s, level, gate)) continue;
    // Only what is low enough to hit the barrier is stopped by it. A ball
    // thrown high enough sails over, which is a second answer to some gates.
    if (s.y - gate.y > GATE_HEIGHT) continue;
    const half = GATE_HALF + BALL_RADIUS;
    if (Math.abs(s.z - gate.z) >= half) continue;
    if (Math.abs(s.x - gate.x) > gate.width / 2 + BALL_RADIUS) continue;
    // Push the ball back out the side it came in on and kill the speed it
    // arrived with, so it bumps to a stop instead of shivering in the wall.
    const side = state.z <= gate.z ? -1 : 1;
    s.z = gate.z + side * half;
    if (s.vz * side < 0) s.vz = 0;
    if (state.status === STATUS.PLAYING && Math.abs(state.vz) > 1) {
      s.events.push({ type: 'gate' });
    }
  }

  level.coins.forEach((c, i) => {
    if (s.coins[i]) return;
    const dx = s.x - c.x;
    const dy = s.y - (c.y ?? 0.9);
    const dz = s.z - c.z;
    const r = COIN_RADIUS + BALL_RADIUS;
    if (dx * dx + dy * dy + dz * dz < r * r) {
      s.coins[i] = true;
      s.events.push({ type: 'coin', index: i });
    }
  });

  if (s.y < (level.fallY ?? FALL_Y)) {
    s.status = STATUS.FELL;
    s.events.push({ type: 'fall' });
    return s;
  }

  if (s.z >= level.goalZ) {
    s.status = STATUS.FINISHED;
    s.events.push({ type: 'goal' });
  }

  return s;
}

/** Put the ball back at the start after a fall, keeping time and coins. */
export function respawn(state, level) {
  return {
    ...state,
    x: level.start.x,
    y: (level.start.y ?? 0) + BALL_RADIUS,
    z: level.start.z,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: true,
    boost: 0,
    boostCap: 1,
    onBooster: -1,
    // Back at the start is back at the start: whatever the ball was carrying
    // when it fell, it is an ordinary ball again now. Thrown switches stay
    // thrown, so a solved lock does not have to be solved twice.
    mass: DEFAULT_MASS,
    cannon: -1,
    cannonTime: 0,
    onCannon: -1,
    status: STATUS.PLAYING,
    falls: state.falls + 1,
    events: [],
  };
}
