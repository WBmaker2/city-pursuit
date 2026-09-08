import { describe, it, expect, beforeAll } from "vitest";
import {
  createState,
  step,
  advance,
  initPhysics,
  isOnRoad,
} from "./simulation";
const go = {
  up: true,
  down: false,
  left: false,
  right: false,
  boost: false,
  handbrake: false,
};
describe("City Pursuit simulation", () => {
  beforeAll(async () => {
    const physics = await initPhysics();
    expect(physics.blocked({ x: 0, z: 11 }, { x: 11, z: 11 })).toBe(true);
    expect(physics.blocked({ x: 0, z: 0 }, { x: 0, z: 22 })).toBe(false);
  });
  it("accelerates and brakes", () => {
    const s = createState();
    advance(s, go, 1);
    expect(s.player.vel.z).toBeLessThan(0);
    const v = Math.hypot(s.player.vel.x, s.player.vel.z);
    advance(s, { ...go, up: false, down: true }, 3);
    expect(Math.hypot(s.player.vel.x, s.player.vel.z)).toBeLessThan(v);
  });
  it("collects ordered checkpoints and scores", () => {
    const s = createState();
    s.player.pos = { x: 0, z: 22 };
    step(s, { ...go, up: false }, 0.01);
    expect(s.checkpoints[0].reached).toBe(true);
    s.player.pos = { x: 44, z: 22 };
    step(s, { ...go, up: false }, 0.01);
    expect(s.checkpoints[1].reached).toBe(true);
    expect(s.score).toBeGreaterThan(500);
  });
  it("collision damages player", () => {
    const s = createState();
    s.traffic[0].pos = { ...s.player.pos };
    const d = s.player.damage;
    step(s, { ...go, up: false }, 0.01);
    expect(s.player.damage).toBeGreaterThan(d);
  });
  it("restart gives clean state", () => {
    const s = createState();
    s.score = 999;
    s.player.damage = 90;
    const n = createState();
    expect(n.score).toBe(0);
    expect(n.player.damage).toBe(0);
  });
  it("reverse input moves backward", () => {
    const s = createState();
    s.player.pos = { x: 0, z: 44 };
    step(s, { ...go, up: false, down: true }, 0.5);
    expect(s.player.pos.z).toBeGreaterThan(44);
  });
  it("boost reaches a higher speed", () => {
    const normal = createState();
    const boosted = createState();
    advance(normal, go, 1);
    advance(boosted, { ...go, boost: true }, 1);
    expect(
      Math.hypot(boosted.player.vel.x, boosted.player.vel.z),
    ).toBeGreaterThan(Math.hypot(normal.player.vel.x, normal.player.vel.z));
  });
  it("building blocks cannot be entered", () => {
    const s = createState();
    s.player.pos = { x: 0, z: 0 };
    s.player.heading = Math.PI / 4;
    advance(s, { ...go, up: true }, 1);
    expect(Math.abs(s.player.pos.x) < 4 || Math.abs(s.player.pos.z) < 4).toBe(
      true,
    );
  });
  it("pause freezes simulation time", () => {
    const s = createState();
    s.status = "paused";
    step(s, go, 1);
    expect(s.time).toBe(0);
  });
  it("damage and timeout fail the run", () => {
    const s = createState();
    s.player.damage = 100;
    step(s, go, 1 / 60);
    expect(s.status).toBe("lost");
  });
  it("escape clears wanted after ten seconds of separation", () => {
    const s = createState();
    s.checkpoints.forEach((c) => (c.reached = true));
    s.player.pos = { x: 66, z: 66 };
    s.police.forEach((p) => (p.pos = { x: -70, z: -70 }));
    s.traffic.forEach((c) => (c.pos = { x: 0, z: 0 }));
    s.pursuit = 20;
    s.wanted = true;
    advance(s, { ...go, up: false }, 9.9);
    expect(s.status).toBe("playing");
    advance(s, { ...go, up: false }, 0.2);
    expect(s.status).toBe("won");
  });
  it("police follows adjacent grid waypoints and reaches a stationary target", () => {
    const s = createState();
    s.traffic = [];
    s.police = [s.police[1]];
    s.player.pos = { x: 44, z: -44 };
    s.police[0].pos = { x: 44, z: -66 };
    s.wanted = true;
    s.player.damage = 0;
    let nearest = Infinity;
    for (let i = 0; i < 2 * 60; i++) {
      step(s, { ...go, up: false }, 1 / 60);
      nearest = Math.min(
        nearest,
        Math.hypot(
          s.police[0].pos.x - s.player.pos.x,
          s.police[0].pos.z - s.player.pos.z,
        ),
      );
    }
    expect(nearest).toBeLessThan(4);
  });
  it("starts peaceful with parked police", () => {
    const s = createState();
    const before = s.police.map((p) => ({ ...p.pos }));
    advance(s, { ...go, up: false }, 20);
    expect(s.wanted).toBe(false);
    expect(s.police.map((p) => p.pos)).toEqual(before);
  });
  it("below the limit stays calm", () => {
    const s = createState();
    advance(s, { ...go, up: false }, 1);
    expect(s.wanted).toBe(false);
    expect(s.wantedReason).toBeNull();
  });
  it("overspeed activates only after the delay and latches one episode", () => {
    const s = createState();
    s.player.vel = { x: 0, z: 16 };
    s.player.pos = { x: 0, z: 44 };
    for (let i = 0; i < 84; i++) {
      s.player.vel = { x: 0, z: 16 };
      step(s, { ...go, up: false }, 1 / 60);
    }
    expect(s.wanted).toBe(false);
    for (let i = 0; i < 12; i++) {
      s.player.vel = { x: 0, z: 16 };
      step(s, { ...go, up: false }, 1 / 60);
    }
    expect(s.wantedReason).toBe("speeding");
    const alert = s.alertTime;
    advance(s, { ...go, up: false }, 1);
    expect(s.alertTime).toBeLessThan(alert);
  });
  it("moving player collision is an offense but idle NPC hit is not", () => {
    const idle = createState();
    idle.traffic[0].pos = { ...idle.player.pos };
    step(idle, { ...go, up: false }, 0.01);
    expect(idle.wanted).toBe(false);
    const moving = createState();
    moving.traffic[0].pos = { ...moving.player.pos };
    moving.player.vel = { x: 0, z: 3 };
    step(moving, { ...go, up: false }, 0.01);
    expect(moving.wantedReason).toBe("vehicle-crash");
  });
  it("separation timer resets on reapproach and clear is independent of checkpoints", () => {
    const s = createState();
    s.wanted = true;
    s.police.forEach((p) => (p.pos = { x: -70, z: -70 }));
    advance(s, { ...go, up: false }, 6);
    expect(s.escapeTime).toBeGreaterThan(5);
    s.police[0].pos = { ...s.player.pos };
    step(s, { ...go, up: false }, 0.01);
    expect(s.escapeTime).toBe(0);
    s.police.forEach((p) => (p.pos = { x: -70, z: -70 }));
    advance(s, { ...go, up: false }, 10.1);
    expect(s.wanted).toBe(false);
    expect(s.status).toBe("playing");
  });
  it("moving cars remain on the rendered street grid", () => {
    const s = createState();
    advance(s, go, 8);
    for (const c of [...s.traffic, ...s.police])
      expect(isOnRoad(c.pos)).toBe(true);
  });
  it("boosting while stationary earns no score", () => {
    const s = createState();
    step(s, { ...go, up: false, boost: true }, 0.5);
    expect(s.score).toBe(0);
  });
  it("reverse steering turns in the opposite direction", () => {
    const s = createState();
    s.player.pos = { x: 0, z: 44 };
    s.player.vel = { x: 0, z: 8 };
    s.player.heading = Math.PI;
    step(s, { ...go, up: false, down: true, right: true }, 0.5);
    expect(s.player.heading).toBeGreaterThan(Math.PI);
  });
  it("ordinary traffic brakes before a stationary player", () => {
    const s = createState();
    s.traffic = [s.traffic[0]];
    s.player.pos = { x: 0, z: 0 };
    s.player.vel = { x: 0, z: 0 };
    s.traffic[0].pos = { x: 0, z: -16 };
    s.traffic[0].vel = { x: 0, z: 9 };
    advance(s, { ...go, up: false }, 2);
    expect(s.player.damage).toBe(0);
    expect(s.wanted).toBe(false);
    expect(Math.hypot(s.traffic[0].pos.x - s.player.pos.x, s.traffic[0].pos.z - s.player.pos.z)).toBeGreaterThanOrEqual(3.8);
  });
  it("stopped traffic resumes after its obstacle clears", () => {
    const s = createState();
    s.traffic = [s.traffic[0]];
    s.player.pos = { x: 0, z: 0 };
    s.traffic[0].pos = { x: 0, z: -14 };
    s.traffic[0].vel = { x: 0, z: 9 };
    advance(s, { ...go, up: false }, 1.5);
    const stopped = s.traffic[0].pos.z;
    s.player.pos = { x: 0, z: 30 };
    advance(s, { ...go, up: false }, 1.5);
    expect(s.traffic[0].pos.z).toBeGreaterThan(stopped);
  });
  it("two approaching NPCs preserve a safe gap", () => {
    const s = createState();
    s.traffic = [s.traffic[0], s.traffic[1]];
    s.traffic[0].pos = { x: 0, z: -12 };
    s.traffic[0].vel = { x: 0, z: 8 };
    s.traffic[1].pos = { x: 0, z: 12 };
    s.traffic[1].vel = { x: 0, z: -8 };
    s.traffic[1].heading = Math.PI;
    advance(s, { ...go, up: false }, 3);
    expect(Math.hypot(s.traffic[0].pos.x - s.traffic[1].pos.x, s.traffic[0].pos.z - s.traffic[1].pos.z)).toBeGreaterThanOrEqual(3.8);
  });
  it("does not approve two cars for the same wrap destination", () => {
    const s = createState();
    s.traffic = [s.traffic[0], s.traffic[1]];
    s.player.pos = { x: 0, z: 66 };
    s.traffic[0].pos = { x: 75.8, z: 0 };
    s.traffic[0].vel = { x: 9, z: 0 };
    s.traffic[0].heading = Math.PI / 2;
    s.traffic[1].pos = { x: 75.8, z: 10 };
    s.traffic[1].vel = { x: 9, z: 0 };
    s.traffic[1].heading = Math.PI / 2;
    step(s, { ...go, up: false }, 0.1);
    expect(Math.hypot(s.traffic[0].pos.x - s.traffic[1].pos.x, s.traffic[0].pos.z - s.traffic[1].pos.z)).toBeGreaterThanOrEqual(3.8);
  });
});
