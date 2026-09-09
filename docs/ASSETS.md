# Visual asset provenance

`public/assets/city-atlas.png`는 이전 생성 원본으로 보존하고, 2026.09.09 승인 후보는 `public/assets/city-atlas-2026-09-09.png`로 원본 바이트 그대로 추가했습니다. 새 atlas의 네 사분면은 도로 아스팔트, 건물 파사드, teal 차량 도장, 시네마틱 레퍼런스로 구성되며 브라우저 캔버스에서 사분면을 잘라 공유하는 `sRGB CanvasTexture`로 사용합니다.

`public/assets/checkpoint-decal-2026-09-09.png`는 투명 배경의 체크포인트 링·화살표 데칼입니다. 공유 `MeshBasicMaterial`과 `depthWrite: false`로 도로 표식 위 `y=0.13`에 배치하며, 현재 다음 체크포인트에만 보입니다. 화살표는 각 경로의 이전 지점에서 현재 지점으로 향하고, 마지막 대각선 데이터 구간은 도시 격자에 맞춰 Z축 접근 방향을 사용합니다.

## 2026.09.09 승인 후보 provenance

- 후보 비교 폴더: `output/asset-review-2026-09-09/`
- 선택 파일: `candidate-atlas.png`, `checkpoint-decal.png`
- 생성 출처: ChatGPT built-in image generation (사용자 승인)
- `city-atlas-2026-09-09.png` SHA-1: `36075082bc7f39deae9c79fc4a3a4df6a6cfd95c`
- `checkpoint-decal-2026-09-09.png` SHA-1: `9309715187531ed08b92ab7ae5f3db0d3f6fbee1`

정확한 생성 프롬프트와 생성 기록은 [IMAGE-PROMPT.md](./IMAGE-PROMPT.md)에 있습니다. Higgsfield 생성은 무료 Private workspace의 크레딧 부족으로 완료되지 않았습니다.
