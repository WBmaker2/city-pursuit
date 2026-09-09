import * as THREE from "three";
import {
  createState,
  debugSnapshot,
  initPhysics,
  step,
  type GameState,
  type Input,
  WORLD,
  ESCAPE_SECONDS,
  SPEED_LIMIT_KMH,
  SPEEDING_THRESHOLD_SECONDS,
  BOOST_SPEED,
  MAX_SPEED,
} from "./simulation";
import { carMesh, checkpointMesh, createWorld, setPoliceActive, syncObject } from "./world";
import { ROAD } from "./road-constants";
import { shellMarkup, setupModal } from "./ui";
import "./style.css";

const app = document.querySelector("#app") as HTMLElement;
app.innerHTML = shellMarkup(SPEED_LIMIT_KMH, SPEEDING_THRESHOLD_SECONDS, ESCAPE_SECONDS, MAX_SPEED * 8, BOOST_SPEED * 8);
const mapLegend = document.createElement("div");
mapLegend.className = "map-legend";
mapLegend.setAttribute("aria-label", "미니맵 범례");
mapLegend.innerHTML =
  '<span><i class="legend-arrow legend-player"></i>나</span><span><i class="legend-arrow legend-traffic"></i>일반차</span><span><i class="legend-arrow legend-police"></i>경찰</span>';
document.querySelector(".right-rail")?.insertBefore(mapLegend, document.querySelector(".meters"));

let physicsReady = false;
const physicsInit = initPhysics()
  .then(() => {
    physicsReady = true;
    state = createState();
    state.status = "paused";
    const button = document.querySelector("#start") as HTMLButtonElement;
    button.disabled = false;
    button.textContent = "주행 시작 ↗";
  })
  .catch(() => {
    const fallbackMessage = document.querySelector(
      "#fallback-copy",
    ) as HTMLElement;
    fallbackMessage.textContent =
      "물리 엔진을 준비하지 못했습니다. 다시 불러와 주세요.";
    (document.querySelector("#fallback") as HTMLElement).hidden = false;
  });

const fallback = document.querySelector("#fallback") as HTMLElement;
let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
} catch {
  fallback.hidden = false;
  throw new Error("WebGL unavailable");
}
renderer.domElement.className = "scene-canvas";
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(innerWidth, innerHeight);
app.append(renderer.domElement);
const scene = new THREE.Scene();
createWorld(scene);
const camera = new THREE.PerspectiveCamera(
  56,
  innerWidth / innerHeight,
  0.1,
  240,
);
camera.position.set(0, 9, 15);
let state: GameState = createState();
state.status = "paused";
const player = carMesh(false, 0x13c8c5);
scene.add(player);
const traffic = state.traffic.map((_, index) => {
  const mesh = carMesh(
    false,
    [0xe26a55, 0xd4a84f, 0x736dd0, 0xe5e1d6][index % 4],
  );
  scene.add(mesh);
  return mesh;
});
const police = state.police.map(() => {
  const mesh = carMesh(true);
  scene.add(mesh);
  return mesh;
});
const checkpoints = state.checkpoints.map(() => {
  const mesh = checkpointMesh();
  scene.add(mesh);
  return mesh;
});
const input: Input = {
  up: false,
  down: false,
  left: false,
  right: false,
  boost: false,
  handbrake: false,
};
const keyMap: Record<string, keyof Input> = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  ShiftLeft: "boost",
  ShiftRight: "boost",
  Space: "handbrake",
};
function clearInput() {
  for (const key of Object.keys(input) as (keyof Input)[]) input[key] = false;
}
function restart() {
  state = createState();
  state.status = "playing";
  clearInput();
  (document.querySelector("#result") as HTMLElement).hidden = true;
  (document.querySelector("#modal") as HTMLElement).hidden = true;
  (document.querySelector("#start-card") as HTMLElement).hidden = true;
  (document.querySelector("#hud") as HTMLElement).hidden = false;
}
function togglePause() {
  if (state.status === "won" || state.status === "lost") return;
  state.status = state.status === "paused" ? "playing" : "paused";
}
let modalController: ReturnType<typeof setupModal>;
addEventListener("keydown", (event) => {
  if (modalController.isOpen()) {
    if (event.code === "Escape") modalController.dismiss();
    if (event.code === "Tab" || event.code === "Enter" || event.code === "Space") return;
    if (keyMap[event.code] || ["KeyP", "KeyR", "Escape"].includes(event.code)) event.preventDefault();
    return;
  }
  const mapped = keyMap[event.code];
  if (mapped) {
    input[mapped] = true;
    event.preventDefault();
  }
  if (!event.repeat && event.code === "KeyR") restart();
  if (
    !event.repeat &&
    (event.code === "KeyP" || event.code === "Escape") &&
    !(document.querySelector("#start-card") as HTMLElement).hidden
  )
    return;
  if (!event.repeat && (event.code === "KeyP" || event.code === "Escape"))
    togglePause();
});
addEventListener("keyup", (event) => {
  const mapped = keyMap[event.code];
  if (mapped) input[mapped] = false;
});
addEventListener("blur", () => {
  clearInput();
  if (state.status === "playing") state.status = "paused";
});
const startButton = document.querySelector("#start") as HTMLButtonElement;
startButton.disabled = true;
startButton.textContent = "물리 엔진 준비 중…";
document.querySelector("#start")!.addEventListener("click", () => {
  if (!physicsReady) return;
  state.status = "playing";
  (document.querySelector("#start-card") as HTMLElement).hidden = true;
  (document.querySelector("#hud") as HTMLElement).hidden = false;
});
document.querySelector("#pause")!.addEventListener("click", togglePause);
document.querySelector("#restart")!.addEventListener("click", restart);
const modal = document.querySelector("#modal") as HTMLElement;
let statusBeforeHelp: GameState["status"] = "paused";
modalController = setupModal(modal, () => {
  statusBeforeHelp = state.status;
  clearInput();
  if (state.status === "playing") state.status = "paused";
}, () => {
  clearInput();
  if (statusBeforeHelp === "playing") state.status = "playing";
});
document.querySelector("#help")!.addEventListener("click", () =>
  modalController.open(false, document.querySelector("#help") as HTMLElement),
);
document.querySelector("#updates")!.addEventListener("click", () =>
  modalController.open(true, document.querySelector("#updates") as HTMLElement),
);
document.querySelectorAll<HTMLButtonElement>("[data-key]").forEach((button) => {
  const key = button.dataset.key as keyof Input;
  const down = (event: Event) => {
    event.preventDefault();
    if (modalController.isOpen()) return;
    input[key] = true;
  };
  const up = () => {
    input[key] = false;
  };
  button.addEventListener("pointerdown", down);
  button.addEventListener("pointerup", up);
  button.addEventListener("pointerleave", up);
  button.addEventListener("pointercancel", up);
});

function updateHud() {
  const reached = state.checkpoints.filter(
    (checkpoint) => checkpoint.reached,
  ).length;
  const next = state.checkpoints.findIndex((checkpoint) => !checkpoint.reached);
  const target = next >= 0 ? state.checkpoints[next].pos : state.player.pos;
  const distance = Math.round(
    Math.hypot(target.x - state.player.pos.x, target.z - state.player.pos.z),
  );
  (document.querySelector("#speed") as HTMLElement).textContent = String(
    Math.round(Math.hypot(state.player.vel.x, state.player.vel.z) * 8),
  );
  (document.querySelector("#score") as HTMLElement).textContent = Math.round(
    state.score,
  ).toLocaleString();
  (document.querySelector("#cp") as HTMLElement).textContent =
    `${reached}/${state.checkpoints.length}`;
  (document.querySelector("#timer") as HTMLElement).textContent = String(
    Math.max(0, Math.ceil(180 - state.time)),
  );
  (document.querySelector("#damage") as HTMLElement).textContent =
    `${Math.max(0, 100 - Math.round(state.player.damage))}%`;
  (document.querySelector("#pursuit") as HTMLElement).textContent =
    state.wanted ? `${Math.round(state.pursuit)}%` : "CALM";
  const wantedPanel = document.querySelector("#wanted-panel") as HTMLElement;
  wantedPanel.hidden = !state.wanted && state.clearMessageTime <= 0;
  (document.querySelector("#wanted-title") as HTMLElement).textContent =
    state.wanted ? "⚠ 경찰 추격 중" : "✓ 추격 해제";
  (document.querySelector("#wanted-reason") as HTMLElement).textContent =
    state.wantedReason === "speeding"
      ? `과속 신고 · ${SPEED_LIMIT_KMH}km/h 제한을 ${SPEEDING_THRESHOLD_SECONDS}초 초과`
      : state.wantedReason === "vehicle-crash"
        ? "차량 충돌 신고 · 움직이는 중 다른 차량과 충돌"
        : "이제 자유롭게 주행할 수 있습니다.";
  (document.querySelector("#escape-countdown") as HTMLElement).textContent =
    state.wanted
      ? state.escapeTime > 0
        ? `추격 해제까지 ${Math.max(0, ESCAPE_SECONDS - state.escapeTime).toFixed(1)}초`
        : `경찰과 거리를 벌리세요 · ${ESCAPE_SECONDS.toFixed(1)}초 대기`
      : "경찰이 추격을 멈췄습니다.";
  (document.querySelector("#mission") as HTMLElement).textContent =
    next < 0
      ? "ESCAPE"
      : `CHECKPOINT ${String(next + 1).padStart(2, "0")} · ${distance}M`;
  (document.querySelector("#hint") as HTMLElement).textContent =
    state.status === "paused"
      ? "일시정지 · P 또는 버튼으로 계속"
      : state.wanted
        ? `42m 이상 거리를 ${ESCAPE_SECONDS}초 유지하세요`
        : next < 0
        ? "경찰과 거리를 벌리세요"
        : "황금 게이트를 통과하세요";
}
function drawMap() {
  const canvas = document.querySelector("#map") as HTMLCanvasElement;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#12162b";
  context.fillRect(0, 0, 150, 150);
  context.strokeStyle = "#373b5b";
  context.lineWidth = (ROAD / WORLD) * 62;
  for (let coordinate = -66; coordinate <= 66; coordinate += 22) {
    const pixel = 75 + (coordinate / WORLD) * 62;
    context.beginPath();
    context.moveTo(pixel, 0);
    context.lineTo(pixel, 150);
    context.moveTo(0, pixel);
    context.lineTo(150, pixel);
    context.stroke();
  }
  const dot = (
    position: { x: number; z: number },
    color: string,
    radius = 4,
  ) => {
    context.fillStyle = color;
    context.beginPath();
    context.arc(
      75 + (position.x / WORLD) * 62,
      75 + (position.z / WORLD) * 62,
      radius,
      0,
      Math.PI * 2,
    );
    context.fill();
  };
  const directionMarker = (
    car: { pos: { x: number; z: number }; heading: number },
    color: string,
    size = 1,
  ) => {
    const x = 75 + (car.pos.x / WORLD) * 62;
    const y = 75 + (car.pos.z / WORLD) * 62;
    const forward = { x: Math.sin(car.heading), y: Math.cos(car.heading) };
    const side = { x: forward.y, y: -forward.x };
    const tip = { x: x + forward.x * 4.2 * size, y: y + forward.y * 4.2 * size };
    const left = {
      x: x + (-forward.x * 2.4 + side.x * 2.1) * size,
      y: y + (-forward.y * 2.4 + side.y * 2.1) * size,
    };
    const right = {
      x: x + (-forward.x * 2.4 - side.x * 2.1) * size,
      y: y + (-forward.y * 2.4 - side.y * 2.1) * size,
    };
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(tip.x, tip.y);
    context.lineTo(left.x, left.y);
    context.lineTo(right.x, right.y);
    context.closePath();
    context.fill();
  };
  const next = state.checkpoints.findIndex((entry) => !entry.reached);
  state.checkpoints.forEach((checkpoint, index) => {
    if (index === next) dot(checkpoint.pos, "#ffb743", 5);
  });
  state.traffic.forEach((car) => directionMarker(car, "#d8f7ff", 0.85));
  state.police.forEach((car) => directionMarker(car, state.wanted ? "#ff4769" : "#7f829d", 0.9));
  directionMarker(state.player, "#23ddd0", 1.35);
}
function showResult() {
  const result = document.querySelector("#result") as HTMLElement;
  if (!result.hidden) return;
  result.hidden = false;
  (document.querySelector("#result-kicker") as HTMLElement).textContent =
    state.status === "won" ? "RUN COMPLETE" : "RUN ENDED";
  (document.querySelector("#result-title") as HTMLElement).textContent =
    state.status === "won" ? "ESCAPED" : "BUSTED";
  (document.querySelector("#result-copy") as HTMLElement).textContent =
    state.status === "won"
      ? "도시를 빠져나왔습니다. 멋진 운전입니다."
      : "차량이 더는 달릴 수 없습니다. 다시 도전해 보세요.";
}
let last = performance.now();
let accumulator = 0;
let manualMode = false;
function checkpointDecalRotation(index: number) {
  const target = state.checkpoints[index].pos;
  const previous = index === 0 ? { x: 0, z: 66 } : state.checkpoints[index - 1].pos;
  const dx = target.x - previous.x;
  const dz = target.z - previous.z;
  // The final leg is diagonal in data, but the city route is orthogonal: use
  // its Z leg for a readable road-aligned arrow.
  const routeX = dz === 0 ? Math.sign(dx) : 0;
  const routeZ = dz === 0 ? 0 : Math.sign(dz);
  return Math.atan2(routeX, routeZ) + Math.PI;
}
function syncView() {
  syncObject(player, state.player.pos, state.player.heading);
  state.traffic.forEach((car, index) =>
    syncObject(traffic[index], car.pos, car.heading),
  );
  state.police.forEach((car, index) =>
    syncObject(police[index], car.pos, car.heading),
  );
  police.forEach((mesh) => setPoliceActive(mesh, state.wanted));
  const next = state.checkpoints.findIndex((entry) => !entry.reached);
  state.checkpoints.forEach((checkpoint, index) => {
    checkpoints[index].visible = index === next;
    syncObject(checkpoints[index], checkpoint.pos, 0);
    checkpoints[index].rotation.y = checkpointDecalRotation(index);
  });
  const forward = {
    x: Math.sin(state.player.heading),
    z: Math.cos(state.player.heading),
  };
  camera.position.lerp(
    new THREE.Vector3(
      state.player.pos.x - forward.x * 11,
      8.5,
      state.player.pos.z - forward.z * 11,
    ),
    0.1,
  );
  camera.lookAt(
    state.player.pos.x + forward.x * 8,
    1.2,
    state.player.pos.z + forward.z * 8,
  );
}
function frame(now: number) {
  if (!manualMode) {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    accumulator += elapsed;
    while (accumulator >= 1 / 60) {
      step(state, input, 1 / 60);
      accumulator -= 1 / 60;
    }
  }
  syncView();
  renderer.render(scene, camera);
  updateHud();
  drawMap();
  if (state.status === "won" || state.status === "lost") showResult();
  requestAnimationFrame(frame);
}
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
renderer.domElement.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  clearInput();
  state.status = "paused";
  fallback.hidden = false;
  (document.querySelector("#fallback-copy") as HTMLElement).textContent =
    "3D 그래픽 연결이 끊겼습니다. 페이지를 다시 불러와 주세요.";
});
document
  .querySelector("#fallback-reload")!
  .addEventListener("click", () => location.reload());
requestAnimationFrame(frame);
if (location.search.includes("debug")) {
  (window as any).render_game_to_text = () =>
    JSON.stringify(debugSnapshot(state));
  (window as any).captureFrame = () => {
    syncView();
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL("image/png");
  };
  (window as any).getState = () => structuredClone(state);
  (window as any).graphicsStats = () => ({
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    textures: renderer.info.memory.textures,
    atlasReady: Boolean(scene.userData.atlasReady),
    atlasSource: scene.userData.atlasSource,
    decalReady: Boolean(scene.userData.decalReady),
    visibleCheckpointDecal: (() => {
      const index = state.checkpoints.findIndex((entry) => !entry.reached);
      if (index < 0) return null;
      const gate = checkpoints[index];
      const decal = gate.userData.decal as THREE.Mesh;
      return {
        index,
        position: { x: gate.position.x, y: decal.position.y, z: gate.position.z },
        rotationY: gate.rotation.y,
        opacity: (decal.material as THREE.MeshBasicMaterial).opacity,
        visible: decal.visible && gate.visible,
      };
    })(),
  });
  (window as any).setManualMode = (enabled: boolean) => {
    manualMode = enabled;
  };
  (window as any).advanceTime = (milliseconds: number) => {
    const ticks = Math.floor(milliseconds / (1000 / 60));
    for (let tick = 0; tick < ticks; tick += 1) step(state, input, 1 / 60);
    syncView();
    updateHud();
    drawMap();
    return debugSnapshot(state);
  };
  (window as any).setGameState = (value: Partial<GameState>) =>
    Object.assign(state, value);
}
