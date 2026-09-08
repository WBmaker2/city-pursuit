# City Pursuit release checklist

이 문서는 `WBmaker2/city-pursuit` 공개 저장소와 GitHub Pages 릴리스 절차를 기록합니다. 현재 문서 작성 시점에는 저장소 생성, 커밋, 푸시, Actions 실행, Pages 공개 URL을 아직 확인하지 않았습니다.

## 현재 상태

- 소스 구현과 최종 게임 검토: 대기 중
- `package-lock.json` 생성 및 `npm ci` 확인: 대기 중
- GitHub 저장소 `WBmaker2/city-pursuit`: 미생성 상태로 확인됨
- GitHub Pages Actions 실행: 대기 중
- 공개 플레이 URL: 아직 없음

## 로컬 검증

게임 소스와 `package-lock.json`이 준비된 뒤 프로젝트 루트에서 실행합니다.

```bash
npm ci
npm test
npm run build
```

배포 전에는 개발 서버와 ego-browser에서 실제 키보드 운전, 체크포인트 순서, 충돌·실패·재시작, 일시정지, 좁은 화면, 콘솔 오류를 확인합니다. VoiceOver 검증은 범위에서 제외합니다.

## GitHub 공개 및 Pages

사용자 승인 계정은 `WBmaker2`이며 대상 저장소는 `WBmaker2/city-pursuit`입니다. 최종 게임 검토가 끝난 뒤 아래 순서로 실행합니다.

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

아래 항목은 실제 실행 결과로 채웁니다.

- 커밋 SHA: 대기 중
- GitHub Actions 실행: 대기 중
- 공개 URL: 대기 중
- 공개 브라우저 확인: 대기 중
- 남은 문제: 대기 중
