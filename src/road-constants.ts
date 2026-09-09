export const WORLD = 80;
export const ROAD = 12;
export const GRID = 22;
export const ROAD_HALF = ROAD / 2;
export const LANE_OFFSET = 3;
export const BUILDING_HALF = 3.5;
export const CAR_RADIUS = 1.35;
export const COLLISION_CLEARANCE = 3.8;

export type RoadVec = { x: number; z: number };

/** Forward is (sin heading, cos heading), so this is the driver's right. */
export function rightVector(heading: number): RoadVec {
  return { x: -Math.cos(heading), z: Math.sin(heading) };
}

export function laneAnchor(position: RoadVec, heading: number): RoadVec {
  const right = rightVector(heading);
  return {
    x: position.x - right.x * LANE_OFFSET,
    z: position.z - right.z * LANE_OFFSET,
  };
}

export function isOnRoad(position: RoadVec): boolean {
  const grid = Math.max(-66, Math.min(66, Math.round(position.x / GRID) * GRID));
  const gridZ = Math.max(-66, Math.min(66, Math.round(position.z / GRID) * GRID));
  return Math.abs(position.x - grid) < ROAD_HALF || Math.abs(position.z - gridZ) < ROAD_HALF;
}
