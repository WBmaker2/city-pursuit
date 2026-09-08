export type TrafficVec = { x: number; z: number };
export type TrafficCar = {
  pos: TrafficVec;
  vel: TrafficVec;
  heading: number;
  lane: number;
  isPolice?: boolean;
};

type Snapshot = { car: TrafficCar; pos: TrafficVec; vel: TrafficVec; id: number };
type Decision = { speed: number; pos: TrafficVec; waiting: boolean };

export const TRAFFIC_CLEARANCE = 4.2;
const LOOKAHEAD = 18;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const length = (v: TrafficVec) => Math.hypot(v.x, v.z);
const dot = (a: TrafficVec, b: TrafficVec) => a.x * b.x + a.z * b.z;
const sub = (a: TrafficVec, b: TrafficVec): TrafficVec => ({ x: a.x - b.x, z: a.z - b.z });
const add = (a: TrafficVec, b: TrafficVec): TrafficVec => ({ x: a.x + b.x, z: a.z + b.z });
const scale = (v: TrafficVec, n: number): TrafficVec => ({ x: v.x * n, z: v.z * n });

const cruise = new WeakMap<TrafficCar, number>();
const intentHeading = new WeakMap<TrafficCar, number>();

function forward(c: TrafficCar): TrafficVec {
  const f = { x: Math.sin(c.heading), z: Math.cos(c.heading) };
  return length(c.vel) > 0.4 ? scale(c.vel, 1 / length(c.vel)) : f;
}

function projectedDistance(a: Snapshot, b: Snapshot, t: number) {
  return length(sub(add(a.pos, scale(a.vel, t)), add(b.pos, scale(b.vel, t))));
}
function sweptDistance(a: Snapshot, b: Snapshot, horizon: number) {
  return conflict(a, b, horizon).distance;
}

function conflict(a: Snapshot, b: Snapshot, horizon: number) {
  const relative = sub(a.vel, b.vel);
  const offset = sub(a.pos, b.pos);
  const rr = dot(relative, relative);
  const t = rr < 1e-6 ? 0 : clamp(-dot(offset, relative) / rr, 0, horizon);
  return { distance: projectedDistance(a, b, t), time: t };
}

function shouldYield(a: Snapshot, b: Snapshot, player: boolean) {
  const c = conflict(a, b, 1.8);
  if (c.distance >= TRAFFIC_CLEARANCE || c.time > 1.8) return false;
  const rel = sub(a.vel, b.vel);
  if (length(rel) < 0.3 && c.distance > 4) return false;
  if (player) return true;
  // Vehicles already in the crossing keep priority. Stable lane/id ordering
  // breaks ties, so two approaching cars do not deadlock indefinitely.
  const aCrossing = Math.abs(dot(forward(a.car), sub(b.pos, a.pos))) < 5;
  const bCrossing = Math.abs(dot(forward(b.car), sub(a.pos, b.pos))) < 5;
  if (aCrossing && !bCrossing) return false;
  return a.id > b.id;
}

function nearestAhead(a: Snapshot, all: Snapshot[], player: Snapshot, obstacles: Snapshot[] = []) {
  const f = forward(a.car);
  let best: { distance: number; speed: number } | undefined;
  for (const b of [...all, player, ...obstacles]) {
    if (b === a) continue;
    const delta = sub(b.pos, a.pos);
    const longitudinal = dot(delta, f);
    const lateral = Math.abs(delta.x * f.z - delta.z * f.x);
    if (longitudinal <= 0 || longitudinal > LOOKAHEAD || lateral > 2.8) continue;
    const distance = longitudinal - 3.8;
    if (!best || distance < best.distance) best = { distance, speed: dot(b.vel, f) };
  }
  return best;
}

/**
 * Updates ordinary traffic from one immutable frame snapshot. The callback
 * validates the complete swept segment, keeping detours out of buildings.
 */
export function updateTraffic(
  cars: TrafficCar[],
  player: TrafficCar,
  dt: number,
  canTravel: (from: TrafficVec, to: TrafficVec) => boolean,
  obstacles: TrafficCar[] = [],
) {
  const all: Snapshot[] = cars.map((car, id) => ({ car, pos: { ...car.pos }, vel: { ...car.vel }, id }));
  const playerSnapshot: Snapshot = { car: player, pos: { ...player.pos }, vel: { ...player.vel }, id: -1 };
  const obstacleSnapshots = obstacles.map((car, id) => ({ car, pos: { ...car.pos }, vel: { ...car.vel }, id: -1000 - id }));
  const decisions = new Map<TrafficCar, Decision>();
  for (const a of all) {
    const rememberedHeading = intentHeading.get(a.car) ?? a.car.heading;
    intentHeading.set(a.car, rememberedHeading);
    const f = { x: Math.sin(rememberedHeading), z: Math.cos(rememberedHeading) };
    const current = length(a.vel);
    const desired = cruise.get(a.car) ?? Math.max(7, current || 8);
    cruise.set(a.car, desired);
    let target = desired;
    const ahead = nearestAhead(a, all, playerSnapshot, obstacleSnapshots);
    if (ahead) {
      const closing = Math.max(0, current - ahead.speed);
      const safe = 4.8 + current * 0.65 + closing * 0.8;
      if (ahead.distance < safe) target = ahead.distance <= 4.5 ? 0 : Math.min(target, Math.max(0, (ahead.distance - 4) * 1.4));
    }
    for (const b of all) if (b !== a && shouldYield(a, b, false)) target = 0;
    for (const b of obstacleSnapshots) if (shouldYield(a, b, false)) target = 0;
    if (shouldYield(a, playerSnapshot, true)) target = 0;
    const braking = target < current ? 24 : 9;
    const speed = clamp(current + (target - current) * Math.min(1, braking * dt / Math.max(1, Math.abs(target - current))), 0, desired);
    let candidate = add(a.pos, scale(f, speed * dt));
    const wrapped = candidate.x > 76 || candidate.x < -76 || candidate.z > 76 || candidate.z < -76;
    if (candidate.x > 76) candidate = { ...candidate, x: -76 };
    if (candidate.x < -76) candidate = { ...candidate, x: 76 };
    if (candidate.z > 76) candidate = { ...candidate, z: -76 };
    if (candidate.z < -76) candidate = { ...candidate, z: 76 };
    decisions.set(a.car, { speed, pos: candidate, waiting: speed < 0.05 || wrapped });
  }

  // Stable priority lets a car proceed while lower-priority candidates wait.
  const accepted = new Map<TrafficCar, Snapshot>();
  const finalPositions: TrafficVec[] = [];
  for (const a of all.sort((x, y) => x.id - y.id)) {
    const d = decisions.get(a.car)!;
    const sweptSelf = { ...a, pos: a.pos, vel: scale({ x: Math.sin(intentHeading.get(a.car) ?? a.car.heading), z: Math.cos(intentHeading.get(a.car) ?? a.car.heading) }, d.speed) };
    const movingIntoTraffic = all.some((b) => b !== a && sweptDistance(sweptSelf, b, dt) < TRAFFIC_CLEARANCE)
      || sweptDistance(sweptSelf, playerSnapshot, dt) < TRAFFIC_CLEARANCE
      || obstacleSnapshots.some((b) => sweptDistance(sweptSelf, b, dt) < TRAFFIC_CLEARANCE)
      || [...accepted.values()].some((b) => sweptDistance(sweptSelf, b, dt) < TRAFFIC_CLEARANCE);
    const occupied = all.some((b) => b !== a && length(sub(d.pos, b.pos)) < TRAFFIC_CLEARANCE)
      || length(sub(d.pos, playerSnapshot.pos)) < TRAFFIC_CLEARANCE
      || obstacles.some((b) => length(sub(d.pos, b.pos)) < TRAFFIC_CLEARANCE)
      || finalPositions.some((position) => length(sub(d.pos, position)) < TRAFFIC_CLEARANCE);
    const wraps = Math.abs(d.pos.x - a.pos.x) > 40 || Math.abs(d.pos.z - a.pos.z) > 40;
    if (occupied || (movingIntoTraffic && d.speed > 0.15) || !canTravel(wraps ? d.pos : a.pos, d.pos)) {
      d.pos = a.pos;
      d.speed = 0;
      d.waiting = true;
    }
    a.car.pos = d.pos;
    const heading = intentHeading.get(a.car) ?? a.car.heading;
    a.car.vel = scale({ x: Math.sin(heading), z: Math.cos(heading) }, d.speed);
    if (d.speed > 0.15) a.car.heading = heading;
    finalPositions.push({ ...d.pos });
    const wrapsAccepted = Math.abs(d.pos.x - a.pos.x) > 40 || Math.abs(d.pos.z - a.pos.z) > 40;
    accepted.set(a.car, {
      ...a,
      pos: wrapsAccepted ? { ...d.pos } : { ...a.pos },
      vel: wrapsAccepted ? { x: 0, z: 0 } : { ...a.car.vel },
    });
  }
  return decisions;
}

export function resetTrafficMemory(cars: TrafficCar[]) {
  for (const car of cars) {
    cruise.delete(car);
    intentHeading.delete(car);
  }
}
