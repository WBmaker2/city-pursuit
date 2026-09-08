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

const idle: Input = {
  up: false,
  down: false,
  left: false,
  right: false,
  boost: false,
  handbrake: false,
};
const safeGap = 3.8;

function oneCarState(): GameState {
  const s = createState();
  s.traffic = [s.traffic[0]];
  s.police = [];
  s.player.pos = { x: 66, z: 66 };
  s.player.vel = { x: 0, z: 0 };
  return s;
}

function twoCarState(): GameState {
  const s = createState();
  s.traffic = [s.traffic[0], s.traffic[1]];
  s.police = [];
  s.player.pos = { x: 66, z: 66 };
  s.player.vel = { x: 0, z: 0 };
  return s;
}

function carAt(
  s: GameState,
  index: number,
  pos: Car["pos"],
  vel: Car["vel"],
  heading: number,
) {
  const c = s.traffic[index];
  c.pos = pos;
  c.vel = vel;
  c.heading = heading;
  c.damage = 0;
}

function distance(a: Car, b: Car) {
  return Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
}

function minTrafficGap(s: GameState) {
  let min = Infinity;
  for (let i = 0; i < s.traffic.length; i++) {
    for (let j = i + 1; j < s.traffic.length; j++) {
      min = Math.min(min, distance(s.traffic[i], s.traffic[j]));
    }
  }
  return min;
}

describe("traffic avoidance integration regressions", () => {
  beforeAll(async () => {
    await initPhysics();
  });

  it("stops an NPC for an idle player without damage or wanted state", () => {
    const s = oneCarState();
    s.player.pos = { x: 0, z: 0 };
    carAt(s, 0, { x: 0, z: -16 }, { x: 0, z: 9 }, 0);

    let minimum = Infinity;
    for (let i = 0; i < 180; i++) {
      step(s, idle, 1 / 60);
      minimum = Math.min(minimum, distance(s.player, s.traffic[0]));
    }

    expect(s.player.damage).toBe(0);
    expect(s.wanted).toBe(false);
    expect(minimum).toBeGreaterThanOrEqual(safeGap);
  });

  it("brakes a fast follower behind a slow lead car", () => {
    const s = twoCarState();
    carAt(s, 0, { x: 0, z: -20 }, { x: 0, z: 12 }, 0);
    carAt(s, 1, { x: 0, z: -8 }, { x: 0, z: 2 }, 0);

    let minimum = Infinity;
    for (let i = 0; i < 300; i++) {
      step(s, idle, 1 / 60);
      minimum = Math.min(minimum, distance(s.traffic[0], s.traffic[1]));
    }

    expect(minimum).toBeGreaterThanOrEqual(safeGap);
    expect(s.traffic[0].pos.z).toBeGreaterThan(-20);
    expect(s.traffic[0].vel.z).toBeLessThan(12);
  });

  it("keeps a safe gap when the moving player suddenly brakes", () => {
    const s = oneCarState();
    s.player.pos = { x: 0, z: 0 };
    s.player.vel = { x: 0, z: 8 };
    carAt(s, 0, { x: 0, z: -16 }, { x: 0, z: 10 }, 0);
    for (let i = 0; i < 12; i++) step(s, idle, 1 / 60);
    s.player.vel = { x: 0, z: 0 };

    let minimum = Infinity;
    for (let i = 0; i < 120; i++) {
      step(s, idle, 1 / 60);
      minimum = Math.min(minimum, distance(s.player, s.traffic[0]));
    }

    expect(minimum).toBeGreaterThanOrEqual(safeGap);
  });

  it("lets perpendicular NPCs clear a junction without freezing", () => {
    const s = twoCarState();
    carAt(s, 0, { x: -16, z: 0 }, { x: 8, z: 0 }, Math.PI / 2);
    carAt(s, 1, { x: 0, z: -16 }, { x: 0, z: 8 }, 0);
    const before = s.traffic.map((c) => ({ ...c.pos }));
    let minimum = Infinity;
    for (let i = 0; i < 36; i++) {
      step(s, idle, 0.1);
      minimum = Math.min(minimum, distance(s.traffic[0], s.traffic[1]));
    }

    expect(minimum).toBeGreaterThanOrEqual(safeGap);
    expect(s.traffic[0].pos.x).toBeGreaterThan(before[0].x + 10);
    expect(s.traffic[1].pos.z).toBeGreaterThan(before[1].z + 10);
  });

  it("restarts a stopped NPC after the player clears its lane", () => {
    const s = oneCarState();
    s.player.pos = { x: 0, z: 0 };
    carAt(s, 0, { x: 0, z: -14 }, { x: 0, z: 9 }, 0);
    advance(s, idle, 1.5);
    const stoppedAt = s.traffic[0].pos.z;
    s.player.pos = { x: 0, z: 30 };
    advance(s, idle, 1.5);

    expect(s.traffic[0].pos.z).toBeGreaterThan(stoppedAt + 0.5);
  });

  it("keeps intentional player impact damage and wanted reporting", () => {
    const s = oneCarState();
    s.player.pos = { x: 0, z: 0 };
    s.player.heading = 0;
    carAt(s, 0, { x: 0, z: 3 }, { x: 0, z: 0 }, 0);
    step(s, { ...idle, up: true }, 0.5);

    expect(s.player.damage).toBeGreaterThan(0);
    expect(s.wanted).toBe(true);
    expect(s.wantedReason).toBe("vehicle-crash");
  });

  it("does not call an NPC rear impact on a moving player a player crime", () => {
    const s = oneCarState();
    s.player.pos = { x: 0, z: 0 };
    s.player.vel = { x: 0, z: 3 };
    // The NPC is genuinely behind the moving player; the initial 3.5-unit
    // gap is within collision range, so this exercises a real rear contact.
    carAt(s, 0, { x: 0, z: -3.5 }, { x: 0, z: 9 }, 0);
    step(s, idle, 1 / 60);

    expect(s.player.damage).toBeGreaterThan(0);
    expect(s.wanted).toBe(false);
    expect(s.wantedReason).toBeNull();
  });

  it("waits for an occupied wrap destination, then resumes after it clears", () => {
    const s = twoCarState();
    carAt(s, 0, { x: 75.8, z: 0 }, { x: 9, z: 0 }, Math.PI / 2);
    carAt(s, 1, { x: -76, z: 0 }, { x: 0, z: 0 }, Math.PI / 2);
    step(s, idle, 1 / 60);
    expect(s.traffic[0].pos.x).toBeGreaterThan(75);

    s.traffic[1].pos = { x: 30, z: 0 };
    const before = s.traffic[0].pos.x;
    advance(s, idle, 1);
    expect(s.traffic[0].pos.x).not.toBe(before);
    expect(s.traffic[0].pos.x).toBeLessThan(-60);
  });

  it("keeps dense traffic separated and moving over thirty simulated seconds", () => {
    const s = createState();
    s.police = [];
    s.player.pos = { x: 66, z: 66 };
    s.player.vel = { x: 0, z: 0 };
    let minimum = Infinity;
    let travel = 0;
    for (let i = 0; i < 30 * 60; i++) {
      step(s, idle, 1 / 60);
      minimum = Math.min(minimum, minTrafficGap(s));
      travel += s.traffic.reduce(
        (sum, c) => sum + Math.hypot(c.vel.x, c.vel.z) / 60,
        0,
      );
    }

    expect(s.status).toBe("playing");
    expect(minimum).toBeGreaterThanOrEqual(safeGap);
    expect(travel).toBeGreaterThan(300);
  });
});
