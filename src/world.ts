import * as THREE from "three";
import { ROAD, WORLD } from "./simulation";

type Tile = { x: number; y: number };
const surfaces: THREE.MeshStandardMaterial[] = [];
const checkpointDecalMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  side: THREE.DoubleSide,
});

function mat(color: number, roughness = 0.8, metalness = 0.05) {
  const value = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  surfaces.push(value);
  return value;
}

function cropAtlas(
  image: HTMLImageElement,
  tile: Tile,
  repeatX = 1,
  repeatY = 1,
) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth / 2;
  canvas.height = image.naturalHeight / 2;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.drawImage(
    image,
    tile.x * canvas.width,
    tile.y * canvas.height,
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.repeat.set(repeatX, repeatY);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function box(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  surface: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), surface);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function createWorld(scene: THREE.Scene) {
  scene.background = new THREE.Color(0x2b2342);
  scene.fog = new THREE.Fog(0x2b2342, 72, 190);
  scene.add(new THREE.HemisphereLight(0xffc79f, 0x182143, 1.8));
  const sunset = new THREE.DirectionalLight(0xffa36f, 2.8);
  sunset.position.set(-45, 75, 32);
  sunset.castShadow = true;
  sunset.shadow.mapSize.set(2048, 2048);
  sunset.shadow.camera.left = -110;
  sunset.shadow.camera.right = 110;
  sunset.shadow.camera.top = 110;
  sunset.shadow.camera.bottom = -110;
  scene.add(sunset);

  box(scene, 0, -1, 0, WORLD * 2.4, 1, WORLD * 2.4, mat(0x171b31));
  const road = mat(0x30334a, 0.96);
  const lane = mat(0xf5b968, 0.5);
  for (let coordinate = -66; coordinate <= 66; coordinate += 22) {
    box(scene, coordinate, 0, 0, ROAD, 0.12, WORLD * 2, road);
    box(scene, 0, 0, coordinate, WORLD * 2, 0.12, ROAD, road);
    for (let mark = -80; mark < 80; mark += 10) {
      box(scene, coordinate, 0.09, mark, 0.16, 0.03, 3.2, lane);
      box(scene, mark, 0.09, coordinate, 3.2, 0.03, 0.16, lane);
    }
  }

  const colors = [0x383b5a, 0x454263, 0x2e405e, 0x4a3956];
  for (let x = -77; x <= 77; x += 11)
    for (let z = -77; z <= 77; z += 11) {
      if (Math.abs(x % 22) < 6 || Math.abs(z % 22) < 6) continue;
      const height = 8 + (Math.abs(x * 3 + z * 5) % 15);
      const building = new THREE.Group();
      building.position.set(x, 0, z);
      box(
        building,
        0,
        height / 2,
        0,
        8,
        height,
        8,
        mat(colors[Math.abs(x + z) % colors.length]),
      );
      for (let y = 3; y < height - 1; y += 3) {
        box(building, 0, y, -4.04, 5.8, 0.95, 0.08, mat(0x8dd6d1, 0.35, 0.1));
        box(building, -4.04, y, 0, 0.08, 0.95, 5.8, mat(0x72bdc8, 0.35, 0.1));
      }
      scene.add(building);
    }

  scene.userData.atlasSource = "./assets/city-atlas-2026-09-09.png";
  scene.userData.decalReady = false;
  new THREE.TextureLoader().load(scene.userData.atlasSource, (loaded) => {
    scene.userData.atlasReady = true;
    const roadTexture = cropAtlas(loaded.image, { x: 0, y: 0 }, 2, 30);
    const facadeTexture = cropAtlas(loaded.image, { x: 1, y: 0 }, 2, 2);
    const paintTexture = cropAtlas(loaded.image, { x: 0, y: 1 }, 1, 1);
    for (const surface of surfaces) {
      const color = surface.color.getHex();
      if (color === 0x30334a) surface.map = roadTexture ?? null;
      if (
        color === 0x383b5a ||
        color === 0x454263 ||
        color === 0x2e405e ||
        color === 0x4a3956
      )
        surface.map = facadeTexture ?? null;
      if (
        color === 0x13c8c5 ||
        color === 0xe26a55 ||
        color === 0xd4a84f ||
        color === 0x736dd0 ||
        color === 0xe5e1d6
      )
        surface.map = paintTexture ?? null;
      surface.needsUpdate = true;
    }
  });
  new THREE.TextureLoader().load(
    "./assets/checkpoint-decal-2026-09-09.png",
    (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      checkpointDecalMaterial.map = loaded;
      checkpointDecalMaterial.needsUpdate = true;
      scene.userData.decalReady = true;
    },
  );
}

function wheel(car: THREE.Group, x: number, z: number) {
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16),
    mat(0x0b0d16, 0.9),
  );
  tire.rotation.z = Math.PI / 2;
  tire.position.set(x, 0.42, z);
  tire.castShadow = true;
  car.add(tire);
}

export function carMesh(police = false, paint = 0x13c8c5) {
  const car = new THREE.Group();
  const body = mat(police ? 0xe8e5df : paint, 0.24, 0.65);
  box(car, 0, 0.76, 0, 2.45, 0.62, 4.1, body);
  box(
    car,
    0,
    1.12,
    -0.2,
    1.72,
    0.58,
    1.9,
    mat(police ? 0x20263a : 0x112c46, 0.18, 0.4),
  );
  box(car, 0, 0.91, 1.75, 2.05, 0.16, 0.62, body);
  box(car, 0, 1.04, -1.8, 2.05, 0.16, 0.62, body);
  for (const side of [-1, 1])
    for (const end of [-1.35, 1.35]) wheel(car, side * 1.18, end);
  const headlight = new THREE.MeshBasicMaterial({ color: 0xfff4c2 });
  const tailLight = new THREE.MeshBasicMaterial({ color: 0xf23d5b });
  for (const side of [-0.68, 0.68]) {
    box(car, side, 0.82, 2.08, 0.32, 0.18, 0.08, headlight);
    box(car, side, 0.82, -2.08, 0.32, 0.18, 0.08, tailLight);
  }
  if (police) {
    box(car, 0, 1.55, -0.2, 1.06, 0.14, 0.25, mat(0x253355, 0.2));
    const redBeacon = box(
      car,
      -0.28,
      1.66,
      -0.2,
      0.42,
      0.12,
      0.2,
      new THREE.MeshBasicMaterial({ color: 0xff315d }),
    );
    const blueBeacon = box(
      car,
      0.28,
      1.66,
      -0.2,
      0.42,
      0.12,
      0.2,
      new THREE.MeshBasicMaterial({ color: 0x4185ff }),
    );
    const red = new THREE.PointLight(0xff315d, 3, 9);
    red.position.set(-0.35, 1.8, -0.2);
    car.add(red);
    const blue = new THREE.PointLight(0x4185ff, 3, 9);
    blue.position.set(0.35, 1.8, -0.2);
    car.add(blue);
    red.visible = false;
    blue.visible = false;
    redBeacon.visible = false;
    blueBeacon.visible = false;
    car.userData.policeLights = [red, blue];
    car.userData.policeBeacons = [redBeacon, blueBeacon];
  }
  return car;
}

export function setPoliceActive(car: THREE.Object3D, active: boolean) {
  const lights = car.userData.policeLights as THREE.PointLight[] | undefined;
  lights?.forEach((light) => (light.visible = active));
  const beacons = car.userData.policeBeacons as THREE.Object3D[] | undefined;
  beacons?.forEach((beacon) => (beacon.visible = active));
  car.userData.policeActive = active;
}

export function checkpointMesh() {
  const gate = new THREE.Group();
  const glow = mat(0xffb743, 0.24, 0.25);
  box(gate, -3, 2, 0, 0.28, 4, 0.28, glow);
  box(gate, 3, 2, 0, 0.28, 4, 0.28, glow);
  box(gate, 0, 4, 0, 6.25, 0.28, 0.28, glow);
  const decal = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 6.4),
    checkpointDecalMaterial,
  );
  decal.name = "checkpoint-decal";
  decal.rotation.x = -Math.PI / 2;
  decal.position.y = 0.13;
  gate.add(decal);
  gate.userData.decal = decal;
  return gate;
}

export function syncObject(
  object: THREE.Object3D,
  position: { x: number; z: number },
  heading: number,
) {
  object.position.set(position.x, 0, position.z);
  object.rotation.y = heading;
}
