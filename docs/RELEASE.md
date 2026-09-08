# City Pursuit release checklist

이 문서는 `WBmaker2/city-pursuit` 공개 저장소와 GitHub Pages 릴리스 절차 및 실제 결과를 기록합니다.

## 현재 상태

- 소스 구현과 최종 게임 검토: 완료
- `package-lock.json` 생성 및 `npm ci` 확인: 완료
- GitHub 저장소 `WBmaker2/city-pursuit`: 공개 완료
- GitHub Pages Actions 실행: 성공
- 공개 플레이 URL: https://wbmaker2.github.io/city-pursuit/

## 로컬 검증

게임 소스와 `package-lock.json`이 준비된 뒤 프로젝트 루트에서 실행합니다.

```bash
npm ci
npm test
npm run build
```

공개 배포에서 W+Shift 운전, 체크포인트 진행, 일시정지, 모바일 터치, 반응형 레이아웃, 콘솔·네트워크 오류를 확인했습니다. 진단 상태 주입으로 충돌·실패·승리·재시작도 확인했습니다. VoiceOver 검증은 범위에서 제외합니다. 자세한 내용은 [docs/TESTING.md](./TESTING.md)를 참조합니다.

## GitHub 공개 및 Pages

사용자 승인 계정은 `WBmaker2`이며 대상 저장소는 `WBmaker2/city-pursuit`입니다. 최종 게임 검토 후 아래 순서로 실행했습니다.

```bash
git init -b main
git add .
git commit -m "Build City Pursuit 3D chase game"
gh repo create WBmaker2/city-pursuit --public --source=. --remote=origin
gh api repos/WBmaker2/city-pursuit/pages -X POST -f build_type=workflow
git push -u origin main
```

`.github/workflows/deploy.yml`은 `main` 푸시 또는 수동 실행 시 `npm ci`, `npm test`, `npm run build`를 수행하고 `dist/`를 Pages artifact로 배포합니다. 첫 Actions 실행이 성공한 뒤 저장소의 Pages 설정과 배포 URL을 확인하고, 실제 공개 페이지에서 정적 에셋과 플레이 루프를 다시 검증합니다.

## 릴리스 후 기록

### 2026-09-08 위반 후 경찰 추격 업데이트

- 평화로운 시작 상태와 과속·이동 중 차량 충돌 기반 wanted 전환
- 경찰 추격 중 42m 이상 거리 10초 유지 시 독립 해제
- 사유, 남은 시간, 재접근 초기화 안내를 포함한 반응형 HUD
- 단위 테스트 19/19 및 production preview 브라우저 QA 통과

실제 실행 결과:

- 초기 릴리스 커밋 SHA: `c281f8f1805e5551086b23a6ddbdd5b325565035`
- 초기 Pages Actions 실행: [34201326888](https://github.com/WBmaker2/city-pursuit/actions/runs/34201326888), 성공
- 공개 URL: [https://wbmaker2.github.io/city-pursuit/](https://wbmaker2.github.io/city-pursuit/)
- 공개 브라우저 확인: `?debug` 입력·상태·텍스처·반응형 검증 완료
- 문서 갱신 커밋: 이 문서의 후속 커밋으로 기록
- 남은 문제: Vite 번들 크기 경고(약 2.6MB, gzip 923KB), native raster screenshot 캡처는 도구 timeout으로 미실행

### 2026-09-08 교통 회피 후속 릴리스

- 일반 차량의 예측 제동, 교차 양보, 안전 간격, 점유된 경계 재등장 대기 추가
- `npm test` 31/31, `npm run build` 성공
- production preview에서 정지 플레이어·추종·교차·재출발·W키 운전 시나리오 확인
- 진단 state injection 결과와 실제 키보드 결과를 분리해 기록

### 2026-09-08 미니맵 교통 표시 후속 릴리스

- 미니맵에 모든 일반 NPC 차량의 현재 위치와 진행 방향을 밝은 청백색 삼각형으로 표시
- 플레이어·일반차·경찰을 구분하는 모바일 대응 범례 추가
- 모바일 추격 패널을 y=296으로 조정해 오른쪽 HUD와 13px 간격 확보
- `npm test` 32/32, `npm run build` 성공
- 실제 canvas 그리기 호출·debug 상태·DOM 범례·390×844 `scrollWidth`를 production preview에서 확인
- VoiceOver 및 raster screenshot 검증은 기존 릴리스 범위와 동일하게 제외
- 커밋 SHA: `16cb10d`
- Pages Actions 실행: [34221958775](https://github.com/WBmaker2/city-pursuit/actions/runs/34221958775), 성공
- 공개 URL: [https://wbmaker2.github.io/city-pursuit/](https://wbmaker2.github.io/city-pursuit/), HTTP 200 확인
