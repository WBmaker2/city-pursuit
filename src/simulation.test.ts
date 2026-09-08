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
  it("escape requires three seconds of separation", () => {
    const s = createState();
    s.checkpoints.forEach((c) => (c.reached = true));
    s.police.forEach((p) => (p.pos = { x: -70, z: -70 }));
    s.pursuit = 20;
    advance(s, { ...go, up: false }, 2.9);
    expect(s.status).toBe("playing");
    advance(s, { ...go, up: false }, 0.2);
    expect(s.status).toBe("won");
  });
  it("police follows adjacent grid waypoints and reaches a stationary target", () => {
    const s = createState();
    s.traffic = [];
    s.police = [s.police[1]];
    s.player.pos = { x: 44, z: -44 };
    s.player.damage = 0;
    let nearest = Infinity;
    for (let i = 0; i < 25 * 60; i++) {
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
});
