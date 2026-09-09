export function shellMarkup(speedLimit: number, speedingSeconds: number, escapeSeconds: number, normalKmh = 96, boostKmh = 272) {
  return `<main class="game-shell">
    <div id="fallback" class="fallback" hidden><strong>이 브라우저에서는 3D 화면을 열 수 없습니다.</strong><span id="fallback-copy">WebGL을 켜거나 최신 브라우저에서 다시 시도해 주세요.</span><button id="fallback-reload" class="primary">다시 불러오기</button></div>
    <section class="start-card" id="start-card"><p class="eyebrow">NEON DISTRICT · 01</p><h1>CITY <em>PURSUIT</em></h1><p>처음에는 평화로운 자유 주행입니다. ${speedLimit}km/h를 ${speedingSeconds}초 넘기거나 다른 차에 들이받을 때만 경찰 추격이 시작됩니다.</p><button id="start" class="primary gi-pulse">주행 시작 <span>↗</span></button><div class="keys"><span>WASD / 방향키</span><span>운전</span><span>SHIFT</span><span>부스트</span><span>SPACE</span><span>핸드브레이크</span><span>S / ↓</span><span>브레이크·후진</span></div></section>
    <section id="hud" class="hud" hidden><div class="topbar"><div class="logo">CITY <em>PURSUIT</em><small>NEON DISTRICT // NIGHT RUN</small></div><div class="stats"><div><small>SPEED</small><b id="speed">0</b><i>KM/H</i></div><div><small>SCORE</small><b id="score">0</b><i>PTS</i></div><div><small>GATES</small><b id="cp">0/5</b><i>ROUTE</i></div><div><small>TIME</small><b id="timer">180</b><i>SEC</i></div></div><button id="pause" class="icon-button" aria-label="일시정지">Ⅱ</button></div><div class="mission"><small>NEXT OBJECTIVE</small><strong id="mission">CHECKPOINT 01</strong><span id="hint">황금 게이트를 통과하세요</span></div><aside class="right-rail"><canvas id="map" width="150" height="150" aria-label="차량 위치와 방향 미니맵"></canvas><div class="meters"><div><span>VEHICLE</span><b id="damage">100%</b></div><div><span>PURSUIT</span><b id="pursuit">CALM</b></div></div></aside><aside id="wanted-panel" class="wanted-panel" hidden><strong id="wanted-title">⚠ 경찰 추격</strong><span id="wanted-reason"></span><b id="escape-countdown"></b><small>경찰과 42m 이상 거리를 ${escapeSeconds}초 연속 유지하면 추격이 해제됩니다. 가까워지면 시간이 초기화됩니다.</small></aside><div class="help-actions"><button id="help" class="help gi-pulse">조작법 안내</button><button id="updates" class="help">업데이트 내역</button></div><div id="touch" class="touch"><button data-key="left">◀</button><button data-key="up">▲</button><button data-key="down">▼</button><button data-key="right">▶</button><button data-key="boost">BOOST</button></div></section>
    <div id="modal" class="modal" hidden><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><button id="close" class="close" aria-label="닫기">×</button><p class="eyebrow">DRIVER BRIEFING</p><div class="modal-tabs" role="tablist" aria-label="안내 종류"><button id="controls-tab" role="tab" aria-controls="controls-panel">조작법 안내</button><button id="updates-tab" role="tab" aria-controls="updates-panel">업데이트 내역</button></div><div id="controls-panel" role="tabpanel" aria-labelledby="controls-tab"><h2 id="modal-title">조작법 안내</h2><p>WASD 또는 방향키로 운전합니다. 일반 주행은 ${normalKmh}km/h, W+SHIFT를 함께 누르면 부스트가 ${boostKmh}km/h까지 올라갑니다.</p><p>좌우 방향키와 A/D는 부드럽게 회전하고, SPACE는 핸드브레이크입니다. S / ↓는 브레이크·후진입니다. ${speedLimit}km/h 초과가 ${speedingSeconds}초 지속되거나 다른 차에 들이받으면 추격이 시작됩니다.</p><p>경찰과 42m 이상 ${escapeSeconds}초 연속 떨어져 있으면 해제됩니다. P / ESC는 일시정지, R은 재시작입니다.</p></div><div id="updates-panel" role="tabpanel" aria-labelledby="updates-tab" hidden><h2 id="updates-title">업데이트 내역</h2><p><strong>2026.09.09</strong><br>일반 주행과 부스트 속도 제한을 조정하고, 미니맵에 모든 차량의 진행 방향을 표시했습니다.<br>조작법 안내와 업데이트 내역을 별도 버튼으로 나누고, 작은 화면에서도 읽을 수 있게 개선했습니다.<br>좌우 방향키와 A/D의 일반 회전 민감도를 낮췄습니다.<br>새 도로·외벽·차량 도장과 경로 방향 체크포인트 그래픽을 적용했습니다.<br>도로 폭 확장·우측 통행·밝은 도시 조명을 개선했습니다.</p><p><strong>2026.09.08</strong><br>플레이어 가속·최고속도와 부스트 돌파력을 강화했습니다.<br>충돌 시 차량을 밀어내고 전진 운동량을 유지했습니다.<br>NPC 예측 제동·교차 양보·안전 간격 회피를 추가했습니다.<br>위반 후 경찰 추격과 도주 HUD를 추가했습니다.</p></div></section></div>
    <div id="result" class="result" hidden><p class="eyebrow" id="result-kicker">RUN COMPLETE</p><h2 id="result-title">ESCAPED</h2><p id="result-copy">모든 체크포인트를 통과했습니다.</p><button id="restart" class="primary">다시 달리기 <span>↻</span></button></div>
  </main>`;
}

export function setupModal(modal: HTMLElement, onOpen: (source: HTMLElement) => void, onClose: () => void) {
  const card = modal.querySelector<HTMLElement>(".modal-card")!;
  const close = modal.querySelector<HTMLButtonElement>("#close")!;
  const controlsTab = modal.querySelector<HTMLButtonElement>("#controls-tab")!;
  const updatesTab = modal.querySelector<HTMLButtonElement>("#updates-tab")!;
  const controlsPanel = modal.querySelector<HTMLElement>("#controls-panel")!;
  const updatesPanel = modal.querySelector<HTMLElement>("#updates-panel")!;
  let previousFocus: HTMLElement | null = null;
  const select = (updates: boolean) => {
    controlsPanel.hidden = updates;
    updatesPanel.hidden = !updates;
    controlsTab.setAttribute("aria-selected", String(!updates));
    updatesTab.setAttribute("aria-selected", String(updates));
    card.setAttribute("aria-labelledby", updates ? "updates-title" : "modal-title");
  };
  select(false);
  const open = (updates: boolean, source: HTMLElement) => {
    previousFocus = document.activeElement as HTMLElement | null;
    select(updates);
    onOpen(source);
    modal.hidden = false;
    close.focus();
  };
  const dismiss = () => {
    modal.hidden = true;
    onClose();
    previousFocus?.focus();
  };
  close.addEventListener("click", dismiss);
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(card.querySelectorAll<HTMLElement>("button, [tabindex]:not([tabindex='-1'])"));
    if (!focusable.length) return;
    const current = focusable.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey
      ? (current <= 0 ? focusable.length - 1 : current - 1)
      : (current === focusable.length - 1 ? 0 : current + 1);
    event.preventDefault();
    focusable[next].focus();
  });
  controlsTab.addEventListener("click", () => select(false));
  updatesTab.addEventListener("click", () => select(true));
  return { open, dismiss, isOpen: () => !modal.hidden, card };
}
