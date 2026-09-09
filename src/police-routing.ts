import { GRID, LANE_OFFSET } from "./road-constants";

/** Directed, right-hand-traffic routing for pursuit cars.
 *
 * The graph deliberately uses the four lane corners of each intersection.
 * Edges between intersections are axis aligned; the short corner-to-corner
 * edges are the only places where a turn is allowed.
 */
export type RoutingVec = { x: number; z: number };

export type RoutingCar = {
  pos: RoutingVec;
  vel: RoutingVec;
  heading: number;
  waypoint?: RoutingVec;
  impactTime?: number;
};

type Node = RoutingVec & { key: string };
type Edge = { from: Node; to: Node };
type RouteMemory = {
  points: RoutingVec[];
  target: RoutingVec;
  segment: number;
  lastPosition: RoutingVec;
};

const LANE = LANE_OFFSET;
const MIN = -66;
const MAX = 66;
const SPEED = 15;
const EPSILON = 0.35;
const routeMemory = new WeakMap<object, RouteMemory>();

const keyOf = (x: number, z: number) => `${x},${z}`;
const distance = (a: RoutingVec, b: RoutingVec) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function makeGraph() {
  const nodes = new Map<string, Node>();
  const edges: Edge[] = [];
  const get = (x: number, z: number) => {
    const key = keyOf(x, z);
    let n = nodes.get(key);
    if (!n) {
      n = { x, z, key };
      nodes.set(key, n);
    }
    return n;
  };
  const add = (from: Node, to: Node) => edges.push({ from, to });

  for (let cx = MIN; cx <= MAX; cx += GRID) {
    for (let cz = MIN; cz <= MAX; cz += GRID) {
      const sw = get(cx - LANE, cz + LANE);
      const se = get(cx + LANE, cz + LANE);
      const nw = get(cx - LANE, cz - LANE);
      const ne = get(cx + LANE, cz - LANE);

      // The directed intersection ring. The additional corner connections
      // encode straight, left, right, and U-turn choices at this junction.
      add(sw, nw);
      add(nw, ne);
      add(ne, se);
      add(se, sw);
      for (const from of [sw, se, nw, ne]) {
        for (const to of [sw, se, nw, ne]) {
          if (from !== to) add(from, to);
        }
      }

      // South row: +X. North row: -X.
      if (cx < MAX) add(sw, get(cx + GRID - LANE, cz + LANE));
      if (cx > MIN) add(ne, get(cx - GRID + LANE, cz - LANE));
      // East column: -Z. West column: +Z.
      if (cz > MIN) add(se, get(cx + LANE, cz - GRID + LANE));
      if (cz < MAX) add(nw, get(cx - LANE, cz + GRID - LANE));
    }
  }
  const outgoing = new Map<string, Edge[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.from.key) ?? [];
    list.push(edge);
    outgoing.set(edge.from.key, list);
  }
  return { nodes, edges, outgoing };
}

const GRAPH = makeGraph();

function project(point: RoutingVec, a: RoutingVec, b: RoutingVec): RoutingVec {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length2 = dx * dx + dz * dz;
  const t = length2 === 0 ? 0 : clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / length2, 0, 1);
  return { x: a.x + dx * t, z: a.z + dz * t };
}

function nearestEdge(point: RoutingVec) {
  let best: { edge: Edge; point: RoutingVec; distance: number } | undefined;
  for (const edge of GRAPH.edges) {
    const projected = project(point, edge.from, edge.to);
    const d = distance(point, projected);
    if (!best || d < best.distance) best = { edge, point: projected, distance: d };
  }
  return best;
}

function findPath(start: Node, goal: Node, canTravel: (from: RoutingVec, to: RoutingVec) => boolean) {
  const queue: Node[] = [start];
  const previous = new Map<string, Node | undefined>([[start.key, undefined]]);
  while (queue.length) {
    const current = queue.shift()!;
    if (current.key === goal.key) break;
    for (const edge of GRAPH.outgoing.get(current.key) ?? []) {
      if (!canTravel(edge.from, edge.to) || previous.has(edge.to.key)) continue;
      previous.set(edge.to.key, current);
      queue.push(edge.to);
    }
  }
  if (!previous.has(goal.key)) return [];
  const path: Node[] = [];
  for (let cursor: Node | undefined = goal; cursor; cursor = previous.get(cursor.key)) path.push(cursor);
  return path.reverse();
}

function limitedRecovery(from: RoutingVec, to: RoutingVec) {
  const d = distance(from, to);
  if (d <= 3.5) return to;
  const scale = 3.5 / d;
  return { x: from.x + (to.x - from.x) * scale, z: from.z + (to.z - from.z) * scale };
}

function makeRoute(car: RoutingCar, player: RoutingCar, canTravel: (from: RoutingVec, to: RoutingVec) => boolean) {
  const start = nearestEdge(car.pos);
  const goal = nearestEdge(player.pos);
  if (!start || !goal) return [car.pos, player.pos];
  // If both cars are on the same directed lane segment and the target is
  // ahead, preserve that segment. This avoids an unnecessary trip around an
  // intersection when the player is already directly reachable.
  if (start.edge === goal.edge) {
    const dx = start.edge.to.x - start.edge.from.x;
    const dz = start.edge.to.z - start.edge.from.z;
    const ahead = (goal.point.x - start.point.x) * dx + (goal.point.z - start.point.z) * dz;
    if (ahead >= -0.01) {
      const entry = limitedRecovery(car.pos, start.point);
      return distance(car.pos, entry) > EPSILON ? [entry, goal.point] : [goal.point];
    }
  }
  const path = findPath(start.edge.to, goal.edge.from, canTravel);
  const points: RoutingVec[] = [];
  const entry = limitedRecovery(car.pos, start.point);
  if (distance(car.pos, entry) > EPSILON) points.push(entry);
  for (const node of path) points.push({ x: node.x, z: node.z });
  points.push(goal.point);
  if (!points.length) points.push(goal.point);
  return points;
}

/** Advance one police car at 15 units/s along a legal directed lane route. */
export function updatePolice(
  car: RoutingCar,
  player: RoutingCar,
  dt: number,
  canTravel: (from: RoutingVec, to: RoutingVec) => boolean,
) {
  if ((car.impactTime ?? 0) > 0) {
    routeMemory.delete(car as object);
    car.vel = { x: 0, z: 0 };
    return;
  }
  if (dt <= 0) return;
  const memory = routeMemory.get(car as object);
  const targetChanged = !memory || distance(memory.target, player.pos) > 3;
  const displaced = !memory || distance(memory.lastPosition, car.pos) > SPEED * 0.45;
  if (targetChanged || displaced || memory!.segment >= memory!.points.length) {
    const points = makeRoute(car, player, canTravel);
    routeMemory.set(car as object, {
      points,
      target: { ...player.pos },
      segment: 0,
      lastPosition: { ...car.pos },
    });
  }
  const active = routeMemory.get(car as object)!;
  let remaining = SPEED * dt;
  while (remaining > 0 && active.segment < active.points.length) {
    const target = active.points[active.segment];
    const d = distance(car.pos, target);
    if (d < EPSILON) {
      active.segment++;
      continue;
    }
    const step = Math.min(remaining, d);
    const next = { x: car.pos.x + ((target.x - car.pos.x) / d) * step, z: car.pos.z + ((target.z - car.pos.z) / d) * step };
    if (!canTravel(car.pos, next)) {
      active.points = makeRoute(car, player, canTravel);
      active.segment = 0;
      car.vel = { x: 0, z: 0 };
      return;
    }
    car.vel = { x: ((next.x - car.pos.x) / step) * SPEED, z: ((next.z - car.pos.z) / step) * SPEED };
    car.pos = next;
    car.heading = Math.atan2(car.vel.x, car.vel.z);
    remaining -= step;
    if (step >= d - EPSILON) active.segment++;
  }
  car.waypoint = active.points[Math.min(active.segment, active.points.length - 1)];
  active.lastPosition = { ...car.pos };
}

export const POLICE_SPEED = SPEED;
