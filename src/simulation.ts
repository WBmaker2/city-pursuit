import { createPhysicsBridge, type PhysicsBridge } from "./physics";
import { resetTrafficMemory, updateTraffic } from "./traffic-ai";

export type Vec = { x: number; z: number };
export type Input = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
  handbrake: boolean;
};
export type Car = {
  pos: Vec;
  vel: Vec;
  heading: number;
  damage: number;
  lane: number;
  isPolice?: boolean;
  waypoint?: Vec;
  /** Short-lived arcade shove, applied after AI steering each frame. */
  impact?: Vec;
  impactTime?: number;
};
export type Checkpoint = { pos: Vec; radius: number; reached: boolean };
export type GameState = {
  player: Car;
  traffic: Car[];
  police: Car[];
  checkpoints: Checkpoint[];
  score: number;
  time: number;
  status: "playing" | "won" | "lost" | "paused";
  pursuit: number;
  combo: number;
  collisionTimer: number;
  escapeTime: number;
  wanted: boolean;
  wantedReason: "speeding" | "vehicle-crash" | null;
  speedingTime: number;
  speedingEpisode: boolean;
  alertTime: number;
  clearMessageTime: number;
};
export const WORLD = 80,
  ROAD = 8,
  GRID = 22,
  MAX_SPEED = 25;
export const SPEED_LIMIT_KMH = 120,
  SPEEDING_THRESHOLD_SECONDS = 1.5,
  WANTED_DISTANCE = 42,
  ESCAPE_SECONDS = 10;
const HALF = 4,
  RADIUS = 1.35,
  clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z),
  grid = (n: number) => clamp(Math.round(n / GRID) * GRID, -66, 66),
  node = (p: Vec): Vec => ({ x: grid(p.x), z: grid(p.z) });
export const isOnRoad = (p: Vec) =>
  Math.abs(p.x - grid(p.x)) < HALF || Math.abs(p.z - grid(p.z)) < HALF;
let bridge: PhysicsBridge | undefined;
const bridges = new WeakMap<GameState, PhysicsBridge>();
export async function initPhysics() {
  bridge ??= await createPhysicsBridge();
  return bridge;
}
function resetPhysics(s: GameState) {
  if (!bridge) return;
  bridges.set(s, bridge);
  bridge.syncPosition(s.player.pos.x, s.player.pos.z);
  bridge.syncCars(
    [...s.traffic, ...s.police].map((c) => ({
      x: c.pos.x,
      z: c.pos.z,
      police: c.isPolice,
    })),
  );
}
export function createState(): GameState {
  const checkpoints = [
    [0, 22],
    [44, 22],
    [44, -44],
    [-44, -44],
    [0, 0],
  ].map(([x, z]) => ({ pos: { x, z }, radius: 5, reached: false }));
  const traffic: Car[] = [];
  for (let i = 0; i < 8; i++) {
    const v = i % 2 === 0,
      lane = ((i % 7) - 3) * GRID;
    traffic.push({
      pos: v ? { x: lane, z: -66 + i * 15 } : { x: -66 + i * 15, z: lane },
      vel: v ? { x: 0, z: 8 + (i % 3) } : { x: 8 + (i % 3), z: 0 },
      heading: v ? 0 : Math.PI / 2,
      damage: 0,
      lane: i,
    });
  }
  const police: Car[] = [
    {
      pos: { x: 0, z: -66 },
      vel: { x: 0, z: 0 },
      heading: 0,
      damage: 0,
      lane: 0,
      isPolice: true,
    },
    {
      pos: { x: -66, z: 22 },
      vel: { x: 0, z: 0 },
      heading: Math.PI / 2,
      damage: 0,
      lane: 1,
      isPolice: true,
    },
  ];
  const s: GameState = {
    player: {
      pos: { x: 0, z: 66 },
      vel: { x: 0, z: 0 },
      heading: Math.PI,
      damage: 0,
      lane: 0,
    },
    traffic,
    police,
    checkpoints,
    score: 0,
    time: 0,
    status: "playing",
    pursuit: 0,
    combo: 1,
    collisionTimer: 0,
    escapeTime: 0,
    wanted: false,
    wantedReason: null,
    speedingTime: 0,
    speedingEpisode: false,
    alertTime: 0,
    clearMessageTime: 0,
  };
  resetPhysics(s);
  resetTrafficMemory(s.traffic);
  return s;
}
const blocks: Vec[] = [];
for (let x = -77; x <= 77; x += 11)
  for (let z = -77; z <= 77; z += 11)
    if (Math.abs(x % 22) >= 6 && Math.abs(z % 22) >= 6) blocks.push({ x, z });
function blocked(a: Vec, b: Vec) {
  if (bridge) return bridge.blocked(a, b);
  const n = Math.max(1, Math.ceil(dist(a, b) / 0.5));
  for (let i = 1; i <= n; i++) {
    const t = i / n,
      x = a.x + (b.x - a.x) * t,
      z = a.z + (b.z - a.z) * t;
    if (
      blocks.some(
        (q) => Math.abs(x - q.x) < 4 + RADIUS && Math.abs(z - q.z) < 4 + RADIUS,
      )
    )
      return true;
  }
  return false;
}
function road(c: Car, previous: Vec) {
  const p = { x: clamp(c.pos.x, -76, 76), z: clamp(c.pos.z, -76, 76) };
  if (!blocked(previous, p) && isOnRoad(p)) {
    c.pos = p;
    return false;
  }
  c.pos = { ...previous };
  c.vel.x *= -0.2;
  c.vel.z *= -0.2;
  return true;
}
function drive(c: Car, i: Input, dt: number) {
  const speed = Math.hypot(c.vel.x, c.vel.z),
    f = { x: Math.sin(c.heading), z: Math.cos(c.heading) },
    signed = c.vel.x * f.x + c.vel.z * f.z,
    brake = i.down && signed > 0.3,
    throttle = i.up ? 1 : i.down && signed <= 0.3 ? -0.55 : 0,
    // With drag this reaches ~19.5u/s in ordinary driving (police cruise at
    // 15), while boost has a clear second tier without feeling weightless.
    acc = c.isPolice ? 12 : i.boost && i.up ? 36 : 28;
  c.vel.x += f.x * throttle * acc * dt;
  c.vel.z += f.z * throttle * acc * dt;
  const turn = (i.left ? 1 : 0) - (i.right ? 1 : 0),
    sign = signed < -0.1 ? -1 : 1;
  c.heading +=
    turn * sign * (i.handbrake ? 2.7 : 1.8) * clamp(speed / 8, 0, 1) * dt;
  const drag = i.handbrake ? 5 : brake ? 7 : 1.4;
  c.vel.x *= Math.max(0, 1 - drag * dt);
  c.vel.z *= Math.max(0, 1 - drag * dt);
  if (brake && speed < 0.5) c.vel.x = c.vel.z = 0;
  const max = c.isPolice ? 20 : i.boost && i.up ? 34 : MAX_SPEED,
    m = Math.hypot(c.vel.x, c.vel.z);
  if (m > max) {
    c.vel.x *= max / m;
    c.vel.z *= max / m;
  }
  c.pos.x += c.vel.x * dt;
  c.pos.z += c.vel.z * dt;
}
function applyImpacts(cars: Car[], dt: number) {
  for (const car of cars) {
    const impact = car.impact;
    if (!impact || (car.impactTime ?? 0) <= 0) {
      car.impact = undefined;
      car.impactTime = 0;
      continue;
    }
    const previous = { ...car.pos };
    car.pos.x += impact.x * dt;
    car.pos.z += impact.z * dt;
    const candidate = {
      x: clamp(car.pos.x, -76, 76),
      z: clamp(car.pos.z, -76, 76),
    };
    if (blocked(previous, candidate) || !isOnRoad(candidate)) {
      car.pos = previous;
      car.impact = undefined;
      car.impactTime = 0;
      car.vel = { x: 0, z: 0 };
      continue;
    }
    car.pos = candidate;
    if (car.isPolice) car.waypoint = undefined;
    const decay = Math.pow(0.72, dt * 60);
    car.impact = { x: impact.x * decay, z: impact.z * decay };
    car.impactTime = Math.max(0, (car.impactTime ?? 0) - dt);
  }
}
function nextWaypoint(p: Car, player: Car) {
  const at = node(p.pos),
    target = node(player.pos);
  if (Math.abs(at.x - target.x) < 0.5 && Math.abs(player.pos.x - at.x) < HALF)
    return { x: at.x, z: player.pos.z };
  if (Math.abs(at.z - target.z) < 0.5 && Math.abs(player.pos.z - at.z) < HALF)
    return { x: player.pos.x, z: at.z };
  const dx = target.x - at.x,
    dz = target.z - at.z;
  if (dx && Math.abs(dx) >= Math.abs(dz))
    return { x: at.x + Math.sign(dx) * GRID, z: at.z };
  if (dz) return { x: at.x, z: at.z + Math.sign(dz) * GRID };
  return at;
}
function police(p: Car, player: Car, dt: number) {
  if ((p.impactTime ?? 0) > 0) {
    p.vel = { x: 0, z: 0 };
    return;
  }
  let w = p.waypoint;
  if (!w || dist(p.pos, w) < 0.01) w = nextWaypoint(p, player);
  p.waypoint = w;
  const dx = w.x - p.pos.x,
    dz = w.z - p.pos.z,
    len = Math.hypot(dx, dz);
  if (len < 0.01) {
    p.vel = { x: 0, z: 0 };
    return;
  }
  const amount = Math.min(15 * dt, len),
    old = { ...p.pos };
  p.pos.x += (dx / len) * amount;
  p.pos.z += (dz / len) * amount;
  p.vel = { x: (dx / len) * 15, z: (dz / len) * 15 };
  p.heading = Math.atan2(p.vel.x, p.vel.z);
  if (amount >= len - 1e-8) {
    p.pos = { ...w };
    p.waypoint = nextWaypoint(p, player);
  }
  road(p, old);
}
function collide(player: Car, other: Car, s: GameState) {
  const min = 3.8,
    dx = player.pos.x - other.pos.x,
    dz = player.pos.z - other.pos.z;
  let d = Math.hypot(dx, dz);
  if (d >= min) return false;
  let nx: number, nz: number;
  if (d < 1e-6) {
    nx = other.lane % 2 ? 1 : 0;
    nz = nx ? 0 : 1;
    d = 0;
  } else {
    nx = dx / d;
    nz = dz / d;
  }
  const impactDirection = { x: -nx, z: -nz };
  const playerBefore = { ...player.pos };
  const otherBefore = { ...other.pos };
  const push = (min - d) / 2;
  const playerCandidate = {
    x: clamp(player.pos.x + nx * push, -76, 76),
    z: clamp(player.pos.z + nz * push, -76, 76),
  };
  const playerFullCandidate = {
    x: clamp(player.pos.x + nx * (min - d), -76, 76),
    z: clamp(player.pos.z + nz * (min - d), -76, 76),
  };
  const otherCandidate = {
    x: clamp(other.pos.x - nx * push, -76, 76),
    z: clamp(other.pos.z - nz * push, -76, 76),
  };
  const valid = (from: Vec, to: Vec) => isOnRoad(to) && !blocked(from, to);
  const playerCanSeparate = valid(playerBefore, playerCandidate);
  const playerCanFullSeparate = valid(playerBefore, playerFullCandidate);
  const otherCanSeparate = valid(otherBefore, otherCandidate);
  if (playerCanSeparate && otherCanSeparate) {
    player.pos = playerCandidate;
    other.pos = otherCandidate;
  } else if (playerCanSeparate) {
    // A building or boundary may trap the struck car. Give the player the
    // available half of the separation instead of pushing into the obstacle.
    player.pos = playerCanFullSeparate ? playerFullCandidate : playerCandidate;
    other.pos = otherBefore;
  } else if (otherCanSeparate) {
    player.pos = playerBefore;
    other.pos = otherCandidate;
  } else {
    player.pos = playerBefore;
    other.pos = otherBefore;
  }
  const playerSpeed = Math.hypot(player.vel.x, player.vel.z);
  const otherSpeed = Math.hypot(other.vel.x, other.vel.z);
  const sameDirection = player.vel.x * other.vel.x + player.vel.z * other.vel.z > 0;
  const movingPlayer = d < 0.25
    ? playerSpeed > 0.5 && !(sameDirection && otherSpeed > playerSpeed + 0.5)
    : dotToward(player.vel, impactDirection) > 0.5;
  // Transfer forward momentum to the struck vehicle. The impulse is kept
  // outside `vel` so traffic AI cannot erase it on its next steering update.
  const approach = Math.max(
    0,
    dotToward(
      { x: player.vel.x - other.vel.x, z: player.vel.z - other.vel.z },
      impactDirection,
    ),
  );
  if (approach > 0.2) {
    const shove = Math.min(
      other.isPolice ? 15 : 12,
      approach * 0.9 + (playerSpeed > 0.6 ? 1.1 : 0),
    );
    other.impact = {
      x: impactDirection.x / Math.max(1e-6, Math.hypot(impactDirection.x, impactDirection.z)) * shove,
      z: impactDirection.z / Math.max(1e-6, Math.hypot(impactDirection.x, impactDirection.z)) * shove,
    };
    other.impactTime = Math.max(other.impactTime ?? 0, 0.55);
  }
  if (s.collisionTimer <= 0) {
    player.damage += 18;
    // Preserve forward momentum; only remove velocity driving into the other
    // car. This lets a held throttle gradually break a low-speed contact.
    const toward = dotToward(player.vel, impactDirection);
    if (toward > 0) {
      player.vel.x -= (impactDirection.x / Math.max(1e-6, Math.hypot(impactDirection.x, impactDirection.z))) * toward * 0.35;
      player.vel.z -= (impactDirection.z / Math.max(1e-6, Math.hypot(impactDirection.x, impactDirection.z))) * toward * 0.35;
    }
    s.score = Math.max(0, s.score - 50);
    s.collisionTimer = 0.75;
    return movingPlayer;
  }
  return false;
}
function dotToward(velocity: Vec, direction: Vec) {
  const length = Math.hypot(direction.x, direction.z);
  return length < 1e-6 ? 0 : (velocity.x * direction.x + velocity.z * direction.z) / length;
}
function startWanted(s: GameState, reason: "speeding" | "vehicle-crash") {
  s.wanted = true;
  s.wantedReason = reason;
  s.pursuit = 100;
  s.escapeTime = 0;
  s.alertTime = 4;
  s.clearMessageTime = 0;
}
function clearWanted(s: GameState) {
  s.wanted = false;
  s.wantedReason = null;
  s.escapeTime = 0;
  s.pursuit = 0;
  s.clearMessageTime = 4;
  for (const p of s.police) {
    p.vel = { x: 0, z: 0 };
    p.waypoint = undefined;
  }
}
export function step(s: GameState, input: Input, dt: number): GameState {
  if (s.status !== "playing") return s;
  dt = clamp(dt, 0, 0.1);
  s.time += dt;
  s.alertTime = Math.max(0, s.alertTime - dt);
  s.clearMessageTime = Math.max(0, s.clearMessageTime - dt);
  s.collisionTimer = Math.max(0, s.collisionTimer - dt);
  const old = { ...s.player.pos };
  drive(s.player, input, dt);
  road(s.player, old);
  updateTraffic(s.traffic, s.player, dt, (from, to) => !blocked(from, to) && isOnRoad(to), s.police);
  if (s.wanted) for (const p of s.police) police(p, s.player, dt);
  else for (const p of s.police) p.vel = { x: 0, z: 0 };
  applyImpacts([...s.traffic, ...s.police], dt);
  const b = bridges.get(s);
  b?.syncPosition(s.player.pos.x, s.player.pos.z);
  b?.syncCars(
    [...s.traffic, ...s.police].map((c) => ({
      x: c.pos.x,
      z: c.pos.z,
      police: c.isPolice,
    })),
  );
  b?.step(dt);
  for (const c of [...s.traffic, ...s.police]) {
    if (collide(s.player, c, s)) startWanted(s, "vehicle-crash");
  }
  const speedKmh = Math.hypot(s.player.vel.x, s.player.vel.z) * 8;
  if (speedKmh > SPEED_LIMIT_KMH) {
    s.speedingTime += dt;
    if (
      !s.speedingEpisode &&
      s.speedingTime >= SPEEDING_THRESHOLD_SECONDS
    ) {
      s.speedingEpisode = true;
      startWanted(s, "speeding");
    }
  } else {
    s.speedingTime = 0;
    s.speedingEpisode = false;
  }
  s.score += Math.hypot(s.player.vel.x, s.player.vel.z) * dt * 0.8;
  const next = s.checkpoints.findIndex((c) => !c.reached);
  if (
    next >= 0 &&
    dist(s.player.pos, s.checkpoints[next].pos) < s.checkpoints[next].radius
  ) {
    s.checkpoints[next].reached = true;
    s.score += 500;
    s.combo++;
  }
  if (s.wanted) {
    const nearest = Math.min(...s.police.map((p) => dist(s.player.pos, p.pos)));
    if (nearest > WANTED_DISTANCE) {
      s.escapeTime += dt;
      s.pursuit = Math.max(0, 100 - (s.escapeTime / ESCAPE_SECONDS) * 100);
    } else {
      s.escapeTime = 0;
      s.pursuit = 100;
    }
    if (s.escapeTime >= ESCAPE_SECONDS) clearWanted(s);
  }
  if (s.player.damage >= 100 || s.time >= 180) s.status = "lost";
  else if (s.checkpoints.every((c) => c.reached) && !s.wanted) {
    s.status = "won";
    s.score += 1000;
  }
  return s;
}
export function advance(s: GameState, input: Input, seconds: number) {
  let t = 0;
  while (t < seconds && s.status === "playing") {
    const dt = Math.min(1 / 60, seconds - t);
    step(s, input, dt);
    t += dt;
  }
  return s;
}
export function debugSnapshot(s: GameState) {
  return {
    status: s.status,
    score: Math.round(s.score),
    checkpoint: s.checkpoints.filter((c) => c.reached).length,
    total: s.checkpoints.length,
    damage: Math.round(s.player.damage),
    pursuit: Math.round(s.pursuit),
    wanted: s.wanted,
    wantedReason: s.wantedReason,
    speedingTime: +s.speedingTime.toFixed(2),
    escapeTime: +s.escapeTime.toFixed(2),
    escapeRemaining: s.wanted
      ? Math.max(0, +(ESCAPE_SECONDS - s.escapeTime).toFixed(1))
      : 0,
    alertTime: +s.alertTime.toFixed(1),
    clearMessageTime: +s.clearMessageTime.toFixed(1),
    player: { x: +s.player.pos.x.toFixed(1), z: +s.player.pos.z.toFixed(1) },
  };
}
