import RAPIER from "@dimforge/rapier2d-compat";
import { BUILDING_HALF } from "./road-constants";

export type PhysicsBridge = {
  world: RAPIER.World;
  playerBody: RAPIER.RigidBody;
  step(dt: number): void;
  syncPosition(x: number, z: number): void;
  syncCars(cars: Array<{ x: number; z: number; police?: boolean }>): void;
  blocked(
    from: { x: number; z: number },
    to: { x: number; z: number },
  ): boolean;
  position(): { x: number; z: number };
};

/** Rapier's XY world is mapped to the game's XZ plane. */
export async function createPhysicsBridge(): Promise<PhysicsBridge> {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: 0 });
  const playerBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased(),
  );
  world.createCollider(
    RAPIER.ColliderDesc.ball(1.35).setRestitution(0.15),
    playerBody,
  );
  const boundary = [
    [-80, 0, 1, 80],
    [80, 0, 1, 80],
    [0, -80, 80, 1],
    [0, 80, 80, 1],
  ];
  for (const [x, y, hx, hy] of boundary) {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(x, y),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy), body);
  }
  // Matches world.ts building footprint.
  for (let x = -77; x <= 77; x += 11)
    for (let z = -77; z <= 77; z += 11) {
      if (Math.abs(x % 22) < 6 || Math.abs(z % 22) < 6) continue;
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(x, z),
      );
      world.createCollider(RAPIER.ColliderDesc.cuboid(BUILDING_HALF, BUILDING_HALF), body);
    }
  const carBodies: RAPIER.RigidBody[] = [];
  world.timestep = 1 / 60;
  world.step();
  return {
    world,
    playerBody,
    step(dt) {
      world.timestep = Math.min(Math.max(dt, 1 / 240), 1 / 20);
      world.step();
    },
    syncPosition(x, z) {
      playerBody.setNextKinematicTranslation({ x, y: z });
    },
    syncCars(cars) {
      while (carBodies.length < cars.length) {
        const body = world.createRigidBody(
          RAPIER.RigidBodyDesc.kinematicPositionBased(),
        );
        world.createCollider(
          RAPIER.ColliderDesc.ball(
            cars[carBodies.length]?.police ? 1.35 : 1.25,
          ),
          body,
        );
        carBodies.push(body);
      }
      cars.forEach((car, index) =>
        carBodies[index].setNextKinematicTranslation({ x: car.x, y: car.z }),
      );
    },
    blocked(from, to) {
      const dx = to.x - from.x,
        dy = to.z - from.z;
      if (Math.abs(dx) + Math.abs(dy) < 1e-8) return false;
      // Rapier shape cast against the static building colliders. The dynamic
      // car proxies are excluded by testing only the fixed collider handles.
      const hit = world.castShape(
        { x: from.x, y: from.z },
        0,
        { x: dx, y: dy },
        new RAPIER.Ball(1.35),
        0,
        1,
        true,
        RAPIER.QueryFilterFlags.ONLY_FIXED,
      );
      return Boolean(hit);
    },
    position() {
      const p = playerBody.translation();
      return { x: p.x, z: p.y };
    },
  };
}
