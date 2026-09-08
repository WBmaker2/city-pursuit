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

WASD 또는 방향키로 운전합니다. `S`는 감속·후진, `Shift`는 부스트, `Space`는 핸드브레이크, `P` 또는 `Esc`는 일시정지, `R`은 재시작입니다. 작은 화면에서는 화면 하단 터치 버튼을 사용할 수 있습니다.

개발 환경에서 URL에 `?debug`를 붙이면 QA용 `render_game_to_text()`, `advanceTime(ms)`, `setGameState()` hooks가 노출됩니다.

## 현재 검증 상태

최종 검증에서 W+Shift 주행, 조향·핸드브레이크, P 일시정지, 충돌·타임아웃 실패, 재시작, 5개 체크포인트 승리, 390px 모바일 터치와 overflow를 확인했습니다. 상세 증거는 [docs/TESTING.md](./docs/TESTING.md)에 기록했습니다.

## 에셋과 업데이트

생성된 atlas는 [public/assets/city-atlas.png](./public/assets/city-atlas.png)이며, 프롬프트와 provenance는 [docs/IMAGE-PROMPT.md](./docs/IMAGE-PROMPT.md), 상세 기록은 [docs/ASSETS.md](./docs/ASSETS.md)에 있습니다.

2026.09.08 — 첫 공개: 도시 그리드, 운전 물리, 교통·경찰 추격, 순서형 체크포인트, 점수·데미지·미니맵 HUD, 모바일 조작. ChatGPT 이미지 생성 모델의 atlas를 도로·외벽·차량 재질에 적용했습니다.
