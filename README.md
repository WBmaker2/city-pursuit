# City Pursuit

따뜻한 황혼빛 3D 도시에서 교통을 피하고 체크포인트를 통과하며 경찰을 따돌리는 브라우저 게임입니다.

공개 플레이: [WBmaker2.github.io/city-pursuit](https://wbmaker2.github.io/city-pursuit/)
소스 저장소: [github.com/WBmaker2/city-pursuit](https://github.com/WBmaker2/city-pursuit)
소스 다운로드: [main.zip](https://github.com/WBmaker2/city-pursuit/archive/refs/heads/main.zip)

## 실행

```bash
npm install
npm run dev -- --port 5187
npm test
npm run build
```

## 조작

WASD 또는 방향키로 운전합니다. 일반 주행은 `96km/h`, `W+Shift` 부스트는 `272km/h`까지입니다. `S`는 감속·후진, `Space`는 핸드브레이크, `P` 또는 `Esc`는 일시정지, `R`은 재시작입니다. 표시 속도 `120km/h`를 `1.5초` 연속 초과하거나 움직이는 중 다른 차량과 충돌할 때만 경찰 추격이 시작됩니다. 경찰과 `42m` 이상 거리를 `10초` 연속 유지하면 추격이 해제되고, 가까워지면 도주 시간이 초기화됩니다. 작은 화면에서는 화면 하단 터치 버튼을 사용할 수 있습니다.

개발 환경에서 URL에 `?debug`를 붙이면 QA용 `render_game_to_text()`, `advanceTime(ms)`, `setGameState()` hooks가 노출됩니다.

## 현재 검증 상태

최종 검증에서 평화 시작, 위반 사유별 추격, 도주 타이머·해제, 재추격·재시작, W+Shift 주행, 조향·핸드브레이크, P 일시정지, 충돌·타임아웃 실패, 5개 체크포인트 승리, 390px 모바일 터치와 overflow를 확인했습니다. 상세 증거는 [docs/TESTING.md](./docs/TESTING.md)에 기록했습니다.

## 에셋과 업데이트

2026.09.09 — 조작법 안내와 업데이트 내역을 별도 버튼으로 제공하고, 모달 키보드 조작과 모바일 화면 대응을 개선했습니다.

2026.09.09 — 좌우 방향키와 A/D의 일반 회전 민감도를 20% 낮춰 더 부드럽게 조정했습니다. 핸드브레이크 회전은 유지됩니다.

2026.09.09 — 도로 폭을 12m로 넓히고 네 방향 우측 차로, 차로 복귀, 교차로 기반 경찰 웨이포인트를 적용했습니다. 건물 반폭·차량 충돌 여유를 공통 치수로 맞추고, 늦은 오후 하늘·안개·환경광을 밝게 조정했습니다.

생성된 atlas는 [public/assets/city-atlas-2026-09-09.png](./public/assets/city-atlas-2026-09-09.png)이며, 기존 [city-atlas.png](./public/assets/city-atlas.png)는 보존합니다. 체크포인트 데칼은 [checkpoint-decal-2026-09-09.png](./public/assets/checkpoint-decal-2026-09-09.png)입니다. 프롬프트와 provenance는 [docs/IMAGE-PROMPT.md](./docs/IMAGE-PROMPT.md), 상세 기록은 [docs/ASSETS.md](./docs/ASSETS.md)에 있습니다.

2026.09.09 — 승인 후보: 새 도로·건물 외벽·차량 도장 atlas와 경로 방향 체크포인트 데칼을 추가했습니다. 데칼은 현재 다음 목표에만 표시됩니다.

2026.09.08 — 첫 공개: 도시 그리드, 운전 물리, 교통·경찰 추격, 순서형 체크포인트, 점수·데미지·미니맵 HUD, 모바일 조작. ChatGPT 이미지 생성 모델의 atlas를 도로·외벽·차량 재질에 적용했습니다.

2026.09.08 — 위반 후 추격: 평화 시작, 과속 지연 신고, 이동 중 충돌 신고, 42m·10초 도주 해제, 추격 상태 HUD를 추가했습니다.

2026.09.08 — 교통 회피: 일반 차량이 스냅샷 기반 전방 감속·교차 양보·안전 간격 검사를 수행합니다. 좁은 도로에서는 무리한 조향 대신 정차하며, 경계 재등장 위치가 점유된 경우 기다렸다가 재출발합니다.

2026.09.08 — 플레이어 파워: 일반 주행이 경찰 순항보다 빠르게 실제 가속되고, Shift 부스트는 더 높은 상한을 사용합니다. 차량 충돌은 플레이어의 전진 운동량을 보존하면서 상대 차량에 감쇠 충격을 전달해 여러 프레임 동안 밀어냅니다.
