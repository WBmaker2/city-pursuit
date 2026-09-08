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
} from "./simulation";
import { carMesh, checkpointMesh, createWorld, setPoliceActive, syncObject } from "./world";
import "./style.css";

const app = document.querySelector("#app") as HTMLElement;
app.innerHTML = `<main class="game-shell"><div id="fallback" class="fallback" hidden><strong>이 브라우저에서는 3D 화면을 열 수 없습니다.</strong><span id="fallback-copy">WebGL을 켜거나 최신 브라우저에서 다시 시도해 주세요.</span><button id="fallback-reload" class="primary">다시 불러오기</button></div><section class="start-card" id="start-card"><p class="eyebrow">NEON DISTRICT · 01</p><h1>CITY <em>PURSUIT</em></h1><p>처음에는 평화로운 자유 주행입니다. ${SPEED_LIMIT_KMH}km/h를 ${SPEEDING_THRESHOLD_SECONDS}초 넘기거나 움직이며 다른 차량과 부딪힐 때만 경찰 추격이 시작됩니다.</p><button id="start" class="primary gi-pulse">주행 시작 <span>↗</span></button><div class="keys"><span>WASD / 방향키</span><span>운전</span><span>SHIFT</span><span>부스트</span><span>SPACE</span><span>핸드브레이크</span><span>S / ↓</span><span>브레이크·후진</span></div></section><section id="hud" class="hud" hidden><div class="topbar"><div class="logo">CITY <em>PURSUIT</em><small>NEON DISTRICT // NIGHT RUN</small></div><div class="stats"><div><small>SPEED</small><b id="speed">0</b><i>KM/H</i></div><div><small>SCORE</small><b id="score">0</b><i>PTS</i></div><div><small>GATES</small><b id="cp">0/5</b><i>ROUTE</i></div><div><small>TIME</small><b id="timer">180</b><i>SEC</i></div></div><button id="pause" class="icon-button">Ⅱ</button></div><div class="mission"><small>NEXT OBJECTIVE</small><strong id="mission">CHECKPOINT 01</strong><span id="hint">황금 게이트를 통과하세요</span></div><aside class="right-rail"><canvas id="map" width="150" height="150"></canvas><div class="meters"><div><span>VEHICLE</span><b id="damage">100%</b></div><div><span>PURSUIT</span><b id="pursuit">CALM</b></div></div></aside><aside id="wanted-panel" class="wanted-panel" hidden><strong id="wanted-title">⚠ 경찰 추격</strong><span id="wanted-reason"></span><b id="escape-countdown"></b><small>경찰과 42m 이상 거리를 ${ESCAPE_SECONDS}초 연속 유지하면 추격이 해제됩니다. 가까워지면 시간이 초기화됩니다.</small></aside><button id="help" class="help">조작 · 업데이트</button><div id="touch" class="touch"><button data-key="left">◀</button><button data-key="up">▲</button><button data-key="down">▼</button><button data-key="right">▶</button><button data-key="boost">BOOST</button></div></section><div id="modal" class="modal" hidden><div class="modal-card"><button id="close" class="close">×</button><p class="eyebrow">DRIVER BRIEFING</p><h2>조작 안내</h2><p>WASD 또는 방향키로 운전하고 SHIFT로 부스트, SPACE로 핸드브레이크를 사용합니다.</p><p>${SPEED_LIMIT_KMH}km/h 초과가 ${SPEEDING_THRESHOLD_SECONDS}초 지속되거나 움직이는 중 차량과 충돌하면 추격이 시작됩니다.</p><p>경찰과 42m 이상 ${ESCAPE_SECONDS}초 연속 떨어져 있으면 해제됩니다. 거리가 좁혀지면 시간이 초기화됩니다.</p><p>P / ESC 일시정지 · R 재시작</p><hr><small>업데이트 내역 · 2026.09.08<br>위반 후 경찰 추격과 도주 HUD 추가</small></div></div><div id="result" class="result" hidden><p class="eyebrow" id="result-kicker">RUN COMPLETE</p><h2 id="result-title">ESCAPED</h2><p id="result-copy">모든 체크포인트를 통과했습니다.</p><button id="restart" class="primary">다시 달리기 <span>↻</span></button></div></main>`;
const modalCard = app.querySelector(".modal-card");
if (modalCard) {
  modalCard.innerHTML = modalCard.innerHTML
    .replace("움직이는 중 차량과 충돌하면", "다른 차에 들이받으면")
    .replace(
      "업데이트 내역 · 2026.09.08<br>위반 후 경찰 추격과 도주 HUD 추가",
      "업데이트 내역 · 2026.09.08<br>미니맵에 일반 차량 위치·진행 방향 표시 추가<br>NPC 예측 제동·교차 양보·안전 간격 회피 추가<br>위반 후 경찰 추격과 도주 HUD 추가",
    );
}
app.querySelector(".start-card p:nth-of-type(2)")?.replaceChildren(
  document.createTextNode(`처음에는 평화로운 자유 주행입니다. ${SPEED_LIMIT_KMH}km/h를 ${SPEEDING_THRESHOLD_SECONDS}초 넘기거나 다른 차에 들이받을 때만 경찰 추격이 시작됩니다.`),
);
const mapLegend = document.createElement("div");
mapLegend.className = "map-legend";
mapLegend.setAttribute("aria-label", "미니맵 범례");
mapLegend.innerHTML =
  '<span><i class="legend-dot legend-player"></i>나</span><span><i class="legend-dot legend-traffic"></i>일반차</span><span><i class="legend-dot legend-police"></i>경찰</span>';
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
addEventListener("keydown", (event) => {
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
document.querySelector("#help")!.addEventListener("click", () => {
  statusBeforeHelp = state.status;
  if (state.status === "playing") state.status = "paused";
  modal.hidden = false;
});
document.querySelector("#close")!.addEventListener("click", () => {
  modal.hidden = true;
  if (statusBeforeHelp === "playing") state.status = "playing";
});
document.querySelectorAll<HTMLButtonElement>("[data-key]").forEach((button) => {
  const key = button.dataset.key as keyof Input;
  const down = (event: Event) => {
    event.preventDefault();
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
  context.lineWidth = 4;
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
  ) => {
    const x = 75 + (car.pos.x / WORLD) * 62;
    const y = 75 + (car.pos.z / WORLD) * 62;
    const forward = { x: Math.sin(car.heading), y: Math.cos(car.heading) };
    const side = { x: forward.y, y: -forward.x };
    const tip = { x: x + forward.x * 4.2, y: y + forward.y * 4.2 };
    const left = {
      x: x - forward.x * 2.4 + side.x * 2.1,
      y: y - forward.y * 2.4 + side.y * 2.1,
    };
    const right = {
      x: x - forward.x * 2.4 - side.x * 2.1,
      y: y - forward.y * 2.4 - side.y * 2.1,
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
  state.traffic.forEach((car) => directionMarker(car, "#d8f7ff"));
  state.police.forEach((car) => dot(car.pos, state.wanted ? "#ff4769" : "#7f829d", 3));
  dot(state.player.pos, "#23ddd0", 5);
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
