import { beforeAll, describe, expect, it } from "vitest";
import {
  advance,
  createState,
  initPhysics,
  step,
  type Car,
  type GameState,
  type Input,
} from "./simulation";
import { isOnRoad, LANE_OFFSET, ROAD_HALF } from "./road-constants";

const idle: Input = {
  up: false,
  down: false,
  left: false,
  right: false,
  boost: false,
  handbrake: false,
};
const MIN_CLEARANCE = 3.8;

const distance = (a: Car, b: Car) =>
  Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);

function forward(car: Car) {
  return { x: Math.sin(car.heading), z: Math.cos(car.heading) };
}

function right(car: Car) {
  const f = forward(car);
  return { x: -f.z, z: f.x };
}

/** Signed distance from the road centerline, positive on the car's right. */
function signedLaneOffset(car: Car) {
  const f = forward(car);
  const r = right(car);
  const vertical = Math.abs(f.z) >= Math.abs(f.x);
  const center = vertical
    ? { x: Math.round(car.pos.x / 22) * 22, z: car.pos.z }
    : { x: car.pos.x, z: Math.round(car.pos.z / 22) * 22 };
  return (car.pos.x - center.x) * r.x + (car.pos.z - center.z) * r.z;
}

function isMidblock(car: Car) {
  const f = forward(car);
  const along = Math.abs(f.z) >= Math.abs(f.x) ? car.pos.z : car.pos.x;
  const distanceToJunction = Math.abs(along - Math.round(along / 22) * 22);
  return distanceToJunction > ROAD_HALF + 2 && distanceToJunction < 22 - ROAD_HALF - 2;
}

function setCar(car: Car, pos: Car["pos"], velocity: Car["vel"], heading: number) {
  car.pos = pos;
  car.vel = velocity;
  car.heading = heading;
  car.damage = 0;
  car.impact = undefined;
  car.impactTime = 0;
}

function minGap(cars: Car[]) {
  let minimum = Infinity;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      minimum = Math.min(minimum, distance(cars[i], cars[j]));
    }
  }
  return minimum;
}

describe("wide-road right-hand traffic regressions", () => {
  beforeAll(async () => {
    await initPhysics();
  });

  it("spawns every NPC on the positive right side of its signed lane", () => {
    const s = createState();

    for (const car of s.traffic) {
      expect(Math.hypot(car.vel.x, car.vel.z)).toBeGreaterThan(0.1);
      expect(signedLaneOffset(car)).toBeGreaterThan(1.8);
      expect(isOnRoad(car.pos)).toBe(true);
    }
  });

  it("keeps the player at the right-side starting lane facing forward", () => {
    const s = createState();
    const f = forward(s.player);

    expect(s.player.pos.x).toBeCloseTo(3, 5);
    expect(s.player.pos.z).toBeCloseTo(66, 5);
    expect(f.z).toBeLessThan(-0.9);
    expect(signedLaneOffset(s.player)).toBeGreaterThan(1.8);
  });

  it("spawns the player, traffic, and police without an initial overlap", () => {
    const s = createState();
    const cars = [s.player, ...s.traffic, ...s.police];

    expect(minGap(cars)).toBeGreaterThanOrEqual(MIN_CLEARANCE);
    for (const police of s.police) {
      expect(signedLaneOffset(police)).toBeGreaterThan(LANE_OFFSET - 1.2);
      expect(signedLaneOffset(police)).toBeLessThan(LANE_OFFSET + 1.2);
    }
  });

  it("keeps an idle player stationary and clear of traffic for twenty seconds", () => {
    const s = createState();
    for (let i = 0; i < 20 * 60; i++) step(s, idle, 1 / 60);

    expect(s.player.pos.x).toBeCloseTo(3, 5);
    expect(s.player.pos.z).toBeCloseTo(66, 5);
    expect(s.player.damage).toBe(0);
    expect(s.wanted).toBe(false);
    expect(s.wantedReason).toBeNull();
  });

  it("lets opposite-lane NPCs pass for five seconds without freezing", () => {
    const s = createState();
    const first = s.traffic[0];
    const second = s.traffic[1];
    s.traffic = [first, second];
    s.police = [];
    s.player.pos = { x: 3, z: 66 };
    s.player.vel = { x: 0, z: 0 };
    setCar(first, { x: -3, z: -30 }, { x: 0, z: 8 }, 0);
    setCar(second, { x: 3, z: 30 }, { x: 0, z: -8 }, Math.PI);
    const before = s.traffic.map((car) => ({ ...car.pos }));
    let minimum = Infinity;

    for (let i = 0; i < 5 * 60; i++) {
      step(s, idle, 1 / 60);
      minimum = Math.min(minimum, distance(first, second));
    }

    expect(minimum).toBeGreaterThanOrEqual(MIN_CLEARANCE);
    expect(first.pos.z).toBeGreaterThan(before[0].z + 12);
    expect(second.pos.z).toBeLessThan(before[1].z - 12);
    expect(first.vel.z).toBeGreaterThan(1);
    expect(second.vel.z).toBeLessThan(-1);
  });

  it("advances a police car through a turn while holding right lanes", () => {
    const s = createState();
    s.traffic = [];
    s.police = [s.police[0]];
    s.wanted = true;
    s.wantedReason = "speeding";
    const police = s.police[0];
    const target = { x: 44, z: 22 };
    s.player.pos = { ...target };
    s.player.vel = { x: 0, z: 0 };
    setCar(police, { x: -44, z: -41 }, { x: 0, z: 0 }, Math.PI / 2);
    police.waypoint = undefined;
    let moved = 0;
    let horizontalSamples = 0;
    let verticalSamples = 0;
    const initialTargetDistance = distance(police, { ...s.player, pos: target });

    for (let i = 0; i < 10 * 60; i++) {
      const before = { ...police.pos };
      step(s, idle, 1 / 60);
      moved += distance(police, { ...police, pos: before });
      const f = forward(police);
      if (Math.hypot(police.vel.x, police.vel.z) > 2 && isMidblock(police)) {
        expect(signedLaneOffset(police)).toBeGreaterThan(LANE_OFFSET - 1.2);
        expect(signedLaneOffset(police)).toBeLessThan(LANE_OFFSET + 1.2);
        if (Math.abs(f.x) > 0.85 && Math.abs(f.z) < 0.35) horizontalSamples++;
        if (Math.abs(f.z) > 0.85 && Math.abs(f.x) < 0.35) verticalSamples++;
      }
      expect(isOnRoad(police.pos)).toBe(true);
    }

    expect(moved).toBeGreaterThan(50);
    expect(horizontalSamples).toBeGreaterThan(30);
    expect(verticalSamples).toBeGreaterThan(30);
    expect(distance(police, { ...s.player, pos: target })).toBeLessThan(
      initialTargetDistance - 30,
    );
  });

  it("recovers police routing after a midblock lane displacement", () => {
    const s = createState();
    s.traffic = [];
    s.police = [s.police[0]];
    s.wanted = true;
    s.player.pos = { x: 44, z: 0 };
    s.player.vel = { x: 0, z: 0 };
    const police = s.police[0];
    setCar(police, { x: -20, z: -3 }, { x: 0, z: 0 }, Math.PI / 2);
    police.waypoint = undefined;

    advance(s, idle, 3);

    expect(isOnRoad(police.pos)).toBe(true);
    expect(police.pos.x).toBeGreaterThan(-10);
    expect(police.pos.z).toBeGreaterThan(0);
    expect(Math.hypot(police.vel.x, police.vel.z)).toBeGreaterThan(2);
    expect(signedLaneOffset(police)).toBeGreaterThan(LANE_OFFSET - 1.2);
    expect(signedLaneOffset(police)).toBeLessThan(LANE_OFFSET + 1.2);
  });
});
