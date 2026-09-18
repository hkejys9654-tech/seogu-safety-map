# 카카오맵 설정 안내

이 프로젝트는 카카오맵 JavaScript 키를 저장소 파일에 기록하지 않습니다. 로컬에서는 `.env.local`, GitHub Pages에서는 Actions secret을 사용해 배포 파일을 생성합니다.

## 로컬 실행

1. `.env.example`을 복사해 `.env.local`을 만듭니다.
2. `KAKAO_MAP_JAVASCRIPT_KEY=` 뒤에 카카오 JavaScript 키를 입력합니다.
3. 다음 명령으로 배포용 폴더를 만듭니다.

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/build-site.ps1
   powershell -ExecutionPolicy Bypass -File scripts/serve-site.ps1
   ```

4. 브라우저에서 `http://localhost:4173/`과 `http://localhost:4173/admin/`을 확인합니다.
5. 로컬 테스트를 하려면 카카오 Developers의 JavaScript SDK 허용 도메인에 `http://localhost:4173`도 등록합니다.

## GitHub Pages 배포

1. GitHub 저장소의 `Settings > Secrets and variables > Actions`로 이동합니다.
2. `New repository secret`을 누릅니다.
3. 이름을 `KAKAO_MAP_JAVASCRIPT_KEY`로 지정하고 JavaScript 키를 저장합니다.
4. `Settings > Pages > Build and deployment > Source`를 `GitHub Actions`로 선택합니다.
5. `Deploy GitHub Pages` 작업을 다시 실행합니다.

JavaScript 지도 키는 브라우저에서 SDK를 호출할 때 전달되므로 배포된 페이지의 네트워크 요청에서는 보일 수 있습니다. 카카오 Developers의 JavaScript SDK 허용 도메인 제한이 실제 접근 통제 수단입니다.
